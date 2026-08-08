/**
 * Generates public/og-default.png (1200×630) — the social share image.
 *
 * Hand-rolled rather than pulled from satori/@vercel/og: those bring a real
 * dependency and a build-time cost for one static asset that changes about
 * never. Run it again if the site is renamed:
 *
 *   pnpm --filter elearning og
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const WORDMARK = 'CODELANE'
const OUT = new URL('../public/og-default.png', import.meta.url)

const W = 1200
const H = 630

const BG = [18, 20, 28]
const BRAND = [74, 95, 224]
const WHITE = [255, 255, 255]
const DOT = [42, 46, 60]

/** 5×7 bitmap glyphs — only the letters the wordmark needs. */
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
}

const px = Buffer.alloc(W * H * 3)
const put = (x, y, c) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const o = (y * W + x) * 3
  px[o] = c[0]
  px[o + 1] = c[1]
  px[o + 2] = c[2]
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

const dist2seg = (x, y, x1, y1, x2, y2) => {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

/** Signed distance to a rounded rectangle; negative inside. */
const sdRoundRect = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - (hw - r)
  const qy = Math.abs(y - cy) - (hh - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

const TILE = { cx: 600, cy: 250, hw: 88, hh: 88, r: 25 }
const S = 2.4
const chev = [
  [TILE.cx - 14 * S, TILE.cy - 21 * S, TILE.cx - 31 * S, TILE.cy, TILE.cx - 14 * S, TILE.cy + 21 * S],
  [TILE.cx + 14 * S, TILE.cy - 21 * S, TILE.cx + 31 * S, TILE.cy, TILE.cx + 14 * S, TILE.cy + 21 * S],
]

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let c = BG
    if (x % 24 === 0 && y % 24 === 0) c = DOT

    const d = sdRoundRect(x, y, TILE.cx, TILE.cy, TILE.hw, TILE.hh, TILE.r)
    if (d < 0) {
      const onChevron = chev.some(
        (p) =>
          Math.min(dist2seg(x, y, p[0], p[1], p[2], p[3]), dist2seg(x, y, p[2], p[3], p[4], p[5])) <=
          4.6,
      )
      c = onChevron ? WHITE : BRAND
    } else if (d < 1.6) {
      c = mix(BG, BRAND, 1 - d / 1.6)
    }

    put(x, y, c)
  }
}

// Wordmark, centred beneath the tile.
const CELL = 9
const GAP = 7
const glyphW = 5 * CELL
const textW = WORDMARK.length * glyphW + (WORDMARK.length - 1) * GAP
let penX = Math.round((W - textW) / 2)
const penY = 410

for (const ch of WORDMARK) {
  const rows = FONT[ch]
  if (!rows) throw new Error(`No glyph for "${ch}" — add it to FONT.`)
  for (let r = 0; r < rows.length; r++) {
    for (let col = 0; col < 5; col++) {
      if (rows[r][col] !== '1') continue
      for (let dy = 0; dy < CELL; dy++) {
        for (let dx = 0; dx < CELL; dx++) {
          put(penX + col * CELL + dx, penY + r * CELL + dy, WHITE)
        }
      }
    }
  }
  penX += glyphW + GAP
}

// Rule + tagline bar under the wordmark.
for (let x = 420; x < 780; x++) put(x, 500, mix(BG, DOT, 1))

// ── PNG encoding ──────────────────────────────────────────────────────────
const stride = W * 3 + 1
const raw = Buffer.alloc(stride * H)
for (let y = 0; y < H; y++) {
  raw[y * stride] = 0 // filter: none
  px.copy(raw, y * stride + 1, y * W * 3, (y + 1) * W * 3)
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8
ihdr[9] = 2

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

writeFileSync(OUT, png)
console.log(`wrote ${OUT.pathname} — ${W}×${H}, ${(png.length / 1024).toFixed(1)} KB`)
