import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import type { Tower } from '../types'

const PANE = 'tower-cut'
const STRINGS = {
  en: {
    title: 'Tower',
    alt: 'A cross-section of a building where you can see into every room. A floor goes up with each finished turn, and at 20 floors it tops out with fireworks.',
    working: (clock: string, tools: number, floor: number) => `Working ${clock} · tools ${tools} · building floor ${floor}`,
    topped: (tower: number, max: number) => `Topped out! · tower ${tower} ${max}/${max} floors · completed ${tower}`,
    idle: (tower: number, floors: number, max: number, done: number) => `Idle · tower ${tower} ${floors}/${max} floors · completed ${done}`,
    opened: 'Opened the tower pane.',
    note: 'The animation shows in the desktop app.',
  },
  ko: {
    title: '빌딩',
    alt: '층마다 방 안이 보이는 빌딩 단면. 턴이 끝날 때마다 한 층씩 올라가고, 20층이 되면 불꽃놀이와 함께 준공됩니다.',
    working: (clock: string, tools: number, floor: number) => `작업 중 ${clock} · 도구 ${tools}회 · ${floor}층 공사`,
    topped: (tower: number, max: number) => `준공! · ${tower}번째 빌딩 ${max}/${max}층 · 준공 ${tower}채`,
    idle: (tower: number, floors: number, max: number, done: number) => `쉬는 중 · ${tower}번째 빌딩 ${floors}/${max}층 · 준공 ${done}채`,
    opened: '빌딩을 열었습니다.',
    note: '그림 움직임은 데스크톱 앱에서 보입니다.',
  },
}

type Words = (typeof STRINGS)['en']

// ---scene-start
const W = 400
const H = 1500
const GROUND = 1380
const FH = 56 // one floor: a 4 px slab on top of a 52 px room
const MAX = 20
const BX = 80 // the three rooms start here, 80 wide each

const n = (v: number) => String(Math.round(v * 10) / 10)
const r3 = (v: number) => String(Math.round(v * 1000) / 1000)
const EASE = '.45 0 .55 1'
const pick = <T,>(list: T[], s: number): T => list[((s % list.length) + list.length) % list.length]
const rnd = (s: number) => {
  const v = Math.sin(s * 127.1 + 311.7) * 43758.5453

  return v - Math.floor(v)
}

const glow = (x: number, y: number, r: number, s: number) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffe9a8" opacity=".3"><animate attributeName="opacity" values=".16;.42;.16" dur="${3 + (s % 4)}s" begin="${-(s % 5)}s" repeatCount="indefinite"/></circle>`

const frame = (x: number, y: number, w: number, h: number, c: string) =>
  `<rect x="${x - 1.5}" y="${y - 1.5}" width="${w + 3}" height="${h + 3}" fill="#8b6b45"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>` +
  `<path d="M${x} ${y + h} l${w * 0.35} ${-h * 0.5} l${w * 0.25} ${h * 0.3} l${w * 0.2} ${-h * 0.35} l${w * 0.2} ${h * 0.55}Z" fill="#fff" opacity=".35"/>`

const base = (wall: string) => `<rect width="80" height="52" fill="${wall}"/><rect y="48" width="80" height="4" fill="#000" opacity=".1"/>`

// ---- rooms, drawn at 0,0 over 80 x 52 ---------------------------------------------------------
const bedroom = (s: number) =>
  base('#f6e7d6') +
  frame(10, 8, 18, 14, pick(['#9fc7e8', '#f0b5a8', '#b9d9a5'], s)) +
  `<rect x="4" y="28" width="5" height="20" rx="2" fill="#8b5a2b"/><rect x="6" y="38" width="46" height="10" rx="2" fill="${pick(['#6f95d1', '#d98a7b', '#7bb08a'], s)}"/><ellipse cx="15" cy="37" rx="8" ry="3.6" fill="#fff"/>` +
  '<rect x="58" y="38" width="12" height="10" fill="#8b5a2b"/><rect x="61" y="30" width="6" height="8" rx="1" fill="#f1d27a"/>' +
  glow(64, 32, 13, s)

