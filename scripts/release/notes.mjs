#!/usr/bin/env node
// Renders the release description in Russian: what changed, which asset to
// take, what Windows is required, why the build is unsigned and how to check
// the checksums.
//
//   node scripts/release/notes.mjs --tag v2026.09.03-a1b2c3d --sha <sha> \
//     --repo owner/name --assets dist/assets --build-version 0.1.42 --out notes.md
//
// The commit list comes from `git log` between the previous release tag and the
// released commit; --commits-file replaces it with a file of `<sha> <subject>`
// lines, which is how the script is exercised without a repository.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The longest commit list a release body carries; the rest is one summary line. */
export const MAX_COMMITS = 200;

// Windows 10 1803 is the floor of the WebView2 Evergreen runtime; below it the
// runtime cannot be installed at all, so no bundle can help.
export const MIN_WINDOWS = "Windows 10 версии 1803 (сборка 17134)";

// One row per asset name the workflow really produces. A row nothing matches is
// a promise to a reader about a file that is not in the release, so selftest.mjs
// checks the list from both sides.
export const AUDIENCE = [
  [/-windows-x64-setup\.exe$/, "Windows 10/11, x64 · обычная установка, WebView2 скачается при установке"],
  [/-windows-x64-setup-offline\.exe$/, "Windows 10/11, x64 · машина без интернета: WebView2 лежит внутри"],
  [/-windows-x64-setup\.msi$/, "Windows 10/11, x64 · развёртывание через MSI (GPO, Intune, SCCM)"],
  [/-windows-x64-portable\.(zip|7z)$/, "Windows 10/11, x64 · без установки; WebView2 ставится отдельно"],
  [
    /-windows-arm64-setup\.exe$/,
    "Windows 11 на ARM и Windows 10 на ARM · обычная установка; offline-варианта для ARM нет",
  ],
  [/-windows-arm64-setup\.msi$/, "Windows на ARM · развёртывание через MSI (GPO, Intune, SCCM)"],
  [/-windows-arm64-portable\.(zip|7z)$/, "Windows на ARM · без установки; WebView2 ставится отдельно"],
  [/-windows-x86-setup\.exe$/, "32-разрядная Windows 10 · обычная установка"],
  [/-windows-x86-setup-offline\.exe$/, "32-разрядная Windows 10 · машина без интернета"],
  [/-windows-x86-setup\.msi$/, "32-разрядная Windows 10 · развёртывание через MSI"],
  [/-windows-x86-portable\.(zip|7z)$/, "32-разрядная Windows 10 · без установки"],
  [/-android\.apk$/, "Android · приложение из `apps/mobile`, установка из файла"],
  [/^mixture-source-.*\.(zip|tar\.gz|tar\.xz|7z)$/, "исходный код этого коммита, вместе с pnpm-lock.yaml"],
  [/^SHA256SUMS\.txt$/, "контрольные суммы всех файлов ниже"],
];

/** Who each asset is for; unknown names get an empty cell instead of a guess. */
export function audience(name) {
  return AUDIENCE.find(([pattern]) => pattern.test(name))?.[1] ?? "";
}

