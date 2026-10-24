import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import type { Camp } from '../types'

const PANE = 'campfire'
const TITLE = '모닥불'
const ALT = '별이 가득한 밤, 빽빽한 숲속 공터의 모닥불. 불꽃이 일렁이고 불티가 탁탁 튀어 오르며, 꽃들이 둘레에 피어 있고, 가끔 여우가 지나가거나 올빼미가 앉아 고개를 돌립니다.'

// ---scene-start
type Fire = { working: boolean; startedAt: number; endedAt: number }
type Key = [number, number, number] // seconds into the loop, x, y

const W = 400
const H = 1200
const FX = 200 // the fire
const FY = 968
const RISE = 2.5 // seconds for the fire to build up
const FALL = 4 // and to die back

const n = (v: number) => String(Math.round(v * 10) / 10)
const r3 = (v: number) => String(Math.round(v * 1000) / 1000)
const EASE = '.45 0 .55 1'
const rnd = (s: number) => {
  const v = Math.sin(s * 127.1 + 311.7) * 43758.5453

  return v - Math.floor(v)
}

// Looping motion shifts back by the time already elapsed, so redrawing the picture never makes it jump.
// Tags marked data-once (the fire building up or dying back) are timed from now and left alone.
const retime = (svg: string, elapsed: number) =>
  svg.replace(/<(animate|animateTransform|animateMotion)\b[^>]*>/g, tag => {
    if (tag.includes('data-once')) {
      return tag
    }
    const found = / begin="(-?[\d.]+)s"/.exec(tag)
    const shifted = ` begin="${n((found ? parseFloat(found[1] ?? '0') : 0) - elapsed)}s"`

    return found ? tag.replace(found[0], shifted) : tag.replace(/^<(\w+)/, `<$1${shifted}`)
  })

const track = (keys: Key[], period: number, begin: number) =>
  `<animateTransform attributeName="transform" type="translate" values="${keys.map(([, x, y]) => `${n(x)} ${n(y)}`).join(';')}" keyTimes="${keys.map(([t]) => r3(t / period)).join(';')}" dur="${period}s" begin="${begin}s" repeatCount="indefinite"/>`