const office = (s: number) =>
  base('#dfe9f0') +
  '<rect x="8" y="36" width="44" height="3" fill="#6d5036"/><rect x="10" y="39" width="3" height="9" fill="#6d5036"/><rect x="47" y="39" width="3" height="9" fill="#6d5036"/>' +
  '<rect x="22" y="21" width="20" height="14" rx="1" fill="#26323f"/>' +
  `<rect x="24" y="23" width="16" height="10" fill="#7fd0ff"><animate attributeName="opacity" values=".55;1;.55" dur="${3 + (s % 3)}s" begin="${-(s % 4)}s" repeatCount="indefinite"/></rect>` +
  '<rect x="30" y="35" width="4" height="2" fill="#26323f"/><rect x="12" y="43" width="9" height="3" rx="1.5" fill="#556"/>' +
  '<rect x="60" y="8" width="16" height="40" fill="#8b6b45"/>' +
  [0, 1, 2]
    .map(r =>
      [0, 1, 2, 3]
        .map(c => `<rect x="${61.5 + c * 3.6}" y="${11 + r * 12}" width="3" height="9" fill="${pick(['#c9503f', '#3f7bc9', '#e0b43a', '#4aa26a'], r * 4 + c + s)}"/>`)
        .join(''),
    )
    .join('')

const living = (s: number) =>
  base('#f2ecd4') +
  frame(26, 8, 24, 12, pick(['#e8c36a', '#8fb7d9', '#c9a0d0'], s)) +
  '<rect x="6" y="34" width="38" height="12" rx="3" fill="#c0695a"/><rect x="6" y="26" width="38" height="10" rx="3" fill="#a9564a"/><rect x="9" y="30" width="10" height="8" rx="2" fill="#e8a35a"/>' +
  '<rect x="52" y="26" width="22" height="14" fill="#202833"/>' +
  '<rect x="54" y="28" width="18" height="10" fill="#4aa3df"><animate attributeName="fill" values="#4aa3df;#e8a14a;#6ccf8a;#4aa3df" dur="9s" repeatCount="indefinite"/></rect>' +
  '<rect x="50" y="40" width="26" height="8" fill="#8b6b45"/>' +
  '<g><animateTransform attributeName="transform" type="rotate" values="-3 71 40;3 71 40;-3 71 40" dur="4s" repeatCount="indefinite"/><ellipse cx="71" cy="36" rx="3" ry="6" fill="#3f9a5a"/></g>'

const cafe = (s: number) =>
  base('#f7e2c6') +
  '<path d="M20 0 V10 M52 0 V10" stroke="#555" stroke-width=".8"/><path d="M15 10 h10 l-2 6 h-6Z M47 10 h10 l-2 6 h-6Z" fill="#d94f4f"/>' +
  glow(20, 18, 11, s) +
  '<rect x="6" y="36" width="50" height="12" fill="#8b5a2b"/><rect x="4" y="34" width="54" height="3" fill="#c79a64"/>' +
  '<rect x="14" y="30" width="5" height="4" fill="#fff"/><rect x="30" y="30" width="5" height="4" fill="#fff"/>' +
  `<path d="M16 28 q-3 -4 0 -8 M32 28 q3 -4 0 -8" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"><animate attributeName="opacity" values=".15;.8;.15" dur="2.6s" begin="${-(s % 3)}s" repeatCount="indefinite"/></path>` +
  '<rect x="62" y="10" width="14" height="18" fill="#2f4a3a"/><path d="M64 15 h10 M64 19 h8 M64 23 h10" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 1.5" opacity=".8"/>'

const studio = (s: number) =>
  base('#e4eee0') +
  '<path d="M14 48 L22 22 L30 48 M22 22 V48" stroke="#8b5a2b" stroke-width="2" fill="none" stroke-linecap="round"/>' +
  `<rect x="12" y="19" width="20" height="16" fill="#fff" stroke="#8b5a2b" stroke-width="1.2"/><circle cx="18" cy="26" r="4" fill="${pick(['#e8693c', '#3f7bc9', '#e0b43a'], s)}"/><path d="M14 33 l7 -5 l8 5Z" fill="#4aa26a"/>` +
  '<rect x="50" y="40" width="10" height="8" fill="#b5651d"/>' +
  '<g><animateTransform attributeName="transform" type="rotate" values="-4 55 40;4 55 40;-4 55 40" dur="3.6s" repeatCount="indefinite"/><ellipse cx="52" cy="33" rx="3" ry="8" fill="#4aa26a"/><ellipse cx="58" cy="33" rx="3" ry="8" fill="#3f9a5a"/><ellipse cx="55" cy="30" rx="2.6" ry="9" fill="#58b06b"/></g>' +
  '<path d="M68 0 V12 M72 0 V18" stroke="#3f9a5a" stroke-width="1.6"/><circle cx="68" cy="13" r="2.4" fill="#58b06b"/><circle cx="72" cy="19" r="2.4" fill="#4aa26a"/>' +
  '<rect x="66" y="38" width="10" height="10" fill="#8b6b45"/>'

