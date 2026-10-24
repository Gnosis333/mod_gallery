import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import type { Reef } from '../types'

const PANE = 'reef-tank'
const STRINGS = {
  en: {
    title: 'Reef tank',
    alt: 'A tank with corals and anemones where colourful tropical fish swim and bubbles rise now and then.',
    working: (clock: string, tools: number) => `Working ${clock} · tools ${tools}`,
    idle: (pearls: number) => `Idle · pearls ${pearls}`,
    opened: 'Opened the reef tank pane.',
    note: 'The animation shows in the desktop app.',
  },
  ko: {
    title: '어항',
    alt: '산호와 말미잘이 있는 수족관에서 알록달록한 열대어가 헤엄치고, 아래에서 물방울이 가끔 올라옵니다.',
    working: (clock: string, tools: number) => `작업 중 ${clock} · 도구 ${tools}회`,
    idle: (pearls: number) => `쉬는 중 · 진주 ${pearls}개`,
    opened: '어항을 열었습니다.',
    note: '그림 움직임은 데스크톱 앱에서 보입니다.',
  },
}

type Words = (typeof STRINGS)['en']

// ---scene-start
type Pt = [number, number]

const W = 400
const H = 1500
const DY = 500 // the whole sea floor sits this far lower
const FLOOR = 962

const n = (v: number) => String(Math.round(v * 10) / 10)
const EASE = '.45 0 .55 1'

const sway = (deg: number, cx: number, cy: number, dur: number, begin: number) =>
  `<animateTransform attributeName="transform" type="rotate" values="${-deg} ${cx} ${cy};${deg} ${cx} ${cy};${-deg} ${cx} ${cy}" keyTimes="0;.5;1" calcMode="spline" keySplines="${EASE};${EASE}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`

let cid = 0
const nextId = (p: string) => `${p}${++cid}`

const DEFS =
  '<defs>' +
  '<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86d6ea"/><stop offset=".45" stop-color="#2f97c0"/><stop offset="1" stop-color="#103f66"/></linearGradient>' +
  '<linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
  '<linearGradient id="sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ead9a9"/><stop offset="1" stop-color="#bda772"/></linearGradient>' +
  '<linearGradient id="tube" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e2a82e"/><stop offset=".45" stop-color="#f7d767"/><stop offset="1" stop-color="#d79a20"/></linearGradient>' +
  '<linearGradient id="lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></linearGradient>' +
  '<linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8d0" stop-opacity=".75"/><stop offset="1" stop-color="#fff8d0" stop-opacity="0"/></linearGradient>' +
  '<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffbd0" stop-opacity=".7"/><stop offset="1" stop-color="#fffbd0" stop-opacity="0"/></linearGradient>' +
  `<clipPath id="tank"><rect x="8" y="26" width="384" height="${H - 26}"/></clipPath>` +
  '<clipPath id="brain"><path d="M176 962 C176 904 198 888 219 888 C240 888 262 904 262 962Z"/></clipPath>' +
  '</defs>'

// ---- water, light, surface -----------------------------------------------------------
const RAYS = [
  [40, 70, 0, 8],
  [120, 50, 3, 11],
  [210, 80, 6, 9],
  [300, 60, 1, 13],
]
const rays = RAYS.map(
  ([x, w, b, d]) =>
    `<polygon points="${x},26 ${x + w},26 ${x + w + 90},1180 ${x + 20},1180" fill="url(#ray)" opacity=".1">` +
    `<animate attributeName="opacity" values=".05;.2;.05" dur="${d}s" begin="${-b}s" repeatCount="indefinite"/>` +
    `<animateTransform attributeName="transform" type="translate" values="0 0;22 0;0 0" dur="${d + 4}s" begin="${-b}s" repeatCount="indefinite"/></polygon>`,
).join('')

const surface =
  '<path d="M8 34' +
  ' q24 -8 48 0 t48 0'.repeat(5) +
  ' V26 H8Z" fill="#c7eef7" opacity=".7">' +
  '<animateTransform attributeName="transform" type="translate" values="0 0;-96 0" dur="7s" repeatCount="indefinite"/></path>'

const PLANKTON: [number, number, number, number][] = [
  [60, 180, 14, 0],
  [140, 330, 18, 4],
  [250, 120, 16, 2],
  [330, 420, 20, 7],
  [90, 560, 17, 5],
  [300, 640, 19, 9],
  [180, 780, 15, 3],
  [350, 250, 21, 6],
]
const plankton = [
  ...PLANKTON,
  ...PLANKTON.map(([x, y, d, b]): [number, number, number, number] => [((x + 130) % 360) + 20, y + 640, d + 3, b + 2]),
].map(
  ([x, y, d, b]) =>
    `<circle cx="${x}" cy="${y}" r=".9" fill="#fff" opacity=".5"><animateMotion path="M0 0 C10 -14 22 -6 12 10 C4 24 -10 14 0 0" dur="${d}s" begin="${-b}s" repeatCount="indefinite"/></circle>`,
).join('')

const BACK =
  `<path d="M8 ${FLOOR} C40 900 80 912 110 942 C150 892 200 906 240 936 C290 896 340 916 392 950 V${FLOOR}Z" fill="#1a5d80" opacity=".7"/>` +
  `<path d="M8 ${FLOOR} C60 930 120 940 170 952 C240 930 310 944 392 936 V${FLOOR}Z" fill="#14507a" opacity=".8"/>`

// ---- plants and corals ----------------------------------------------------------------
const kelp = (x: number, ht: number, color: string, dur: number, begin: number) =>
  `<g>${sway(3.2, x, FLOOR, dur, -begin)}` +
  `<path d="M${x} ${FLOOR} q-14 ${-ht / 4} 0 ${-ht / 2} q14 ${-ht / 4} 0 ${-ht / 2}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>` +
  `<path d="M${x + 1} ${FLOOR} q-14 ${-ht / 4} 0 ${-ht / 2} q14 ${-ht / 4} 0 ${-ht / 2}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2.4" stroke-linecap="round"/></g>`

const stag = (x: number, y: number, ang: number, len: number, depth: number): string => {
  const x2 = x + Math.sin(ang) * len
  const y2 = y - Math.cos(ang) * len
  const color = ['#ffa583', '#f58a5e', '#e8693c', '#d4562e', '#c04a28'][Math.min(depth, 4)]
  let out = `<path d="M${n(x)} ${n(y)} L${n(x2)} ${n(y2)}" fill="none" stroke="${color}" stroke-width="${n(2.2 + depth * 1.9)}" stroke-linecap="round"/>`
  if (depth > 0) {
    for (const da of depth >= 2 ? [-0.55, 0.02, 0.5] : [-0.5, 0.45]) {
      out += stag(x2, y2, ang + da, len * 0.74, depth - 1)
    }
  }

  return out
}

