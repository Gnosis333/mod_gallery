import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import type { Rain } from '../types'

const PANE = 'rain-window'
const TITLE = '창가'
const ALT = '비 오는 창가. 빗방울이 유리를 타고 내려가며 합쳐지고, 밖으로 도시 불빛이 번지며, 고양이가 창턱에서 졸고 있습니다.'

// ---scene-start
const W = 400
const H = 1400
const GL = 30 // the glass: left, right, top, bottom
const GR = 370
const GT = 30
const GB = 1010 // and the sill it sits on

const n = (v: number) => String(Math.round(v * 10) / 10)
const r3 = (v: number) => String(Math.round(v * 1000) / 1000)
const EASE = '.45 0 .55 1'
const pick = <T,>(list: T[], s: number): T => list[((s % list.length) + list.length) % list.length]
const rnd = (s: number) => {
  const v = Math.sin(s * 127.1 + 311.7) * 43758.5453

  return v - Math.floor(v)
}

// Looping motion shifts back by the time already elapsed, so redrawing the picture never makes it jump.
// Tags marked data-once (a fade for work, the rainbow coming out) are left alone and play from the start.
const retime = (svg: string, elapsed: number) =>
  svg.replace(/<(animate|animateTransform|animateMotion)\b[^>]*>/g, tag => {
    if (tag.includes('data-once')) {
      return tag
    }
    const found = / begin="(-?[\d.]+)s"/.exec(tag)
    const shifted = ` begin="${n((found ? parseFloat(found[1]) : 0) - elapsed)}s"`

    return found ? tag.replace(found[0], shifted) : tag.replace(/^<(\w+)/, `<$1${shifted}`)
  })

// ---- outside: the sky, the city and its blurred lights -----------------------------------------
const SKY =
  `<rect x="${GL}" y="${GT}" width="${GR - GL}" height="${GB - GT}" fill="url(#night)"/>` +
  `<rect x="${GL}" y="700" width="${GR - GL}" height="${GB - 700}" fill="url(#glow)"/>`

const skyline = (fill: string, base: number, minH: number, maxH: number, seed: number, lights: string) => {
  let x = GL - 10
  let out = ''
  for (let k = 0; x < GR; k++) {
    const w = 22 + rnd(seed + k) * 30
    const h = minH + rnd(seed + k + 100) * (maxH - minH)
    out += `<rect x="${n(x)}" y="${n(base - h)}" width="${n(w)}" height="${n(h + 2)}" fill="${fill}"/>`
    if (lights) {
      out += `<path d="M${n(x + 5)} ${n(base - h + 10)} V${base}" stroke="${lights}" stroke-width="3" stroke-dasharray="3 ${n(7 + rnd(seed + k + 50) * 6)}" opacity=".55"/>`
    }
    x += w + 2 + rnd(seed + k + 200) * 4
  }

  return out
}

const CITY = skyline('#2a2150', 970, 120, 300, 10, '#ffd68a') + skyline('#171233', 1010, 70, 190, 60, '#ffb878')