const lobby = (s: number) =>
  base('#e9eef2') +
  '<rect x="26" y="6" width="28" height="6" fill="#2f7fd0"/>' +
  '<rect x="22" y="14" width="36" height="34" fill="#bfe3f2" stroke="#6b7782" stroke-width="1.2"/>' +
  '<rect x="22" y="14" width="18" height="34" fill="#9ed0e6" stroke="#6b7782" stroke-width="1"><animateTransform attributeName="transform" type="translate" values="0 0;0 0;-13 0;-13 0;0 0" keyTimes="0;.2;.3;.7;.8" dur="9s" repeatCount="indefinite"/></rect>' +
  '<rect x="40" y="14" width="18" height="34" fill="#9ed0e6" stroke="#6b7782" stroke-width="1"><animateTransform attributeName="transform" type="translate" values="0 0;0 0;13 0;13 0;0 0" keyTimes="0;.2;.3;.7;.8" dur="9s" repeatCount="indefinite"/></rect>' +
  '<rect x="60" y="38" width="16" height="10" fill="#8b6b45"/><circle cx="68" cy="18" r="5" fill="#fff" stroke="#556" stroke-width="1"/><path d="M68 18 V14.5 M68 18 L70.5 19" stroke="#556" stroke-width=".9"/>' +
  glow(10, 12, 8, s)

const ROOMS = [bedroom, office, living, cafe, studio, lobby]

const person = (x: number, s: number) =>
  `<g transform="translate(${x} 48)"><g><animateTransform attributeName="transform" type="translate" values="0 0;24 0;0 0" keyTimes="0;.5;1" calcMode="spline" keySplines="${EASE};${EASE}" dur="${9 + (s % 5) * 2}s" begin="${-(s % 7)}s" repeatCount="indefinite"/>` +
  `<circle cy="-22" r="3.6" fill="#f3c9a0"/><rect x="-3.6" y="-18" width="7.2" height="13" rx="3" fill="${pick(['#d9534f', '#3f7bc9', '#e0b43a', '#4aa26a', '#8e5fc1'], s)}"/>` +
  '<rect x="-3" y="-6" width="2.6" height="6" fill="#39414d"/><rect x=".4" y="-6" width="2.6" height="6" fill="#39414d"/></g></g>'

// One finished floor: rooms, walls, the slab above them, and someone walking about.
const floor = (i: number) => {
  const y0 = GROUND - (i + 1) * FH
  let out = ''
  for (let j = 0; j < 3; j++) {
    const s = i * 3 + j
    const type = i === 0 ? [3, 5, 4][j] : (i * 7 + j * 3 + (i >> 1)) % 5
    const who = i > 0 && (i + j * 2) % 3 === 1 ? person(18 + (s % 3) * 8, s) : i === 0 && j === 1 ? person(10, s) : ''
    out += `<g transform="translate(${BX + j * 80} ${y0 + 4})">${ROOMS[type](s)}${who}</g>`
  }

  return (
    out +
    `<rect x="76" y="${y0}" width="4" height="${FH}" fill="#7d858d"/><rect x="320" y="${y0}" width="4" height="${FH}" fill="#7d858d"/>` +
    `<rect x="159" y="${y0 + 4}" width="2" height="52" fill="#aab2ba"/><rect x="239" y="${y0 + 4}" width="2" height="52" fill="#aab2ba"/>` +
    `<rect x="72" y="${y0}" width="256" height="4" fill="#5f6872"/>`
  )
}

