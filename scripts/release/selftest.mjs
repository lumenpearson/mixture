#!/usr/bin/env node
// Assertions for the release scripts, runnable without a runner, a network or
// a Windows box: `node scripts/release/selftest.mjs`.
//
// The workflow depends on these answers being exact — a tag that shifts by a
// timezone or a checksum line in the wrong format breaks a published release,
// which cannot be taken back.

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { calendarVersion, computeRelease, shortSha } from "./version.mjs";
import { pack } from "./archive.mjs";
import { renderChecksums } from "./checksums.mjs";
import {
  AUDIENCE,
  MAX_COMMITS,
  audience,
  commitLogArgs,
  humanSize,
  parseCommit,
  renderCommits,
  renderNotes,
} from "./notes.mjs";

// Exactly what .github/workflows/release.yml attaches, for one tag. arm64 has
// no offline installer: tauri-bundler has no WebView2 offline runtime link for
// that architecture, so the workflow skips that one build.
const RELEASE_ASSETS = (tag) => [
  `mixture-screenkit-${tag}-windows-x64-setup.exe`,
  `mixture-screenkit-${tag}-windows-x64-setup-offline.exe`,
  `mixture-screenkit-${tag}-windows-x64-setup.msi`,
  `mixture-screenkit-${tag}-windows-x64-portable.zip`,
  `mixture-screenkit-${tag}-windows-x64-portable.7z`,
  `mixture-screenkit-${tag}-windows-arm64-setup.exe`,
  `mixture-screenkit-${tag}-windows-arm64-setup.msi`,
  `mixture-screenkit-${tag}-windows-arm64-portable.zip`,
  `mixture-screenkit-${tag}-windows-arm64-portable.7z`,
  `mixture-screenkit-${tag}-windows-x86-setup.exe`,
  `mixture-screenkit-${tag}-windows-x86-setup-offline.exe`,
  `mixture-screenkit-${tag}-windows-x86-setup.msi`,
  `mixture-screenkit-${tag}-windows-x86-portable.zip`,
  `mixture-screenkit-${tag}-windows-x86-portable.7z`,
  `mixture-screenkit-${tag}-android.apk`,
  `mixture-source-${tag}.zip`,
  `mixture-source-${tag}.tar.gz`,
  `mixture-source-${tag}.tar.xz`,
  `mixture-source-${tag}.7z`,
  "SHA256SUMS.txt",
];

let passed = 0;
const cases = [];
function test(name, body) {
  cases.push([name, body]);
}

// --- version.mjs -----------------------------------------------------------

test("the tag carries the commit date in UTC and the short sha", () => {
  const release = computeRelease({
    sha: "A1B2C3D4E5F60718293A4B5C6D7E8F9012345678",
    date: "2026-09-03T12:34:56Z",
  });
  assert.equal(release.version, "2026.09.03");
  assert.equal(release.tag, "v2026.09.03-a1b2c3d");
  assert.equal(release.title, "mixture · screenkit v2026.09.03-a1b2c3d");
  assert.equal(release.shortSha, "a1b2c3d");
});

test("the date is read in UTC, not in the runner timezone", () => {
  // 23:30 in Moscow on the 4th is still 20:30 UTC on the 4th; 00:30 UTC on the
  // 4th is the 3rd in New York. The tag must not move with the runner.
  assert.equal(calendarVersion("2026-09-04T20:30:00+03:00"), "2026.09.04");
  assert.equal(calendarVersion("2026-09-04T00:30:00Z"), "2026.09.04");
  assert.equal(calendarVersion("2026-01-01T00:00:00Z"), "2026.01.01");
});

test("month and day are zero padded", () => {
  assert.equal(calendarVersion("2026-01-05T10:00:00Z"), "2026.01.05");
});

test("a malformed sha or date is refused instead of producing a wrong tag", () => {
  assert.throws(() => shortSha("nothex!"), /7-40 hex/);
  assert.throws(() => shortSha("abc"), /7-40 hex/);
  assert.throws(() => calendarVersion("not a date"), /valid timestamp/);
});