const STAGHORN =
  `<g>${sway(1.6, 55, FLOOR, 8, 0)}` +
  [
    [28, -0.32, 54],
    [56, 0.04, 62],
    [82, 0.34, 52],
  ]
    .map(([x, a, l]) => stag(x, FLOOR + 2, a, l, 3))
    .join('') +
  '</g>'

const SQUIGGLES = Array.from(
  { length: 9 },
  (_, i) => `<path d="M170 ${898 + i * 8} q8 -8 16 0${' t16 0'.repeat(6)}" fill="none" stroke="#a8682f" stroke-width="2.2" stroke-linecap="round"/>`,
).join('')

const BRAIN =
  '<path d="M176 962 C176 904 198 888 219 888 C240 888 262 904 262 962Z" fill="#dc9f5c"/>' +
  `<g clip-path="url(#brain)">${SQUIGGLES}<ellipse cx="206" cy="900" rx="22" ry="8" fill="#fff" opacity=".2"/></g>`

const TUBES = [
  [346, 90],
  [357, 134],
  [368, 72],
  [379, 114],
  [389, 62],
]
  .map(
    ([x, ht], i) =>
      `<g>${sway(1.5, x, FLOOR, 5 + i * 0.6, i)}<rect x="${x - 4.5}" y="${FLOOR - ht}" width="9" height="${ht + 2}" rx="4.5" fill="url(#tube)"/>` +
      `<ellipse cx="${x}" cy="${FLOOR - ht + 1}" rx="3.6" ry="2" fill="#7a4a14"/>` +
      `<path d="M${x - 3} ${FLOOR - ht - 1} l-1 -5 M${x} ${FLOOR - ht - 1} l0 -6 M${x + 3} ${FLOOR - ht - 1} l1 -5" stroke="#ff9fb8" stroke-width="1.4" stroke-linecap="round"/></g>`,
  )
  .join('')

const ANEMONE = (front: boolean) => {
  if (!front) {
    return '<ellipse cx="320" cy="960" rx="24" ry="7" fill="#8c3a73"/>'
  }

  return Array.from({ length: 17 }, (_, i) => {
    const x = 300 + i * 2.5
    const len = 38 + ((i * 7) % 5) * 5
    const lean = (i - 8) * 1.6

    return (
      `<g>${sway(7, x, 958, 2.2 + (i % 4) * 0.5, -i * 0.3)}` +
      `<path d="M${x} 958 q${n(lean * 0.3)} ${-len / 2} ${n(lean)} ${-len}" fill="none" stroke="#e0529c" stroke-width="3.2" stroke-linecap="round"/>` +
      `<circle cx="${n(x + lean)}" cy="${958 - len}" r="2.6" fill="#ffd0e6"/></g>`
    )
  }).join('')
}

const star = (cx: number, cy: number, r: number, fill: string) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 === 0 ? r : r * 0.45
    const a = (Math.PI / 5) * i - Math.PI / 2

    return `${n(cx + Math.cos(a) * rr)},${n(cy + Math.sin(a) * rr)}`
  }).join(' ')

  return `<polygon points="${pts}" fill="${fill}" stroke="#a63c22" stroke-width=".8" stroke-linejoin="round"/>`
}

const urchin = (cx: number, cy: number) =>
  Array.from({ length: 22 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 22

    return `<path d="M${n(cx)} ${n(cy)} L${n(cx + Math.cos(a) * 12)} ${n(cy + Math.sin(a) * 12)}" stroke="#3b2a55" stroke-width="1.4" stroke-linecap="round"/>`
  }).join('') + `<circle cx="${cx}" cy="${cy}" r="6" fill="#5a3f86"/>`

const FOREGROUND =
  star(150, 986, 11, '#f2653f') +
  urchin(92, 978) +
  '<path d="M200 988 q-9 -2 -8 -9 q4 -7 11 -3 q6 4 1 9 q-3 3 -6 0" fill="#f1d8c4" stroke="#c79a7a" stroke-width="1.1"/>' +
  '<ellipse cx="180" cy="991" rx="4" ry="2.4" fill="#9d8a66"/><ellipse cx="305" cy="990" rx="3" ry="2" fill="#a29072"/><ellipse cx="122" cy="992" rx="3.4" ry="2" fill="#a29072"/>'

// ---- the air stone, the chest and the pearls it keeps ------------------------------------
// A burst: the bubbles leave one after another, rise for `share` of the cycle, and the rest is quiet.
const SHARE = 0.5
const BUBBLER = (x: number, y: number, count: number, cycle: number, begin: number, share = SHARE, gap = 0.45) =>
  Array.from({ length: count }, (_, i) => {
    const r = 1.8 + ((i * 5) % 4) * 0.8
    const b = begin + i * gap
    const steps = Array.from({ length: 12 }, (_, j) => j)
    const wob = [...steps.map(j => n(x + Math.sin(j * 1.3 + i) * 5)), n(x)].join(';')
    const wobTimes = [...steps.map(j => Math.round((j / 11) * share * 1000) / 1000), 1].join(';')

    return (
      `<circle cx="${x}" cy="${y}" r="0" fill="#fff" fill-opacity=".22" stroke="#fff" stroke-opacity=".85" stroke-width=".8" opacity="0">` +
      `<animate attributeName="cy" values="${y};52;52" keyTimes="0;${share};1" dur="${cycle}s" begin="${n(b)}s" repeatCount="indefinite"/>` +
      `<animate attributeName="cx" values="${wob}" keyTimes="${wobTimes}" dur="${cycle}s" begin="${n(b)}s" repeatCount="indefinite"/>` +
      `<animate attributeName="r" values="${n(r * 0.5)};${n(r * 1.5)};${n(r * 1.5)}" keyTimes="0;${share};1" dur="${cycle}s" begin="${n(b)}s" repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" values="0;.9;.9;0;0" keyTimes="0;.03;${Math.round((share - 0.05) * 1000) / 1000};${share};1" dur="${cycle}s" begin="${n(b)}s" repeatCount="indefinite"/></circle>`
    )
  }).join('')