// The floor going up: bare columns, orange scaffolding, a worker and a welder's sparks.
const SITE = '#f08a1c'
const site = (i: number) => {
  const y0 = GROUND - (i + 1) * FH
  const yb = y0 + FH
  const cols = [76, 158, 238, 320].map(x => `<rect x="${x}" y="${y0}" width="4" height="${FH}" fill="#9aa1a8"/>`).join('')
  const xs = [68, 148, 228, 332]
  const bars =
    xs.map(x => `M${x} ${y0 - 2} V${yb}`).join(' ') +
    ` M68 ${y0 + 2} H332 M68 ${y0 + 28} H332` +
    xs
      .slice(0, 3)
      .map((x, k) => (k % 2 === 0 ? `M${x} ${y0 + 28} L${xs[k + 1]} ${y0 + 2}` : `M${x} ${y0 + 2} L${xs[k + 1]} ${y0 + 28}`))
      .join(' ')

  return (
    cols +
    `<path d="${bars}" fill="none" stroke="${SITE}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<rect x="84" y="${yb - 14}" width="30" height="14" fill="#c9503f" opacity=".85"/><rect x="262" y="${yb - 8}" width="40" height="8" fill="#8a929a"/>` +
    // worker
    `<g transform="translate(120 ${yb})"><g><animateTransform attributeName="transform" type="translate" values="0 0;60 0;0 0" keyTimes="0;.5;1" calcMode="spline" keySplines="${EASE};${EASE}" dur="14s" repeatCount="indefinite"/>` +
    `<circle cy="-22" r="3.6" fill="#f3c9a0"/><path d="M-4.4 -23 a4.4 4.4 0 0 1 8.8 0Z" fill="#ffd21f"/><rect x="-3.6" y="-18" width="7.2" height="13" rx="3" fill="${SITE}"/><rect x="-3" y="-6" width="2.6" height="6" fill="#39414d"/><rect x=".4" y="-6" width="2.6" height="6" fill="#39414d"/></g></g>` +
    // sparks
    `<g transform="translate(206 ${yb - 4})">` +
    [0, 1, 2, 3]
      .map(
        k =>
          `<circle r="1.3" fill="#ffe27a" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="${0.5 + k * 0.17}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;${(k - 1.5) * 9} ${-12 - k * 3}" dur="${0.5 + k * 0.17}s" repeatCount="indefinite"/></circle>`,
      )
      .join('') +
    '</g>'
  )
}

// ---- sky, skyline, ground ---------------------------------------------------------------
const SKY = [
  ['#6ec3ee', '#d3f0fb'],
  ['#4a5f9e', '#fcd9a0'],
  ['#070d24', '#243a78'],
]

const clouds = (y0: number, stage: number) => {
  const fill = ['#fff', '#ffd2b0', '#3a4c86'][stage]
  const op = ['.9', '.7', '.45'][stage]

  return [0, 1, 2]
    .map(
      k =>
        `<g transform="translate(0 ${n(y0 + 120 + k * 150 + (k % 2) * 30)})"><g><animateTransform attributeName="transform" type="translate" values="-80 0;480 0" dur="${60 + k * 18}s" begin="${-k * 23}s" repeatCount="indefinite"/>` +
        `<g fill="${fill}" opacity="${op}"><ellipse rx="34" ry="11"/><ellipse cx="-16" cy="-8" rx="20" ry="11"/><ellipse cx="14" cy="-11" rx="24" ry="13"/></g></g></g>`,
    )
    .join('')
}

const celestial = (y0: number, stage: number) => {
  if (stage === 0) {
    return `<circle cx="316" cy="${n(y0 + 90)}" r="42" fill="#fff6b0" opacity=".4"><animate attributeName="r" values="38;48;38" dur="6s" repeatCount="indefinite"/></circle><circle cx="316" cy="${n(y0 + 90)}" r="24" fill="#ffe27a"/>`
  }
  if (stage === 1) {
    return `<circle cx="70" cy="${GROUND - 210}" r="60" fill="#ffb066" opacity=".35"/><circle cx="70" cy="${GROUND - 210}" r="36" fill="#ff9a4a"/>`
  }

  return `<circle cx="330" cy="${n(y0 + 95)}" r="34" fill="#cfd8ff" opacity=".12"/><circle cx="330" cy="${n(y0 + 95)}" r="20" fill="#f4f1da"/><circle cx="324" cy="${n(y0 + 90)}" r="4" fill="#d6d2b6"/><circle cx="337" cy="${n(y0 + 101)}" r="3" fill="#d6d2b6"/>`
}