// ---- the night sky ---------------------------------------------------------------------------------------
const STARS = Array.from({ length: 70 }, (_, k) => {
  const x = rnd(k) * 400
  const y = rnd(k + 100) * 560
  const r = 0.5 + rnd(k + 200) * 1.2
  const tw = k % 3 === 0 ? `<animate attributeName="opacity" values=".9;.25;.9" dur="${n(2 + rnd(k + 300) * 4)}s" begin="${n(-rnd(k + 400) * 5)}s" repeatCount="indefinite"/>` : ''

  return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="#fff8e0" opacity=".85">${tw}</circle>`
}).join('')

const SKY =
  `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#sky)"/>` +
  // the milky way, a soft band across the sky
  '<path d="M-40 120 Q160 220 440 80 L440 150 Q170 300 -40 200Z" fill="#b8c8ff" opacity=".03"/>' +
  STARS +
  '<circle cx="316" cy="112" r="44" fill="#fff6d8" opacity=".08"/><circle cx="316" cy="112" r="18" fill="#fff4cc"/><circle cx="324" cy="106" r="16" fill="#0e1430"/>' +
  // a shooting star now and then
  '<path d="M0 0 L40 -16" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0"><animateTransform attributeName="transform" type="translate" values="300 60;180 110;180 110" keyTimes="0;.05;1" dur="31s" begin="-9s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.01;.05;1" dur="31s" begin="-9s" repeatCount="indefinite"/></path>'

// ---- ridges covered in forest, and the dense woods round the clearing ---------------------------------------
// a ridge whose skyline is a row of treetops
const ridge = (base: number, amp: number, phase: number, color: string, k: number, spikes = 9) => {
  let d = `M-10 ${H}`
  for (let x = -10; x <= 410; x += 9) {
    const y = base + Math.sin(x / 70 + phase) * amp + Math.sin(x / 23 + phase * 2) * amp * 0.25
    const tip = spikes * (0.6 + rnd(x + k) * 0.8)
    d += ` L${n(x)} ${n(y)} L${n(x + 4.5)} ${n(y - tip)}`
  }

  return `<path d="${d} L410 ${H}Z" fill="${color}"/>`
}

const RIDGES = ridge(470, 40, 0.4, '#1d2b48', 1, 7) + ridge(560, 34, 2.1, '#16233c', 2, 9) + ridge(650, 28, 4.2, '#111c30', 3, 11)

const pine = (x: number, base: number, h: number, color: string) => {
  const w = h * 0.36
  let d = `M${n(x)} ${n(base - h)}`
  // a ragged silhouette: tiers stepping out on each side
  for (let i = 1; i <= 5; i++) {
    const y = base - h + (h * i) / 5
    const hw = (w * i) / 5
    d += ` L${n(x + hw)} ${n(y)} L${n(x + hw * 0.55)} ${n(y - 2)}`
  }
  d += ` L${n(x - w * 0.55)} ${n(base - 2)}`
  for (let i = 5; i >= 1; i--) {
    const y = base - h + (h * i) / 5
    const hw = (w * i) / 5
    d += ` L${n(x - hw)} ${n(y)} L${n(x - hw * 0.55)} ${n(y - h / 5 + 2)}`
  }

  return `<path d="${d}Z" fill="${color}"/><rect x="${n(x - 2)}" y="${n(base - 3)}" width="4" height="10" fill="${color}"/>`
}

const FOREST =
  Array.from({ length: 30 }, (_, k) => pine(k * 14 - 6 + rnd(k + 500) * 8, 790 + rnd(k + 510) * 20, 110 + rnd(k + 520) * 70, '#0d1828')).join('') +
  Array.from({ length: 22 }, (_, k) => pine(k * 19 - 4 + rnd(k + 600) * 10, 836 + rnd(k + 610) * 16, 120 + rnd(k + 620) * 80, '#0a1220')).join('')

// the big trees framing the scene, and the branch the owl sits on
const FRAME_TREES =
  pine(8, 960, 360, '#080e1a') +
  pine(394, 990, 420, '#080e1a') +
  '<path d="M392 682 Q350 676 296 688" stroke="#1a120c" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M330 684 L318 672 M312 687 L300 680" stroke="#1a120c" stroke-width="3" stroke-linecap="round"/>' +
  // firelight catching their trunks
  '<path d="M24 900 V1010 M384 920 V1040" stroke="#ff9a4a" stroke-width="2" opacity=".25"/>'

// ---- the clearing: ground, a tent, a log to sit on, and the flowers around it -----------------------------
const GROUND =
  '<path d="M-10 860 Q100 846 200 852 T410 858 V1200 H-10Z" fill="#1a140f"/>' +
  '<ellipse cx="200" cy="990" rx="210" ry="90" fill="#2a1e14"/>' +
  // the tent, its open flap glowing faintly
  '<g transform="translate(78 902)"><path d="M-46 0 L0 -64 L46 0Z" fill="#c8963a"/><path d="M0 -64 L46 0 L20 0Z" fill="#a8762a"/><path d="M-12 0 L0 -36 L12 0Z" fill="#3a2410"/><path d="M-6 0 L0 -20 L6 0Z" fill="#ffb060" opacity=".35"/>' +
  '<path d="M0 -64 L-4 -72 M-46 0 L-56 6 M46 0 L56 6" stroke="#5a4020" stroke-width="1.6"/></g>'

// six logs to sit on, set in a ring round the fire; seen from above at a slant, the ones at the sides
// point toward us and look short
const LOG_RING = [30, 90, 150, 210, 270, 330]
  .map(deg => {
    const a = (deg * Math.PI) / 180
    const x = FX + Math.cos(a) * 116
    const y = FY + 10 + Math.sin(a) * 50
    const vx = -Math.sin(a)
    const vy = Math.cos(a) * 0.43
    const len = 70 * Math.hypot(vx, vy)
    const rot = (Math.atan2(vy, vx) * 180) / Math.PI

    return (
      `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)})"><ellipse cx="3" cy="7" rx="${n(len / 2 + 6)}" ry="5" fill="#000" opacity=".25"/>` +
      `<rect x="${n(-len / 2)}" y="-8" width="${n(len)}" height="16" rx="8" fill="#5a3c22"/><path d="M${n(-len / 2 + 6)} -3 H${n(len / 2 - 8)} M${n(-len / 2 + 10)} 3 H${n(len / 2 - 14)}" stroke="#4a2e18" stroke-width="1.4"/>` +
      `<ellipse cx="${n(len / 2)}" cy="0" rx="4.4" ry="8" fill="#b88a5a"/><ellipse cx="${n(len / 2)}" cy="0" rx="2" ry="4.4" fill="none" stroke="#8a6040"/>` +
      `<path d="M${n(-len / 2 + 4)} -7 H${n(len / 2 - 4)}" stroke="#ff9a4a" stroke-width="1.6" opacity=".3"/></g>`
    )
  })
  .join('')

const sway = (dur: number, k: number) =>
  `<animateTransform attributeName="transform" type="rotate" values="-4;4;-4" calcMode="spline" keyTimes="0;.5;1" keySplines="${EASE};${EASE}" dur="${dur}s" begin="${n(-k)}s" repeatCount="indefinite"/>`

// flowers by kind, each drawn at its stem's foot, standing h tall
const FLOWERS: Record<string, (h: number) => string> = {
  daisy: h =>
    `<path d="M0 0 V${-h}" stroke="#3a6a2a" stroke-width="1.6"/><g transform="translate(0 ${-h})">` +
    Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="-5" rx="1.8" ry="4" fill="#f4f0e6" transform="rotate(${i * 45})"/>`).join('') +
    '<circle r="2.6" fill="#f2c13a"/></g>',
  tulip: h =>
    `<path d="M0 0 V${-h}" stroke="#3a6a2a" stroke-width="2"/><path d="M0 -8 Q-8 -14 -6 -22" stroke="#3a6a2a" stroke-width="3" fill="none"/>` +
    `<path d="M-6 ${-h} Q-7 ${-h - 12} -3 ${-h - 14} L0 ${-h - 9} L3 ${-h - 14} Q7 ${-h - 12} 6 ${-h} Q0 ${-h + 5} -6 ${-h}Z" fill="#e8405a"/>`,
  poppy: h =>
    `<path d="M0 0 Q2 ${-h / 2} 0 ${-h}" stroke="#4a6a2a" stroke-width="1.4" fill="none"/><g transform="translate(0 ${-h})"><circle r="7" fill="#e83a2a"/><circle cx="-2" cy="-2" r="4" fill="#ff5a3a" opacity=".7"/><circle r="2.2" fill="#1a1010"/></g>`,
  bluebell: h =>
    `<path d="M0 0 Q4 ${-h * 0.7} ${-6} ${-h}" stroke="#3a6a2a" stroke-width="1.4" fill="none"/>` +
    [0.45, 0.65, 0.85].map((f, i) => `<path d="M${n(2 - f * 7)} ${n(-h * f)} q-3 2 -3 7 l2 -1 l1 2 l1 -2 l2 1 q0 -5 -3 -7Z" fill="#5a6ae8" transform="rotate(${i * 8 - 8} ${n(2 - f * 7)} ${n(-h * f)})"/>`).join(''),
  lavender: h =>
    `<path d="M0 0 V${-h}" stroke="#4a6a3a" stroke-width="1.4"/>` + Array.from({ length: 6 }, (_, i) => `<ellipse cx="${i % 2 ? 1.6 : -1.6}" cy="${-h + i * 3.4}" rx="2" ry="2.6" fill="#9a6ad8"/>`).join(''),
  forgetmenot: h =>
    `<path d="M0 0 V${-h}" stroke="#3a6a2a" stroke-width="1.2"/>` +
    [[-4, -h], [3, -h - 3], [1, -h + 5]].map(([x, y]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map(a => `<circle cx="0" cy="-2" r="1.6" fill="#7ab8ff" transform="rotate(${a})"/>`).join('')}<circle r="1" fill="#f2e05a"/></g>`).join(''),
}

const BEDS: [number, number, string, number][] = [
  [30, 1086, 'daisy', 4],
  [64, 1150, 'tulip', 3],
  [118, 1110, 'lavender', 4],
  [150, 1176, 'poppy', 3],
  [254, 1170, 'bluebell', 3],
  [300, 1120, 'daisy', 3],
  [350, 1160, 'forgetmenot', 3],
  [374, 1090, 'tulip', 3],
  [36, 960, 'forgetmenot', 3],
  [350, 980, 'poppy', 3],
  [150, 900, 'bluebell', 3],
  [262, 896, 'lavender', 3],
  [206, 1120, 'daisy', 2],
]

const FLOWERBEDS = BEDS.map(([x, y, kind, count], b) =>
  Array.from({ length: count }, (_, i) => {
    const dx = (i - (count - 1) / 2) * 10 + rnd(b * 10 + i) * 6
    const h = 18 + rnd(b * 10 + i + 50) * 14

    return `<g transform="translate(${n(x + dx)} ${n(y + rnd(b * 10 + i + 90) * 8)})"><g>${sway(3 + rnd(b + i) * 2, b + i)}${FLOWERS[kind]!(h)}</g></g>`
  }).join(''),
).join('')

// ---- the fire ----------------------------------------------------------------------------------------------
// the ring of stones: the far half behind the logs and flames, the near half in front of them
const stones = (near: boolean) =>
  Array.from({ length: 11 }, (_, k) => (k / 11) * Math.PI * 2)
    .map((a, k) => [a, k] as const)
    .filter(([a]) => Math.sin(a) > 0 === near)
    .map(([a, k]) => {
      const x = FX + Math.cos(a) * 44
      const y = FY + 6 + Math.sin(a) * 15

      return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(9 + rnd(k + 700) * 4)}" ry="${n(6 + rnd(k + 710) * 2)}" fill="${k % 2 ? '#4a4440' : '#5a524c'}"/>` + `<ellipse cx="${n(x - 2)}" cy="${n(y - 3)}" rx="5" ry="2" fill="#ff9a4a" opacity=".3"/>`
    })
    .join('')