const AIRSTONE =
  '<ellipse cx="28" cy="987" rx="7" ry="3" fill="#8a949c"/><path d="M28 984 q4 -12 -2 -22" fill="none" stroke="#c9d3d9" stroke-width="1.2" opacity=".5"/>'

const LID =
  '<path d="M262 975 q0 -12 17 -12 q17 0 17 12Z" fill="#a56a31"/><path d="M262 973 q17 -3 34 0" fill="none" stroke="#e1b84a" stroke-width="2"/>'

// Resting, the lid opens now and then to let a burst out; at work it stands open and glows.
const chest = (isWorking: boolean) =>
  '<rect x="262" y="975" width="34" height="15" rx="2" fill="#8b5a2b"/><rect x="262" y="980" width="34" height="2.4" fill="#e1b84a"/>' +
  '<rect x="266" y="972" width="26" height="4" fill="#f2c94c"/>' +
  (isWorking
    ? '<circle cx="279" cy="968" r="26" fill="#fff3b0" opacity=".4"><animate attributeName="opacity" values=".22;.55;.22" dur="2.4s" repeatCount="indefinite"/></circle>' +
      `<g transform="rotate(-40 262 975)">${LID}</g>`
    : `<g><animateTransform attributeName="transform" type="rotate" values="0 262 975;-40 262 975;-40 262 975;0 262 975;0 262 975" keyTimes="0;.03;.35;.4;1" dur="31s" begin="12s" repeatCount="indefinite"/>${LID}</g>`)

const PEARL_POS: Pt[] = [
  [224, 987],
  [231, 987],
  [238, 987],
  [245, 987],
  [252, 987],
  [227.5, 980.5],
  [234.5, 980.5],
  [241.5, 980.5],
  [248.5, 980.5],
  [231, 974],
  [238, 974],
  [245, 974],
]

const pearl = (x: number, y: number, pop = false) =>
  `<g transform="translate(${x} ${y})"><g>${pop ? '<animateTransform attributeName="transform" type="scale" values="0;1.6;1" keyTimes="0;.6;1" dur="1.3s" fill="freeze"/>' : ''}` +
  '<circle r="3.2" fill="#f6f1ea" stroke="#d3c9bd" stroke-width=".6"/><circle cx="-1" cy="-1.1" r="1.05" fill="#fff"/></g></g>'

const pearlCount = (done: number) => (done === 0 ? 0 : ((done - 1) % PEARL_POS.length) + 1)

// ---- fish (drawn at 0,0 facing +x) -------------------------------------------------------
const tail = (root: number, deg: number, dur: number, shape: string) =>
  `<g><animateTransform attributeName="transform" type="rotate" values="${-deg} ${root} 0;${deg} ${root} 0;${-deg} ${root} 0" dur="${dur}s" repeatCount="indefinite"/>${shape}</g>`

const eye = (x: number, y = -2, r = 1.7) =>
  `<circle cx="${x}" cy="${y}" r="${r + 0.9}" fill="#fff"/><circle cx="${x + 0.3}" cy="${y}" r="${r}" fill="#1c2430"/>`

const clown = () => {
  const id = nextId('cf')

  return (
    `<clipPath id="${id}"><ellipse rx="14" ry="8"/></clipPath>` +
    tail(-12, 14, 0.4, '<path d="M-12 0 L-23 -8 Q-19.5 0 -23 8Z" fill="#f58a2f" stroke="#1f1a17" stroke-width="1"/>') +
    '<path d="M-4 -7 Q2 -13 8 -6Z" fill="#f58a2f" stroke="#1f1a17" stroke-width="1"/>' +
    '<ellipse rx="14" ry="8" fill="#f58a2f"/>' +
    `<g clip-path="url(#${id})"><rect x="-6" y="-9" width="4.6" height="18" fill="#fff" stroke="#1f1a17" stroke-width=".8"/><rect x="6" y="-9" width="3.2" height="18" fill="#fff" stroke="#1f1a17" stroke-width=".8"/></g>` +
    '<ellipse rx="14" ry="8" fill="none" stroke="#1f1a17" stroke-width="1"/>' +
    eye(9, -2.2, 1.5)
  )
}

const BLUE_TANG = () =>
  tail(-14, 13, 0.45, '<path d="M-14 0 L-26 -9 Q-22 0 -26 9Z" fill="#ffd21f"/>') +
  '<path d="M-8 -9 Q2 -17 12 -6Z" fill="#1d55b8"/><path d="M-8 9 Q2 15 10 6Z" fill="#1d55b8"/>' +
  '<ellipse rx="17" ry="10.5" fill="#2f78e0"/>' +
  '<path d="M-12 -4 Q-2 -9 6 -3 Q-1 1 4 6 Q-7 8 -12 2Z" fill="#14204a"/>' +
  '<path d="M9 -7 q6 3 6 9" fill="none" stroke="#14204a" stroke-width="1.4"/>' +
  '<ellipse cx="3" cy="3" rx="3" ry="2" fill="#ffd21f" opacity=".9"/>' +
  eye(11, -2.5, 1.5)

const YELLOW_TANG = () =>
  tail(-14, 13, 0.45, '<path d="M-14 0 L-25 -9 Q-21 0 -25 9Z" fill="#f4cc1a"/>') +
  '<path d="M-10 -9 Q2 -18 13 -6Z" fill="#f2c514"/><path d="M-8 9 Q2 16 10 6Z" fill="#f2c514"/>' +
  '<ellipse rx="16" ry="10.5" fill="#f9dc2e"/><ellipse cx="-1" cy="-4" rx="9" ry="3.4" fill="#fff" opacity=".28"/>' +
  '<circle cx="-12" cy="0.5" r="1.4" fill="#fff"/>' +
  '<path d="M14 -1 L19 1 L14 3Z" fill="#f4cc1a"/>' +
  eye(9, -2.5, 1.5)

const ANGELFISH = () =>
  tail(-9, 10, 0.55, '<path d="M-9 0 L-20 -7 Q-17 0 -20 7Z" fill="#c8d4e0"/>') +
  '<path d="M-8 -11 Q-12 -22 -24 -28 Q-6 -27 6 -13Z" fill="#cfd9e6" opacity=".92"/>' +
  '<path d="M-8 11 Q-12 21 -24 26 Q-6 25 6 13Z" fill="#cfd9e6" opacity=".92"/>' +
  '<path d="M-11 0 Q-2 -22 12 -3 Q-2 21 -11 0Z" fill="#e9eef4"/>' +
  '<path d="M-3 -10 L-3 10 M3 -9 L3 9 M-8 -4 L-8 4" stroke="#2d3a52" stroke-width="2.2" stroke-linecap="round"/>' +
  '<path d="M6 -2 Q12 -1 12 -3 Q9 1 6 2Z" fill="#f2c94c"/>' +
  eye(7, -2.2, 1.3)