const BOKEH_COLORS = ['#ffb347', '#ff6f91', '#6fd3ff', '#fff3a8', '#ff9a5c', '#b58cff']
const BOKEH = Array.from({ length: 30 }, (_, k) => {
  const x = GL + 10 + rnd(k + 300) * (GR - GL - 20)
  const y = 760 + rnd(k + 320) * 240
  const r = 7 + rnd(k + 340) * 16
  const c = pick(BOKEH_COLORS, k + Math.floor(rnd(k) * 5))
  const twinkle = k % 2 === 0 ? `<animate attributeName="opacity" values=".18;.34;.18" dur="${n(3 + rnd(k + 5) * 4)}s" begin="${n(-rnd(k + 6) * 6)}s" repeatCount="indefinite"/>` : ''

  return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${c}" opacity=".24">${twinkle}</circle><circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.5)}" fill="${c}" opacity=".3"/>`
}).join('')

// the light that falls on the glass from the room's lamp
const lamplight = (storm: boolean) => flicker(storm, LAMPLIGHT)

const LAMPLIGHT_CIRCLES = [150, 100, 60]
  .map((r, k) => `<circle cx="345" cy="985" r="${r}" fill="#ffd9a0" opacity="${[0.05, 0.07, 0.09][k]}"/>`)
  .join('')
const LAMPLIGHT = LAMPLIGHT_CIRCLES

// ---- the rain outside, drops on the glass --------------------------------------------------------------
const streaks = (count: number, fast: boolean) =>
  Array.from({ length: count }, (_, k) => {
    const x = GL - 20 + rnd(k + 400) * (GR - GL + 60)
    const dur = (fast ? 0.42 : 0.7) + rnd(k + 410) * 0.3

    return `<path d="M${n(x)} ${GT - 40} l-4 ${fast ? 22 : 16}" stroke="#bcd4ff" stroke-width="${fast ? 1.4 : 1.1}" stroke-linecap="round" opacity="${fast ? 0.55 : 0.4}"><animateTransform attributeName="transform" type="translate" values="0 0;-${n((GB - GT) * 0.14)} ${GB - GT + 60}" dur="${n(dur)}s" begin="${n(-rnd(k + 420))}s" repeatCount="indefinite"/></path>`
  }).join('')

const still = Array.from({ length: 34 }, (_, k) => {
  const x = GL + 6 + rnd(k + 500) * (GR - GL - 12)
  const y = GT + 20 + rnd(k + 520) * (GB - GT - 40)
  const rx = 1.4 + rnd(k + 540) * 2
  const ry = rx * (1.2 + rnd(k + 560) * 0.5)

  return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="#dbe9ff" opacity=".32"/><circle cx="${n(x - rx * 0.3)}" cy="${n(y - ry * 0.3)}" r="${n(rx * 0.35)}" fill="#fff" opacity=".7"/>`
}).join('')

const drop = (size: number) =>
  `<ellipse cy="${n(-size * 2.4)}" rx=".8" ry="${n(size * 2.6)}" fill="#dbe9ff" opacity=".22"/>` +
  `<ellipse rx="${n(size * 0.8)}" ry="${n(size)}" fill="#dbe9ff" opacity=".6" stroke="#9fb6e0" stroke-width=".4"/><circle cx="${n(-size * 0.25)}" cy="${n(-size * 0.3)}" r="${n(size * 0.28)}" fill="#fff" opacity=".85"/>`

// A drop runs down the glass in fits and starts; a smaller one slides in from above, joins it, and it grows.
const runner = (k: number, fast: boolean) => {
  const x = GL + 26 + rnd(k + 600) * (GR - GL - 52)
  const p0 = GT + 30 + rnd(k + 610) * 320
  const total = GB - 10 - p0
  const shares = [0.12, 0.2, 0.24, 0.44]
  const ps = [p0]
  for (const s of shares) ps.push(ps[ps.length - 1] + total * s)
  const xs = ps.map((_, i) => x + (rnd(k * 7 + i) - 0.5) * 9)
  const dur = (fast ? 0.55 : 1) * (12 + rnd(k + 620) * 8)
  const begin = n(-rnd(k + 630) * dur)
  const t = '0;.1;.18;.3;.4;.52;.6;.7;.9;1'
  const A = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4].map(i => `${n(xs[i])} ${n(ps[i])}`).join(';')
  const rep = `dur="${n(dur)}s" begin="${begin}s" repeatCount="indefinite"`
  const size = 3.4 + rnd(k + 640) * 1.6
  // the small one waits above the place where the big one stops second, then slides down into it
  const bx = xs[2] + (rnd(k + 650) - 0.5) * 22
  const B = `${n(bx)} ${n(ps[2] - 70)};${n(bx)} ${n(ps[2] - 70)};${n(xs[2])} ${n(ps[2])}`

  return (
    `<g><animateTransform attributeName="transform" type="translate" values="${A}" keyTimes="${t}" calcMode="linear" ${rep}/>` +
    `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.03;.96;1" ${rep}/>` +
    `<g><animateTransform attributeName="transform" type="scale" values="1 1;1 1;1.5 1.5;1.5 1.5" keyTimes="0;.4;.45;1" ${rep}/>${drop(size)}</g></g>` +
    `<g opacity="0"><animateTransform attributeName="transform" type="translate" values="${B}" keyTimes="0;.28;.4" calcMode="linear" fill="freeze" ${rep}/>` +
    `<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.03;.4;.41;1" ${rep}/>${drop(size * 0.6)}</g>`
  )
}

