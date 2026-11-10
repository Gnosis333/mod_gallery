// A ball's drawn way must stay clear of every pin it does not meet: the kicks of three and five lanes travel
// along the gap between two rows instead of over the pins of their own row.
import { describe, expect, test } from 'claude-code/testing'
import { makeLayout, pathOf, walk } from './register'
const seeded = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646 }
const sample = (d: string) => {
  const t = d.match(/[MLQC]|-?\d+(?:\.\d+)?/g)!
  const pts: { x: number; y: number; seg: number }[] = []
  let i = 0, cx = 0, cy = 0, seg = -1, prev = ''
  const num = () => parseFloat(t[i++]!)
  while (i < t.length) {
    const c = t[i++]!
    if (c === 'M') { cx = num(); cy = num(); continue }
    if (!(c === 'L' && prev === 'C')) seg++
    prev = c
    const n = c === 'L' ? 1 : c === 'Q' ? 2 : 3
    const p = [{ x: cx, y: cy }]
    for (let k = 0; k < n; k++) p.push({ x: num(), y: num() })
    for (let s = 0; s <= 40; s++) {
      const u = s / 40, v = 1 - u
      let x: number, y: number
      if (n === 1) { x = v * p[0]!.x + u * p[1]!.x; y = v * p[0]!.y + u * p[1]!.y }
      else if (n === 2) { x = v * v * p[0]!.x + 2 * u * v * p[1]!.x + u * u * p[2]!.x; y = v * v * p[0]!.y + 2 * u * v * p[1]!.y + u * u * p[2]!.y }
      else { x = v ** 3 * p[0]!.x + 3 * v * v * u * p[1]!.x + 3 * v * u * u * p[2]!.x + u ** 3 * p[3]!.x; y = v ** 3 * p[0]!.y + 3 * v * v * u * p[1]!.y + 3 * v * u * u * p[2]!.y + u ** 3 * p[3]!.y }
      pts.push({ x, y, seg })
    }
    cx = p[n]!.x; cy = p[n]!.y
  }
  return pts
}
describe('ball paths', () => {
  test('a ball never runs through a pin it does not meet, including after a strong kick or a bumper', () => {
    const rand = seeded(5)
    let hops = 0, bad = 0, worst = 99
    const byLen: Record<number, number> = {}
    for (let L = 0; L < 60; L++) {
      const layout = makeLayout(L, rand)
      const gap = new Set(layout.gaps), bump = new Set(layout.bumpers), gold = new Set(layout.golds)
      for (let i = 0; i < 25; i++) {
        const start = 2 * Math.floor(rand() * 14)
        const { lanes, hits } = walk(layout, start, 0, rand)
        const ball: any = { id: i, start, lanes, hits, color: '#fff' }
        const pts = sample(pathOf(ball, 0))
        for (let r = 0; r < 12; r++) {
          const a = lanes[r]!, b = lanes[r + 1]!
          const n = Math.abs(b - a)
          if (n === 0) continue
          hops++
          const mine = pts.filter(q => q.seg === r + 1)
          let bad1 = false
          for (const rr of [r - 1, r, r + 1, r + 2]) for (let p = rr % 2; p <= 26; p += 2) {
            if (rr < 0 || rr > 12 || gap.has(rr * 100 + p)) continue
            if ((rr === r && p === a) || (rr === r + 1 && p === b)) continue
            const px = 14 + p * 12, py = 64 + rr * 40
            const pr = bump.has(rr * 100 + p) ? 7.5 : gold.has(rr * 100 + p) ? 3.8 : 3.6
            for (const q of mine) { const dd = Math.hypot(q.x - px, q.y - py) - pr - 5.5; worst = Math.min(worst, dd); if (dd < -2.5) bad1 = true }
          }
          if (bad1) { bad++; byLen[n] = (byLen[n] ?? 0) + 1 }
        }
      }
    }
    expect(hops).toBeGreaterThan(10_000)
    expect(Object.keys(byLen)).toEqual([])
    expect(bad).toBe(0)
    expect(worst).toBeGreaterThan(-2.5)
  })
})