const BUTTERFLYFISH = () =>
  tail(-11, 14, 0.4, '<path d="M-11 0 L-19 -7 Q-16 0 -19 7Z" fill="#f08a2f"/>') +
  '<ellipse rx="12" ry="11" fill="#f6efc8"/><path d="M-10 -4 Q0 -14 11 -4 L11 -9 Q0 -16 -10 -9Z" fill="#f2c53a"/>' +
  '<path d="M-9 -2 Q0 -11 10 -2 Q0 -6 -9 -2Z" fill="#f2c53a"/>' +
  '<path d="M6 -11 L6 11" stroke="#1c2430" stroke-width="2.6" opacity=".9"/>' +
  '<path d="M11 -2 L18 0 L11 2Z" fill="#f2c53a"/>' +
  eye(7.4, -2.2, 1.2)

const PARROTFISH = () =>
  tail(-20, 12, 0.5, '<path d="M-19 0 L-31 -9 L-27 0 L-31 9Z" fill="#2fa58a"/>') +
  '<path d="M-14 -8 Q-2 -17 10 -7Z" fill="#35b698"/>' +
  '<ellipse rx="21" ry="9" fill="#3fbf9f"/><path d="M-19 1 Q0 14 19 3 Q0 9 -19 1Z" fill="#ec6fa6"/>' +
  '<ellipse cx="-4" cy="-2" rx="9" ry="3" fill="#fff" opacity=".25"/>' +
  '<path d="M19 -3 q5 3 3 7 q-2 2 -4 -1Z" fill="#f3ecc8"/>' +
  eye(12, -2.5, 1.5)

const BETTA = () =>
  tail(-10, 11, 0.7, '<path d="M-10 0 C-24 -22 -44 -16 -42 0 C-44 16 -24 22 -10 0Z" fill="#e24a8d" opacity=".85"/><path d="M-12 0 C-24 -10 -34 -8 -36 0 C-34 8 -24 10 -12 0Z" fill="#7a2ea8" opacity=".7"/>') +
  '<path d="M-6 -7 C0 -20 14 -18 12 -6Z" fill="#e24a8d" opacity=".85"/><path d="M-4 7 C2 18 12 16 10 6Z" fill="#e24a8d" opacity=".85"/>' +
  '<ellipse rx="14" ry="6.6" fill="#b8326e"/><ellipse cx="-2" cy="-2" rx="8" ry="2.2" fill="#fff" opacity=".22"/>' +
  eye(9, -1.6, 1.4)

const tetra = () =>
  tail(-6, 16, 0.3, '<path d="M-6 0 L-12 -4 L-12 4Z" fill="#cfd9e8"/>') +
  '<ellipse rx="8" ry="3.3" fill="#d9e3f0"/><path d="M-7 -.6 L8 -.6" stroke="#2fc2ff" stroke-width="1.8"/>' +
  '<path d="M-6 1.2 Q0 3.4 8 1.2 L7 3 Q0 4 -6 2.6Z" fill="#e5483a"/>' +
  '<circle cx="5.4" cy="-1" r="1" fill="#1c2430"/>'

const SCHOOL = () =>
  (
    [
      [0, 0],
      [-12, 6],
      [-10, -7],
      [-24, 2],
      [-22, -9],
      [-33, 7],
    ] as Pt[]
  )
    .map(([x, y]) => `<g transform="translate(${x} ${y})">${tetra()}</g>`)
    .join('')

// A smooth S through `from` and `to`, level where it meets a point: the fish never pitches steeply.
const cubic = (p: Pt, q: Pt) => {
  const dx = (q[0] - p[0]) * 0.38

  return `C${n(p[0] + dx)} ${n(p[1])} ${n(q[0] - dx)} ${n(q[1])} ${n(q[0])} ${n(q[1])}`
}

const cubicLength = (p: Pt, q: Pt) => {
  const dx = (q[0] - p[0]) * 0.38
  let total = 0
  let [px, py] = p
  for (let i = 1; i <= 24; i++) {
    const t = i / 24
    const u = 1 - t
    const x = u * u * u * p[0] + 3 * u * u * t * (p[0] + dx) + 3 * u * t * t * (q[0] - dx) + t * t * t * q[0]
    const y = u * u * u * p[1] + 3 * u * u * t * p[1] + 3 * u * t * t * q[1] + t * t * t * q[1]
    total += Math.hypot(x - px, y - py)
    ;[px, py] = [x, y]
  }

  return total
}

// Out to the right through `m1` to `b`, and back to the left through `m2`: the fish faces
// the way it swims, flipped on the way back, and rests a moment where it turns.
const swim = (draw: string, a: Pt, m1: Pt, b: Pt, m2: Pt, dur: number, begin: number, scale = 1, upright = false) => {
  const out = cubicLength(a, m1) + cubicLength(m1, b)
  const back = cubicLength(b, m2) + cubicLength(m2, a)
  const turn = n(out / (out + back))
  const path = `M${a[0]} ${a[1]} ${cubic(a, m1)} ${cubic(m1, b)} ${cubic(b, m2)} ${cubic(m2, a)}`

  return (
    '<g>' +
    `<animateMotion path="${path}" dur="${dur}s" begin="${-begin}s" repeatCount="indefinite" calcMode="spline" keyPoints="0;${turn};1" keyTimes="0;.5;1" keySplines=".4 0 .6 1;.4 0 .6 1"${upright ? '' : ' rotate="auto"'}/>` +
    `<g transform="scale(${scale})"><g><animateTransform attributeName="transform" type="scale" values="${upright ? '1 1;-1 1' : '1 1;1 -1'}" keyTimes="0;.5" calcMode="discrete" dur="${dur}s" begin="${-begin}s" repeatCount="indefinite"/>${draw}</g></g></g>`
  )
}

// A closed, smooth loop through the points, for things that drift rather than swim.
const smoothLoop = (pts: Pt[]) => {
  const m = pts.length
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < m; i++) {
    const p0 = pts[(i - 1 + m) % m]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % m]
    const p3 = pts[(i + 2) % m]
    d += ` C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`
  }

  return d
}