// ---- the sky for a storm and for a rainbow -------------------------------------------------------------------------
// the two lightning strokes: where, how often, and when the first one falls
const BOLTS: [number, number, number][] = [
  [130, 9, 2],
  [280, 13, 7],
]
const FLASH_TIMES = '0;.5;.52;.55;.58;.62;.66;1'

const bolt = (x: number, period: number, begin: number) => {
  const pts = [[x, GT], [x - 14, 190], [x + 4, 200], [x - 22, 420], [x - 8, 430], [x - 36, 640]]
  const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(' ')
  const times = FLASH_TIMES

  return (
    `<path d="${d}" fill="none" stroke="#f4f0ff" stroke-width="3.4" stroke-linejoin="round" opacity="0"><animate attributeName="opacity" values="0;0;1;.2;1;.3;0;0" keyTimes="${times}" dur="${period}s" begin="${n(-begin)}s" repeatCount="indefinite"/></path>` +
    `<rect x="${GL}" y="${GT}" width="${GR - GL}" height="${GB - GT}" fill="#eaf0ff" opacity="0"><animate attributeName="opacity" values="0;0;.55;.1;.4;.1;0;0" keyTimes="${times}" dur="${period}s" begin="${n(-begin)}s" repeatCount="indefinite"/></rect>`
  )
}

const RAINBOW = ['#ff4d4d', '#ff944d', '#ffd84d', '#6ed36e', '#4db8ff', '#5a6bff', '#a05aff']
const RAINBOW_LIFE = 15 // seconds from coming out to gone: it fades in, hangs, then fades away

// `age` is how long ago it began, so a picture drawn again carries on from there instead of starting over.
const rainbow = (age: number) =>
  `<g opacity="0"><animate data-once="1" attributeName="opacity" values="0;1;1;0" keyTimes="0;.2;.75;1" dur="${RAINBOW_LIFE}s" begin="${n(-age)}s" fill="freeze"/>` +
  RAINBOW.map((c, k) => {
    const r = 170 - k * 8

    return `<path d="M${200 - r} 420 A${r} ${r} 0 0 1 ${200 + r} 420" fill="none" stroke="${c}" stroke-width="9" opacity=".55"><animate attributeName="opacity" values=".45;.68;.45" dur="${n(5 + k * 0.3)}s" repeatCount="indefinite"/></path>`
  }).join('') +
  '</g>'

// ---- the room: the sill, the cat and what stands on it ---------------------------------------------------------------
// A flash of lightning wakes the cat for a moment: yellow-green eyes, slit pupils, then it dozes off again.
const openEye = (x: number) =>
  `<ellipse cx="${x}" cy="-17" rx="4.6" ry="4.8" fill="#8d8f9b"/><circle cx="${x}" cy="-17" r="3.5" fill="#c6e04a"/><ellipse cx="${x}" cy="-17" rx="1" ry="3.2" fill="#1a1a1a"/><circle cx="${x - 1.2}" cy="-18.4" r=".9" fill="#fff"/>`

const openEyes = () =>
  BOLTS.map(
    ([, period, begin]) =>
      `<g opacity="0"><animate attributeName="opacity" values="0;0;1;1;1;1;0;0" keyTimes="${FLASH_TIMES}" dur="${period}s" begin="${n(-begin)}s" repeatCount="indefinite"/>${openEye(27)}${openEye(40)}</g>`,
  ).join('')

// The lamp's light stutters out and back while the lightning lasts, for each of the two strokes in turn.
// `only` shows the thing just during the flicker (the dark shade); otherwise it is the light that dips.
const FLICKER_DIP = '1;1;.1;.9;.2;.8;1;1'
const FLICKER_SHOW = '0;0;1;.2;1;.3;0;0'
const flicker = (storm: boolean, inner: string, only = false) => {
  if (!storm) {
    return inner
  }
  const wrapFor = ([, period, begin]: [number, number, number], what: string) =>
    `<g><animate attributeName="opacity" values="${only ? FLICKER_SHOW : FLICKER_DIP}" keyTimes="${FLASH_TIMES}" dur="${period}s" begin="${n(-begin)}s" repeatCount="indefinite"/>${what}</g>`

  // dips multiply when nested; things that only show during a stroke must sit side by side instead
  return only ? BOLTS.map(bolt => wrapFor(bolt, inner)).join('') : BOLTS.reduce((acc, bolt) => wrapFor(bolt, acc), inner)
}

