#!/usr/bin/env node
// Calendar release identity: one release per commit on master.
//
//   version  2026.09.03                 the commit date in UTC
//   tag      v2026.09.03-a1b2c3d        plus the short sha, so the tag is unique
//   title    mixture · screenkit v2026.09.03-a1b2c3d
//
// The sha is part of the tag on purpose: several commits can land on the same
// day and a tag is never moved or reused.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PRODUCT = "mixture · screenkit";

const SHA_RE = /^[0-9a-f]{7,40}$/i;

/** The first seven characters of a commit sha, lowercased. */
export function shortSha(sha) {
  if (typeof sha !== "string" || !SHA_RE.test(sha)) {
    throw new Error(`sha must be 7-40 hex characters, received: ${JSON.stringify(sha)}`);
  }
  return sha.toLowerCase().slice(0, 7);
}

/** `YYYY.MM.DD` of the given instant in UTC — never in the runner's timezone. */
export function calendarVersion(date) {
  const at = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(at.getTime())) {
    throw new Error(`date is not a valid timestamp: ${JSON.stringify(date)}`);
  }
  const year = String(at.getUTCFullYear()).padStart(4, "0");
  const month = String(at.getUTCMonth() + 1).padStart(2, "0");
  const day = String(at.getUTCDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

/** The full release identity for one commit. */
export function computeRelease({ sha, date }) {
  const version = calendarVersion(date);
  const short = shortSha(sha);
  const tag = `v${version}-${short}`;
  return {
    sha: sha.toLowerCase(),
    shortSha: short,
    version,
    tag,
    title: `${PRODUCT} ${tag}`,
    date: (date instanceof Date ? date : new Date(date)).toISOString(),
  };
}

/** The commit date of `sha` as recorded by git, in ISO 8601. */
export function commitDate(sha, cwd = process.cwd()) {
  return execFileSync("git", ["show", "-s", "--format=%cI", sha], {
    cwd,
    encoding: "utf8",
  }).trim();
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

function main(argv) {
  const args = parseArgs(argv);
  if (!args.sha) {
    throw new Error("usage: version.mjs --sha <sha> [--date <iso>] [--format json|tag|title|github]");
  }
  const date = args.date ?? commitDate(args.sha, args.repo ?? process.cwd());
  const release = computeRelease({ sha: args.sha, date });

  switch (args.format ?? "json") {
    case "tag":
      process.stdout.write(`${release.tag}\n`);
      break;
    case "title":
      process.stdout.write(`${release.title}\n`);
      break;
    case "github":
      // ready to be appended to $GITHUB_OUTPUT
      process.stdout.write(
        [
          `sha=${release.sha}`,
          `short_sha=${release.shortSha}`,
          `version=${release.version}`,
          `tag=${release.tag}`,
          `title=${release.title}`,
          `date=${release.date}`,
        ].join("\n") + "\n",
      );
      break;
    default:
      process.stdout.write(`${JSON.stringify(release, null, 2)}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