// ---- seahorse: upright, drifting slowly, with a rocking body and a fluttering fin --------------------
const SEAHORSE = () =>
  '<g><animateTransform attributeName="transform" type="rotate" values="-5 0 8;5 0 8;-5 0 8" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="3.4s" repeatCount="indefinite"/>' +
  // curled tail, then the belly stroke
  '<path d="M3 16 C-4 24 3 31 -5 33 C-12 35 -14 28 -9 26 C-7 25 -5 28 -7 29" fill="none" stroke="#e8902c" stroke-width="5.5" stroke-linecap="round"/>' +
  '<path d="M4 -14 C11 -6 9 6 3 15" fill="none" stroke="#f4a542" stroke-width="11.5" stroke-linecap="round"/>' +
  '<path d="M-1 -4 q7 3 13 0 M-1 3 q7 3 12 0 M0 10 q6 3 10 0" fill="none" stroke="#c97420" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>' +
  // dorsal fin, fluttering
  '<g><animateTransform attributeName="transform" type="scale" values="1 1;.55 1;1 1" dur=".35s" repeatCount="indefinite" additive="sum"/>' +
  '<path d="M-1 -2 C-14 -1 -14 9 -3 11Z" fill="#fbd592" opacity=".85"/></g>' +
  // head, crest, snout
  '<ellipse cx="4" cy="-19" rx="8" ry="7" fill="#f4a542"/>' +
  '<path d="M8 -21 L22 -18.5 L22 -15.5 L8 -14Z" fill="#f4a542"/>' +
  '<path d="M-2 -24 l1.5 -6 l3 5 l3 -5 l1.4 6" fill="#e8902c" stroke="#e8902c" stroke-width="1" stroke-linejoin="round"/>' +
  '<path d="M6 -10 q5 3 3 8" fill="none" stroke="#fbd592" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>' +
  eye(6.4, -20, 1.5) +
  '</g>'

// ---- jellyfish: the bell pulses, jets up, and sinks while the tentacles wave ----------------------------
const jelly = (inner: string, rim: string, scale: number, dur: number, begin: number, loop: Pt[]) => {
  const id = nextId('jf')
  const tent = Array.from({ length: 9 }, (_, i) => {
    const x = -16 + i * 4
    const len = 24 + ((i * 7) % 4) * 8
    const a = `M${x} 0 q${i % 2 ? 4 : -4} ${len / 2} 0 ${len} q${i % 2 ? -4 : 4} ${len / 2} 0 ${len}`
    const b = `M${x} 0 q${i % 2 ? -4 : 4} ${len / 2} 0 ${len} q${i % 2 ? 4 : -4} ${len / 2} 0 ${len}`

    return `<path d="${a}" fill="none" stroke="${rim}" stroke-width="1.2" stroke-linecap="round" opacity=".6"><animate attributeName="d" values="${a};${b};${a}" dur="${2.6 + (i % 3) * 0.5}s" begin="${-i * 0.4}s" repeatCount="indefinite"/></path>`
  }).join('')
  const arm = [-7, -2, 3, 8]
    .map(
      (x, i) =>
        `<path d="M${x} 0 q-5 10 0 20 q5 10 0 20" fill="none" stroke="${rim}" stroke-width="3.6" stroke-linecap="round" opacity=".5"><animate attributeName="d" values="M${x} 0 q-5 10 0 20 q5 10 0 20;M${x} 0 q5 10 0 20 q-5 10 0 20;M${x} 0 q-5 10 0 20 q5 10 0 20" dur="${3 + i * 0.4}s" begin="${-i}s" repeatCount="indefinite"/></path>`,
    )
    .join('')
  const d = smoothLoop(loop)

  return (
    `<radialGradient id="${id}" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${inner}" stop-opacity=".78"/><stop offset="1" stop-color="${rim}" stop-opacity=".5"/></radialGradient>` +
    `<g><animateMotion path="${d}" dur="${dur}s" begin="${-begin}s" repeatCount="indefinite"/>` +
    `<g transform="scale(${scale})"><g><animateTransform attributeName="transform" type="translate" values="0 0;0 -16;0 0" keyTimes="0;.3;1" calcMode="spline" keySplines=".3 0 .2 1;.5 0 .5 1" dur="2.8s" begin="${-begin}s" repeatCount="indefinite"/>` +
    tent +
    arm +
    '<g><animateTransform attributeName="transform" type="scale" values="1 1;1.14 .8;1 1" keyTimes="0;.3;1" calcMode="spline" keySplines=".3 0 .2 1;.5 0 .5 1" dur="2.8s" begin="' + `${-begin}s` + '" repeatCount="indefinite"/>' +
    `<path d="M-21 0 C-21 -32 21 -32 21 0 C15 -5 8 2 0 -3 C-8 2 -15 -5 -21 0Z" fill="url(#${id})" stroke="${rim}" stroke-opacity=".75" stroke-width="1.2"/>` +
    '<ellipse cx="-5" cy="-17" rx="8" ry="5" fill="#fff" opacity=".35"/><circle cx="6" cy="-8" r="1.4" fill="#fff" opacity=".6"/><circle cx="-8" cy="-6" r="1" fill="#fff" opacity=".5"/>' +
    '</g></g></g></g>'
  )
}

const CLOWNS =
  swim(clown(), [292, 925], [318, 905], [346, 925], [320, 942], 14, 3, 0.85) +
  swim(clown(), [296, 940], [322, 920], [344, 936], [318, 952], 17, 11, 0.7)