// the z's of its sleep
const ZZZ =
  [0, 1, 2]
    .map(
      k =>
        `<path d="M${52 + k * 8} -50 h6 l-6 7 h6" fill="none" stroke="#cfd8ff" stroke-width="1.4" stroke-linejoin="round" opacity="0"><animateTransform attributeName="transform" type="translate" values="0 0;${6 + k * 2} -26" dur="4.2s" begin="${n(-k * 1.4)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.8;0" dur="4.2s" begin="${n(-k * 1.4)}s" repeatCount="indefinite"/></path>`,
    )
    .join('')

// hidden for as long as the lightning lasts, for each of the two strokes in turn
const quiet = (inner: string) =>
  BOLTS.reduce(
    (acc, [, period, begin]) => `<g><animate attributeName="opacity" values="1;1;0;0;0;0;1;1" keyTimes="${FLASH_TIMES}" dur="${period}s" begin="${n(-begin)}s" repeatCount="indefinite"/>${acc}</g>`,
    inner,
  )

const catArt = (storm: boolean) =>
  // tail
  `<g><animateTransform attributeName="transform" type="rotate" values="-5 -34 -8;7 -34 -8;-5 -34 -8" dur="5s" repeatCount="indefinite"/>` +
  '<path d="M-36 -8 Q-62 -8 -52 10 Q-44 18 -10 12" fill="none" stroke="#7d7f8c" stroke-width="9" stroke-linecap="round"/><path d="M-52 10 Q-44 18 -26 15" fill="none" stroke="#595b68" stroke-width="9" stroke-linecap="round"/></g>' +
  // the loaf of a body, breathing
  `<g><animateTransform attributeName="transform" type="scale" values="1 1;1 1.04;1 1" dur="3.6s" repeatCount="indefinite"/>` +
  '<ellipse cx="0" cy="-22" rx="40" ry="22" fill="#8d8f9b"/><ellipse cx="4" cy="-8" rx="32" ry="9" fill="#a9abb6" opacity=".6"/>' +
  '<path d="M-20 -40 q4 10 0 20 M-6 -43 q4 10 0 22 M8 -43 q4 10 0 22 M20 -39 q4 10 0 18" fill="none" stroke="#6d6f7c" stroke-width="3" stroke-linecap="round"/>' +
  '<ellipse cx="36" cy="-3" rx="10" ry="4.4" fill="#9a9ca8"/>' +
  // the head, resting on its paws
  '<circle cx="30" cy="-17" r="15" fill="#8d8f9b"/>' +
  '<path d="M17 -27 L20 -43 L31 -31Z M43 -27 L40 -43 L29 -31Z" fill="#8d8f9b"/><path d="M20 -30 L21 -38 L27 -32Z M40 -30 L39 -38 L33 -32Z" fill="#e8a9b0"/>' +
  `<g><animateTransform attributeName="transform" type="rotate" values="0 40 -40;0 40 -40;-14 40 -40;0 40 -40;0 40 -40" keyTimes="0;.86;.9;.94;1" dur="9s" repeatCount="indefinite"/><path d="M43 -27 L40 -43 L29 -31Z" fill="#8d8f9b"/></g>` +
  '<path d="M23 -17 q4 4 8 0 M36 -17 q4 4 8 0" fill="none" stroke="#2a2a33" stroke-width="1.6" stroke-linecap="round"/><path d="M32 -11 l3 0 l-1.5 2.4Z" fill="#e8a9b0"/>' +
  (storm ? openEyes() : '') +
  '<path d="M40 -10 l14 -3 M40 -8 l14 1 M24 -10 l-12 -3 M24 -8 l-12 1" stroke="#d9dbe6" stroke-width=".7" opacity=".8"/>' +
  '</g>' +
  // sleep, drifting up; a flash of lightning wakes the cat, so the z's go with it
  (storm ? quiet(ZZZ) : ZZZ)