const stars = (y0: number) =>
  Array.from({ length: 36 }, (_, k) => {
    const y = y0 + rnd(k * 2 + 1) * (GROUND - y0 - 220)

    return `<circle cx="${n(rnd(k * 2) * W)}" cy="${n(y)}" r="${n(0.7 + rnd(k + 90) * 1)}" fill="#fff" opacity=".3"><animate attributeName="opacity" values=".15;.95;.15" dur="${n(2 + rnd(k + 5) * 4)}s" begin="${n(-rnd(k + 9) * 6)}s" repeatCount="indefinite"/></circle>`
  }).join('')

// Finished towers stand behind, dark, with a few lit windows.
const SLOTS = [
  [0, 46, 640],
  [352, 48, 720],
  [40, 34, 480],
  [326, 34, 560],
  [96, 60, 780],
  [236, 70, 900],
] as const

const skyline = (towers: number, stage: number) => {
  const col = ['#9fb8cb', '#6c6490', '#16224a'][stage]
  const win = ['#ffffff', '#ffd68a', '#ffe08a'][stage]
  const op = ['.45', '.7', '.9'][stage]

  return SLOTS.slice(0, Math.min(SLOTS.length, towers))
    .map(([x, w, h]) => {
      const top = GROUND - h
      const lines = [x + 8, x + w / 2 - 1.5, x + w - 12].filter((_, k) => w > 40 || k !== 1)

      return (
        `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${col}"/><rect x="${x + w / 2 - 1}" y="${top - 10}" width="2" height="10" fill="${col}"/>` +
        lines.map(lx => `<path d="M${n(lx)} ${top + 14} V${GROUND - 4}" stroke="${win}" stroke-width="3" stroke-dasharray="3 11" opacity="${op}"/>`).join('')
      )
    })
    .join('')
}

const car = (x: number, color: string) =>
  `<rect x="${x}" y="1426" width="44" height="12" rx="4" fill="${color}"/><path d="M${x + 9} 1426 l5 -9 h16 l5 9Z" fill="${color}"/><path d="M${x + 15} 1426 l3 -7 h8 l3 7Z" fill="#bfe3f2"/>` +
  `<circle cx="${x + 10}" cy="1439" r="4.4" fill="#222"/><circle cx="${x + 34}" cy="1439" r="4.4" fill="#222"/>`

const GROUND_SVG =
  `<rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="#5a4636"/>` +
  `<rect x="0" y="${GROUND}" width="${W}" height="14" fill="#6aa563"/><rect x="0" y="${GROUND + 12}" width="${W}" height="3" fill="#8a929a"/>` +
  // the basement, cut open: columns and two parked cars
  `<rect x="72" y="${GROUND + 15}" width="256" height="80" fill="#3d4450"/><rect x="72" y="${GROUND + 15}" width="256" height="4" fill="#5f6872"/>` +
  [100, 160, 240, 300].map(x => `<rect x="${x}" y="${GROUND + 19}" width="6" height="76" fill="#59616c"/>`).join('') +
  car(112, '#d94f4f') +
  car(252, '#4f86d9') +
  `<rect x="76" y="${GROUND + 24}" width="14" height="12" rx="2" fill="#2f7fd0"/><path d="M80 ${GROUND + 34} V${GROUND + 27} h3.4 a2.2 2.2 0 0 1 0 4.4 H80" fill="none" stroke="#fff" stroke-width="1.3"/>` +
  `<rect x="0" y="${GROUND + 95}" width="${W}" height="${H - GROUND - 95}" fill="#4a3a2d"/>`

const trees =
  '<rect x="33" y="1344" width="6" height="36" fill="#6b4a2a"/><circle cx="36" cy="1334" r="18" fill="#3f9a5a"/><circle cx="28" cy="1342" r="11" fill="#58b06b"/>' +
  '<rect x="365" y="1350" width="5" height="30" fill="#6b4a2a"/><circle cx="367" cy="1342" r="15" fill="#3f9a5a"/>' +
  '<rect x="52" y="1330" width="2.4" height="50" fill="#555"/><path d="M53 1332 h12" stroke="#555" stroke-width="2.4"/><circle cx="66" cy="1334" r="3" fill="#ffe9a8"/>'

