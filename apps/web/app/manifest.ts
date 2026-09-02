import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "mixture · screenkit",
    short_name: "screenkit",
    description: "screen-insert production library for the crime series «Гремучая смесь»",
    start_url: "/",
    display: "standalone",
    background_color: "#05070c",
    theme_color: "#05070c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}