// crossed logs, their cracks glowing with embers that breathe
const LOGS =
  `<g transform="translate(${FX} ${FY})">` +
  '<g transform="rotate(-14)"><rect x="-38" y="-6" width="76" height="12" rx="6" fill="#3a2414"/><ellipse cx="38" cy="0" rx="4" ry="6" fill="#8a5a30"/></g>' +
  '<g transform="rotate(16)"><rect x="-38" y="-6" width="76" height="12" rx="6" fill="#4a2c18"/><ellipse cx="-38" cy="0" rx="4" ry="6" fill="#8a5a30"/></g>' +
  [
    [-20, -2],
    [-6, 3],
    [10, -1],
    [22, 2],
  ]
    .map(([x, y], k) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="2.4" fill="#ff6a1a"><animate attributeName="opacity" values=".5;1;.6;.9;.5" dur="${n(1.6 + k * 0.4)}s" repeatCount="indefinite"/><animate attributeName="fill" values="#ff6a1a;#ffb03a;#ff6a1a" dur="${n(2.2 + k * 0.3)}s" repeatCount="indefinite"/></ellipse>`)
    .join('') +
  '</g>'

// one tongue of flame, its tip licking side to side and leaping up and down
const tongue = (x: number, w: number, h: number, color: string, dur: number, k: number) => {
  const shape = (tip: number, hh: number) =>
    `M${n(x - w)} 0 C${n(x - w)} ${n(-hh * 0.45)} ${n(x - w * 0.15 + tip * 0.3)} ${n(-hh * 0.6)} ${n(x + tip)} ${n(-hh)} C${n(x + w * 0.15 + tip * 0.3)} ${n(-hh * 0.6)} ${n(x + w)} ${n(-hh * 0.45)} ${n(x + w)} 0 Q${n(x)} ${n(w * 0.3)} ${n(x - w)} 0Z`
  const frames = [0, 1, 2, 3, 0].map(i => shape((rnd(k * 7 + i) - 0.5) * w * 1.4, h * (0.78 + rnd(k * 7 + i + 3) * 0.36)))
  frames[4] = frames[0]!

  return `<path d="${frames[0]}" fill="${color}"><animate attributeName="d" values="${frames.join(';')}" dur="${n(dur)}s" begin="${n(-rnd(k + 800) * dur)}s" repeatCount="indefinite"/></path>`
}

const FLAMES =
  // the glow it throws round the clearing, breathing unevenly
  `<circle r="190" fill="url(#glow)"><animate attributeName="opacity" values=".85;1;.8;.95;.75;.9;.85" dur="2.6s" repeatCount="indefinite"/></circle>` +
  '<ellipse cx="0" cy="8" rx="120" ry="30" fill="#ff8a3a" opacity=".16"><animate attributeName="opacity" values=".12;.2;.14;.18;.12" dur="1.9s" repeatCount="indefinite"/></ellipse>' +
  // red at the edges, then orange, yellow, and a white heart
  [-16, 0, 15].map((x, k) => tongue(x, 18, 86 - Math.abs(x) * 1.2, '#e8401a', 0.9 + k * 0.17, k)).join('') +
  [-11, 2, 12].map((x, k) => tongue(x, 14, 70 - Math.abs(x), '#ff7a1e', 0.75 + k * 0.13, k + 10)).join('') +
  [-6, 5].map((x, k) => tongue(x, 10, 50, '#ffb52e', 0.6 + k * 0.11, k + 20)).join('') +
  tongue(0, 7, 30, '#ffe9a0', 0.5, 30) +
  tongue(0, 4, 16, '#fffbe8', 0.42, 31)

// sparks: a steady stream drifting up, and every so often a crackle that throws a handful out at once
const spark = (k: number, burst: number | null, g = 0) => {
  const dur = burst === null ? 1.8 + rnd(k + 900) * 2.2 : 0.9 + rnd(k + 900) * 0.7
  const dx = (rnd(k + 910) - 0.5) * (burst === null ? 70 : 150)
  const up = burst === null ? 160 + rnd(k + 920) * 160 : 70 + rnd(k + 930) * 90
  const sx = (rnd(k + 940) - 0.5) * 30
  const path = `M${n(sx)} -20 C${n(sx + dx * 0.2)} ${n(-up * 0.4)} ${n(sx + dx * 1.3)} ${n(-up * 0.6)} ${n(sx + dx)} ${n(-up)}`
  const r = burst === null ? 0.9 + rnd(k + 950) * 1.1 : 1.2 + rnd(k + 950) * 0.8
  const timing = burst === null ? `dur="${n(dur)}s" begin="${n(-rnd(k + 960) * dur)}s" repeatCount="indefinite"` : `dur="${n(burst)}s" begin="${n(-rnd(k) * 0.12 - g * 1.3)}s" repeatCount="indefinite"`
  const keys = burst === null ? '' : ` keyPoints="0;1;1" keyTimes="0;${r3(dur / burst)};1" calcMode="linear"`
  const fade = burst === null ? 'values="1;1;0" keyTimes="0;.6;1"' : `values="1;0;0" keyTimes="0;${r3(dur / burst)};1"`

  return `<circle r="${n(r)}" fill="${k % 4 ? '#ffd27a' : '#fff2c0'}"><animateMotion path="${path}" ${timing}${keys}/><animate attributeName="opacity" ${fade} ${timing}/></circle>`
}

const sparks = (busy: boolean) =>
  Array.from({ length: busy ? 34 : 16 }, (_, k) => spark(k, null)).join('') +
  // crackles: each group of six pops together, at its own interval
  [3.7, 5.3, 4.4]
    .slice(0, busy ? 3 : 2)
    .map((period, g) => `<g>${Array.from({ length: 6 }, (_, i) => spark(100 + g * 10 + i, period, g)).join('')}</g>`)
    .join('')

const SMOKE = [0, 1, 2]
  .map(
    k =>
      `<circle r="10" fill="#8a8a96" opacity="0"><animateTransform attributeName="transform" type="translate" values="0 -80;-10 -160;-30 -260" dur="7s" begin="${n(-k * 2.3)}s" repeatCount="indefinite"/><animate attributeName="r" values="8;26" dur="7s" begin="${n(-k * 2.3)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.06;0" dur="7s" begin="${n(-k * 2.3)}s" repeatCount="indefinite"/></circle>`,
  )
  .join('')

// how big the fire is: [from, to] between small (0) and roaring (1); a rebuilt picture carries on from where it is
const fireSpan = (w: Fire, now: number): [number, number, number] => {
  const since = (now - w.startedAt) / 1000
  const sinceEnd = (now - w.endedAt) / 1000
  if (w.working) {
    const v = Math.min(1, since / RISE)

    return [v, 1, RISE * (1 - v)]
  }
  if (w.endedAt > 0 && sinceEnd < FALL) {
    const v = 1 - sinceEnd / FALL

    return [v, 0, FALL * v]
  }

  return [0, 0, 0]
}

const size = (v: number) => r3(0.72 + v * 0.55)

// ---- visitors: a fox trotting past, and an owl that drops onto the branch and turns its head about ----------
const FOX =
  `<g>${track(
    [
      [0, -60, 918],
      [6, -60, 918],
      [13, 150, 912],
      [19, 150, 912],
      [27, 470, 920],
      [44, 470, 920],
    ],
    44,
    -8,
  )}` +
  '<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -1.6;0 0" dur=".44s" repeatCount="indefinite"/>' +
  // the brush of a tail, swishing
  '<g><animateTransform attributeName="transform" type="rotate" values="-8 -14 -12;10 -14 -12;-8 -14 -12" dur="1.4s" repeatCount="indefinite"/><path d="M-14 -12 Q-34 -18 -40 -6 Q-30 -2 -14 -6Z" fill="#c8582a"/><path d="M-40 -6 Q-36 -10 -33 -6 Q-36 -3 -40 -6Z" fill="#f4ece0"/></g>' +
  '<g><animateTransform attributeName="transform" type="rotate" values="10 0 -6;-10 0 -6;10 0 -6" dur=".44s" repeatCount="indefinite"/><path d="M-8 -6 V6 M12 -6 V6" stroke="#2a1810" stroke-width="3.4" stroke-linecap="round"/></g>' +
  '<ellipse cx="2" cy="-10" rx="17" ry="8" fill="#d8642a"/><path d="M-6 -6 Q4 -2 16 -6" stroke="#f4ece0" stroke-width="3" fill="none" stroke-linecap="round"/>' +
  '<path d="M-4 -6 V6 M16 -6 V6" stroke="#3a2010" stroke-width="3.4" stroke-linecap="round"/>' +
  '<path d="M14 -14 Q20 -24 28 -20 L36 -14 Q28 -8 18 -8Z" fill="#d8642a"/><path d="M28 -14 L36 -14 Q30 -9 24 -10Z" fill="#f4ece0"/>' +
  '<path d="M18 -20 L19 -29 L24 -21Z M23 -20 L26 -28 L28 -19Z" fill="#c8582a"/><circle cx="36" cy="-14" r="1.4" fill="#1a1010"/><circle cx="26" cy="-17" r="1.3" fill="#1a1010"/>' +
  '</g></g>'

const OWL_PERIOD = 60
const OWL_FLYING = [2, 5, 44, 47] // flies in between the first two times, off between the last two

const OWL_HEAD =
  // the head swivels: a tilt this way and that, a quick look over one shoulder (only the back of the head shows),
  // and back round again
  '<g transform="translate(0 -30)"><g><animateTransform attributeName="transform" type="rotate" values="0;-24;-24;0;18;18;0;0" keyTimes="0;.08;.2;.26;.34;.46;.52;1" dur="9s" repeatCount="indefinite"/>' +
  '<g><animateTransform attributeName="transform" type="scale" values="1 1;1 1;.08 1;1 1;1 1;.08 1;1 1;1 1" keyTimes="0;.58;.62;.66;.84;.88;.92;1" dur="9s" repeatCount="indefinite"/>' +
  '<ellipse rx="13" ry="11" fill="#7a5a3a"/><path d="M-11 -7 L-14 -17 L-5 -10Z M11 -7 L14 -17 L5 -10Z" fill="#6a4a2c"/>' +
  // the face, gone while it looks behind
  '<g><animate attributeName="opacity" values="1;0;1" keyTimes="0;.62;.88" calcMode="discrete" dur="9s" repeatCount="indefinite"/>' +
  '<path d="M-12 0 Q-12 -9 -5 -9 Q0 -6 5 -9 Q12 -9 12 0 Q6 8 0 6 Q-6 8 -12 0Z" fill="#c8a478"/>' +
  '<circle cx="-5" cy="-2" r="4.6" fill="#ffc83a"/><circle cx="5" cy="-2" r="4.6" fill="#ffc83a"/>' +
  '<circle cx="-5" cy="-2" r="2.4" fill="#120c08"/><circle cx="5" cy="-2" r="2.4" fill="#120c08"/><circle cx="-4" cy="-3" r=".8" fill="#fff"/><circle cx="6" cy="-3" r=".8" fill="#fff"/>' +
  // a blink now and then
  '<g><animateTransform attributeName="transform" type="scale" values="1 0;1 0;1 1;1 0;1 0" keyTimes="0;.4;.43;.46;1" dur="4s" repeatCount="indefinite"/><path d="M-10 -2 H0 M0 -2 H10" stroke="#7a5a3a" stroke-width="6"/></g>' +
  '<path d="M-1.6 2 L0 6 L1.6 2Z" fill="#e8b03a"/></g>' +
  // the back of the head
  '<path d="M-6 -6 Q0 -2 6 -6 M-8 0 Q0 4 8 0" stroke="#5a4028" stroke-width="1.4" fill="none" opacity=".6"/>' +
  '</g></g></g>'

// a translate through timed points, each leg eased with its own curve
const glide = (keys: Key[], splines: string[], period: number, begin: number) =>
  `<animateTransform attributeName="transform" type="translate" values="${keys.map(([, x, y]) => `${n(x)} ${n(y)}`).join(';')}" keyTimes="${keys.map(([t]) => r3(t / period)).join(';')}" calcMode="spline" keySplines="${splines.join(';')}" dur="${period}s" begin="${begin}s" repeatCount="indefinite"/>`

const LINEAR = '0 0 1 1'
const LAND = '.2 .5 .35 1' // slowing as it comes in to land or to stop
const LEAP = '.5 0 .8 .5' // gathering speed as it leaves

const OWL_WINGS = [-1, 1]
  .map(
    s =>
      `<g><animateTransform attributeName="transform" type="rotate" values="${s * 34} ${s * 7} -18;${s * -26} ${s * 7} -18;${s * 34} ${s * 7} -18" calcMode="spline" keyTimes="0;.45;1" keySplines="${EASE};${EASE}" dur=".62s" repeatCount="indefinite"/>` +
      `<path d="M${s * 7} -20 Q${s * 24} -32 ${s * 44} -24 L${s * 40} -20 L${s * 44} -16 L${s * 38} -14 L${s * 40} -10 Q${s * 22} -12 ${s * 7} -10Z" fill="#6a4a2c"/>` +
      `<path d="M${s * 12} -20 Q${s * 26} -26 ${s * 38} -22" stroke="#c8a478" stroke-width="1.4" fill="none" opacity=".6"/></g>`,
  )
  .join('')

// an eased arc in to the branch, a little hop and climb on the way out, and wings that beat from the shoulder
const OWL = (() => {
  const shown = (flying: boolean) => {
    const [a, b, c, d] = OWL_FLYING.map(t => r3(t / OWL_PERIOD))

    return `<animate attributeName="opacity" values="${flying ? '0;1;0;1;0' : '1;0;1;0;1'}" keyTimes="0;${a};${b};${c};${d}" calcMode="discrete" dur="${OWL_PERIOD}s" begin="-22s" repeatCount="indefinite"/>`
  }

  return (
    `<g>${glide(
      [
        [0, 470, 610],
        [2, 470, 610],
        [3.6, 384, 622],
        [5, 326, 674],
        [44, 326, 674],
        [44.7, 312, 656],
        [46.4, 170, 600],
        [48, -60, 590],
        [OWL_PERIOD, -60, 590],
      ],
      [LINEAR, LINEAR, LAND, LINEAR, LEAP, LINEAR, LINEAR, LINEAR],
      OWL_PERIOD,
      -22,
    )}` +
    // perched: body, folded wings, talons on the branch, and the busy head
    `<g opacity="1">${shown(false)}<ellipse cx="0" cy="-12" rx="12" ry="17" fill="#7a5a3a"/><ellipse cx="0" cy="-9" rx="8" ry="12" fill="#c8a478"/>` +
    '<path d="M-4 -16 l2 2 M2 -12 l2 2 M-3 -6 l2 2 M3 -2 l2 2" stroke="#7a5a3a" stroke-width="1.2"/>' +
    '<path d="M-12 -20 Q-16 -6 -8 4 M12 -20 Q16 -6 8 4" stroke="#5a4028" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    `<path d="M-5 4 l-2 4 M-3 4 v4 M3 4 v4 M5 4 l2 4" stroke="#e8b03a" stroke-width="1.4"/>${OWL_HEAD}</g>` +
    // flying: leaning into the flight, wings beating from the shoulders, talons tucked up
    `<g opacity="0">${shown(true)}<g transform="rotate(-8 0 -12)">${OWL_WINGS}` +
    '<ellipse cx="0" cy="-12" rx="10" ry="15" fill="#7a5a3a"/><ellipse cx="0" cy="-9" rx="6.4" ry="10" fill="#c8a478"/>' +
    '<path d="M-3 2 l-1 4 M3 2 l1 4" stroke="#e8b03a" stroke-width="1.4"/>' +
    '<g transform="translate(0 -30)"><ellipse rx="12" ry="10" fill="#7a5a3a"/><path d="M-10 -6 L-13 -15 L-5 -9Z M10 -6 L13 -15 L5 -9Z" fill="#6a4a2c"/>' +
    '<path d="M-11 0 Q-11 -8 -5 -8 Q0 -5 5 -8 Q11 -8 11 0 Q6 7 0 5 Q-6 7 -11 0Z" fill="#c8a478"/>' +
    '<circle cx="-4.6" cy="-2" r="4.2" fill="#ffc83a"/><circle cx="4.6" cy="-2" r="4.2" fill="#ffc83a"/><circle cx="-4.6" cy="-2" r="2.2" fill="#120c08"/><circle cx="4.6" cy="-2" r="2.2" fill="#120c08"/>' +
    '<path d="M-1.4 2 L0 5.6 L1.4 2Z" fill="#e8b03a"/></g></g></g></g>'
  )
})()

// ---- more visitors ----------------------------------------------------------------------------------------
// a deer steps out of the trees, grazes, lifts its head to look at the fire, and turns back
const DEER_ART =
  '<g><animateTransform attributeName="transform" type="rotate" values="0;0;8;0;0" keyTimes="0;.6;.65;.7;1" dur="2.6s" repeatCount="indefinite"/><path d="M26 -30 l6 -4 l-2 6Z" fill="#f4ece0"/></g>' +
  '<path d="M-20 -18 V6 M-12 -18 V6 M14 -18 V6 M22 -18 V6" stroke="#5a3a20" stroke-width="3.2" stroke-linecap="round"/>' +
  '<ellipse cx="2" cy="-26" rx="28" ry="12" fill="#9a6a3e"/><ellipse cx="2" cy="-20" rx="22" ry="5" fill="#d8b890" opacity=".7"/>' +
  // head and neck, lowered to graze and raised again
  '<g><animateTransform attributeName="transform" type="rotate" values="0 -18 -30;0 -18 -30;-62 -18 -30;-62 -18 -30;0 -18 -30;0 -18 -30" keyTimes="0;.2;.3;.6;.7;1" calcMode="spline" keySplines="' +
  [EASE, EASE, EASE, EASE, EASE].join(';') +
  '" dur="9s" repeatCount="indefinite"/>' +
  '<path d="M-14 -34 L-26 -56 L-36 -54 L-24 -28Z" fill="#9a6a3e"/><path d="M-40 -60 Q-30 -64 -24 -56 L-28 -50 Q-38 -50 -44 -54Z" fill="#9a6a3e"/>' +
  '<ellipse cx="-24" cy="-60" rx="5" ry="2.4" fill="#8a5a30" transform="rotate(-30 -24 -60)"/><circle cx="-34" cy="-56" r="1.4" fill="#120c08"/><circle cx="-44" cy="-54" r="1.4" fill="#120c08"/>' +
  // antlers
  '<path d="M-30 -62 L-32 -78 L-38 -86 M-32 -78 L-26 -84 M-32 -72 L-38 -76 M-26 -62 L-22 -76 L-24 -86 M-22 -76 L-16 -80" stroke="#d8c8a8" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
  '</g>'

const DEER_PERIOD = 72
const DEER =
  `<g>${glide(
    [
      [0, 470, 860],
      [4, 470, 860],
      [12, 312, 858],
      [36, 312, 858],
      [44, 470, 860],
      [DEER_PERIOD, 470, 860],
    ],
    [LINEAR, LAND, LINEAR, LEAP, LINEAR],
    DEER_PERIOD,
    -30,
  )}` +
  // facing the way it walks: left on the way in, right on the way back
  `<g><animateTransform attributeName="transform" type="scale" values="1 1;-1 1;1 1" keyTimes="0;${r3(36 / DEER_PERIOD)};${r3(70 / DEER_PERIOD)}" calcMode="discrete" dur="${DEER_PERIOD}s" begin="-30s" repeatCount="indefinite"/>` +
  `<g transform="scale(.8)">${DEER_ART}</g></g></g>`

// a raccoon snuffles along the front of the clearing, stops to sniff, and goes on its way
const RACCOON =
  `<g>${track(
    [
      [0, -50, 1098],
      [5, -50, 1098],
      [14, 196, 1092],
      [21, 196, 1092],
      [30, 460, 1100],
      [52, 460, 1100],
    ],
    52,
    -16,
  )}<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -1.4;0 0" dur=".36s" repeatCount="indefinite"/>` +
  // the ringed tail
  '<g><animateTransform attributeName="transform" type="rotate" values="-6 -16 -10;8 -16 -10;-6 -16 -10" dur="1.6s" repeatCount="indefinite"/><path d="M-16 -10 Q-34 -12 -40 -2 Q-30 2 -16 -4Z" fill="#8a8a92"/><path d="M-22 -11 L-24 -3 M-29 -10 L-30 -1 M-35 -7 L-36 -1" stroke="#2a2a30" stroke-width="3"/></g>' +
  '<path d="M-10 -4 V6 M-2 -4 V6 M8 -4 V6 M14 -4 V6" stroke="#2a2a30" stroke-width="3" stroke-linecap="round"/>' +
  '<ellipse cx="0" cy="-10" rx="18" ry="10" fill="#9a9aa2"/><ellipse cx="2" cy="-5" rx="13" ry="4" fill="#c8c8d0" opacity=".6"/>' +
  // a sniffing head with its black mask
  '<g><animateTransform attributeName="transform" type="rotate" values="0 16 -12;-6 16 -12;0 16 -12;-4 16 -12;0 16 -12" dur="1.2s" repeatCount="indefinite"/>' +
  '<path d="M12 -18 Q22 -24 30 -16 L36 -10 Q28 -6 16 -8Z" fill="#9a9aa2"/><path d="M18 -18 Q26 -18 30 -14 Q24 -12 18 -13Z" fill="#1a1a20"/><circle cx="25" cy="-15" r="1.4" fill="#f4f4f8"/>' +
  '<path d="M30 -13 L36 -10 L32 -9Z" fill="#f4f4f8"/><circle cx="36" cy="-10" r="1.4" fill="#120c08"/><path d="M14 -18 L15 -26 L20 -19Z" fill="#7a7a82"/></g>' +
  '</g></g>'

// a hedgehog waddles slowly along the bottom, through the flowers
const HEDGEHOG =
  `<g>${track(
    [
      [0, 450, 1176],
      [3, 450, 1176],
      [26, -40, 1172],
      [44, -40, 1172],
    ],
    44,
    -12,
  )}<g><animateTransform attributeName="transform" type="rotate" values="-4 0 0;4 0 0;-4 0 0" dur=".5s" repeatCount="indefinite"/>` +
  '<path d="M-4 0 V3 M6 0 V3" stroke="#3a2a1a" stroke-width="2.4" stroke-linecap="round"/>' +
  '<path d="M-14 0 Q-14 -16 2 -17 Q16 -16 14 -2Z" fill="#6a4a30"/>' +
  Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI * (0.95 - i * 0.1)
    const x = 1 + Math.cos(a) * 13
    const y = -3 - Math.sin(a) * 13

    return `<path d="M${n(x)} ${n(y)} l${n(Math.cos(a) * 6)} ${n(-Math.sin(a) * 6)}" stroke="#4a3220" stroke-width="2" stroke-linecap="round"/>`
  }).join('') +
  '<path d="M-14 -2 Q-22 -4 -24 -1 Q-20 2 -12 1Z" fill="#c8a478"/><circle cx="-24" cy="-1" r="1.4" fill="#120c08"/><circle cx="-17" cy="-4" r="1" fill="#120c08"/>' +
  '</g></g>'

