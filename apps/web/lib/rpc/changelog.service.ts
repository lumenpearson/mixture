import "server-only"
import { create } from "@bufbuild/protobuf"
import type { ServiceImpl } from "@connectrpc/connect"
import {
  ChangelogSchema,
  ChangelogService,
  CommitSchema,
  EventSchema,
  ItemSchema,
  type Changelog,
  type Commit,
  type Event,
  type ContributorStats,
  type BranchStats,
  type DayStats,
  type LanguageStat,
  type RepoSmallItem,
} from "@mixture/protocol/changelog"

/* ------------------------------------------------------------------ *
 * ChangelogService — live GitHub changelog over ConnectRPC / gRPC-Web
 *
 * The repository defaults to the project itself and can be pointed elsewhere
 * with MIXTURE_GITHUB_REPO ("owner/name"). A token (MIXTURE_GITHUB_TOKEN or
 * GITHUB_TOKEN) raises the API rate limit; without one the public limit of
 * 60 requests per hour applies and the 30 second server cache matters.
 * ------------------------------------------------------------------ */

const DEFAULT_REPO = "lumenpearson/mixture"
const API = "https://api.github.com"

const MAX_BRANCHES_WITH_COMMITS = 32
const MAX_COMMIT_PAGES_PER_BRANCH = 2
const MAX_EVENT_PAGES = 2
const GITHUB_PAGE_SIZE = 50
const CACHE_TTL_MS = 30_000
const STALE_TTL_MS = 5 * 60_000
const FORCE_REFRESH_MIN_INTERVAL_MS = 5_000

function repoSlug(): { owner: string; repo: string } {
  const raw = (process.env.MIXTURE_GITHUB_REPO ?? DEFAULT_REPO).trim()
  const [owner, repo] = raw.split("/")
  if (!owner || !repo) return { owner: "lumenpearson", repo: "mixture" }
  return { owner, repo }
}

type RepositoryResponse = {
  full_name: string
  html_url?: string
  description?: string | null
  private?: boolean
  fork?: boolean
  default_branch?: string
  language?: string | null
  stargazers_count?: number
  watchers_count?: number
  forks_count?: number
  open_issues_count?: number
  size?: number
  created_at?: string
  updated_at?: string
  pushed_at?: string
  license?: { spdx_id?: string | null; name?: string | null } | null
  owner?: { login?: string; avatar_url?: string; html_url?: string }
}

type BranchResponse = {
  name: string
  protected?: boolean
  commit?: { sha?: string; url?: string }
}

type CommitResponse = {
  sha: string
  html_url?: string
  commit?: {
    message?: string
    author?: { name?: string; email?: string; date?: string }
    committer?: { name?: string; date?: string }
  }
  author?: { login?: string; avatar_url?: string; html_url?: string } | null
  committer?: { login?: string; avatar_url?: string; html_url?: string } | null
  parents?: { sha: string }[]
}

type EventResponse = {
  id: string
  type: string
  created_at: string
  actor?: { login?: string; avatar_url?: string; url?: string }
  payload?: Record<string, unknown>
  public?: boolean
}

type ContributorResponse = {
  login?: string
  avatar_url?: string
  html_url?: string
  contributions?: number
  type?: string
}

type ReleaseResponse = {
  id: number
  name?: string | null
  tag_name?: string
  html_url?: string
  draft?: boolean
  prerelease?: boolean
  published_at?: string | null
  created_at?: string
}

type TagResponse = {
  name: string
  zipball_url?: string
  tarball_url?: string
  commit?: { sha?: string; url?: string }
}

type IssueLikeResponse = {
  id: number
  number?: number
  title?: string
  html_url?: string
  state?: string
  created_at?: string
  updated_at?: string
  user?: { login?: string; avatar_url?: string }
  pull_request?: unknown
}

let cachedPayload: Changelog | null = null
let cachedAt = 0
let lastForcedAt = 0
let inflight: Promise<Changelog> | null = null

async function github<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "mixture-changelog",
  }
  const token = process.env.MIXTURE_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API}${path}`, { headers, cache: "no-store" })
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${path}`)
  }
  return (await res.json()) as T
}

