/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