// ---- the whole picture --------------------------------------------------------------------------------
const buildScene = (w: Fire, elapsed: number, vh: number, now: number) => {
  const view = Math.min(H, Math.max(vh, 240))
  const y0 = H - view
  const [v0, v1, dur] = fireSpan(w, now)
  const grow =
    v0 === v1
      ? ''
      : `<animateTransform data-once="1" attributeName="transform" type="scale" values="${size(v0)};${size(v1)}" dur="${n(dur)}s" calcMode="spline" keyTimes="0;1" keySplines="${EASE}" fill="freeze"/>`

  const defs =
    '<defs>' +
    '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b1e"/><stop offset=".5" stop-color="#121a3a"/><stop offset="1" stop-color="#1c2240"/></linearGradient>' +
    '<radialGradient id="glow"><stop offset="0" stop-color="#ffb35a" stop-opacity=".55"/><stop offset=".35" stop-color="#ff8a3a" stop-opacity=".22"/><stop offset="1" stop-color="#ff6a2a" stop-opacity="0"/></radialGradient>' +
    '</defs>'

  const fire = `<g transform="translate(${FX} ${FY})"><g transform="scale(${size(v0)})">${grow}${FLAMES}${SMOKE}${sparks(w.working)}</g></g>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${n(y0)} ${W} ${n(view)}" width="${W}" height="${n(view)}" preserveAspectRatio="xMidYMax slice">${defs}` +
    retime(SKY + RIDGES + FOREST + FRAME_TREES + GROUND + DEER + OWL + FLOWERBEDS + LOG_RING + stones(false) + LOGS + RACCOON + HEDGEHOG + FOX, elapsed) +
    retime(fire + stones(true), elapsed) +
    '</svg>'
  )
}
// ---scene-end

