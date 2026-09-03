/* ------------------------------------------------------------------ *
 * placeholder icons for the desktop bundle
 *
 * The shell needs an .ico for the NSIS installer and the exe, plus the png
 * sizes tauri.conf.json lists. Rather than committing binaries nobody can
 * regenerate, the mark is drawn here: a dark rounded square with a monitor in
 * accent cyan, the same two colours the app uses (--panel-*, --accent-cyan).
 * Run `pnpm --filter @mixture/desktop icons` after changing it.
 *
 * No dependencies: png is written by hand (zlib + crc32) and the ico carries
 * classic 32-bit BMP entries, which every windows resource compiler accepts.
 * ------------------------------------------------------------------ */

import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons")

const PANEL = [0x10, 0x13, 0x1a, 0xff]
const ACCENT = [0x4c, 0xc9, 0xf0, 0xff]

/* ------------------------------ drawing ------------------------------ */

const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

/** rgba pixels for one square icon, 3x3 supersampled so the edges stay smooth */
function draw(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const s = (v) => v * size
  // background, monitor body, screen cut-out, stand, base
  const shapes = [
    { color: PANEL, hit: (x, y) => inRoundRect(x, y, s(0.02), s(0.02), s(0.98), s(0.98), s(0.22)) },
    { color: ACCENT, hit: (x, y) => inRoundRect(x, y, s(0.2), s(0.24), s(0.8), s(0.62), s(0.07)) },
    { color: PANEL, hit: (x, y) => inRoundRect(x, y, s(0.29), s(0.33), s(0.71), s(0.42), s(0.02)) },
    { color: ACCENT, hit: (x, y) => inRoundRect(x, y, s(0.45), s(0.62), s(0.55), s(0.71), s(0.01)) },
    { color: ACCENT, hit: (x, y) => inRoundRect(x, y, s(0.32), s(0.71), s(0.68), s(0.78), s(0.03)) },
  ]

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = (y * size + x) * 4
      for (const shape of shapes) {
        let hits = 0
        for (let sy = 0; sy < 3; sy += 1) {
          for (let sx = 0; sx < 3; sx += 1) {
            if (shape.hit(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) hits += 1
          }
        }
        if (hits === 0) continue
        const alpha = hits / 9
        for (let c = 0; c < 3; c += 1) {
          pixels[at + c] = Math.round(pixels[at + c] * (1 - alpha) + shape.color[c] * alpha)
        }
        pixels[at + 3] = Math.round(pixels[at + 3] * (1 - alpha) + 255 * alpha)
      }
    }
  }
  return pixels
}

/* -------------------------------- png -------------------------------- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, body) {
  const head = Buffer.alloc(4)
  head.writeUInt32BE(body.length)
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typed))
  return Buffer.concat([head, typed, crc])
}

function png(size, pixels) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // rgba
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

/* -------------------------------- ico -------------------------------- */

/** one 32-bit BMP entry: bottom-up BGRA rows followed by a zeroed AND mask */
function dib(size, pixels) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8) // xor + and mask
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  const xor = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const from = (y * size + x) * 4
      const to = ((size - 1 - y) * size + x) * 4
      xor[to] = pixels[from + 2]
      xor[to + 1] = pixels[from + 1]
      xor[to + 2] = pixels[from]
      xor[to + 3] = pixels[from + 3]
    }
  }
  const maskStride = Math.ceil(size / 8 / 4) * 4
  return Buffer.concat([header, xor, Buffer.alloc(maskStride * size)])
}

function ico(sizes) {
  const images = sizes.map((size) => dib(size, draw(size)))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = 6 + sizes.length * 16
  const directory = sizes.map((size, index) => {
    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(images[index].length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += images[index].length
    return entry
  })
  return Buffer.concat([header, ...directory, ...images])
}

/* ------------------------------- output ------------------------------- */

mkdirSync(OUT, { recursive: true })
const written = []
for (const [name, size] of [
  ["32x32.png", 32],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
]) {
  writeFileSync(join(OUT, name), png(size, draw(size)))
  written.push(name)
}
writeFileSync(join(OUT, "icon.ico"), ico([16, 32, 48, 64, 128]))
written.push("icon.ico")
console.log(`icons written to src-tauri/icons: ${written.join(", ")}`)