// ---- the crane ---------------------------------------------------------------------
const crane = (ct: number, working: boolean) => {
  let zig = ''
  for (let y = GROUND; y - 24 > ct; y -= 24) zig += `M346 ${y} L354 ${y - 24} M354 ${y} L346 ${y - 24} `

  const a = 52
  const b = 120
  const swing = working
    ? '<animateTransform attributeName="transform" type="scale" values="1 1;.82 1;1 1" keyTimes="0;.5;1" calcMode="spline" keySplines="' + EASE + ';' + EASE + '" dur="18s" repeatCount="indefinite"/>'
    : ''
  const cableTop = ct + 6
  const y2 = working
    ? `<animate attributeName="y2" values="${cableTop + a};${cableTop + b};${cableTop + a}" dur="9s" repeatCount="indefinite"/>`
    : ''
  const beamY = working
    ? `<animate attributeName="y" values="${cableTop + a};${cableTop + b};${cableTop + a}" dur="9s" repeatCount="indefinite"/>`
    : ''

  return (
    `<path d="M346 ${GROUND} V${ct} M354 ${GROUND} V${ct} ${zig}" stroke="#f2b01e" stroke-width="2" fill="none"/>` +
    `<g transform="translate(350 0)"><g>${swing}` +
    `<rect x="-115" y="${ct}" width="160" height="6" fill="#f2b01e"/><path d="M-115 ${ct + 6} L-60 ${ct + 6} L-2 ${ct} M-115 ${ct + 6} L-90 ${ct}" stroke="#d99a10" stroke-width="1.4" fill="none"/>` +
    `<path d="M0 ${ct - 22} L-112 ${ct} M0 ${ct - 22} L42 ${ct}" stroke="#555" stroke-width="1"/><polygon points="-6,${ct} 6,${ct} 0,${ct - 22}" fill="#f2b01e"/>` +
    `<rect x="26" y="${ct + 6}" width="18" height="14" fill="#6b747d"/><rect x="2" y="${ct + 6}" width="12" height="10" rx="1" fill="#e8f3fa" stroke="#8a929a"/>` +
    `<line x1="-78" y1="${cableTop}" x2="-78" y2="${cableTop + a}" stroke="#333" stroke-width="1.2">${y2}</line>` +
    `<rect x="-90" y="${cableTop + a}" width="24" height="6" fill="#d94f4f" stroke="#7a2a2a" stroke-width=".8">${beamY}</rect>` +
    `</g></g>` +
    `<circle cx="350" cy="${ct - 24}" r="2.2" fill="#ff4040"><animate attributeName="opacity" values="1;.1;1" dur="1.6s" repeatCount="indefinite"/></circle>`
  )
}

// ---- topping out: helipad, flag and fireworks ----------------------------------------------
const FIREWORK = ['#ff5a5f', '#ffd23f', '#5ad0ff', '#7dff9a', '#ff8ad8']
const burst = (x: number, y: number, r: number, color: string, begin: number, dur: number) => {
  const rays = Array.from({ length: 12 }, (_, k) => {
    const a = (Math.PI * 2 * k) / 12

    return `M${n(Math.cos(a) * r * 0.4)} ${n(Math.sin(a) * r * 0.4)} L${n(Math.cos(a) * r)} ${n(Math.sin(a) * r)}`
  }).join(' ')

  return (
    `<g transform="translate(${x} ${y})" opacity="0"><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.06;.45;.75;1" dur="${dur}s" begin="${-begin}s" repeatCount="indefinite"/>` +
    `<g><animateTransform attributeName="transform" type="scale" values=".1;1;1.12;1.12" keyTimes="0;.3;.75;1" dur="${dur}s" begin="${-begin}s" repeatCount="indefinite"/>` +
    `<path d="${rays}" stroke="${color}" stroke-width="2.6" stroke-linecap="round" fill="none"/><circle r="3" fill="#fff"/></g></g>`
  )
}