const MUG =
  '<rect x="-9" y="-18" width="18" height="18" rx="3" fill="#e8e2d4"/><path d="M9 -13 q8 0 8 6 q0 6 -8 6" fill="none" stroke="#e8e2d4" stroke-width="3"/><ellipse cy="-18" rx="9" ry="2.4" fill="#6b4a2e"/>' +
  [0, 1]
    .map(
      k =>
        `<path d="M${k * 6 - 3} -22 q-4 -8 0 -14 q4 -6 0 -12" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0"><animateTransform attributeName="transform" type="translate" values="0 0;0 -10" dur="3s" begin="${n(-k * 1.5)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.5;0" dur="3s" begin="${n(-k * 1.5)}s" repeatCount="indefinite"/></path>`,
    )
    .join('')

const PLANT =
  '<path d="M-13 -22 H13 L10 0 H-10Z" fill="#b5651d"/><rect x="-14" y="-26" width="28" height="6" rx="2" fill="#c97b2d"/>' +
  `<g><animateTransform attributeName="transform" type="rotate" values="-2 0 -26;2 0 -26;-2 0 -26" dur="4.5s" repeatCount="indefinite"/>` +
  [-60, -30, 0, 30, 60]
    .map((a, k) => `<path d="M0 -26 Q${a * 0.5} -${46 + (k % 2) * 8} ${a * 0.9} -${58 + (k % 3) * 6} Q${a * 0.3} -${42 + (k % 2) * 8} 0 -26Z" fill="${pick(['#3f9a55', '#58b06b', '#2f7d46'], k)}"/>`)
    .join('') +
  '</g>'

const lampArt = (storm: boolean) =>
  '<rect x="-3" y="-60" width="6" height="60" fill="#3b2f26"/><ellipse cy="-1" rx="16" ry="4" fill="#3b2f26"/>' +
  '<path d="M-20 -60 L-12 -92 H12 L20 -60Z" fill="#ffcf88"/><ellipse cy="-60" rx="20" ry="4" fill="#ffe3b3"/>' +
  // in a storm the shade goes dark with each stroke, as if the power flickered
  (storm ? flicker(true, '<path d="M-20 -60 L-12 -92 H12 L20 -60Z" fill="#3b2f26" opacity=".78"/><ellipse cy="-60" rx="20" ry="4" fill="#5a4636" opacity=".78"/>', true) : '') +
  flicker(
    storm,
    `<ellipse cy="-76" rx="26" ry="38" fill="#ffd9a0" opacity=".2"><animate attributeName="opacity" values=".16;.26;.16" dur="4.4s" repeatCount="indefinite"/></ellipse>`,
  )

const BOOKS = [
  [-18, 11, '#c0503f'],
  [-16, 9, '#3f6fb0'],
  [-14, 10, '#e0b43a'],
]
  .map(([dx, h, c], i) => `<rect x="${dx}" y="${-(i + 1) * 11}" width="${36 - i * 4}" height="10" rx="1.4" fill="${c}"/>`)
  .join('')

const ROOM =
  // the wall and floor below the sill
  `<rect x="0" y="${GB + 32}" width="${W}" height="${H - GB - 32}" fill="url(#wall)"/>` +
  Array.from({ length: 11 }, (_, k) => `<rect x="${k * 40 + 10}" y="${GB + 32}" width="16" height="${H - GB - 32 - 70}" fill="#fff" opacity=".025"/>`).join('') +
  // two shelves with books and a few things
  [1118, 1232]
    .map((y, row) => {
      let books = ''
      let x = 52
      for (let k = 0; x < 340; k++) {
        const w = 8 + rnd(k + row * 30 + 700) * 8
        const h = 34 + rnd(k + row * 30 + 720) * 22
        books += `<rect x="${n(x)}" y="${n(y - h)}" width="${n(w)}" height="${n(h)}" fill="${pick(['#8e3f3a', '#35577d', '#b58a35', '#4a6b4c', '#6c4a7a', '#a8645a'], k + row * 3)}"/>`
        x += w + 1
      }

      return `${books}<rect x="38" y="${y}" width="324" height="8" fill="#5a3f28"/>`
    })
    .join('') +
  // the floor, and a rug
  `<rect x="0" y="1334" width="${W}" height="66" fill="#4a3322"/><rect x="0" y="1330" width="${W}" height="6" fill="#2a1d14"/>` +
  '<ellipse cx="210" cy="1372" rx="150" ry="20" fill="#7a3a4a"/><ellipse cx="210" cy="1372" rx="120" ry="14" fill="none" stroke="#e8c9a0" stroke-width="2" opacity=".6"/>'