const FREE =
  swim(BUTTERFLYFISH(), [60, 160], [200, 120], [340, 200], [190, 270], 34, 20, 1.1) +
  swim(SCHOOL(), [60, 380], [200, 340], [340, 410], [200, 450], 28, 8, 1.1) +
  swim(SCHOOL(), [50, 250], [190, 215], [345, 270], [200, 310], 33, 18, 1.0) +
  swim(BUTTERFLYFISH(), [50, 650], [190, 700], [340, 630], [200, 590], 36, 3, 1.15) +
  swim(BLUE_TANG(), [50, 560], [180, 640], [340, 530], [190, 470], 38, 5, 1.25) +
  swim(YELLOW_TANG(), [40, 790], [190, 860], [350, 770], [200, 710], 32, 12, 1.1) +
  swim(BETTA(), [70, 960], [190, 1030], [330, 940], [180, 890], 42, 9, 1.2) +
  swim(ANGELFISH(), [60, 1100], [200, 1040], [330, 1110], [190, 1170], 46, 17, 1.0) +
  swim(PARROTFISH(), [50, 1210], [190, 1260], [350, 1200], [200, 1160], 50, 26, 1.3) +
  swim(YELLOW_TANG(), [60, 1300], [190, 1270], [340, 1320], [200, 1350], 40, 30, 1.0) +
  swim(SEAHORSE(), [150, 880], [210, 840], [270, 920], [210, 980], 70, 14, 1.15, true) +
  jelly('#ffd0ef', '#ff8fd0', 1.1, 96, 10, [[290, 1240], [130, 960], [210, 560], [300, 860]]) +
  jelly('#e3d4ff', '#a387f5', 0.8, 120, 55, [[110, 420], [260, 250], [330, 520], [190, 700]]) +
  jelly('#d2f4ff', '#62c9f2', 1.3, 110, 80, [[200, 1150], [330, 820], [150, 380], [90, 800]])

// ---- what Claude is doing: the lights, the submarine, the pearl -----------------------------------------
type Look = { working: boolean; prev: boolean; done: number; fresh: boolean; ran?: number }

// Every animation here repeats, so shifting each `begin` back by the time already spent keeps
// the fish where they were when the picture is drawn again for a new state.
const retime = (svg: string, elapsed: number) =>
  svg.replace(/<(animate|animateTransform|animateMotion)\b[^>]*>/g, tag => {
    const found = / begin="(-?[\d.]+)s"/.exec(tag)
    const shifted = ` begin="${n((found ? parseFloat(found[1]) : 0) - elapsed)}s"`

    return found ? tag.replace(found[0], shifted) : tag.replace(/^<(\w+)/, `<$1${shifted}`)
  })

const SUB_AT: Pt = [165, 1110]

// The classic yellow submarine, seen from the side and facing right (about 90 units long).
const subSprite = (beam: boolean) =>
  // propeller at the stern: the blades turn edge-on and flat in turn
  '<g transform="translate(-50 0)"><circle r="3" fill="#8a6a00"/>' +
  '<g><animateTransform attributeName="transform" type="scale" values="1 1;1 .15;1 1" dur=".28s" repeatCount="indefinite"/>' +
  '<ellipse cx="-2" cy="-9" rx="2.6" ry="9" fill="#9a7400"/><ellipse cx="-2" cy="9" rx="2.6" ry="9" fill="#9a7400"/></g></g>' +
  // tail fins
  '<path d="M-36 -11 L-50 -20 L-45 -4Z" fill="#e5b00e" stroke="#b88a00" stroke-width="1.2" stroke-linejoin="round"/>' +
  '<path d="M-36 11 L-50 20 L-45 4Z" fill="#e5b00e" stroke="#b88a00" stroke-width="1.2" stroke-linejoin="round"/>' +
  // conning tower and periscope
  '<path d="M-13 -15 L-9 -27 L10 -27 L14 -15Z" fill="#f2bd10" stroke="#b88a00" stroke-width="1.5" stroke-linejoin="round"/>' +
  '<path d="M3 -27 V-37 H12" fill="none" stroke="#8a6a00" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<rect x="11" y="-39.5" width="3.4" height="5" rx="1" fill="#bfe8ff" stroke="#8a6a00" stroke-width=".8"/>' +
  // hull
  '<ellipse rx="44" ry="17.5" fill="#f7cb1e" stroke="#b88a00" stroke-width="1.7"/>' +
  '<path d="M-41 7 Q0 15 41 7" fill="none" stroke="#e0a000" stroke-width="2.4"/>' +
  '<ellipse cx="-4" cy="-9.5" rx="31" ry="3.8" fill="#fff" opacity=".35"/>' +
  '<g fill="#8a6a00"><circle cx="-33" cy="-8" r=".9"/><circle cx="-33" cy="8" r=".9"/><circle cx="33" cy="-8" r=".9"/><circle cx="33" cy="8" r=".9"/></g>' +
  // portholes, glowing a little
  [-19, 0, 19]
    .map(
      (x, i) =>
        `<g transform="translate(${x} -1)"><circle r="6.2" fill="#8a6a00"/><circle r="4.6" fill="#a9e0ff"/>` +
        `<circle r="3" fill="#fff6c8" opacity=".6"><animate attributeName="opacity" values=".35;.8;.35" dur="${2 + i * 0.4}s" repeatCount="indefinite"/></circle>` +
        '<circle cx="-1.4" cy="-1.6" r="1.1" fill="#fff"/></g>',
    )
    .join('') +
  // headlight and its beam
  '<circle cx="41" cy="-1" r="3.6" fill="#fffbd0" stroke="#b88a00" stroke-width="1"/>' +
  (beam
    ? '<g opacity="0"><animate attributeName="opacity" values="0;1" begin="11s" dur="1.5s" fill="freeze"/>' +
      `<g><animateTransform attributeName="transform" type="rotate" values="-5 43 -1;6 43 -1;-5 43 -1" keyTimes="0;.5;1" calcMode="spline" keySplines="${EASE};${EASE}" dur="7s" begin="12s" repeatCount="indefinite"/>` +
      '<polygon points="44,-1 190,-44 190,44" fill="url(#beam)"/></g></g>'
    : '')

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const ease = (x: number) => x * x * (3 - 2 * x)
const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, u: number): Pt => {
  const v = 1 - u

  return [
    v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
    v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
  ]
}

const SINK = 12 // seconds to reach the floor
const PATROL = 30 // seconds for one climb and descent
const RISE = 490 // how far the patrol climbs

// Where the submarine is `ran` seconds into a turn, so it can leave from there when the turn ends.
const subAt = (ran: number): Pt => {
  const [ax, ay] = SUB_AT
  if (ran < SINK) {
    const e = ease(clamp(ran / SINK, 0, 1))

    return e < 0.5
      ? bez([250, 70], [285, 300], [60, 480], [150, 760], e * 2)
      : bez([150, 760], [215, 960], [120, 1030], [ax, ay], (e - 0.5) * 2)
  }
  const p = ((ran - SINK) % PATROL) / PATROL
  const [x, y] = bez([ax, ay], [ax + 80, ay - 130], [ax - 80, ay - 330], [ax, ay - RISE], ease(p < 0.5 ? p * 2 : (1 - p) * 2))

  return [p < 0.5 ? x : 2 * ax - x, y]
}