const topOut = (ry: number) =>
  `<ellipse cx="200" cy="${ry - 3}" rx="40" ry="5" fill="#3a424b"/><ellipse cx="200" cy="${ry - 3.4}" rx="34" ry="3.6" fill="none" stroke="#fff" stroke-width="1"/>` +
  `<path d="M192 ${ry - 5} v3.6 M208 ${ry - 5} v3.6 M192 ${ry - 3.2} h16" stroke="#fff" stroke-width="1.4"/>` +
  `<rect x="300" y="${ry - 44}" width="2" height="44" fill="#ccc"/><rect x="302" y="${ry - 44}" width="20" height="12" fill="#e24a4a"><animateTransform attributeName="transform" type="scale" values="1 1;.82 1;1 1" dur="1.8s" repeatCount="indefinite"/></rect>` +
  `<rect x="109" y="${ry - 38}" width="2" height="38" fill="#999"/><circle cx="110" cy="${ry - 40}" r="2.4" fill="#ff4040"><animate attributeName="opacity" values="1;.1;1" dur="1.4s" repeatCount="indefinite"/></circle>`

const fireworks = (ry: number) =>
  `<g data-fx="1">` +
  [
    [120, ry - 110, 38, 0, 3.6],
    [292, ry - 140, 44, 1.4, 4],
    [206, ry - 190, 50, 2.6, 4.4],
    [60, ry - 190, 34, 0.8, 3.8],
    [350, ry - 80, 30, 2, 3.4],
  ]
    .map(([x, y, r, b, d], k) => burst(x, y, r, FIREWORK[k % FIREWORK.length], b, d))
    .join('') +
  '</g>'

// ---- the whole picture -------------------------------------------------------------------------
// Looping motion shifts back by the time already elapsed, so redrawing the picture never makes it jump.
// Tags marked data-once (a floor popping in, the sky darkening) are left alone and play from the start.
const retime = (svg: string, elapsed: number) =>
  svg.replace(/<(animate|animateTransform|animateMotion)\b[^>]*>/g, tag => {
    if (tag.includes('data-once')) {
      return tag
    }
    const found = / begin="(-?[\d.]+)s"/.exec(tag)
    const shifted = ` begin="${n((found ? parseFloat(found[1]) : 0) - elapsed)}s"`

    return found ? tag.replace(found[0], shifted) : tag.replace(/^<(\w+)/, `<$1${shifted}`)
  })

const WORK_VEIL = 0.3

const buildScene = (w: Tower, elapsed: number, vh: number) => {
  const stage = w.floors <= 6 ? 0 : w.floors <= 13 ? 1 : 2
  const celebrate = w.floors >= MAX && !w.working
  const building = w.working && w.floors < MAX ? w.floors + 1 : w.floors
  const topY = GROUND - building * FH
  const ct = Math.max(70, topY - 90)
  const view = Math.min(H, Math.max(vh, 240))
  let y0 = H - view
  const need = ct - 30 - (celebrate ? 120 : 0)
  if (need < y0) y0 = Math.max(0, need)

  const [skyTop, skyBottom] = SKY[stage]
  const defs =
    `<defs><linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="${n(y0)}" x2="0" y2="${GROUND}"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/></linearGradient></defs>`

  let floors = ''
  for (let i = 0; i < w.floors; i++) {
    const body = floor(i)
    floors +=
      w.fresh && i === w.floors - 1
        ? `<g opacity="0"><animate data-once="1" attributeName="opacity" values="0;1" dur=".9s" fill="freeze"/><g><animateTransform data-once="1" attributeName="transform" type="translate" values="0 40;0 -4;0 0" keyTimes="0;.7;1" dur=".9s" fill="freeze"/>${body}</g></g>`
        : body
  }
  if (w.floors > 0) {
    const ry = GROUND - w.floors * FH
    floors += `<rect x="68" y="${ry - 4}" width="264" height="4" fill="#59626c"/>` + (celebrate ? topOut(ry - 4) : '')
  }

  let veil = ''
  if (w.working) {
    veil = `<rect x="0" y="${n(y0)}" width="${W}" height="${n(GROUND - y0)}" fill="#06112a" opacity="${WORK_VEIL}"><animate data-once="1" attributeName="opacity" values="0;${WORK_VEIL}" dur="1.4s" fill="freeze"/></rect>`
  } else if (w.prev) {
    veil = `<rect x="0" y="${n(y0)}" width="${W}" height="${n(GROUND - y0)}" fill="#06112a" opacity="0"><animate data-once="1" attributeName="opacity" values="${WORK_VEIL};0" dur="1.4s" fill="freeze"/></rect>`
  }

  const scene =
    `<rect x="0" y="${n(y0)}" width="${W}" height="${n(GROUND - y0 + 2)}" fill="url(#sky)"/>` +
    (stage === 2 ? stars(y0) : '') +
    celestial(y0, stage) +
    clouds(y0, stage) +
    skyline(w.towers, stage) +
    GROUND_SVG +
    crane(ct, w.working && w.floors < MAX) +
    floors +
    (w.working && w.floors < MAX ? site(w.floors) : '') +
    (celebrate ? fireworks(GROUND - MAX * FH - 4) : '') +
    trees

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${n(y0)} ${W} ${n(view)}" width="${W}" height="${n(view)}" preserveAspectRatio="xMidYMax slice">${defs}` +
    `<rect x="0" y="${n(y0)}" width="${W}" height="${n(view)}" fill="#1b242c"/>` +
    retime(scene, elapsed) +
    veil +
    '</svg>'
  )
}
// ---scene-end