const SILL =
  `<rect x="0" y="${GB}" width="${W}" height="14" fill="#8a6440"/><rect x="0" y="${GB + 14}" width="${W}" height="18" fill="#5e4129"/>` +
  `<rect x="0" y="${GB}" width="${W}" height="3" fill="#b88a5a" opacity=".7"/>`

const FRAME =
  `<rect x="0" y="0" width="${GL}" height="${GB}" fill="#e8e2d4"/><rect x="${GR}" y="0" width="${W - GR}" height="${GB}" fill="#e8e2d4"/>` +
  `<rect x="0" y="0" width="${W}" height="${GT}" fill="#e8e2d4"/><rect x="${GL}" y="${GT}" width="${GR - GL}" height="4" fill="#bfb8a6"/>` +
  `<rect x="197" y="${GT}" width="6" height="${GB - GT}" fill="#e8e2d4"/><rect x="${GL}" y="500" width="${GR - GL}" height="6" fill="#e8e2d4"/>` +
  `<rect x="${GL - 3}" y="${GT}" width="3" height="${GB - GT}" fill="#bfb8a6"/><rect x="${GR}" y="${GT}" width="3" height="${GB - GT}" fill="#bfb8a6"/>` +
  // the latch
  `<rect x="188" y="740" width="24" height="8" rx="3" fill="#a89a7a"/>`

const WORK_DARK = 0.3

const buildScene = (w: Rain, elapsed: number, vh: number, now: number) => {
  const view = Math.min(H, Math.max(vh, 240))
  const y0 = H - view
  const storm = w.working
  const sinceEnd = (now - w.endedAt) / 1000
  const done = !w.working && w.endedAt > 0 && sinceEnd < RAINBOW_LIFE
  const since = (now - w.startedAt) / 1000
  const darkFrom = storm ? Math.min(1, since / 1.4) * WORK_DARK : 0

  const defs =
    '<defs>' +
    '<linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1130"/><stop offset=".55" stop-color="#2b2255"/><stop offset="1" stop-color="#5a2f5a"/></linearGradient>' +
    '<linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a5c" stop-opacity="0"/><stop offset="1" stop-color="#ff9a5c" stop-opacity=".5"/></linearGradient>' +
    '<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2c3a"/><stop offset="1" stop-color="#241a24"/></linearGradient>' +
    '<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0ff" stop-opacity="0"/><stop offset="1" stop-color="#cfe0ff" stop-opacity=".16"/></linearGradient>' +
    `<clipPath id="glass"><rect x="${GL}" y="${GT}" width="${GR - GL}" height="${GB - GT}"/></clipPath>` +
    '</defs>'

  const drops = Array.from({ length: 10 }, (_, k) => runner(k, storm)).join('')
  const outside =
    SKY +
    CITY +
    BOKEH +
    (done ? rainbow(Math.max(0, sinceEnd)) : '') +
    // a storm darkens the sky and then flashes; at rest the rain is light
    (storm
      ? `<rect x="${GL}" y="${GT}" width="${GR - GL}" height="${GB - GT}" fill="#06112a" opacity="${r3(darkFrom)}"><animate data-once="1" attributeName="opacity" values="${r3(darkFrom)};${WORK_DARK}" dur="${n(1.4 * (1 - darkFrom / WORK_DARK))}s" fill="freeze"/></rect>` + BOLTS.map(([x, period, begin]) => bolt(x, period, begin)).join('')
      : '') +
    streaks(storm ? 46 : 18, storm)

  const glass =
    `<g clip-path="url(#glass)">${outside}` +
    `<rect x="${GL}" y="700" width="${GR - GL}" height="${GB - 700}" fill="url(#fog)"/>` +
    `<polygon points="60,${GT} 100,${GT} 20,${GB} -20,${GB}" fill="#fff" opacity=".04"/>` +
    still +
    drops +
    '</g>'

  const room =
    ROOM +
    `<g transform="translate(335 ${GB})">${lampArt(storm)}</g>` +
    SILL +
    `<g transform="translate(150 ${GB})">${catArt(storm)}</g>` +
    `<g transform="translate(64 ${GB})">${MUG}</g>` +
    `<g transform="translate(250 ${GB})">${BOOKS}</g>` +
    `<g transform="translate(306 ${GB})">${PLANT}</g>` +
    lamplight(storm)

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${n(y0)} ${W} ${n(view)}" width="${W}" height="${n(view)}" preserveAspectRatio="xMidYMax slice">${defs}` +
    `<rect x="0" y="${n(y0)}" width="${W}" height="${n(view)}" fill="#1b1624"/>` +
    retime(glass + FRAME + room, elapsed) +
    '</svg>'
  )
}
// ---scene-end

