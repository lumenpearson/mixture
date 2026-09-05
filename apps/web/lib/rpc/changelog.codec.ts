import type { Changelog as PbChangelog } from "@mixture/protocol/changelog"

/* ------------------------------------------------------------------ *
 * changelog codec: mixture.changelog.v1.Changelog -> the plain JSON shape
 * the timeline section renders (and caches in sessionStorage). Empty wire
 * strings become null where the UI treats a value as optional; int64 fields
 * become numbers so the cache stays plain JSON.
 * ------------------------------------------------------------------ */

export type ChangelogCommit = {
  id: string
  slug: string
  kind: "commit"
  sha: string
  shortSha: string
  title: string
  body: string
  date: string
  url: string | null
  author: string
  authorLogin: string | null
  avatarUrl: string | null
  branches: string[]
  parentCount: number
}

export type ChangelogEvent = {
  id: string
  slug: string
  kind: "event"
  eventType: string
  title: string
  description: string
  date: string
  actor: string
  avatarUrl: string | null
  branch: string | null
  url: string | null
}

export type ChangelogItem = ChangelogCommit | ChangelogEvent

export type ContributorStats = {
  login: string
  avatarUrl: string | null
  url: string | null
  contributions: number
  commits: number
  events: number
  lastActiveAt: string | null
  score: number
}

export type BranchStats = {
  name: string
  sha: string | null
  protected: boolean
  commits: number
  lastCommitAt: string | null
}

export type LanguageStat = { name: string; bytes: number; percent: number }
export type DayStat = { day: string; commits: number; events: number; total: number }

export type RepoSmallItem = {
  id: number
  number: number | null
  title: string
  state: string
  url: string | null
  updatedAt: string | null
  author: string
  avatarUrl: string | null
}

export type ChangelogData = {
  repo: string
  generatedAt: string
  source: string
  repository: {
    name: string
    url: string | null
    description: string | null
    defaultBranch: string
    primaryLanguage: string | null
    stars: number
    watchers: number
    forks: number
    openIssues: number
    size: number
    createdAt: string | null
    updatedAt: string | null
    pushedAt: string | null
    license: string | null
  } | null
  branches: BranchStats[]
  contributors: ContributorStats[]
  languages: LanguageStat[]
  releases: {
    id: number
    name: string
    tag: string | null
    url: string | null
    publishedAt: string | null
  }[]
  tags: { name: string; sha: string | null }[]
  issues: { open: number; closed: number; recent: RepoSmallItem[] }
  pulls: { open: number; closed: number; recent: RepoSmallItem[] }
  stats: {
    days: DayStat[]
    eventTypes: { type: string; count: number }[]
    totals: Record<string, number>
  }
  commits: ChangelogCommit[]
  events: ChangelogEvent[]
  items: ChangelogItem[]
  error?: string
}

const orNull = (value: string): string | null => (value ? value : null)

function smallItem(item: PbChangelog["issues"] extends infer T ? (T extends { recent: (infer R)[] } ? R : never) : never): RepoSmallItem {
  return {
    id: Number(item.id),
    number: item.number || null,
    title: item.title,
    state: item.state,
    url: orNull(item.url),
    updatedAt: orNull(item.updatedAt),
    author: item.author,
    avatarUrl: orNull(item.avatarUrl),
  }
}

export function changelogFromPb(pb: PbChangelog): ChangelogData {
  const commits: ChangelogCommit[] = pb.commits.map((c) => ({
    id: c.id,
    slug: c.slug,
    kind: "commit",
    sha: c.sha,
    shortSha: c.shortSha,
    title: c.title,
    body: c.body,
    date: c.date,
    url: orNull(c.url),
    author: c.author,
    authorLogin: orNull(c.authorLogin),
    avatarUrl: orNull(c.avatarUrl),
    branches: [...c.branches],
    parentCount: c.parentCount,
  }))
  const events: ChangelogEvent[] = pb.events.map((e) => ({
    id: e.id,
    slug: e.slug,
    kind: "event",
    eventType: e.eventType,
    title: e.title,
    description: e.description,
    date: e.date,
    actor: e.actor,
    avatarUrl: orNull(e.avatarUrl),
    branch: orNull(e.branch),
    url: orNull(e.url),
  }))
  const byId = new Map<string, ChangelogItem>([...commits, ...events].map((item) => [item.id, item]))
  const items = pb.items
    .map((item) => (item.item.case ? byId.get(item.item.value.id) : undefined))
    .filter((item): item is ChangelogItem => Boolean(item))

  const repo = pb.repository
  return {
    repo: pb.repo,
    generatedAt: pb.generatedAt,
    source: pb.source,
    repository: repo
      ? {
          name: repo.name,
          url: orNull(repo.url),
          description: orNull(repo.description),
          defaultBranch: repo.defaultBranch || "main",
          primaryLanguage: orNull(repo.primaryLanguage),
          stars: repo.stars,
          watchers: repo.watchers,
          forks: repo.forks,
          openIssues: repo.openIssues,
          size: repo.size,
          createdAt: orNull(repo.createdAt),
          updatedAt: orNull(repo.updatedAt),
          pushedAt: orNull(repo.pushedAt),
          license: orNull(repo.license),
        }
      : null,
    branches: pb.branches.map((b) => ({
      name: b.name,
      sha: orNull(b.sha),
      protected: b.protected,
      commits: b.commits,
      lastCommitAt: orNull(b.lastCommitAt),
    })),
    contributors: pb.contributors.map((c) => ({
      login: c.login,
      avatarUrl: orNull(c.avatarUrl),
      url: orNull(c.url),
      contributions: c.contributions,
      commits: c.commits,
      events: c.events,
      lastActiveAt: orNull(c.lastActiveAt),
      score: c.score,
    })),
    languages: pb.languages.map((l) => ({ name: l.name, bytes: Number(l.bytes), percent: l.percent })),
    releases: pb.releases.map((r) => ({
      id: Number(r.id),
      name: r.name,
      tag: orNull(r.tag),
      url: orNull(r.url),
      publishedAt: orNull(r.publishedAt),
    })),
    tags: pb.tags.map((t) => ({ name: t.name, sha: orNull(t.sha) })),
    issues: {
      open: pb.issues?.open ?? 0,
      closed: pb.issues?.closed ?? 0,
      recent: (pb.issues?.recent ?? []).map(smallItem),
    },
    pulls: {
      open: pb.pulls?.open ?? 0,
      closed: pb.pulls?.closed ?? 0,
      recent: (pb.pulls?.recent ?? []).map(smallItem),
    },
    stats: {
      days: pb.stats?.days.map((d) => ({ day: d.day, commits: d.commits, events: d.events, total: d.total })) ?? [],
      eventTypes: pb.stats?.eventTypes.map((e) => ({ type: e.type, count: e.count })) ?? [],
      totals: { ...(pb.stats?.totals ?? {}) },
    },
    commits,
    events,
    items,
    ...(pb.error ? { error: pb.error } : {}),
  }
}