async function githubPages<T>(path: string, maxPages: number): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    const separator = path.includes("?") ? "&" : "?"
    const chunk = await github<T[]>(`${path}${separator}per_page=${GITHUB_PAGE_SIZE}&page=${page}`)
    rows.push(...chunk)
    if (chunk.length < GITHUB_PAGE_SIZE) break
  }
  return rows
}

async function mapLimit<T, R>(
  rows: T[],
  limit: number,
  mapper: (row: T, index: number) => Promise<R>,
): Promise<R[]> {
  const result: R[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, rows.length) }, async () => {
    while (cursor < rows.length) {
      const index = cursor
      cursor += 1
      result[index] = await mapper(rows[index], index)
    }
  })
  await Promise.all(workers)
  return result
}

const firstLine = (message: string | undefined): string =>
  (message ?? "untitled commit").split("\n")[0]?.trim() || "untitled commit"

const restLines = (message: string | undefined): string =>
  (message ?? "").split("\n").slice(1).join("\n").trim()

function dayIso(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "unknown"
  return date.toISOString().slice(0, 10)
}

function eventBranch(payload: Record<string, unknown> | undefined): string {
  const ref = payload?.ref
  if (typeof ref !== "string") return ""
  return ref.replace(/^refs\/heads\//, "")
}

function eventUrl(payload: Record<string, unknown> | undefined): string {
  for (const key of ["pull_request", "issue", "release"] as const) {
    const value = payload?.[key]
    if (value && typeof value === "object" && "html_url" in value && typeof value.html_url === "string") {
      return value.html_url
    }
  }
  return ""
}

function describeEvent(event: EventResponse): Event {
  const payload = event.payload ?? {}
  const actor = event.actor?.login ?? "github"
  const branch = eventBranch(payload)
  const type = event.type.replace(/Event$/, "")

  let title = type
  let description = "repository event"

  if (event.type === "PushEvent") {
    const commits = Array.isArray(payload.commits) ? payload.commits.length : 0
    title = `push${branch ? ` · ${branch}` : ""}`
    description = commits ? `${commits} commit${commits === 1 ? "" : "s"}` : "branch update"
  } else if (event.type === "CreateEvent") {
    const refType = typeof payload.ref_type === "string" ? payload.ref_type : "ref"
    title = `created ${refType}`
    description = branch ? branch : "new repository ref"
  } else if (event.type === "DeleteEvent") {
    const refType = typeof payload.ref_type === "string" ? payload.ref_type : "ref"
    title = `deleted ${refType}`
    description = branch ? branch : "removed repository ref"
  } else if (event.type === "PullRequestEvent") {
    const action = typeof payload.action === "string" ? payload.action : "updated"
    const pr = payload.pull_request
    const prTitle =
      pr && typeof pr === "object" && "title" in pr && typeof pr.title === "string" ? pr.title : "pull request"
    title = `pull request · ${action}`
    description = prTitle
  } else if (event.type === "IssuesEvent") {
    const action = typeof payload.action === "string" ? payload.action : "updated"
    const issue = payload.issue
    const issueTitle =
      issue && typeof issue === "object" && "title" in issue && typeof issue.title === "string"
        ? issue.title
        : "issue"
    title = `issue · ${action}`
    description = issueTitle
  } else if (event.type === "ReleaseEvent") {
    const action = typeof payload.action === "string" ? payload.action : "updated"
    title = `release · ${action}`
    description = "release update"
  }

  return create(EventSchema, {
    id: `event-${event.id}`,
    slug: `event-${event.id}`,
    eventType: event.type,
    title,
    description,
    date: event.created_at,
    actor,
    avatarUrl: event.actor?.avatar_url ?? "",
    branch,
    url: eventUrl(payload),
  })
}

function latest(values: string[]): string {
  const sorted = values.filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  return sorted[0] ?? ""
}

function buildContributorStats(
  contributorsRaw: ContributorResponse[],
  commits: Commit[],
  events: Event[],
): ContributorStats[] {
  const map = new Map<string, ContributorStats>()
  const blank = (login: string, avatarUrl: string): ContributorStats => ({
    $typeName: "mixture.changelog.v1.ContributorStats",
    login,
    avatarUrl,
    url: "",
    contributions: 0,
    commits: 0,
    events: 0,
    lastActiveAt: "",
    score: 0,
  })

  for (const contributor of contributorsRaw) {
    const login = contributor.login ?? "unknown"
    map.set(login, {
      ...blank(login, contributor.avatar_url ?? ""),
      url: contributor.html_url ?? "",
      contributions: contributor.contributions ?? 0,
      score: contributor.contributions ?? 0,
    })
  }

  for (const commit of commits) {
    const login = commit.authorLogin || commit.author
    const current = map.get(login) ?? blank(login, commit.avatarUrl)
    current.commits += 1
    current.lastActiveAt = latest([current.lastActiveAt, commit.date])
    current.score = current.contributions + current.commits * 3 + current.events
    if (!current.avatarUrl) current.avatarUrl = commit.avatarUrl
    map.set(login, current)
  }

  for (const event of events) {
    const current = map.get(event.actor) ?? blank(event.actor, event.avatarUrl)
    current.events += 1
    current.lastActiveAt = latest([current.lastActiveAt, event.date])
    current.score = current.contributions + current.commits * 3 + current.events
    if (!current.avatarUrl) current.avatarUrl = event.avatarUrl
    map.set(event.actor, current)
  }

  return [...map.values()].sort((a, b) => b.score - a.score)
}

function buildDayStats(commits: Commit[], events: Event[]): DayStats[] {
  const map = new Map<string, DayStats>()
  const bump = (day: string, key: "commits" | "events") => {
    const stat =
      map.get(day) ?? { $typeName: "mixture.changelog.v1.DayStats" as const, day, commits: 0, events: 0, total: 0 }
    stat[key] += 1
    stat.total += 1
    map.set(day, stat)
  }
  for (const commit of commits) bump(dayIso(commit.date), "commits")
  for (const event of events) bump(dayIso(event.date), "events")
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day))
}