// --- notes.mjs -------------------------------------------------------------

test("a commit line splits into sha, subject and pull request number", () => {
  assert.deepEqual(parseCommit("a1b2c3d feat(web): add the timeline (#42)"), {
    sha: "a1b2c3d",
    subject: "feat(web): add the timeline (#42)",
    pr: 42,
  });
  assert.equal(parseCommit("a1b2c3d chore: bump turbo").pr, null);
  assert.equal(parseCommit(""), null);
});

test("every asset name the workflow produces has an audience", () => {
  const tag = "v2026.09.03-a1b2c3d";
  for (const name of RELEASE_ASSETS(tag)) {
    assert.notEqual(audience(name), "", `no audience for ${name}`);
  }
  // the online installer must not answer for the offline one
  assert.match(audience(`mixture-screenkit-${tag}-windows-x64-setup.exe`), /скачается/);
  assert.match(
    audience(`mixture-screenkit-${tag}-windows-x64-setup-offline.exe`),
    /без интернета/,
  );
  assert.equal(audience("something-else.bin"), "");
  // arm64 has no offline installer, so its row says so instead of leaving the
  // reader to look for a file the release does not carry
  assert.match(
    audience(`mixture-screenkit-${tag}-windows-arm64-setup.exe`),
    /offline-варианта для ARM нет/,
  );
});

test("no audience row describes a file the release does not carry", () => {
  const names = RELEASE_ASSETS("v2026.09.03-a1b2c3d");
  for (const [pattern, text] of AUDIENCE) {
    assert.ok(
      names.some((name) => pattern.test(name)),
      `nothing in the release matches ${pattern}: "${text}"`,
    );
  }
});

test("a long commit list is cut off and says that it was", () => {
  const repo = "codeilluminators/mixture";
  const commits = Array.from({ length: MAX_COMMITS + 1 }, (unused, index) => ({
    sha: String(index).padStart(12, "0"),
    subject: `chore: commit ${index}`,
    pr: null,
  }));
  const body = renderCommits(commits, repo);
  assert.equal(body.split("\n").length, MAX_COMMITS + 1, "the cap plus the notice");
  assert.match(body, /список обрезан: показаны первые 200 коммитов/);
  assert.doesNotMatch(renderCommits(commits.slice(0, MAX_COMMITS), repo), /обрезан/);
  // and the notice is reachable: a first release asks git for one commit more
  // than the cap, because with exactly the cap fetched a truncated list would
  // look complete
  assert.deepEqual(commitLogArgs({ sha: "a1b2c3d", previous: null }).slice(-3), [
    "-n",
    String(MAX_COMMITS + 1),
    "a1b2c3d",
  ]);
  assert.equal(
    commitLogArgs({ sha: "a1b2c3d", previous: "v2026.08.01-0badc0d" }).at(-1),
    "v2026.08.01-0badc0d..a1b2c3d",
  );
});

test("sizes are readable", () => {
  assert.equal(humanSize(900), "900 Б");
  assert.equal(humanSize(512 * 1024), "512 КиБ");
  assert.equal(humanSize(12 * 1024 * 1024), "12.0 МиБ");
});