const TERMINAL_ART: [string, string][] = [
  ['   ✦    ▲▲   ✦  ▲   ✦', '#fff8e0'],
  ['  ▲▲ ▲▲▲  ▲▲▲  ▲▲ ▲▲', '#16233c'],
  ['    ✿    ·:  ·   ❀ ', '#ffd27a'],
  ['   ❀    ( )(  )   ✿ ', '#ff7a1e'],
  ['  ✿    ═╳═╳═    ❀  ', '#8a5a30'],
]

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))

  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const label = (w: Camp, now: number) => (w.working ? `작업 중 ${clock(now - w.startedAt)} · 도구 ${w.tools}회` : '쉬는 중')

const fire = atom({ plugin: 'campfire', key: 'fire' } as const, { working: false, tools: 0, startedAt: 0, endedAt: 0, tick: 0 } as Camp)

// The picture is built again only when the state it draws changes; the same text keeps it running.
let t0 = 0
let cache = { key: '', svg: '' }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    t0 = await $.clock.now()
    await $.command.register({
      name: 'fire',
      description: 'Open the campfire pane',
    })
    // Wakes the pane each second while Claude works (the stopwatch) and while the fire dies back.
    $.clock.every(1000, () => {
      void Promise.all([read($, fire), $.clock.now()])
        .then(([r, now]) => (r.working || (r.endedAt > 0 && now - r.endedAt < (FALL + 1) * 1000) ? update($, fire, v => ({ ...v, tick: v.tick + 1 })) : undefined))
        .catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'fire' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: '모닥불을 열었습니다.' }
  })

  // The main loop's turns only: a subagent's run is not Claude at work.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, fire, v => (v.working ? v : { ...v, working: true, tools: 0, startedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, fire, v => (v.working ? { ...v, working: false, endedAt: now } : v))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await update($, fire, v => ({ ...v, tools: v.tools + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const w = await read($, fire)
    const now = await $.clock.now()
    if (t0 === 0) t0 = now
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 20
    const line = label(w, now)

    if (e.surface !== 'terminal') {
      const { Box, Text, Svg } = els as ElementTable<'desktop'>
      // The pane's px: its cells over the code font's advance (about 7.8 px) and line height
      // (about 19.5 px). Short of the whole picture, the sky is cut, never the fire.
      const width = Math.max(160, Math.round(cols * 7.8))
      const full = Math.round((width * H) / W)
      const tall = e.props?.scroll?.bodyRows ? Math.round((rows - 1) * 19.5) : full
      const height = Math.min(full, tall)
      // building up and dying back each draw the change; once that is over the picture settles
      const changing = w.working ? (now - w.startedAt) / 1000 < RISE : w.endedAt > 0 && (now - w.endedAt) / 1000 < FALL
      const key = `${w.working}|${changing}|${w.startedAt}|${w.endedAt}|${height}|${width}`
      if (cache.key !== key) cache = { key, svg: buildScene(w, (now - t0) / 1000, (height * W) / width, now) }

      return (
        <Box flexDirection="column" justifyContent="center" minHeight={rows}>
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
