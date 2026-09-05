/* ------------------------------------------------------------------ *
 * next configuration — two builds, one app
 *
 * The web build is the deployment on Vercel and is what `pnpm build`
 * gates. The desktop build — `MIXTURE_DESKTOP_BUILD=1`, driven by
 * `pnpm --filter web build:desktop` — exports the same app to plain files
 * the Tauri window loads from disk, so the shell stops being a browser
 * pointed at the deployment.
 *
 * Every desktop-only option sits behind the flag, and the flag is set by
 * `scripts/build-desktop.mjs` alone: with it unset this file is what it was.
 * ------------------------------------------------------------------ */

/** true only inside the static export that ships in the Tauri bundle */
const desktop = process.env.MIXTURE_DESKTOP_BUILD === "1"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `output: "export"` plus a distDir other than `.next` makes that distDir
  // the *export* directory and puts the temporary build back in `.next`
  // (next/dist/export/utils.js, hasCustomExportOutput). It sits under `out/`
  // so the repository's existing ignore rule covers it and the web build's
  // `.next` is never the thing the shell ships.
  ...(desktop
    ? {
        output: "export",
        distDir: "out/desktop",
        // the window resolves tauri://localhost/insert/<id>/ against files on
        // disk, and only a directory carrying index.html answers that
        trailingSlash: true,
      }
    : {}),
  typescript: {
    // type errors fail the build; `pnpm typecheck` is the same gate locally
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    externalDir: true,
  },
  transpilePackages: [
    "@mixture/protocol",
    "@screenkit/core",
    "@screenkit/insert-bank",
    "@screenkit/insert-call",
    "@screenkit/insert-cctv",
    "@screenkit/insert-cctv-grid",
    "@screenkit/insert-countdown",
    "@screenkit/insert-dying-video",
    "@screenkit/insert-messenger",
    "@screenkit/insert-remote",
    "@screenkit/insert-situation",
    "@screenkit/insert-text-file",
    "@screenkit/insert-tracker",
    "@screenkit/insert-tv-news",
    "@screenkit/insert-wanted",
  ],
}

export default nextConfig
