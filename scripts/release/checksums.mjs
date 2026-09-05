#!/usr/bin/env node
// SHA256SUMS.txt for a directory of release assets, in the format `sha256sum`
// reads back: 64 hex characters, two spaces, the file name.
//
//   node scripts/release/checksums.mjs --dir dist/assets
//   sha256sum --check SHA256SUMS.txt

import { createHash } from "node:crypto";
import { createReadStream, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SUMS_FILE = "SHA256SUMS.txt";

export async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

/**
 * Hashes every file in `dir` except the sums file itself.
 * @returns {Promise<string>} the contents of SHA256SUMS.txt
 */
export async function renderChecksums(dir, exclude = SUMS_FILE) {
  const from = resolve(dir);
  const names = readdirSync(from)
    .filter((name) => name !== exclude)
    .filter((name) => statSync(join(from, name)).isFile())
    // plain codepoint order, so the file is stable whatever the runner locale is
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (names.length === 0) throw new Error(`no files to hash in ${from}`);

  const lines = [];
  for (const name of names) {
    lines.push(`${await sha256(join(from, name))}  ${name}`);
  }
  return `${lines.join("\n")}\n`;
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
    if (!args.dir) throw new Error("usage: checksums.mjs --dir <dir> [--out <file>]");
    const out = resolve(args.out ?? join(args.dir, SUMS_FILE));
    const body = await renderChecksums(args.dir, basename(out));
    writeFileSync(out, body, "utf8");
    process.stdout.write(body);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