const TERMINAL_ART: [string, string][] = [
  ['      ┌──┐', '#8a929a'],
  ['    ┌─┤▒▒├─┐', '#8a929a'],
  ['    │▒│▒▒│▒│', '#e0b43a'],
  ['    │▒│▒▒│▒│', '#e0b43a'],
  ['    ├─┴──┴─┤', '#8a929a'],
  ['  ──┴──────┴──', '#6aa563'],
]

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))

  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const label = (w: Tower, now: number, T: Words) => {
  if (w.working) {
    return T.working(clock(now - w.startedAt), w.tools, Math.min(MAX, w.floors + 1))
  }
  if (w.floors >= MAX) {
    return T.topped(w.towers + 1, MAX)
  }

  return T.idle(w.towers + 1, w.floors, MAX, w.towers)
}

const tower = atom(
  { plugin: 'tower-cut', key: 'tower' } as const,
  { working: false, prev: false, floors: 0, towers: 0, fresh: false, tools: 0, startedAt: 0, tick: 0 } as Tower,
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
      name: 'tower',
      description: 'Open the building pane',
    })
    // Wakes the pane each second while Claude works, for the stopwatch in its top line.
    $.clock.every(1000, () => {
      void read($, tower)
        .then(r => (r.working ? update($, tower, v => ({ ...v, tick: v.tick + 1 })) : undefined))
        .catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'tower' }, async $ => {
    await $.ui.open({ id: PANE, title: T.title })

    return { text: T.opened }
  })

  // The main loop's turns only: a subagent's run is not Claude at work.
  // A tower that topped out stays standing until the next turn, then it joins the skyline.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, tower, v => ({
        ...v,
        prev: false,
        working: true,
        fresh: false,
        tools: 0,
        startedAt: now,
        floors: v.floors >= MAX ? 0 : v.floors,
        towers: v.floors >= MAX ? v.towers + 1 : v.towers,
      }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const isAnswer = e.reason === 'answer'
      await update($, tower, v => ({ ...v, prev: true, working: false, fresh: isAnswer, floors: Math.min(MAX, v.floors + (isAnswer ? 1 : 0)) }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await update($, tower, v => ({ ...v, tools: v.tools + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const w = await read($, tower)
    const now = await $.clock.now()
    if (t0 === 0) t0 = now
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 20
    const line = label(w, now, T)

    if (e.surface !== 'terminal') {
      const { Box, Text, Svg } = els as ElementTable<'desktop'>
      // The pane's px: its cells over the code font's advance (about 7.8 px) and line height
      // (about 19.5 px). Short of the whole picture the view keeps the ground, and climbs with the crane.
      const width = Math.max(160, Math.round(cols * 7.8))
      const full = Math.round((width * H) / W)
      const tall = e.props?.scroll?.bodyRows ? Math.round((rows - 1) * 19.5) : full
      const height = Math.min(full, tall)
      const key = `${w.working}|${w.prev}|${w.fresh}|${w.floors}|${w.towers}|${w.startedAt}|${height}|${width}`
      if (cache.key !== key) cache = { key, svg: buildScene(w, (now - t0) / 1000, (height * W) / width) }

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
