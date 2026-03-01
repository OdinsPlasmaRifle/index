// Deterministic hash from string using xorshift for good distribution
function hash(str: string): number[] {
  const values: number[] = []
  // FNV-1a hash for better initial spread
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  // Generate 16 pseudo-random values via xorshift32
  for (let i = 0; i < 16; i++) {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    values.push(h >>> 0)
  }
  return values
}

const palettes = [
  ['#6366f1', '#818cf8', '#a5b4fc'], // indigo
  ['#8b5cf6', '#a78bfa', '#c4b5fd'], // violet
  ['#ec4899', '#f472b6', '#f9a8d4'], // pink
  ['#ef4444', '#f87171', '#fca5a5'], // red
  ['#f97316', '#fb923c', '#fdba74'], // orange
  ['#eab308', '#facc15', '#fde047'], // yellow
  ['#22c55e', '#4ade80', '#86efac'], // green
  ['#14b8a6', '#2dd4bf', '#5eead4'], // teal
  ['#06b6d4', '#22d3ee', '#67e8f9'], // cyan
  ['#3b82f6', '#60a5fa', '#93c5fd'], // blue
]

type Shape = (cx: number, cy: number, size: number, color: string, rotation: number) => string

const shapes: Shape[] = [
  // Circle
  (cx, cy, size, color) =>
    `<circle cx="${cx}" cy="${cy}" r="${size * 0.4}" fill="${color}" opacity="0.8"/>`,
  // Square
  (cx, cy, size, color, rotation) => {
    const s = size * 0.65
    return `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" fill="${color}" opacity="0.8" transform="rotate(${rotation},${cx},${cy})"/>`
  },
  // Triangle
  (cx, cy, size, color, rotation) => {
    const r = size * 0.42
    const points = [0, 1, 2].map((i) => {
      const angle = (i * 120 - 90) * (Math.PI / 180)
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
    }).join(' ')
    return `<polygon points="${points}" fill="${color}" opacity="0.8" transform="rotate(${rotation},${cx},${cy})"/>`
  },
  // Diamond
  (cx, cy, size, color, rotation) => {
    const r = size * 0.42
    const points = [0, 1, 2, 3].map((i) => {
      const angle = (i * 90) * (Math.PI / 180)
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
    }).join(' ')
    return `<polygon points="${points}" fill="${color}" opacity="0.8" transform="rotate(${rotation},${cx},${cy})"/>`
  },
  // Hexagon
  (cx, cy, size, color, rotation) => {
    const r = size * 0.38
    const points = [0, 1, 2, 3, 4, 5].map((i) => {
      const angle = (i * 60 - 30) * (Math.PI / 180)
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
    }).join(' ')
    return `<polygon points="${points}" fill="${color}" opacity="0.8" transform="rotate(${rotation},${cx},${cy})"/>`
  },
]

export function generateIdenticon(name: string): string {
  const values = hash(name)
  const palette = palettes[values[0] % palettes.length]
  const bgColor = palette[0]

  const w = 300
  const h = 400

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">`

  // Background gradient
  svg += `<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">`
  svg += `<stop offset="0%" style="stop-color:${palette[0]}"/>`
  svg += `<stop offset="100%" style="stop-color:${palette[1]}"/>`
  svg += `</linearGradient></defs>`
  svg += `<rect width="${w}" height="${h}" fill="url(#bg)"/>`

  // Grid: 3 columns x 4 rows of shapes, mirrored horizontally for symmetry
  const cols = 3
  const rows = 4
  const cellW = w / cols
  const cellH = h / rows

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < Math.ceil(cols / 2); col++) {
      const idx = row * Math.ceil(cols / 2) + col
      const v = values[idx % values.length]

      // Decide whether to draw a shape (roughly 60% chance)
      if (v % 5 < 2) continue

      const shape = shapes[v % shapes.length]
      const color = v % 3 === 0 ? palette[2] : v % 3 === 1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)'
      const rotation = (v % 12) * 30

      const cx = col * cellW + cellW / 2
      const cy = row * cellH + cellH / 2
      const size = cellW * 0.8

      // Draw shape and its mirror
      svg += shape(cx, cy, size, color, rotation)
      const mirrorCol = cols - 1 - col
      if (mirrorCol !== col) {
        const mcx = mirrorCol * cellW + cellW / 2
        svg += shape(mcx, cy, size, color, rotation)
      }
    }
  }

  svg += `</svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
