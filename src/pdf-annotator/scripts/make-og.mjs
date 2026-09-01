/**
 * Generates public/og.png (1200×630) — the social share image.
 *
 *   pnpm --filter pdf-annotator og
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const WORDMARK = 'SIGN PDF ONLINE'
const OUT = new URL('../public/og.png', import.meta.url)

const W = 1200
const H = 630

const BG = [15, 23, 42]
const BRAND = [29, 78, 216]
const WHITE = [255, 255, 255]
const DOT = [30, 41, 59]
const PAPER = [248, 250, 252]
const INK = [29, 78, 216]

/** 5×7 bitmap glyphs — only the letters the wordmark needs. */
const FONT = {
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
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

/** Signed distance to a rounded rectangle; negative inside. */
const sdRoundRect = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - (hw - r)
  const qy = Math.abs(y - cy) - (hh - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

const TILE = { cx: 600, cy: 230, hw: 70, hh: 88, r: 12 }

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let c = BG
    if (x % 24 === 0 && y % 24 === 0) c = DOT

    const d = sdRoundRect(x, y, TILE.cx, TILE.cy, TILE.hw, TILE.hh, TILE.r)
    if (d < 0) {
      c = PAPER
      const localX = x - (TILE.cx - TILE.hw)
      const localY = y - (TILE.cy - TILE.hh)
      if (localY > TILE.hh * 2 * 0.62 && localY < TILE.hh * 2 * 0.78) {
        const t = (localX - 24) / (TILE.hw * 2 - 48)
        if (t >= 0 && t <= 1) {
          const squiggle = Math.sin(t * Math.PI * 2.2) * 7
          if (Math.abs(localY - TILE.hh * 2 * 0.7 - squiggle) < 2.4) c = INK
        }
      }
    } else if (d < 1.6) {
      c = mix(BG, BRAND, 1 - d / 1.6)
    }

    put(x, y, c)
  }
}

const CELL = 7
const GAP = 5
const glyphW = 5 * CELL
const textW = [...WORDMARK].reduce((w, ch) => w + (ch === ' ' ? glyphW * 0.4 : glyphW + GAP), -GAP)
let penX = Math.round((W - textW) / 2)
const penY = 400

for (const ch of WORDMARK) {
  if (ch === ' ') {
    penX += glyphW * 0.4
    continue
  }
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

for (let x = 420; x < 780; x++) put(x, 490, mix(BG, DOT, 1))

const stride = W * 3 + 1
const raw = Buffer.alloc(stride * H)
for (let y = 0; y < H; y++) {
  raw[y * stride] = 0
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