function buildLanguageStats(languages: Record<string, number>): LanguageStat[] {
  const total = Object.values(languages).reduce((sum, value) => sum + value, 0)
  if (!total) return []
  return Object.entries(languages)
    .map(([name, bytes]) => ({
      $typeName: "mixture.changelog.v1.LanguageStat" as const,
      name,
      bytes: BigInt(bytes),
      percent: Math.round((bytes / total) * 1000) / 10,
    }))
    .sort((a, b) => Number(b.bytes - a.bytes))
}

function smallItems(items: IssueLikeResponse[]): RepoSmallItem[] {
  return items.slice(0, 12).map((item) => ({
    $typeName: "mixture.changelog.v1.RepoSmallItem" as const,
    id: BigInt(item.id),
    number: item.number ?? 0,
    title: item.title ?? "item",
    state: item.state ?? "unknown",
    url: item.html_url ?? "",
    updatedAt: item.updated_at ?? "",
    author: item.user?.login ?? "unknown",
    avatarUrl: item.user?.avatar_url ?? "",
  }))
}

async function buildPayload(): Promise<Changelog> {
  const { owner: OWNER, repo: REPO } = repoSlug()
  const [repo, branches, contributorsRaw, languagesRaw, releasesRaw, tagsRaw, issuesRaw, pullsRaw] =
    await Promise.all([
      github<RepositoryResponse>(`/repos/${OWNER}/${REPO}`),
      github<BranchResponse[]>(`/repos/${OWNER}/${REPO}/branches?per_page=100`),
      githubPages<ContributorResponse>(`/repos/${OWNER}/${REPO}/contributors`, 1).catch(() => []),
      github<Record<string, number>>(`/repos/${OWNER}/${REPO}/languages`).catch(() => ({})),
      githubPages<ReleaseResponse>(`/repos/${OWNER}/${REPO}/releases`, 1).catch(() => []),
      githubPages<TagResponse>(`/repos/${OWNER}/${REPO}/tags`, 1).catch(() => []),
      githubPages<IssueLikeResponse>(`/repos/${OWNER}/${REPO}/issues?state=all`, 1).catch(() => []),
      githubPages<IssueLikeResponse>(`/repos/${OWNER}/${REPO}/pulls?state=all`, 1).catch(() => []),
    ])

  const branchStats = new Map<string, BranchStats>()
  const commitMap = new Map<string, Commit>()
  const branchesForCommits = branches.slice(0, MAX_BRANCHES_WITH_COMMITS)

  await mapLimit(branchesForCommits, 4, async (branch) => {
    const branchCommits = await githubPages<CommitResponse>(
      `/repos/${OWNER}/${REPO}/commits?sha=${encodeURIComponent(branch.name)}`,
      MAX_COMMIT_PAGES_PER_BRANCH,
    ).catch(() => [])

    branchStats.set(branch.name, {
      $typeName: "mixture.changelog.v1.BranchStats",
      name: branch.name,
      sha: branch.commit?.sha ?? "",
      protected: Boolean(branch.protected),
      commits: branchCommits.length,
      lastCommitAt: branchCommits[0]?.commit?.committer?.date ?? branchCommits[0]?.commit?.author?.date ?? "",
    })

    for (const commit of branchCommits) {
      const existing = commitMap.get(commit.sha)
      if (existing) {
        if (!existing.branches.includes(branch.name)) existing.branches.push(branch.name)
        continue
      }
      const message = commit.commit?.message ?? ""
      commitMap.set(
        commit.sha,
        create(CommitSchema, {
          id: `commit-${commit.sha}`,
          slug: `commit-${commit.sha.slice(0, 12)}`,
          sha: commit.sha,
          shortSha: commit.sha.slice(0, 7),
          title: firstLine(message),
          body: restLines(message),
          date: commit.commit?.committer?.date ?? commit.commit?.author?.date ?? new Date().toISOString(),
          url: commit.html_url ?? "",
          author: commit.author?.login ?? commit.commit?.author?.name ?? commit.committer?.login ?? "unknown",
          authorLogin: commit.author?.login ?? commit.committer?.login ?? "",
          avatarUrl: commit.author?.avatar_url ?? commit.committer?.avatar_url ?? "",
          branches: [branch.name],
          parentCount: commit.parents?.length ?? 0,
        }),
      )
    }
  })

  for (const branch of branches) {
    if (branchStats.has(branch.name)) continue
    branchStats.set(branch.name, {
      $typeName: "mixture.changelog.v1.BranchStats",
      name: branch.name,
      sha: branch.commit?.sha ?? "",
      protected: Boolean(branch.protected),
      commits: 0,
      lastCommitAt: "",
    })
  }

  const eventsRaw = await githubPages<EventResponse>(`/repos/${OWNER}/${REPO}/events`, MAX_EVENT_PAGES).catch(
    () => [],
  )
  const events = eventsRaw.map(describeEvent)
  const commits = [...commitMap.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const items = [
    ...commits.map((commit) => create(ItemSchema, { item: { case: "commit", value: commit } })),
    ...events.map((event) => create(ItemSchema, { item: { case: "event", value: event } })),
  ].sort((a, b) => new Date(b.item.value?.date ?? 0).getTime() - new Date(a.item.value?.date ?? 0).getTime())

  const contributors = buildContributorStats(contributorsRaw, commits, events)
  const eventTypeStats = Object.entries(
    events.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] ?? 0) + 1
      return acc
    }, {}),
  )
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  const openIssues = issuesRaw.filter((issue) => !issue.pull_request && issue.state === "open")
  const closedIssues = issuesRaw.filter((issue) => !issue.pull_request && issue.state === "closed")
  const openPulls = pullsRaw.filter((pull) => pull.state === "open")
  const closedPulls = pullsRaw.filter((pull) => pull.state === "closed")

  return create(ChangelogSchema, {
    repo: `${OWNER}/${REPO}`,
    generatedAt: new Date().toISOString(),
    source: "github-live",
    repository: {
      name: repo.full_name,
      url: repo.html_url ?? "",
      description: repo.description ?? "",
      private: Boolean(repo.private),
      fork: Boolean(repo.fork),
      defaultBranch: repo.default_branch ?? "main",
      primaryLanguage: repo.language ?? "",
      stars: repo.stargazers_count ?? 0,
      watchers: repo.watchers_count ?? 0,
      forks: repo.forks_count ?? 0,
      openIssues: repo.open_issues_count ?? 0,
      size: repo.size ?? 0,
      createdAt: repo.created_at ?? "",
      updatedAt: repo.updated_at ?? "",
      pushedAt: repo.pushed_at ?? "",
      license: repo.license?.spdx_id ?? repo.license?.name ?? "",
      owner: repo.owner
        ? {
            login: repo.owner.login ?? OWNER,
            avatarUrl: repo.owner.avatar_url ?? "",
            url: repo.owner.html_url ?? "",
          }
        : undefined,
    },
    branches: [...branchStats.values()].sort((a, b) => b.commits - a.commits),
    contributors,
    languages: buildLanguageStats(languagesRaw),
    releases: releasesRaw.map((release) => ({
      id: BigInt(release.id),
      name: release.name || release.tag_name || "release",
      tag: release.tag_name ?? "",
      url: release.html_url ?? "",
      draft: Boolean(release.draft),
      prerelease: Boolean(release.prerelease),
      publishedAt: release.published_at ?? release.created_at ?? "",
    })),
    tags: tagsRaw.map((tag) => ({
      name: tag.name,
      sha: tag.commit?.sha ?? "",
      zipballUrl: tag.zipball_url ?? "",
      tarballUrl: tag.tarball_url ?? "",
    })),
    issues: {
      open: openIssues.length,
      closed: closedIssues.length,
      recent: smallItems(issuesRaw.filter((issue) => !issue.pull_request)),
    },
    pulls: {
      open: openPulls.length,
      closed: closedPulls.length,
      recent: smallItems(pullsRaw),
    },
    stats: {
      days: buildDayStats(commits, events),
      eventTypes: eventTypeStats,
      totals: {
        commits: commits.length,
        events: events.length,
        branches: branches.length,
        contributors: contributors.length,
        releases: releasesRaw.length,
        tags: tagsRaw.length,
        languages: Object.keys(languagesRaw).length,
      },
    },
    commits,
    events,
    items,
    limits: {
      branchCommitLimit: MAX_BRANCHES_WITH_COMMITS,
      commitPagesPerBranch: MAX_COMMIT_PAGES_PER_BRANCH,
      eventPages: MAX_EVENT_PAGES,
      pageSize: GITHUB_PAGE_SIZE,
    },
  })
}