export function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КиБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МиБ`;
}

/** `abc1234 fix(web): do the thing (#12)` -> {sha, subject, pr}. */
export function parseCommit(line) {
  const match = /^([0-9a-f]{7,40})\s+(.*)$/i.exec(line.trim());
  if (!match) return null;
  const [, sha, subject] = match;
  const pr = /\(#(\d+)\)\s*$/.exec(subject);
  return { sha: sha.toLowerCase(), subject, pr: pr ? Number(pr[1]) : null };
}

export function renderCommits(commits, repo) {
  if (commits.length === 0) return "С прошлого релиза изменений нет.";
  const shown = commits.slice(0, MAX_COMMITS).map((commit) => {
    const link = `[\`${commit.sha.slice(0, 7)}\`](https://github.com/${repo}/commit/${commit.sha})`;
    const subject = commit.pr
      ? commit.subject.replace(
          /\(#(\d+)\)\s*$/,
          `([#$1](https://github.com/${repo}/pull/$1))`,
        )
      : commit.subject;
    return `- ${subject} — ${link}`;
  });
  if (commits.length > MAX_COMMITS) {
    // not "и ещё N": on a first release the list is fetched capped, so the
    // remainder is a lower bound, not a count. What the reader needs is that
    // the list is partial — the compare link above carries the whole range.
    shown.push(`- …список обрезан: показаны первые ${MAX_COMMITS} коммитов`);
  }
  return shown.join("\n");
}

export function renderAssets(assets) {
  const rows = assets.map(
    ({ name, size }) => `| \`${name}\` | ${audience(name)} | ${humanSize(size)} |`,
  );
  return ["| Файл | Кому | Размер |", "| --- | --- | --- |", ...rows].join("\n");
}

/**
 * @param {{tag: string, sha: string, repo: string, previous: string|null,
 *          commits: Array, assets: Array<{name: string, size: number}>,
 *          buildVersion?: string|null}} input
 */
export function renderNotes({ tag, sha, repo, previous, commits, assets, buildVersion }) {
  const compare = previous
    ? `[\`${previous}\` → \`${tag}\`](https://github.com/${repo}/compare/${previous}...${tag})`
    : "первый релиз в этом репозитории";

  // the tag is the identity of the release, but Windows shows a three-part
  // version number, so the artefacts carry one too; without it an installed
  // build cannot be told apart from any other
  const installed = buildVersion
    ? `\n\nВ «Приложениях и возможностях» и в свойствах \`.exe\` эта сборка показывает версию \`${buildVersion}\` — по ней установленное приложение сопоставляется с этим релизом.`
    : "";

  return `Автоматический релиз из коммита [\`${sha.slice(0, 7)}\`](https://github.com/${repo}/commit/${sha}) ветки \`master\`, прошедшего все проверки \`ci\`. Диапазон: ${compare}.

## Что изменилось

${renderCommits(commits, repo)}

## Что скачать

${renderAssets(assets)}${installed}

Если сомневаетесь — берите \`-windows-x64-setup.exe\`: это обычный установщик для 64-разрядной Windows 10 или 11. Вариант \`-setup-offline.exe\` нужен только там, где у машины нет интернета: он несёт среду выполнения WebView2 внутри и поэтому весит примерно на 130 МиБ больше. Для ARM64 такого варианта нет: сборщик знает ссылки на автономную среду выполнения только для x64 и x86, а x86-среду ARM64-приложение загрузить не может. \`.msi\` — для централизованного развёртывания. \`-portable\` — распакуйте и запустите \`mixture-screenkit.exe\`, ничего не устанавливая.

## Совместимость с Windows

- минимум — ${MIN_WINDOWS}; порог задаёт не приложение, а среда выполнения WebView2: на более старых сборках она не устанавливается;
- Windows 11 поддерживается целиком, WebView2 в ней уже есть;
- архитектуры: x64, ARM64 (Windows 11 на ARM и Windows 10 на ARM) и x86 (32-разрядная Windows 10);
- на 64-разрядной системе ставьте x64-сборку, а не x86: x86 остаётся для 32-разрядных установок;
- обычный установщик требует WebView2 не ниже 110 — это первая версия без поддержки Windows 7, 8 и 8.1. Если на машине среда старее, он просит EdgeUpdate обновить её, а без интернета прерывает установку;
- у offline-установщика этого порога нет: он ставит вложенную среду выполнения на любой машине, где WebView2 старее или его нет вовсе;
- Windows 7, 8 и 8.1 не поддерживаются: поддержка WebView2 для них закончилась.

Портативная сборка среду выполнения не несёт. Если окно пустое или приложение не стартует, поставьте [Microsoft Edge WebView2 Evergreen Bootstrapper](https://go.microsoft.com/fwlink/p/?LinkId=2124703).

## Подпись

Файлы не подписаны сертификатом издателя. При первом запуске Windows SmartScreen покажет предупреждение «Windows защитила ваш компьютер» — «Подробнее» → «Выполнить в любом случае». Сверьте контрольную сумму: она однозначно связывает файл с этим релизом.

## Контрольные суммы

\`\`\`powershell
Get-FileHash .\\mixture-screenkit-${tag}-windows-x64-setup.exe -Algorithm SHA256
\`\`\`

\`\`\`bash
sha256sum --check SHA256SUMS.txt
\`\`\`

## Исходный код

Архивы \`mixture-source-${tag}.*\` — это дерево ровно этого коммита, без \`.git\` и \`node_modules\`. \`pnpm-lock.yaml\` внутри, поэтому \`pnpm install --frozen-lockfile\` из распакованного архива даёт те же версии зависимостей, с которыми собирался релиз.
`;
}

function git(args, cwd, quiet = false) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", quiet ? "ignore" : "inherit"],
  }).trim();
}

/** The release tag before `sha`, or null when this is the first release. */
export function previousTag(sha, cwd) {
  try {
    // quiet: "No names found" is the expected answer for the first release
    const found = git(["describe", "--tags", "--abbrev=0", "--match", "v*", sha], cwd, true);
    return found || null;
  } catch {
    return null;
  }
}

/**
 * What `git log` is asked for. Without a previous tag the history is unbounded,
 * so it is capped — at one more than the cap, so `renderCommits` can tell that
 * it truncated instead of printing 200 commits as if they were all of them.
 */
export function commitLogArgs({ sha, previous }) {
  return [
    "log",
    "--no-merges",
    "--pretty=format:%H %s",
    ...(previous ? [`${previous}..${sha}`] : ["-n", String(MAX_COMMITS + 1), sha]),
  ];
}

function collectCommits({ sha, previous, cwd, commitsFile }) {
  const raw = commitsFile
    ? readFileSync(commitsFile, "utf8")
    : git(commitLogArgs({ sha, previous }), cwd);
  return raw
    .split("\n")
    .map((line) => parseCommit(line))
    .filter(Boolean);
}

function collectAssets(dir) {
  const from = resolve(dir);
  return readdirSync(from)
    .filter((name) => statSync(join(from, name)).isFile())
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((name) => ({ name, size: statSync(join(from, name)).size }));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) throw new Error(`unexpected argument: ${token}`);
    const [key, inline] = token.slice(2).split("=", 2);
    args[key] = inline ?? argv[++i];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    for (const required of ["tag", "sha", "repo", "assets"]) {
      if (!args[required]) {
        throw new Error(
          "usage: notes.mjs --tag <tag> --sha <sha> --repo <owner/name> --assets <dir> " +
            "[--build-version <x.y.z>] [--previous <tag>] [--commits-file <file>] [--out <file>]",
        );
      }
    }
    const cwd = args.cwd ?? process.cwd();
    const previous =
      args.previous ?? (args["commits-file"] ? null : previousTag(args.sha, cwd));
    const body = renderNotes({
      tag: args.tag,
      sha: args.sha,
      repo: args.repo,
      buildVersion: args["build-version"] || null,
      previous: previous || null,
      commits: collectCommits({
        sha: args.sha,
        previous: previous || null,
        cwd,
        commitsFile: args["commits-file"],
      }),
      assets: collectAssets(args.assets),
    });
    if (args.out) writeFileSync(resolve(args.out), body, "utf8");
    else process.stdout.write(body);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