test("the notes name the release, the assets and the Windows floor", () => {
  const body = renderNotes({
    tag: "v2026.09.03-a1b2c3d",
    sha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    repo: "codeilluminators/mixture",
    previous: "v2026.08.01-0badc0d",
    commits: [
      { sha: "a1b2c3d4e5f6", subject: "feat(web): add the timeline (#42)", pr: 42 },
      { sha: "0badc0de1234", subject: "fix(cloud): reject a path with ..", pr: null },
    ],
    assets: [
      { name: "mixture-screenkit-v2026.09.03-a1b2c3d-windows-x64-setup.exe", size: 9_000_000 },
      { name: "SHA256SUMS.txt", size: 900 },
    ],
  });
  assert.match(body, /## Что изменилось/);
  assert.match(body, /add the timeline \(\[#42\]\(https:\/\/github\.com\/codeilluminators\/mixture\/pull\/42\)\)/);
  assert.match(body, /compare\/v2026\.08\.01-0badc0d\.\.\.v2026\.09\.03-a1b2c3d/);
  assert.match(body, /\| `mixture-screenkit-v2026\.09\.03-a1b2c3d-windows-x64-setup\.exe` \|/);
  assert.match(body, /Windows 10 версии 1803/);
  // the prose says why an ARM64 reader finds no offline installer in the table
  assert.match(body, /Для ARM64 такого варианта нет/);
  assert.match(body, /SmartScreen/);
  assert.match(body, /sha256sum --check SHA256SUMS\.txt/);
  assert.match(body, /pnpm install --frozen-lockfile/);
});

test("the notes carry the version the installed build reports", () => {
  const common = {
    tag: "v2026.09.03-a1b2c3d",
    sha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    repo: "codeilluminators/mixture",
    previous: null,
    commits: [],
    assets: [{ name: "SHA256SUMS.txt", size: 10 }],
  };
  assert.match(renderNotes({ ...common, buildVersion: "0.1.42" }), /версию `0\.1\.42`/);
  // without one the paragraph is absent rather than half-written
  assert.doesNotMatch(renderNotes(common), /В «Приложениях и возможностях»/);
});

test("the first release says so instead of linking a compare against nothing", () => {
  const body = renderNotes({
    tag: "v2026.09.03-a1b2c3d",
    sha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    repo: "codeilluminators/mixture",
    previous: null,
    commits: [],
    assets: [{ name: "SHA256SUMS.txt", size: 10 }],
  });
  assert.match(body, /первый релиз/);
  assert.match(body, /С прошлого релиза изменений нет\./);
  assert.doesNotMatch(body, /compare\/null/);
});

// --- checksums.mjs ---------------------------------------------------------

test("SHA256SUMS.txt is in the format sha256sum reads back", async () => {
  const dir = mkdtempSync(join(tmpdir(), "release-sums-"));
  writeFileSync(join(dir, "b.txt"), "b");
  writeFileSync(join(dir, "a.txt"), "a");
  writeFileSync(join(dir, "SHA256SUMS.txt"), "stale");
  const body = await renderChecksums(dir);
  const lines = body.trimEnd().split("\n");
  assert.equal(lines.length, 2, "the sums file itself must not be hashed");
  assert.deepEqual(
    lines.map((line) => line.slice(66)),
    ["a.txt", "b.txt"],
    "names are sorted and separated by exactly two spaces",
  );
  assert.equal(
    lines[0],
    "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb  a.txt",
  );
  assert.equal(body.at(-1), "\n");
});

// --- archive.mjs -----------------------------------------------------------

test("tar.gz and tar.xz hold the staged tree", () => {
  const root = mkdtempSync(join(tmpdir(), "release-pack-"));
  const stage = join(root, "stage", "mixture-v2026.09.03-a1b2c3d");
  mkdirSync(stage, { recursive: true });
  writeFileSync(join(stage, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  for (const format of ["tar.gz", "tar.xz"]) {
    const out = pack({
      format,
      source: join(root, "stage"),
      out: join(root, `mixture-source.${format}`),
    });
    assert.ok(readFileSync(out).length > 0, `${format} is empty`);
  }
  assert.throws(() => pack({ format: "rar", source: join(root, "stage"), out: join(root, "x") }), /unknown format/);
  assert.throws(
    () => pack({ format: "zip", source: join(root, "missing"), out: join(root, "y.zip") }),
    /existing directory/,
  );
});

// --- run -------------------------------------------------------------------

for (const [name, body] of cases) {
  try {
    await body();
    passed += 1;
    process.stdout.write(`ok   ${name}\n`);
  } catch (error) {
    process.stdout.write(`FAIL ${name}\n${error.message}\n`);
    process.exitCode = 1;
  }
}
process.stdout.write(`\n${passed}/${cases.length} passed\n`);