function emptyPayload(error: unknown): Changelog {
  const { owner, repo } = repoSlug()
  return create(ChangelogSchema, {
    repo: `${owner}/${repo}`,
    generatedAt: new Date().toISOString(),
    source: "github-live",
    issues: { open: 0, closed: 0, recent: [] },
    pulls: { open: 0, closed: 0, recent: [] },
    stats: { days: [], eventTypes: [], totals: {} },
    error: error instanceof Error ? error.message : "unknown changelog error",
  })
}

function refreshCache() {
  if (!inflight) {
    inflight = buildPayload()
      .then((payload) => {
        cachedPayload = payload
        cachedAt = Date.now()
        return payload
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** cache-aware changelog lookup; never throws */
export async function getChangelog(forceRefresh = false): Promise<{ changelog: Changelog; cacheState: string }> {
  const now = Date.now()
  const age = now - cachedAt
  const force = forceRefresh && now - lastForcedAt > FORCE_REFRESH_MIN_INTERVAL_MS
  if (force) lastForcedAt = now

  try {
    if (cachedPayload && !force && age < CACHE_TTL_MS) {
      return { changelog: cachedPayload, cacheState: "hit" }
    }
    if (cachedPayload && !force && age < STALE_TTL_MS) {
      void refreshCache().catch(() => {})
      return { changelog: cachedPayload, cacheState: "stale" }
    }
    const payload = await refreshCache()
    return { changelog: payload, cacheState: cachedPayload && !force ? "refreshed" : "miss" }
  } catch (error) {
    if (cachedPayload) {
      return {
        changelog: create(ChangelogSchema, {
          ...cachedPayload,
          error: error instanceof Error ? error.message : "unknown changelog error",
        }),
        cacheState: "stale-error",
      }
    }
    return { changelog: emptyPayload(error), cacheState: "error" }
  }
}

export const changelogServiceImpl: ServiceImpl<typeof ChangelogService> = {
  async getChangelog(req, ctx) {
    const result = await getChangelog(req.forceRefresh)
    ctx.responseHeader.set("Cache-Control", "no-store")
    ctx.responseHeader.set("X-Mixture-Cache", result.cacheState)
    return result
  },
}