const TERMINAL_ART: [string, string][] = [
  ['  ┌───────┬───────┐', '#e8e2d4'],
  ['  │ ╲ ╲ ╲ │ ╲ ╲ ╲ │', '#8fb4ff'],
  ['  │  ╲ ╲  │  ╲ ╲  │', '#8fb4ff'],
  ['  ├───────┼───────┤', '#e8e2d4'],
  ['  │ ✦  ✦ ✦│ ✦   ✦ │', '#ffb347'],
  ['  └───────┴───────┘', '#e8e2d4'],
  ['  ━━━━ ᓚᘏᗢ ━━━━━━', '#a9abb6'],
]

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))

  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const label = (w: Rain, now: number) => (w.working ? `작업 중 ${clock(now - w.startedAt)} · 도구 ${w.tools}회` : '쉬는 중')

const rain = atom(
  { plugin: 'rain-window', key: 'window' } as const,
  { working: false, prev: false, tools: 0, startedAt: 0, endedAt: 0, tick: 0 } as Rain,
)

// The picture is built again only when the state it draws changes; the same text keeps it running.
let t0 = 0
let cache = { key: '', svg: '' }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    t0 = await $.clock.now()
    await $.command.register({
      name: 'rain',
      description: 'Open the rainy window pane',
    })
    // Wakes the pane each second while Claude works, for the stopwatch in its top line.
    $.clock.every(1000, () => {
      void read($, rain)
        .then(r => (r.working ? update($, rain, v => ({ ...v, tick: v.tick + 1 })) : undefined))
        .catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'rain' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: '창가를 열었습니다.' }
  })

  // The main loop's turns only: a subagent's run is not Claude at work.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, rain, v => ({ ...v, prev: false, working: true, tools: 0, startedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, rain, v => ({ ...v, prev: true, working: false, endedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await update($, rain, v => ({ ...v, tools: v.tools + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const w = await read($, rain)
    const now = await $.clock.now()
    if (t0 === 0) t0 = now
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 20
    const line = label(w, now)

    if (e.surface !== 'terminal') {
      const { Box, Text, Svg } = els as ElementTable<'desktop'>
      // The pane's px: its cells over the code font's advance (about 7.8 px) and line height
      // (about 19.5 px). Short of the whole picture, the top of the window is cut, never the sill.
      const width = Math.max(160, Math.round(cols * 7.8))
      const full = Math.round((width * H) / W)
      const tall = e.props?.scroll?.bodyRows ? Math.round((rows - 1) * 19.5) : full
      const height = Math.min(full, tall)
      // the fade into the storm lasts 1.4 s; a rebuild after that draws it settled
      const settling = w.working && (now - w.startedAt) / 1000 < 1.4
      const key = `${w.working}|${settling}|${w.startedAt}|${w.endedAt}|${height}|${width}`
      if (cache.key !== key) cache = { key, svg: buildScene(w, (now - t0) / 1000, (height * W) / width, now) }

      return (
        <Box flexDirection="column" justifyContent="flex-end" minHeight={rows}>
          <Box justifyContent="center">
            <Text bold={w.working} dimColor={!w.working}>
              {line}
            </Text>
          </Box>
          <Svg source={cache.svg} alt={ALT} width={width} height={height} isInteractive />
        </Box>
      )
    }

    const { Box, Text } = els as ElementTable<'terminal'>

    return (
      <Box flexDirection="column">
        {TERMINAL_ART.map(([row, color]) => (
          <Text color={color}>{row}</Text>
        ))}
        <Text>{line}</Text>
        <Text dimColor>그림 움직임은 데스크톱 앱에서 보입니다.</Text>
      </Box>
    )
  })
}
