#!/usr/bin/env node
// Packs the contents of a directory into one archive.
//
//   node scripts/release/archive.mjs --format zip --source stage --out dist/x.zip
//
// Whatever lies in --source ends up at the root of the archive, so the caller
// decides whether there is a top-level folder: `git archive --prefix=` puts one
// there for the source archives, the portable build stages the bare .exe.
//
// zip and 7z go through 7-Zip (present on both runner images, `p7zip-full` on
// ubuntu), with `zip` as a fallback; tar.gz and tar.xz go through tar.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FORMATS = ["zip", "tar.gz", "tar.xz", "7z"];

function has(tool) {
  const probe = spawnSync(tool, ["--help"], { stdio: "ignore" });
  return !probe.error;
}

/** The first 7-Zip binary on PATH: the name differs between distributions. */
function sevenZip() {
  return ["7z", "7za", "7zz"].find((tool) => has(tool));
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: ["ignore", "inherit", "inherit"] });
}

/**
 * @param {{format: string, source: string, out: string}} options
 * @returns {string} absolute path of the archive
 */
export function pack({ format, source, out }) {
  if (!FORMATS.includes(format)) {
    throw new Error(`unknown format ${format}, expected one of ${FORMATS.join(", ")}`);
  }
  const from = resolve(source);
  if (!existsSync(from) || !statSync(from).isDirectory()) {
    throw new Error(`--source must be an existing directory: ${from}`);
  }
  const entries = readdirSync(from);
  if (entries.length === 0) throw new Error(`nothing to pack, ${from} is empty`);

  const target = resolve(out);
  mkdirSync(dirname(target), { recursive: true });
  if (existsSync(target)) throw new Error(`refusing to overwrite ${target}`);

  if (format === "zip" || format === "7z") {
    const zipper = sevenZip();
    if (zipper) {
      const type = format === "zip" ? "-tzip" : "-t7z";
      run(zipper, ["a", type, "-mx=9", "-bd", target, ...entries], from);
    } else if (format === "zip" && has("zip")) {
      run("zip", ["-r", "-9", "-q", target, ...entries], from);
    } else {
      throw new Error(
        `no archiver for ${format}: install p7zip-full (7z)${format === "zip" ? " or zip" : ""}`,
      );
    }
  } else {
    const flag = format === "tar.gz" ? "-czf" : "-cJf";
    run("tar", [flag, target, ...entries], from);
  }

  return target;
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
    if (!args.format || !args.source || !args.out) {
      throw new Error("usage: archive.mjs --format <zip|tar.gz|tar.xz|7z> --source <dir> --out <file>");
    }
    const target = pack(args);
    const { size } = statSync(target);
    process.stdout.write(`${target} (${(size / 1024 / 1024).toFixed(1)} MiB)\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