// At work the submarine sinks to the floor, then patrols up and down with its light on; when
// the turn ends it rises from wherever it is.
const diver = (w: Look) => {
  const [ax, ay] = SUB_AT
  if (w.working) {
    const down = `M250 70 C285 300 60 480 150 760 C215 960 120 1030 ${ax} ${ay}`
    const patrol = `M${ax} ${ay} C${ax + 80} ${ay - 130} ${ax - 80} ${ay - RISE + 160} ${ax} ${ay - RISE} C${ax + 80} ${ay - RISE + 160} ${ax - 80} ${ay - 130} ${ax} ${ay}`
    const tilt = '0 0 0;-17 0 0;-17 0 0;11 0 0;11 0 0;0 0 0'
    const puffs = [0, 1, 2, 3, 4]
      .map(
        i =>
          '<circle cx="-64" cy="0" r="0" fill="#fff" fill-opacity=".25" stroke="#fff" stroke-opacity=".85" stroke-width=".8" opacity="0">' +
          `<animate attributeName="cy" values="0;-150" dur="3.5s" begin="${SINK + i * 0.7}s" repeatCount="indefinite"/>` +
          `<animate attributeName="r" values="1;3" dur="3.5s" begin="${SINK + i * 0.7}s" repeatCount="indefinite"/>` +
          `<animate attributeName="opacity" values="0;.9;0" dur="3.5s" begin="${SINK + i * 0.7}s" repeatCount="indefinite"/></circle>`,
      )
      .join('')

    return (
      `<g><animateMotion path="${down}" dur="${SINK}s" fill="freeze" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines=".4 0 .3 1"/>` +
      `<animateMotion path="${patrol}" dur="${PATROL}s" begin="${SINK}s" repeatCount="indefinite" calcMode="spline" keyPoints="0;.5;1" keyTimes="0;.5;1" keySplines="${EASE};${EASE}"/>` +
      `<g><animateTransform attributeName="transform" type="rotate" values="32 0 0;32 0 0;3 0 0" keyTimes="0;.65;1" dur="${SINK}s" fill="freeze"/>` +
      `<g><animateTransform attributeName="transform" type="rotate" values="${tilt}" keyTimes="0;.04;.46;.54;.96;1" calcMode="spline" keySplines="${Array(5).fill(EASE).join(';')}" dur="${PATROL}s" begin="${SINK}s" repeatCount="indefinite"/>` +
      `<g transform="scale(1.2)">${subSprite(true)}</g></g></g>` +
      puffs +
      '</g>'
    )
  }
  if (w.prev) {
    const [sx, sy] = subAt(w.ran ?? SINK)
    const up = `M${n(sx)} ${n(sy)} C${n(sx)} ${n(sy - 300)} 250 400 250 40`
    const dur = n(clamp(((sy - 40) / 1070) * 10, 3, 12))

    return (
      `<g><animateMotion path="${up}" dur="${dur}s" fill="freeze" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines=".5 0 .4 1"/>` +
      `<animate attributeName="opacity" values="1;1;0" keyTimes="0;.88;1" dur="${dur}s" fill="freeze"/>` +
      `<g><animateTransform attributeName="transform" type="rotate" values="3 0 0;3 0 0;-32 0 0" keyTimes="0;.08;.3" dur="${dur}s" fill="freeze"/>` +
      `<g transform="scale(1.2)">${subSprite(false)}</g></g></g>`
    )
  }

  return ''
}

const STATIC_BOTTOM =
  BACK +
  kelp(112, 420, '#3f9a5a', 7, 0) +
  kelp(124, 330, '#58b06b', 8, 2) +
  kelp(272, 360, '#3f9a5a', 7.5, 1) +
  kelp(283, 250, '#58b06b', 9, 3) +
  `<rect x="8" y="${FLOOR - 4}" width="384" height="46" fill="url(#sand)"/>` +
  `<path d="M8 ${FLOOR + 6} C60 ${FLOOR - 6} 120 ${FLOOR + 4} 190 ${FLOOR - 2} C250 ${FLOOR - 8} 330 ${FLOOR + 2} 392 ${FLOOR - 4} V${H}H8Z" fill="#dfcd9a"/>` +
  STAGHORN +
  BRAIN +
  ANEMONE(false) +
  TUBES +
  CLOWNS +
  ANEMONE(true) +
  FOREGROUND

const FRAME =
  `<rect x="0" y="0" width="8" height="${H}" fill="#2b3640"/><rect x="392" y="0" width="8" height="${H}" fill="#2b3640"/>` +
  `<rect x="8" y="26" width="3" height="${H - 26}" fill="#fff" opacity=".12"/><rect x="389" y="26" width="3" height="${H - 26}" fill="#fff" opacity=".08"/>` +
  '<rect width="400" height="26" fill="#252d35"/><rect x="40" y="18" width="320" height="6" rx="3" fill="url(#lid)"/>' +
  `<rect x="0" y="${H - 10}" width="400" height="10" fill="#252d35"/>` +
  '<path d="M24 60 v640" stroke="#fff" stroke-opacity=".16" stroke-width="5" stroke-linecap="round"/>'

// Resting, the light swells and fades on a slow cycle. At work it holds darker than that, so the
// submarine's light and the chest stand out; the pump runs without a pause and the
// submarine goes down.
const DARK = 0.36 // the swell's darkest, resting
const LID_DARK = 0.85
const WORK_DARK = 0.6 // darker still while Claude works
const WORK_LID = 0.95
const CYCLE = 36

// Where the swell stands `t` seconds in (close to the animation's own easing): the veil that
// follows a change of state starts from it, so the light never jumps.
const swellAt = (t: number) => {
  const p = (((t % CYCLE) + CYCLE) % CYCLE) / CYCLE
  const half = p < 0.5 ? p * 2 : (1 - p) * 2

  return half * half * (3 - 2 * half)
}

const r3 = (v: number) => String(Math.round(v * 1000) / 1000)

const buildScene = (w: Look, elapsed: number) => {
  const count = pearlCount(w.done)
  const kept = PEARL_POS.slice(0, Math.max(0, count - 1))
    .map(([x, y]) => pearl(x, y))
    .join('')

  const swell = (low: number, high: number) =>
    `values="${low};${high};${low}" keyTimes="0;.5;1" calcMode="spline" keySplines="${EASE};${EASE}" dur="${CYCLE}s" repeatCount="indefinite"`
  const breathe = w.working
    ? ''
    : `<rect x="8" y="26" width="384" height="${H - 26}" fill="#071a33" opacity="0"><animate attributeName="opacity" ${swell(0, DARK)}/></rect>` +
      `<rect x="8" y="26" width="384" height="760" fill="url(#glow)" opacity=".2"><animate attributeName="opacity" ${swell(0.2, 0)}/></rect>`
  const breatheLid = w.working
    ? ''
    : `<rect x="40" y="18" width="320" height="6" rx="3" fill="#252d35" opacity="0"><animate attributeName="opacity" ${swell(0, LID_DARK)}/></rect>`

  const tank =
    '<g clip-path="url(#tank)">' +
    `<rect x="8" y="26" width="384" height="${H - 26}" fill="url(#water)"/>` +
    rays +
    `<g transform="translate(0 ${DY})">${STATIC_BOTTOM}${AIRSTONE}${chest(w.working)}${kept}</g>` +
    FREE +
    BUBBLER(28, 978 + DY, 12, 30, 4) +
    BUBBLER(279, 970 + DY, 14, 31, 12) +
    (w.working ? BUBBLER(28, 978 + DY, 9, 14, 0, 1, 14 / 9) + BUBBLER(279, 970 + DY, 8, 15, 0.7, 1, 15 / 8) : '') +
    plankton +
    breathe +
    '</g>' +
    surface

  // A veil over the swell: going to work it sinks from wherever the swell was to its work darkness and
  // stays; coming back it lifts, and the swell takes over again.
  const now = swellAt(elapsed)
  const veilRect = (x: number, y: number, width: number, height: number, fill: string, a: number, b: number) =>
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" opacity="${r3(b)}"><animate attributeName="opacity" values="${r3(a)};${r3(b)}" dur="1.4s" fill="freeze"/></rect>`
  const lift = (target: number, covered: number) => Math.max(0, (target - covered) / (1 - covered))
  let veil = ''
  let lidVeil = ''
  if (w.working) {
    veil = veilRect(8, 26, 384, H - 26, '#071a33', DARK * now, WORK_DARK)
    lidVeil = veilRect(40, 18, 320, 6, '#252d35', LID_DARK * now, WORK_LID)
  } else if (w.prev) {
    veil = veilRect(8, 26, 384, H - 26, '#071a33', lift(WORK_DARK, DARK * now), 0)
    lidVeil = veilRect(40, 18, 320, 6, '#252d35', lift(WORK_LID, LID_DARK * now), 0)
  }

  const newest = count > 0 ? pearl(PEARL_POS[count - 1][0], PEARL_POS[count - 1][1] + DY, w.fresh) : ''
  const overlay = '<g clip-path="url(#tank)">' + veil + newest + diver(w) + '</g>'

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMax slice">${DEFS}` +
    `<rect width="${W}" height="${H}" fill="#1b242c"/>` +
    retime(tank, elapsed) +
    overlay +
    FRAME +
    retime(breatheLid, elapsed) +
    lidVeil +
    '</svg>'
  )
}
// ---scene-end

const TERMINAL_ART: [string, string][] = [
  ['     o', '#bfe6f2'],
  ['   o', '#bfe6f2'],
  [' ><(((º>', '#f58a2f'],
  ['        <º)))><', '#2f78e0'],
  ['   ><>   ', '#f9dc2e'],
  ['  ✿ ψ ❀ ✾', '#e2735a'],
]

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))

  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const reef = atom(
  { plugin: 'reef-tank', key: 'reef' } as const,
  { working: false, prev: false, done: 0, fresh: false, tools: 0, startedAt: 0, tick: 0 } as Reef,
)

// The picture is built again only when the state it draws changes; the same text keeps it running.
let t0 = 0
let cache = { key: '', svg: '' }

export const register: Register = (on, options) => {
  // `language` is a field of the plugin's userConfig: 'en' (default) or 'ko'
  const T: Words = STRINGS[options.language === 'ko' ? 'ko' : 'en']

  on('session.start', async ($, e, next) => {
    t0 = await $.clock.now()
    await $.command.register({
      name: 'reef',
      description: 'Open the aquarium pane',
    })
    // Wakes the pane each second while Claude works, for the stopwatch in its top line.
    $.clock.every(1000, () => {
      void read($, reef)
        .then(r => (r.working ? update($, reef, v => ({ ...v, tick: v.tick + 1 })) : undefined))
        .catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'reef' }, async $ => {
    await $.ui.open({ id: PANE, title: T.title })

    return { text: T.opened }
  })

  // The main loop's turns only: a subagent's run is not Claude at work.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, reef, v => ({ ...v, prev: false, working: true, fresh: false, tools: 0, startedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const isAnswer = e.reason === 'answer'
      await update($, reef, v => ({ ...v, prev: true, working: false, fresh: isAnswer, done: v.done + (isAnswer ? 1 : 0) }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await update($, reef, v => ({ ...v, tools: v.tools + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const w = await read($, reef)
    const now = await $.clock.now()
    if (t0 === 0) t0 = now
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 20
    const line = w.working ? T.working(clock(now - w.startedAt), w.tools) : T.idle(w.done)

    if (e.surface !== 'terminal') {
      const { Box, Text, Svg } = els as ElementTable<'desktop'>
      const key = `${w.working}|${w.prev}|${w.fresh}|${w.done}|${w.startedAt}`
      if (cache.key !== key) cache = { key, svg: buildScene({ ...w, ran: Math.max(0, (now - w.startedAt) / 1000) }, (now - t0) / 1000) }
      // The pane's px: its cells over the code font's advance (about 7.8 px) and line height
      // (about 19.5 px). Short of the whole picture, the top of the water is cut, never the floor.
      const width = Math.max(160, Math.round(cols * 7.8))
      const full = Math.round((width * H) / W)
      const tall = e.props?.scroll?.bodyRows ? Math.round((rows - 1) * 19.5) : full
      const height = Math.min(full, tall)

      return (
        <Box flexDirection="column" justifyContent="flex-end" minHeight={rows}>
          <Box justifyContent="center">
            <Text bold={w.working} dimColor={!w.working}>
              {line}
            </Text>
          </Box>
          <Svg source={cache.svg} alt={T.alt} width={width} height={height} isInteractive />
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
        <Text dimColor>{T.note}</Text>
      </Box>
    )
  })
}
