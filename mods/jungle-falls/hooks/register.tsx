import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import type { Falls } from '../types'

const PANE = 'jungle-falls'
const TITLE = '정글'
const ALT = '정글 속 계단식 폭포가 굽이쳐 내려와 연꽃 연못으로 떨어지고, 동물들이 무작위로 찾아옵니다.'

const KINDS = 24 // kinds of animal; 13 to 17 swim
const SLOTS = 1 // each kind visits at its own times
const HORIZON = 800 // seconds of visits laid out in each picture
const isUnder = (kind: number) => kind >= 13 && kind <= 17 // these swim under the pool's lily pads
const LIFE = 14 // seconds a visitor stays
const LIMB_KINDS = [2, 3, 7, 9, 10, 19, 20, 21, 22, 23] // these use a limb; two never share one at once

// ---scene-start
type Pt = [number, number]
type Slot = { id: number; kind: number; seed: number }

const W = 400
const H = 1660 // the pool is twice as deep as it was, so the picture is taller
const TOP = 262 // where the cliff begins
const POOL_Y = 1340

const n = (v: number) => String(Math.round(v * 10) / 10)
const EASE = '.45 0 .55 1'
const pick = <T,>(list: T[], s: number): T => list[((s % list.length) + list.length) % list.length]
const rnd = (s: number) => {
  const v = Math.sin(s * 127.1 + 311.7) * 43758.5453

  return v - Math.floor(v)
}

const sway = (deg: number, cx: number, cy: number, dur: number, begin: number) =>
  `<animateTransform attributeName="transform" type="rotate" values="${-deg} ${cx} ${cy};${deg} ${cx} ${cy};${-deg} ${cx} ${cy}" keyTimes="0;.5;1" calcMode="spline" keySplines="${EASE};${EASE}" dur="${dur}s" begin="${n(-begin)}s" repeatCount="indefinite"/>`

// ---- leaves and ferns --------------------------------------------------------------------------
const GREENS = ['#1f6b45', '#2f8f55', '#43a863', '#175a3a', '#5cbf72', '#2a7d4c']

const leaf = (x: number, y: number, rot: number, len: number, color: string) =>
  `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)})"><path d="M0 0 C${n(len * 0.3)} ${n(-len * 0.34)} ${n(len * 0.75)} ${n(-len * 0.3)} ${n(len)} 0 C${n(len * 0.75)} ${n(len * 0.3)} ${n(len * 0.3)} ${n(len * 0.34)} 0 0Z" fill="${color}"/>` +
  `<path d="M0 0 L${n(len * 0.92)} 0" stroke="#fff" stroke-opacity=".25" stroke-width="1.2"/></g>`

const fern = (x: number, y: number, k: number, size = 1) =>
  `<g>${sway(2.4, x, y, 4 + (k % 3), k)}` +
  [-68, -34, 0, 34, 68]
    .map((a, j) => leaf(x, y, a - 90 + (j % 2) * 4, (28 + (j % 3) * 8) * size, pick(GREENS, k + j)))
    .join('') +
  '</g>'

// ---- the sky, the far mountains and the canopy line --------------------------------------------
const SKYLINE =
  `<rect x="0" y="0" width="${W}" height="${TOP + 60}" fill="url(#sky)"/>` +
  '<circle cx="318" cy="96" r="70" fill="#fff4c0" opacity=".35"/><circle cx="318" cy="96" r="34" fill="#fff0a8" opacity=".85"/>' +
  `<path d="M0 ${TOP - 40} L50 150 L96 ${TOP - 70} L160 120 L226 ${TOP - 60} L290 150 L350 ${TOP - 80} L${W} 160 V${TOP + 60} H0Z" fill="#8fbfb4" opacity=".75"/>` +
  `<path d="M0 ${TOP - 20} L70 ${TOP - 100} L140 ${TOP - 30} L210 ${TOP - 110} L290 ${TOP - 34} L350 ${TOP - 96} L${W} ${TOP - 40} V${TOP + 60} H0Z" fill="#6fa59c" opacity=".85"/>` +
  `<rect x="0" y="${TOP - 60}" width="${W}" height="70" fill="url(#haze)"/>`

const CANOPY = [0, 1].map(layer =>
  Array.from({ length: 22 }, (_, k) => {
    const x = k * 19 - 8 + layer * 9
    const y = TOP - 6 - layer * 22 + rnd(k + layer * 40) * 14

    return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(18 + rnd(k + layer * 9) * 14)}" fill="${layer ? '#2a7050' : '#1f5a40'}"/>`
  }).join(''),
).join('')

// ---- the cliff -------------------------------------------------------------------------------------
const ROCKS = Array.from({ length: 28 }, (_, k) => {
  const x = rnd(k) * 440 - 20
  const y = TOP + 10 + rnd(k + 50) * (POOL_Y - TOP - 20)
  const rx = 20 + rnd(k + 100) * 36
  const ry = 9 + rnd(k + 150) * 18

  return (
    `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${pick(['#4b6b4f', '#3f5f48', '#587a58', '#33503f'], k)}"/>` +
    `<ellipse cx="${n(x - rx * 0.1)}" cy="${n(y - ry * 0.55)}" rx="${n(rx * 0.7)}" ry="${n(ry * 0.4)}" fill="#7ec27a" opacity=".38"/>`
  )
}).join('')

const WALL = `<rect x="0" y="${TOP - 4}" width="${W}" height="${POOL_Y - TOP + 8}" fill="url(#wall)"/>` + ROCKS

// ---- the terraces and the water that winds through them --------------------------------------------
const BASINS: [number, number, number][] = [
  [262, 330, 62],
  [176, 560, 70],
  [246, 790, 68],
  [150, 1030, 74],
]
// from the lip of one terrace to the next: x1, y1, x2, y2, width at the top, width at the foot
const FALLS: [number, number, number, number, number, number][] = [
  [248, 340, 192, 556, 26, 40],
  [192, 570, 232, 786, 28, 42],
  [232, 800, 166, 1026, 28, 44],
  [164, 1040, 198, 1346, 36, 70],
]

const ctrl = (x1: number, y1: number, x2: number, y2: number) => {
  const dy = y2 - y1

  return { a: [x1 + (x2 - x1) * 0.35, y1 + dy * 0.15], b: [x2 - (x2 - x1) * 0.08, y1 + dy * 0.7] }
}

const ribbon = (x1: number, y1: number, x2: number, y2: number, w1: number, w2: number) => {
  const { a, b } = ctrl(x1, y1, x2, y2)
  const wm = (w1 + w2) / 2

  return (
    `M${n(x1 - w1 / 2)} ${y1} C${n(a[0] - wm / 2)} ${n(a[1])} ${n(b[0] - w2 / 2)} ${n(b[1])} ${n(x2 - w2 / 2)} ${y2} L${n(x2 + w2 / 2)} ${y2} ` +
    `C${n(b[0] + w2 / 2)} ${n(b[1])} ${n(a[0] + wm / 2)} ${n(a[1])} ${n(x1 + w1 / 2)} ${y1}Z`
  )
}

const centre = (x1: number, y1: number, x2: number, y2: number, dx: number) => {
  const { a, b } = ctrl(x1, y1, x2, y2)

  return `M${n(x1 + dx)} ${y1} C${n(a[0] + dx)} ${n(a[1])} ${n(b[0] + dx)} ${n(b[1])} ${n(x2 + dx)} ${y2}`
}

const falls = (fast: boolean) =>
  FALLS.map(([x1, y1, x2, y2, w1, w2], k) => {
    const spread = [-0.28, 0, 0.28]
      .map((f, j) => {
        const w = w1 + (w2 - w1) * 0.5

        return (
          `<path d="${centre(x1, y1, x2, y2, f * w)}" fill="none" stroke="#fff" stroke-width="${n(2.2 + (j % 2) * 1.4)}" stroke-linecap="round" stroke-dasharray="${12 + j * 5} ${24 + (j % 2) * 12}" opacity=".7">` +
          `<animate attributeName="stroke-dashoffset" values="0;-${36 + j * 5 + (j % 2) * 12}" dur="${n((fast ? 0.7 : 1.25) + k * 0.12 + j * 0.1)}s" repeatCount="indefinite"/></path>`
        )
      })
      .join('')

    return (
      `<path d="${ribbon(x1, y1, x2, y2, w1, w2)}" fill="url(#fallw)"/>` +
      `<path d="${ribbon(x1, y1, x2, y2, w1 * 0.7, w2 * 0.7)}" fill="#fff" opacity=".16"/>` +
      spread
    )
  }).join('') +
  // the little stream that feeds the top terrace
  `<path d="${ribbon(254, TOP + 4, 262, 326, 14, 36)}" fill="url(#fallw)"/>`

const basin = (cx: number, cy: number, rx: number, k: number) =>
  `<ellipse cx="${cx}" cy="${cy + 20}" rx="${rx + 14}" ry="24" fill="#2f4a38"/>` +
  `<ellipse cx="${cx}" cy="${cy + 6}" rx="${rx + 10}" ry="17" fill="#5b7a58"/>` +
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="12" fill="url(#basinw)"/>` +
  [0, 1].map(j => `<ellipse cx="${cx + (j ? 18 : -22)}" cy="${cy + 1}" rx="14" ry="3.6" fill="none" stroke="#fff" stroke-width="1.2" opacity="0"><animate attributeName="opacity" values="0;.7;0" dur="2.6s" begin="${n(-k * 0.9 - j * 1.3)}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="scale" values="1 1;1.5 1.4" additive="sum" dur="2.6s" begin="${n(-k * 0.9 - j * 1.3)}s" repeatCount="indefinite"/></ellipse>`).join('') +
  `<path d="M${cx - rx - 8} ${cy + 8} Q${cx} ${cy + 36} ${cx + rx + 8} ${cy + 8}" fill="none" stroke="#7d9a72" stroke-width="5" stroke-linecap="round"/>`

const mist = (x: number, y: number, k: number, fast: boolean) =>
  [0, 1, 2]
    .slice(0, fast ? 3 : 2)
    .map(
      j =>
        `<ellipse cx="${n(x + (j - 1) * 16)}" cy="${y - 4}" rx="${n(20 + j * 4)}" ry="${n(9 + j * 2)}" fill="#fff" opacity=".4"><animate attributeName="opacity" values=".12;.5;.12" dur="${n(2.2 + j * 0.5)}s" begin="${n(-k - j * 0.7)}s" repeatCount="indefinite"/>` +
        `<animateTransform attributeName="transform" type="translate" values="0 0;${(j % 2 ? 1 : -1) * 5} -14;0 0" dur="${n(3 + j * 0.5)}s" begin="${n(-k - j * 0.4)}s" repeatCount="indefinite"/></ellipse>`,
    )
    .join('')

// ---- salmon leaping up the falls, and out of the pool ---------------------------------------------------
const salmon = () =>
  '<g><animateTransform attributeName="transform" type="rotate" values="-16 0 0;16 0 0;-16 0 0" dur=".28s" repeatCount="indefinite"/>' +
  '<path d="M-9 0 Q0 -5 8 0 Q0 5 -9 0Z" fill="#ee7f5a"/><path d="M-9 0 L-15 -4 L-14 0 L-15 4Z" fill="#d9603c"/><path d="M-2 -3 Q2 -7 4 -3" fill="#d9603c"/>' +
  '<path d="M-6 1.2 Q0 3.4 6 1.2" stroke="#ffd0b8" fill="none" stroke-width="1.2"/><circle cx="5" cy="-.8" r="1" fill="#1c2430"/></g>'

// fall, sideways offset (a share of the width), seconds per round, delay
const LEAP: [number, number, number, number][] = [
  [0, -0.18, 10.5, 0],
  [1, 0.2, 12.5, 4],
  [2, -0.1, 9.5, 2],
  [3, -0.2, 13, 0],
  [3, 0.22, 13, 6.5],
]

const leapers = () =>
  LEAP.map(([k, f, dur, delay]) => {
    const [x1, y1, x2, y2, w1, w2] = FALLS[k]
    const { a, b: c } = ctrl(x1, y1, x2, y2)
    const dx = f * ((w1 + w2) / 2)
    const path = `M${n(x2 + dx)} ${y2} C${n(c[0] + dx)} ${n(c[1])} ${n(a[0] + dx)} ${n(a[1])} ${n(x1 + dx)} ${y1}`

    return (
      '<g data-fish="1" opacity="0">' +
      `<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.02;.2;.23;1" dur="${dur}s" begin="${n(-delay)}s" repeatCount="indefinite"/>` +
      `<animateMotion path="${path}" rotate="auto" dur="${dur}s" begin="${n(-delay)}s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;.22;1"/>${salmon()}</g>`
    )
  }).join('')

const jumper = (x: number, y: number, delay: number, dur: number) =>
  `<g data-fish="1" opacity="0"><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.01;.1;.11;1" dur="${dur}s" begin="${n(-delay)}s" repeatCount="indefinite"/>` +
  `<animateMotion path="M${x} ${y} Q${x + 16} ${y - 52} ${x + 34} ${y}" rotate="auto" dur="${dur}s" begin="${n(-delay)}s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;.1;1"/>${salmon()}</g>` +
  `<ellipse cx="${x + 34}" cy="${y}" rx="10" ry="3" fill="none" stroke="#fff" stroke-width="1.2" opacity="0"><animate attributeName="opacity" values="0;0;.8;0;0" keyTimes="0;.09;.12;.2;1" dur="${dur}s" begin="${n(-delay)}s" repeatCount="indefinite"/></ellipse>`

// ---- the pool, its banks, pads and lotus ---------------------------------------------------------
const PADS: Pt[] = [
  [96, 1396],
  [146, 1432],
  [222, 1460],
  [258, 1408],
  [306, 1444],
  [70, 1510],
  [182, 1534],
  [268, 1508],
  [330, 1566],
  [124, 1590],
  [236, 1612],
  [340, 1500],
]

const pad = ([x, y]: Pt, k: number) =>
  `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 1.6;0 0" dur="${n(3.4 + k * 0.5)}s" begin="${n(-k)}s" repeatCount="indefinite"/>` +
  `<path d="M${x} ${y} L${x + 15} ${y - 4} A16 6.6 0 1 1 ${x + 11} ${y + 4.6}Z" fill="#3f9f58" transform="translate(${-x + x} 0)"/>` +
  `<ellipse cx="${x}" cy="${y}" rx="15" ry="5.6" fill="none" stroke="#2a7d46" stroke-width="1"/></g>`

const lotus = (x: number, y: number) =>
  `<g transform="translate(${x} ${y})">` +
  [-40, -20, 0, 20, 40].map(a => `<path d="M0 0 Q-5 -10 0 -16 Q5 -10 0 0Z" fill="#f08ab8" transform="rotate(${a})"/>`).join('') +
  '<circle cy="-2" r="3" fill="#ffd84d"/></g>'

const POOL_BASE_SHAPE = `<path d="M24 ${POOL_Y - 4} H376 V1560 Q376 1654 200 1654 Q24 1654 24 1560Z" fill="url(#pool)"/>`


// the bed of the pool: stones, waving weeds and light moving on the water
const POOL_DEPTH =
  Array.from({ length: 9 }, (_, k) => `<ellipse cx="${n(50 + rnd(k + 400) * 300)}" cy="${n(1620 + rnd(k + 410) * 26)}" rx="${n(14 + rnd(k + 420) * 22)}" ry="${n(6 + rnd(k + 430) * 7)}" fill="${pick(['#0a3a46', '#0d4452', '#15555f'], k)}"/>`).join('') +
  Array.from({ length: 11 }, (_, k) => {
    const x = 40 + k * 31 + rnd(k + 440) * 14
    const h = 44 + rnd(k + 450) * 60

    return `<g>${sway(5, x, 1650, 3 + (k % 4) * 0.6, k * 0.8)}<path d="M${n(x)} 1650 q${n(rnd(k) * 10 - 5)} ${n(-h * 0.5)} ${n(rnd(k + 9) * 12 - 6)} ${n(-h)}" fill="none" stroke="${pick(['#1f8f5a', '#2aa56a', '#157a4a'], k)}" stroke-width="${n(3 + (k % 3))}" stroke-linecap="round"/></g>`
  }).join('') +
  Array.from({ length: 9 }, (_, k) => `<ellipse cx="${n(50 + rnd(k + 460) * 300)}" cy="${n(1380 + rnd(k + 470) * 240)}" rx="${n(18 + rnd(k) * 20)}" ry="${n(4 + rnd(k + 5) * 5)}" fill="#bff6ec" opacity="0"><animate attributeName="opacity" values="0;.22;0" dur="${n(4 + rnd(k + 8) * 4)}s" begin="${n(-rnd(k + 3) * 6)}s" repeatCount="indefinite"/></ellipse>`).join('')

const POOL_BASE = POOL_BASE_SHAPE + POOL_DEPTH

const POOL_TOP =
  `<path d="M24 ${POOL_Y} q16 -6 33 0 t33 0 t33 0 t33 0 t33 0 t33 0 t33 0 t33 0 t33 0 t33 0 V${POOL_Y - 6} H24Z" fill="#a8efe6" opacity=".8"><animateTransform attributeName="transform" type="translate" values="0 0;-66 0" dur="4.2s" repeatCount="indefinite"/></path>` +
  PADS.map((p, k) => pad(p, k)).join('') +
  lotus(120, 1408) +
  lotus(278, 1424) +
  lotus(190, 1522) +
  lotus(84, 1562) +
  lotus(300, 1596) +
  jumper(236, 1372, 0, 9) +
  jumper(96, 1398, 4.5, 11) +
  // something watching from the water
  '<g transform="translate(330 1362)"><animateTransform attributeName="transform" type="translate" values="330 1362;330 1366;330 1362" dur="3.4s" repeatCount="indefinite"/>' +
  '<circle cx="0" cy="0" r="3.8" fill="#4f7a3a"/><circle cx="-1" cy="-1" r="1.6" fill="#f2c94c"/><circle cx="-12" cy="1" r="3.2" fill="#4f7a3a"/><circle cx="-13" cy="0" r="1.4" fill="#f2c94c"/></g>'

const BANKS =
  `<path d="M0 ${POOL_Y - 10} Q30 ${POOL_Y - 22} 44 ${POOL_Y - 4} V${H} H0Z" fill="#4d3b2c"/><path d="M${W} ${POOL_Y - 10} Q370 ${POOL_Y - 22} 356 ${POOL_Y - 4} V${H} H${W}Z" fill="#4d3b2c"/>` +
  `<path d="M0 ${POOL_Y - 10} Q30 ${POOL_Y - 22} 44 ${POOL_Y - 4}" fill="none" stroke="#5cbf72" stroke-width="9" stroke-linecap="round"/><path d="M${W} ${POOL_Y - 10} Q370 ${POOL_Y - 22} 356 ${POOL_Y - 4}" fill="none" stroke="#5cbf72" stroke-width="9" stroke-linecap="round"/>` +
  Array.from({ length: 14 }, (_, k) => `<ellipse cx="${n(rnd(k + 70) * 40)}" cy="${n(1400 + k * 20)}" rx="${n(9 + rnd(k) * 8)}" ry="5" fill="#6b5640"/><ellipse cx="${n(W - rnd(k + 80) * 40)}" cy="${n(1410 + k * 18)}" rx="${n(9 + rnd(k + 3) * 8)}" ry="5" fill="#6b5640"/>`).join('')

// reeds and big ferns on the banks and the terrace rims
const GROWTH =
  [22].map((x, k) => fern(x, POOL_Y - 8, k + 3, 1.3)).join('') +
  [378].map((x, k) => fern(x, POOL_Y - 8, k + 7, 1.3)).join('') +
  BASINS.map(([cx, cy, rx], k) => fern(cx - rx - 2, cy + 6, k + 11) + fern(cx + rx + 2, cy + 6, k + 21)).join('') +
  Array.from({ length: 9 }, (_, k) => `<path d="M${n(46 + k * 36)} ${POOL_Y} q${n(rnd(k) * 8 - 4)} -26 ${n(rnd(k + 9) * 12 - 6)} -${n(28 + rnd(k + 4) * 14)}" stroke="#3f9a55" stroke-width="2.4" fill="none" stroke-linecap="round"/>`).join('')

// ---- limbs for animals to walk and swing from, and vines ----------------------------------------------
const LIMBS = [
  { x0: 280, x1: 400, y: 900, side: 1 },
  { x0: 0, x1: 118, y: 1110, side: -1 },
  { x0: 0, x1: 120, y: 675, side: -1 },
] as const

const limb = (l: (typeof LIMBS)[number], k: number) => {
  const tipx = l.side === -1 ? l.x1 : l.x0
  const rootx = l.side === -1 ? l.x0 : l.x1

  return (
    `<path d="M${rootx} ${l.y + 8} Q${n((rootx + tipx) / 2)} ${l.y - 4} ${tipx} ${l.y}" fill="none" stroke="#3b2a1a" stroke-width="15" stroke-linecap="round"/>` +
    `<path d="M${rootx} ${l.y + 6} Q${n((rootx + tipx) / 2)} ${l.y - 6} ${tipx} ${l.y - 2}" fill="none" stroke="#7a5532" stroke-width="10" stroke-linecap="round"/>` +
    `<path d="M${rootx} ${l.y + 3} Q${n((rootx + tipx) / 2)} ${l.y - 9} ${tipx} ${l.y - 5}" fill="none" stroke="#9a7048" stroke-width="2.6" stroke-linecap="round" opacity=".6"/>` +
    `<g>${sway(1.6, tipx, l.y, 5 + k, k)}${[-70, -35, 0, 35].map((a, j) => leaf(tipx, l.y - 2, (l.side === -1 ? a : 180 - a), 34 + j * 3, pick(GREENS, k + j))).join('')}</g>`
  )
}

const vine = (x: number, len: number, dur: number, begin: number) =>
  `<g>${sway(2.4, x, TOP + 6, dur, begin)}<path d="M${x} ${TOP + 6} q-7 ${n(len * 0.3)} 0 ${n(len * 0.5)} t0 ${n(len * 0.5)}" fill="none" stroke="#1f6b3d" stroke-width="3" stroke-linecap="round"/>` +
  `<circle cx="${x}" cy="${TOP + 6 + len}" r="3.2" fill="#5cbf72"/><circle cx="${x - 3}" cy="${n(TOP + 6 + len * 0.55)}" r="2.4" fill="#43a863"/></g>`

const VINES = [34, 84, 154, 318, 366].map((x, k) => vine(x, 150 + (k % 3) * 120, 4.5 + k * 0.4, k)).join('')

// the near leaves that frame the picture
const FRAME = [
  [-14, 420, -14, 120],
  [-14, 820, 8, 130],
  [-14, 1230, -6, 118],
  [414, 560, 192, 126],
  [414, 1010, 172, 132],
  [414, 1280, 190, 120],
]
  .map(
    ([x, y, rot, len], k) =>
      `<g>${sway(2, x, y, 5 + (k % 3), k * 1.3)}${leaf(x, y, rot, len, '#124d32')}${leaf(x, y, rot + (x < 0 ? 30 : -30), len * 0.8, '#1a6b43')}${leaf(x, y, rot - (x < 0 ? 28 : -28), len * 0.7, '#0f4029')}</g>`,
  )
  .join('')

const RAYS = [
  [300, 380, 150, 70, 8],
  [236, 296, 40, -50, 11],
  [350, 400, 260, 220, 13],
]
  .map(
    ([a, b, c, d, dur], k) =>
      `<polygon points="${a},0 ${b},0 ${c},1000 ${d},1000" fill="#fff6c8" opacity=".08"><animate attributeName="opacity" values=".04;.16;.04" dur="${dur}s" begin="${-k * 3}s" repeatCount="indefinite"/></polygon>`,
  )
  .join('')

// Resting is day; while Claude works it is night: a dark veil, the moon, stars and fireflies fade in over 1.4 s.
const fade = (a0: number, a1: number, inner: string, max = 1) => {
  const v0 = Math.round(a0 * max * 1000) / 1000
  const v1 = Math.round(a1 * max * 1000) / 1000
  if (a0 === a1) {
    return a1 === 0 ? '' : `<g opacity="${v1}">${inner}</g>`
  }

  return `<g opacity="${v0}"><animate data-once="1" attributeName="opacity" values="${v0};${v1}" dur="${n(1.4 * Math.abs(a1 - a0))}s" fill="freeze"/>${inner}</g>`
}

const NIGHT_SKY =
  '<circle cx="88" cy="112" r="40" fill="#cfd8ff" opacity=".14"/><circle cx="88" cy="112" r="21" fill="#f4f1da"/><circle cx="81" cy="106" r="4" fill="#d6d2b6"/><circle cx="95" cy="119" r="3" fill="#d6d2b6"/>' +
  Array.from({ length: 14 }, (_, k) => `<circle cx="${n(rnd(k * 2) * W)}" cy="${n(rnd(k * 2 + 1) * (TOP - 50))}" r="${n(0.7 + rnd(k + 90))}" fill="#fff" opacity=".7"><animate attributeName="opacity" values=".25;.9;.25" dur="${n(2 + rnd(k + 5) * 4)}s" begin="${n(-rnd(k + 9) * 6)}s" repeatCount="indefinite"/></circle>`).join('')

const FIREFLIES = Array.from({ length: 10 }, (_, k) => {
  const x = 20 + rnd(k + 200) * 360
  const y = TOP + 40 + rnd(k + 210) * (H - 60 - TOP - 80)

  return `<circle cx="${n(x)}" cy="${n(y)}" r="2.2" fill="#e8ff7a"><animate attributeName="opacity" values=".1;1;.2;1;.1" dur="${n(3 + rnd(k) * 4)}s" begin="${n(-rnd(k + 4) * 6)}s" repeatCount="indefinite"/>` +
    `<animateMotion path="M0 0 C${n(10 + rnd(k) * 16)} -14 ${n(-12 - rnd(k + 3) * 14)} -10 0 0Z" dur="${n(6 + rnd(k + 8) * 5)}s" repeatCount="indefinite"/></circle>`
}).join('')

const nightLayer = (a0: number, a1: number) =>
  fade(a0, a1, `<rect x="0" y="0" width="${W}" height="${H}" fill="#06133a"/>`, 0.55) + fade(a0, a1, NIGHT_SKY + FIREFLIES)

// ---- visitors: each is drawn for LIFE seconds from its own start, then dropped ---------------------------
const flap = (draw: string, dur: number) =>
  `<g><animateTransform attributeName="transform" type="scale" values="1 1;1 -.4;1 1" dur="${dur}s" repeatCount="indefinite"/>${draw}</g>`

// Crosses the picture left to right (or back), facing the way it goes.
const flyer = (draw: string, y: number, dir: 1 | -1, dur: number, begin: string) => {
  const path = dir === 1 ? `M-50 ${n(y)} C100 ${n(y - 70)} 260 ${n(y + 60)} 450 ${n(y - 30)}` : `M450 ${n(y)} C300 ${n(y - 70)} 140 ${n(y + 60)} -50 ${n(y - 30)}`

  return `<g><animateMotion path="${path}" dur="${dur}s" begin="${begin}" fill="freeze"/><g transform="scale(${dir} 1)">${draw}</g></g>`
}

const toucan = () =>
  flap('<path d="M-4 0 Q-10 -16 -18 -10 Q-10 -2 -4 0Z" fill="#2a3342"/>', 0.46) +
  '<ellipse rx="14" ry="6" fill="#1c2430"/><ellipse cx="9" cy="1.4" rx="5" ry="3.8" fill="#fff"/><circle cx="15" cy="-2" r="5" fill="#1c2430"/>' +
  '<path d="M18 -5 q16 -2 19 4 q-9 6 -19 2Z" fill="#f4a21f"/><path d="M20 -2 q10 -1 16 1" stroke="#d9531e" fill="none"/><circle cx="17" cy="-3.2" r="1.2" fill="#fff"/>' +
  '<path d="M-12 -1 l-13 3 l13 2Z" fill="#1c2430"/><rect x="-26" y="1" width="3" height="3" fill="#e24a4a"/>'

const parrot = (c: string, wing: string) =>
  flap(`<path d="M-3 0 Q-8 -14 -16 -9 Q-9 -2 -3 0Z" fill="${wing}"/>`, 0.4) +
  `<ellipse rx="10" ry="4.4" fill="${c}"/><circle cx="11" cy="-2" r="4.2" fill="${c}"/><ellipse cx="12" cy="-2" rx="2.2" ry="2.8" fill="#fff"/><circle cx="12.4" cy="-2.2" r="1" fill="#1c2430"/>` +
  '<path d="M14 -4 q5 0 5 4 q-3 0 -5 -2Z" fill="#3a3a3a"/>' +
  `<path d="M-9 0 L-32 6 L-28 1Z" fill="${wing}"/><path d="M-9 0 L-24 3" stroke="#f2c94c" stroke-width="2"/>`

const monkeyHang = () =>
  '<path d="M0 0 L-3 13 M0 0 L3 13" stroke="#8b5a2b" stroke-width="3.2" stroke-linecap="round"/>' +
  '<path d="M2 32 q14 6 8 18 q-4 6 -10 2" fill="none" stroke="#7a4a22" stroke-width="3.4" stroke-linecap="round"/>' +
  '<ellipse cx="0" cy="24" rx="6.5" ry="10" fill="#8b5a2b"/><ellipse cx="0" cy="25" rx="3.6" ry="6" fill="#e8c9a0"/>' +
  '<path d="M-3 32 l-2 10 M3 32 l2 10" stroke="#8b5a2b" stroke-width="3" stroke-linecap="round"/>' +
  '<circle cx="0" cy="12" r="6" fill="#8b5a2b"/><ellipse cx="0" cy="13.2" rx="3.8" ry="3.2" fill="#e8c9a0"/><circle cx="-1.8" cy="11.4" r=".9" fill="#1c2430"/><circle cx="1.8" cy="11.4" r=".9" fill="#1c2430"/><circle cx="-6" cy="11" r="2.2" fill="#8b5a2b"/><circle cx="6" cy="11" r="2.2" fill="#8b5a2b"/>'

const legs = (x: number, k: number) =>
  `<g><animateTransform attributeName="transform" type="rotate" values="${k ? -24 : 24} ${x} -8;${k ? 24 : -24} ${x} -8;${k ? -24 : 24} ${x} -8" dur=".8s" repeatCount="indefinite"/><rect x="${x - 2.4}" y="-9" width="5" height="12" rx="2.4" fill="#e8a63c"/></g>`

const jaguar = () =>
  `<g>${sway(8, -26, -16, 2.2, 0)}<path d="M-26 -16 q-14 -6 -12 -20 q2 -8 8 -4" fill="none" stroke="#e8a63c" stroke-width="5" stroke-linecap="round"/></g>` +
  legs(-20, 0) +
  legs(18, 0) +
  '<rect x="-28" y="-24" width="50" height="17" rx="8.5" fill="#e8a63c"/><rect x="-28" y="-12" width="50" height="5" rx="2.5" fill="#f4d89a" opacity=".6"/>' +
  legs(-10, 1) +
  legs(26, 1) +
  [[-20, -18], [-10, -20], [0, -17], [8, -20], [-16, -12], [-4, -11], [12, -14]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#3b2a1a"/>`).join('') +
  '<circle cx="28" cy="-22" r="9" fill="#e8a63c"/><circle cx="23" cy="-30" r="3" fill="#e8a63c"/><circle cx="32" cy="-30" r="3" fill="#e8a63c"/><ellipse cx="34" cy="-19" rx="5" ry="3.6" fill="#f4d89a"/>' +
  '<circle cx="30" cy="-24" r="1.6" fill="#1c2430"/><circle cx="37" cy="-20" r="1.2" fill="#222"/><circle cx="26" cy="-27" r="1.5" fill="#3b2a1a"/>'

const croc = (jaw: number) =>
  '<g><animateTransform attributeName="transform" type="rotate" values="-4 -30 0;4 -30 0;-4 -30 0" dur="2.6s" repeatCount="indefinite"/><path d="M-30 -3 L-72 3 L-30 6Z" fill="#46703a"/></g>' +
  '<ellipse rx="34" ry="8.5" fill="#4f7a3a"/><ellipse cx="2" cy="4" rx="28" ry="4" fill="#cfd9a0" opacity=".7"/>' +
  '<path d="M-22 -7 l3 -4 l3 4 l3 -4 l3 4 l3 -4 l3 4 l3 -4 l3 4 l3 -4 l3 4" fill="#35592b"/>' +
  '<rect x="26" y="-6" width="32" height="8" rx="3.5" fill="#4f7a3a"/><circle cx="55" cy="-6.4" r="1.2" fill="#223"/>' +
  `<g><animateTransform attributeName="transform" type="rotate" values="0 28 3;0 28 3;24 28 3;24 28 3;0 28 3;0 28 3" keyTimes="0;.35;.4;.46;.52;1" dur="${LIFE}s" begin="${n(jaw)}s" repeatCount="indefinite"/><rect x="28" y="2" width="29" height="5" rx="2.4" fill="#3f6630"/><path d="M32 2 l2 -2.6 l2 2.6 M40 2 l2 -2.6 l2 2.6 M48 2 l2 -2.6 l2 2.6" fill="#fff"/></g>` +
  '<ellipse cx="27" cy="-8" rx="4.4" ry="3.2" fill="#4f7a3a"/><circle cx="28" cy="-8.6" r="2" fill="#f2c94c"/><rect x="27.4" y="-10" width="1.2" height="3" fill="#1c2430"/>'

const frog = () =>
  '<ellipse cx="0" cy="-5" rx="7" ry="5" fill="#5fbf4a"/><circle cx="-3.5" cy="-10" r="2.4" fill="#5fbf4a"/><circle cx="3.5" cy="-10" r="2.4" fill="#5fbf4a"/>' +
  '<circle cx="-3.5" cy="-10.4" r="1" fill="#1c2430"/><circle cx="3.5" cy="-10.4" r="1" fill="#1c2430"/><path d="M-6 -2 q-5 2 -3 4 M6 -2 q5 2 3 4" stroke="#3f8f33" stroke-width="2" fill="none" stroke-linecap="round"/>'

const butterfly = (c: string) =>
  `<g><animateTransform attributeName="transform" type="scale" values="1 1;.25 1;1 1" dur=".32s" repeatCount="indefinite"/><ellipse cx="-3.4" cy="0" rx="3.6" ry="4.6" fill="${c}"/><ellipse cx="3.4" cy="0" rx="3.6" ry="4.6" fill="${c}"/><circle cx="-3.4" cy="-1" r="1" fill="#fff" opacity=".7"/><circle cx="3.4" cy="-1" r="1" fill="#fff" opacity=".7"/></g><rect x="-.5" y="-4" width="1" height="8" fill="#222"/>`

const sloth = () =>
  '<path d="M-7 6 L-7 -2 M7 6 L7 -2" stroke="#6b5a42" stroke-width="3.4" stroke-linecap="round"/><path d="M-9 -1 l2 2 M-7 -2 l0 3 M-5 -1 l-2 2" stroke="#e8e0cc" stroke-width="1" stroke-linecap="round"/>' +
  '<ellipse cx="0" cy="14" rx="16" ry="7.4" fill="#8a7457"/><path d="M-12 12 q4 3 8 0 M0 12 q4 3 8 0" stroke="#6b5a42" stroke-width="1.2" fill="none"/>' +
  '<circle cx="18" cy="14" r="6.4" fill="#e6d9b8"/><path d="M13.6 12.4 q4 -3 8 0 l-1 3 q-3 -1 -6 0Z" fill="#3b2a1a" opacity=".85"/><circle cx="17" cy="13.6" r="1" fill="#fff"/><circle cx="21" cy="13.6" r="1" fill="#fff"/><path d="M16.4 18 q2 1.6 4 0" stroke="#6b5a42" fill="none" stroke-linecap="round"/>' +
  '<path d="M-7 20 L-8 28 M7 20 L8 28" stroke="#6b5a42" stroke-width="3" stroke-linecap="round"/>'

const bat = () =>
  flap('<path d="M0 0 L-13 -8 Q-9 -2 -13 4Z M0 0 L13 -8 Q9 -2 13 4Z" fill="#2a2433"/>', 0.22) +
  '<ellipse rx="3" ry="4.4" fill="#2a2433"/><path d="M-2.4 -3.4 l-1 -3 l2.4 1.4 M2.4 -3.4 l1 -3 l-2.4 1.4" fill="#2a2433"/><circle cx="-1.1" cy="-1" r=".6" fill="#f2c94c"/><circle cx="1.1" cy="-1" r=".6" fill="#f2c94c"/>'

const chameleon = () =>
  '<path d="M-9 -7 q-11 6 -15 -2 q-3 -7 4 -6 q5 1 3 5" fill="none" stroke="#6fbf3a" stroke-width="3.2" stroke-linecap="round"><animate attributeName="stroke" values="#6fbf3a;#e8a63c;#6fbf3a" dur="6s" repeatCount="indefinite"/></path>' +
  '<path d="M-5 -2 l-3 5 M5 -2 l3 5 M-1 -2 l-1 5 M9 -2 l2 5" stroke="#5e9a30" stroke-width="2" stroke-linecap="round"/>' +
  '<ellipse cx="0" cy="-8" rx="11" ry="7.4" fill="#6fbf3a"><animate attributeName="fill" values="#6fbf3a;#e8a63c;#6fbf3a" dur="6s" repeatCount="indefinite"/></ellipse>' +
  '<path d="M-6 -14 l3 -3 l3 3 l3 -3 l3 3" fill="none" stroke="#4f8a28" stroke-width="1.6" stroke-linecap="round"/>' +
  '<ellipse cx="12" cy="-9" rx="6" ry="4.6" fill="#6fbf3a"><animate attributeName="fill" values="#6fbf3a;#e8a63c;#6fbf3a" dur="6s" repeatCount="indefinite"/></ellipse>' +
  '<circle cx="12" cy="-12.4" r="3" fill="#8bd24f"/><circle cx="12.8" cy="-12.6" r="1.3" fill="#1c2430"/>' +
  '<path d="M17 -8 L19 -8" stroke="#e24a4a" stroke-width="1.6" stroke-linecap="round"><animate attributeName="d" values="M17 -8 L19 -8;M17 -8 L19 -8;M17 -8 L34 -8;M17 -8 L19 -8;M17 -8 L19 -8" keyTimes="0;.5;.55;.6;1" dur="7s" repeatCount="indefinite"/></path>'

const snake = () =>
  '<path d="M0 0 q9 12 0 24 t0 24 t0 24 t0 24" fill="none" stroke="#4fae64" stroke-width="6.4" stroke-linecap="round"/>' +
  '<path d="M0 0 q9 12 0 24 t0 24 t0 24 t0 24" fill="none" stroke="#a8e08a" stroke-width="1.6" stroke-dasharray="3 6" stroke-linecap="round"/>' +
  '<ellipse cx="0" cy="98" rx="4.4" ry="5.6" fill="#3f9a55"/><circle cx="-2" cy="97" r="1" fill="#f2c94c"/><circle cx="2" cy="97" r="1" fill="#f2c94c"/>' +
  '<path d="M0 103 v7 l-2 3 M0 110 l2 3" stroke="#e24a4a" stroke-width="1" fill="none"><animate attributeName="opacity" values="1;0;1;1" keyTimes="0;.2;.4;1" dur="1.6s" repeatCount="indefinite"/></path>'

const hummingbird = () =>
  flap('<ellipse cx="-2" cy="-2" rx="8" ry="2.4" fill="#cfe9f2" opacity=".65" transform="rotate(-28)"/>', 0.1) +
  '<ellipse rx="5.4" ry="2.8" fill="#1f9d8a"/><circle cx="6" cy="-1" r="2.6" fill="#2fbfa0"/><path d="M8 -1 L20 -1.8" stroke="#333" stroke-width="1"/><circle cx="6.6" cy="-1.4" r=".7" fill="#111"/>' +
  '<path d="M-5 0 L-11 3 L-11 -2Z" fill="#157a6a"/><circle cx="5.4" cy="1.4" r="1.4" fill="#e23b3b"/>'

const heron = (begin: string) =>
  '<path d="M-3 -44 V0 M3 -44 V0" stroke="#c9a56b" stroke-width="2" stroke-linecap="round"/>' +
  '<ellipse cx="0" cy="0" rx="14" ry="3" fill="none" stroke="#fff" stroke-width="1.2" opacity=".6"><animate attributeName="rx" values="10;22;10" dur="3s" repeatCount="indefinite"/></ellipse>' +
  '<ellipse cx="-2" cy="-52" rx="17" ry="8.6" fill="#8fa8c2" transform="rotate(-8 0 -52)"/><path d="M-16 -50 L-30 -46 L-16 -46Z" fill="#6f88a2"/><path d="M-8 -54 q10 -6 18 -2" stroke="#cfd9e6" stroke-width="2" fill="none"/>' +
  `<g><animateTransform attributeName="transform" type="rotate" values="0 12 -56;0 12 -56;44 12 -56;44 12 -56;0 12 -56;0 12 -56" keyTimes="0;.3;.37;.45;.52;1" dur="${LIFE}s" begin="${begin}" fill="freeze"/>` +
  '<path d="M12 -56 q9 -14 -2 -28 q-4 -6 4 -12" fill="none" stroke="#e8eef4" stroke-width="5" stroke-linecap="round"/>' +
  '<circle cx="14" cy="-98" r="4.6" fill="#e8eef4"/><path d="M12 -100 l-9 -2" stroke="#1c2430" stroke-width="2" stroke-linecap="round"/><path d="M18 -98 L38 -96" stroke="#f2c94c" stroke-width="3" stroke-linecap="round"/><circle cx="15.6" cy="-99" r="1" fill="#1c2430"/></g>'

const turtle = () =>
  '<ellipse cx="9" cy="8" rx="8" ry="3.4" fill="#7da854"><animateTransform attributeName="transform" type="rotate" values="-20 9 8;20 9 8;-20 9 8" dur="1.8s" repeatCount="indefinite"/></ellipse>' +
  '<ellipse cx="-10" cy="7" rx="6" ry="2.8" fill="#7da854"><animateTransform attributeName="transform" type="rotate" values="20 -10 7;-20 -10 7;20 -10 7" dur="1.8s" repeatCount="indefinite"/></ellipse>' +
  '<path d="M-17 2 L-24 4 L-17 5Z" fill="#7da854"/><ellipse cx="20" cy="-1" rx="6.4" ry="4.2" fill="#9ac06a"/><circle cx="22" cy="-2.4" r="1.1" fill="#1c2430"/>' +
  '<ellipse cx="0" cy="0" rx="18" ry="11" fill="#5b8a3c"/><ellipse cx="0" cy="0" rx="18" ry="11" fill="none" stroke="#3e6a28" stroke-width="1.6"/>' +
  '<path d="M-8 -6 l6 -3 l6 3 l0 7 l-6 3 l-6 -3Z M6 -7 l6 3 M-14 2 l6 3" fill="none" stroke="#3e6a28" stroke-width="1.4"/>'

const neon = () =>
  '<g><animateTransform attributeName="transform" type="rotate" values="-8 -6 0;8 -6 0;-8 -6 0" dur=".34s" repeatCount="indefinite"/><path d="M-6 0 L-12 -4 L-12 4Z" fill="#cfd9e8"/></g>' +
  '<ellipse rx="8" ry="3.3" fill="#d9e3f0"/><path d="M-7 -.6 L8 -.6" stroke="#2fc2ff" stroke-width="1.8"/><path d="M-6 1.2 Q0 3.4 8 1.2 L7 3 Q0 4 -6 2.6Z" fill="#e5483a"/><circle cx="5.4" cy="-1" r="1" fill="#1c2430"/>'

const piranha = () =>
  '<g><animateTransform attributeName="transform" type="rotate" values="-10 -8 0;10 -8 0;-10 -8 0" dur=".3s" repeatCount="indefinite"/><path d="M-8 0 L-16 -5 L-16 5Z" fill="#4f5e6a"/></g>' +
  '<ellipse rx="11" ry="6.6" fill="#6b7a86"/><path d="M-8 2 Q0 8 10 3 Q0 5 -8 2Z" fill="#d9534f"/><path d="M-3 -7 Q2 -12 6 -6Z" fill="#4f5e6a"/>' +
  '<path d="M7 1 l2 3 l2 -3 l2 3 l1 -3" fill="#fff" stroke="#fff" stroke-width=".6"/><circle cx="6" cy="-2" r="1.5" fill="#f2c94c"/><circle cx="6.3" cy="-2" r=".7" fill="#111"/>'

const otter = () =>
  '<path d="M-16 0 Q-28 2 -36 -3 Q-30 4 -16 3Z" fill="#6b4a2a"/><ellipse cx="0" cy="0" rx="17" ry="5.6" fill="#7a5532"/><ellipse cx="2" cy="2.6" rx="12" ry="2.6" fill="#c9a578"/>' +
  '<circle cx="17" cy="-1" r="5.4" fill="#7a5532"/><ellipse cx="21" cy="1" rx="3.2" ry="2.4" fill="#e8d4b0"/><circle cx="21.6" cy="0" r=".9" fill="#111"/><circle cx="18" cy="-3" r="1" fill="#111"/><circle cx="14" cy="-5.4" r="1.6" fill="#7a5532"/>' +
  '<path d="M22 2 l8 -1 M22 3 l8 2" stroke="#fff" stroke-width=".6"/>'

const ray = () =>
  '<path d="M-8 0 L-46 3" stroke="#5d7690" stroke-width="2" stroke-linecap="round"/>' +
  '<g><animateTransform attributeName="transform" type="scale" values="1 1;1 .72;1 1" dur="1.8s" repeatCount="indefinite"/>' +
  '<path d="M26 0 Q10 -17 -12 -20 Q-6 0 -12 20 Q10 17 26 0Z" fill="#6d8aa5"/><path d="M26 0 Q10 -9 -4 -10 Q-1 0 -4 10 Q10 9 26 0Z" fill="#8fa9c0" opacity=".6"/>' +
  '<circle cx="-1" cy="-6" r="1.8" fill="#4f6a85"/><circle cx="-8" cy="8" r="1.4" fill="#4f6a85"/></g>' +
  '<circle cx="17" cy="-3" r="1.2" fill="#111"/><circle cx="17" cy="3" r="1.2" fill="#111"/>'

const dragonfly = () =>
  flap(
    '<ellipse cx="2" cy="-3" rx="11" ry="3" fill="#cfe9f2" opacity=".6" transform="rotate(-16 2 -3)"/><ellipse cx="2" cy="3" rx="11" ry="3" fill="#cfe9f2" opacity=".6" transform="rotate(16 2 3)"/>',
    0.09,
  ) +
  '<rect x="-16" y="-1.3" width="28" height="2.6" rx="1.3" fill="#2f6fd0"/><path d="M-14 -1.3 v2.6 M-9 -1.3 v2.6 M-4 -1.3 v2.6" stroke="#fff" stroke-width=".8" opacity=".6"/>' +
  '<circle cx="14" cy="0" r="3.2" fill="#6fd0a0"/><circle cx="15.4" cy="-.8" r="1" fill="#111"/>'

const ant = () =>
  '<path d="M-3 -1 l-2 3 M0 -1 l0 3 M3 -1 l2 3" stroke="#3b1f12" stroke-width=".8"/>' +
  '<circle cx="-4" cy="-2" r="2" fill="#5a2a1a"/><circle cx="0" cy="-2.4" r="1.5" fill="#5a2a1a"/><circle cx="4" cy="-2.6" r="2.2" fill="#5a2a1a"/>' +
  '<path d="M-1 -5 l4 -6 l4 6Z" fill="#5cbf72"><animateTransform attributeName="transform" type="rotate" values="-6 2 -5;6 2 -5;-6 2 -5" dur="1s" repeatCount="indefinite"/></path>'

const kingfisher = () =>
  '<path d="M-6 -1 L-13 3 L-6 3Z" fill="#2f7fd0"/><ellipse cx="0" cy="0" rx="6.4" ry="4.6" fill="#2f9fd0"/><ellipse cx="0" cy="2" rx="5" ry="2.8" fill="#f08a2f"/>' +
  '<circle cx="5.6" cy="-3.6" r="3.6" fill="#2f9fd0"/><path d="M8.6 -4 L17 -3.4 L8.6 -2Z" fill="#222"/><circle cx="6.4" cy="-4.2" r=".9" fill="#fff"/><path d="M-4 -2 q4 -5 8 0" fill="#1f7fb0"/>'

const owl = () =>
  '<ellipse cx="0" cy="-12" rx="9" ry="12" fill="#8a6a4a"/><path d="M-6 -12 q3 4 6 0 q3 4 6 0 M-5 -6 q3 4 5 0 q3 4 5 0" fill="none" stroke="#e8d4b0" stroke-width="1.3"/>' +
  '<path d="M-6 0 L-6 2 M-3 0 L-3 2 M3 0 L3 2 M6 0 L6 2" stroke="#e8a63c" stroke-width="1.6"/>' +
  '<g><animateTransform attributeName="transform" type="scale" values="1 1;1 1;.15 1;.15 1;1 1;1 1" keyTimes="0;.3;.34;.5;.54;1" dur="7s" repeatCount="indefinite"/>' +
  '<circle cx="0" cy="-26" r="8.4" fill="#9a7a56"/><path d="M-7 -32 l-2 -6 l5 3 M7 -32 l2 -6 l-5 3" fill="#9a7a56"/>' +
  '<circle cx="-3.6" cy="-26" r="3.6" fill="#fff"/><circle cx="3.6" cy="-26" r="3.6" fill="#fff"/><circle cx="-3.6" cy="-26" r="1.8" fill="#f2c94c"/><circle cx="3.6" cy="-26" r="1.8" fill="#f2c94c"/>' +
  '<circle cx="-3.6" cy="-26" r=".9" fill="#111"/><circle cx="3.6" cy="-26" r=".9" fill="#111"/><path d="M0 -24 l-1.6 3 l3.2 0Z" fill="#f08a2f"/></g>'

const lg = (x: number, k: number, color: string) =>
  `<g><animateTransform attributeName="transform" type="rotate" values="${k ? -24 : 24} ${x} -8;${k ? 24 : -24} ${x} -8;${k ? -24 : 24} ${x} -8" dur=".9s" repeatCount="indefinite"/><rect x="${x - 2.2}" y="-9" width="4.4" height="11" rx="2.2" fill="${color}"/></g>`

const iguana = () =>
  '<path d="M-14 -7 q-18 -2 -34 4 q-6 3 -12 2" fill="none" stroke="#5fae4a" stroke-width="5" stroke-linecap="round"/><path d="M-26 -5 l0 -3 M-36 -3 l0 -3 M-46 -1 l0 -3" stroke="#3f7a30" stroke-width="2"/>' +
  lg(-8, 0, '#5fae4a') + lg(12, 0, '#5fae4a') +
  '<ellipse cx="0" cy="-8" rx="17" ry="6.6" fill="#6fbf55"/><path d="M-12 -14 l2 -4 l2 4 l2 -4 l2 4 l2 -4 l2 4 l2 -4 l2 4 l2 -4 l2 4" fill="#3f7a30"/>' +
  lg(-14, 1, '#5fae4a') + lg(8, 1, '#5fae4a') +
  '<ellipse cx="20" cy="-9" rx="7.4" ry="5" fill="#7ccf62"/><circle cx="21" cy="-11.4" r="1.3" fill="#1c2430"/><path d="M18 -4 q3 7 6 0Z" fill="#e8a63c"/><circle cx="23" cy="-8.4" r=".8" fill="#3f7a30"/>'

const coati = () =>
  '<path d="M-17 -10 Q-34 -14 -30 -32 Q-27 -42 -20 -36" fill="none" stroke="#8a5a3a" stroke-width="6" stroke-linecap="round"/>' +
  '<path d="M-24 -14 l5 -4 M-28 -22 l6 -2 M-29 -30 l6 0 M-25 -37 l5 3" stroke="#2a1a10" stroke-width="2.4" stroke-linecap="round"/>' +
  lg(-12, 0, '#6b4528') + lg(10, 0, '#6b4528') +
  '<ellipse cx="0" cy="-12" rx="18" ry="6.6" fill="#8a5a3a"/><ellipse cx="0" cy="-9" rx="14" ry="3" fill="#c9a578" opacity=".7"/>' +
  lg(-8, 1, '#6b4528') + lg(14, 1, '#6b4528') +
  '<ellipse cx="22" cy="-13" rx="7" ry="5" fill="#8a5a3a"/><path d="M26 -15 L36 -11 L26 -9Z" fill="#a8764c"/><circle cx="36" cy="-11" r="1.8" fill="#fff"/><circle cx="23" cy="-15" r="1.3" fill="#111"/><circle cx="20" cy="-18" r="2" fill="#6b4528"/>'

const wrap = (kind: number, begin: string, body: string) =>
  `<g data-visitor="${kind}" display="none"><animate attributeName="display" values="inline;inline" calcMode="discrete" dur="${LIFE}s" begin="${begin}"/>` +
  `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.05;.93;1" dur="${LIFE}s" begin="${begin}" fill="freeze"/>${body}</g></g>`

const limbsInView = (y0: number, view: number) => LIMBS.filter(l => l.y > y0 + 50 && l.y < y0 + view - 20)

const visitorSvg = (v: Slot, starts: number[], y0: number, view: number, limbAt = -1) => {
  // every time it is due to appear, shifted by `lag` seconds
  const B = (lag = 0) => starts.map(t => `${n(t + lag)}s`).join(';')
  const r = (k: number) => rnd(v.seed + k)
  const dir: 1 | -1 = r(1) < 0.5 ? 1 : -1
  const yFly = y0 + 70 + r(2) * Math.max(80, view * 0.55)
  // a limb inside the view, if there is one
  const seen = limbsInView(y0, view)
  const spot = seen.length ? seen[limbAt >= 0 ? limbAt % seen.length : Math.floor(r(3) * seen.length) % seen.length] : undefined
  const dur = LIFE - 1

  switch (v.kind) {
    case 0:
      return wrap(0, B(), flyer(toucan(), yFly, dir, dur, B()))
    case 1:
      return wrap(
        1,
        B(),
        flyer(parrot('#e23b3b', '#2f7fd0'), yFly, dir, dur, B()) + flyer(parrot('#f2c94c', '#2fa58a'), yFly + 22, dir, dur, B(-0.7)),
      )
    case 2: {
      const ax = spot ? (spot.side === -1 ? spot.x1 : spot.x0) : 40 + r(4) * 320
      const ay = spot ? spot.y : y0 + 20
      const L = 90 + r(5) * 40

      return wrap(
        2,
        B(),
        `<g transform="translate(${n(ax)} ${n(ay)})"><g><animateTransform attributeName="transform" type="rotate" values="-42 0 0;42 0 0;-42 0 0" keyTimes="0;.5;1" calcMode="spline" keySplines="${EASE};${EASE}" dur="4.4s" begin="${B()}" repeatCount="indefinite"/>` +
          `<path d="M0 0 V${n(L)}" stroke="#2a7d3d" stroke-width="3"/><g transform="translate(0 ${n(L)})">${monkeyHang()}</g></g></g>`,
      )
    }
    case 3: {
      const l = spot ?? LIMBS[2]
      const a = l.x0 + 6
      const z = l.x1 - 6
      const [s, e, f] = dir === 1 ? [a, z, 1] : [z, a, -1]
      const mid = s + (e - s) * 0.55

      return wrap(
        3,
        B(),
        `<g><animateTransform attributeName="transform" type="translate" values="${n(s)} ${l.y - 6};${n(mid)} ${l.y - 6};${n(mid)} ${l.y - 6};${n(e)} ${l.y - 6}" keyTimes="0;.45;.66;1" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(${f} 1)">${jaguar()}</g></g>`,
      )
    }
    case 4: {
      const x0 = 100 + r(6) * 70
      const x1 = x0 + 90 + r(7) * 40
      const [s, e, f] = dir === 1 ? [x0, x1, 1] : [x1, x0, -1]
      const id = `cc${v.id}`

      return wrap(
        4,
        B(),
        `<clipPath id="${id}"><rect x="-90" y="-28" width="200" height="28"/></clipPath>` +
          `<g><animateTransform attributeName="transform" type="translate" values="${n(s)} 1382;${n(e)} 1386" dur="${dur}s" begin="${B()}" fill="freeze"/>` +
          `<g clip-path="url(#${id})"><g transform="scale(${1.3 * f} 1.3)">${croc(3)}</g></g>` +
          '<ellipse cx="0" cy="1" rx="52" ry="5" fill="none" stroke="#fff" stroke-width="1.2" opacity=".5"/></g>',
      )
    }
    case 5: {
      const order = dir === 1 ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0]
      const pts = order.slice(0, 4).map(i => PADS[i])
      let path = `M${pts[0][0]} ${pts[0][1] - 4}`
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i - 1]
        const [qx, qy] = pts[i]
        path += ` Q${n((px + qx) / 2)} ${n(Math.min(py, qy) - 38)} ${qx} ${qy - 4}`
      }

      return wrap(5, B(), `<g><animateMotion path="${path}" dur="${dur - 2}s" begin="${B()}" fill="freeze" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines=".4 0 .6 1"/>${frog()}</g>`)
    }
    case 6:
      return wrap(
        6,
        B(),
        [0, 1, 2, 3, 4]
          .map(k => {
            const y = yFly + k * 16 - 30
            const path = `M-20 ${n(y)} C80 ${n(y - 60)} 160 ${n(y + 60)} 250 ${n(y - 20)} S380 ${n(y + 40)} 430 ${n(y - 30)}`

            return `<g><animateMotion path="${path}" dur="${12 + k}s" begin="${B(- k * 0.5)}" fill="freeze"/>${butterfly(pick(['#3f9be0', '#f08a2f', '#c05fd0', '#f2c94c', '#e24a8d'], k + v.seed))}</g>`
          })
          .join(''),
      )
    case 8:
      return wrap(
        8,
        B(),
        [0, 1, 2, 3, 4]
          .map(k => {
            const y = yFly + k * 12 - 24
            const path = `M-30 ${n(y)} C60 ${n(y - 90)} 120 ${n(y + 90)} 200 ${n(y - 30)} S330 ${n(y + 70)} 430 ${n(y - 20)}`

            return `<g><animateMotion path="${path}" dur="${10 + (k % 3)}s" begin="${B(- k * 0.45)}" fill="freeze"/>${bat()}</g>`
          })
          .join(''),
      )
    case 9: {
      const l = spot ?? LIMBS[0]
      const s0 = l.x0 + 24 + r(6) * 30

      return wrap(
        9,
        B(),
        `<g><animateTransform attributeName="transform" type="translate" values="${n(s0)} ${l.y - 8};${n(s0 + 50 * dir)} ${l.y - 8}" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(${dir} 1)">${chameleon()}</g></g>`,
      )
    }
    case 10: {
      const ax = spot ? (spot.side === -1 ? spot.x1 : spot.x0) : 40 + r(4) * 320
      const ay = spot ? spot.y : y0 + 20

      return wrap(
        10,
        B(),
        `<g transform="translate(${n(ax)} ${n(ay)})"><g><animateTransform attributeName="transform" type="rotate" values="-10 0 0;10 0 0;-10 0 0" keyTimes="0;.5;1" calcMode="spline" keySplines="${EASE};${EASE}" dur="3.6s" begin="${B()}" repeatCount="indefinite"/>${snake()}</g></g>`,
      )
    }
    case 11: {
      const pt = (k: number): Pt => [60 + r(k) * 280, y0 + 110 + r(k + 1) * Math.max(60, view * 0.55)]
      const [p1, p2, p3] = [pt(20), pt(22), pt(24)]
      const val = (p: Pt) => `${n(p[0])} ${n(p[1])}`

      return wrap(
        11,
        B(),
        `<g><animateTransform attributeName="transform" type="translate" values="-30 ${n(p1[1])};${val(p1)};${val(p1)};${val(p2)};${val(p2)};${val(p3)};${val(p3)};440 ${n(p3[1] - 30)}" keyTimes="0;.12;.28;.34;.5;.56;.72;1" dur="${dur}s" begin="${B()}" fill="freeze"/>` +
          `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0;0 2;0 0" dur=".7s" repeatCount="indefinite"/>${hummingbird()}</g></g>`,
      )
    }
    case 12: {
      const hx = 100 + r(8) * 200

      return wrap(
        12,
        B(),
        `<g transform="translate(${n(hx)} 1394)"><g><animateTransform attributeName="transform" type="translate" values="0 0;${dir * 18} 0" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(${dir} 1)">${heron(B())}</g></g></g>`,
      )
    }
    case 13: {
      const y = 1400 + r(9) * 200
      const [s, e, f] = dir === 1 ? [50, 340, 1] : [340, 50, -1]

      return wrap(13, B(), `<g><animateTransform attributeName="transform" type="translate" values="${s} ${n(y)};${e} ${n(y + 8)}" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(${f} 1)">${turtle()}</g></g>`)
    }
    case 14:
      return wrap(
        14,
        B(),
        Array.from({ length: 9 }, (_, k) => {
          const y = 1400 + r(10) * 160 + (k % 3) * 12
          const [s, e] = dir === 1 ? [40, 360] : [360, 40]
          const path = `M${s} ${n(y)} C${n(s + (e - s) * 0.3)} ${n(y - 26 + k * 3)} ${n(s + (e - s) * 0.6)} ${n(y + 24 - k * 3)} ${e} ${n(y - 6)}`

          return `<g><animateMotion path="${path}" dur="${dur - 1}s" begin="${B(- (k % 4) * 0.35 - Math.floor(k / 4) * 0.2)}" fill="freeze"/><g transform="scale(${dir} 1)">${neon()}</g></g>`
        }).join(''),
      )
    case 15:
      return wrap(
        15,
        B(),
        Array.from({ length: 4 }, (_, k) => {
          const y = 1410 + r(11) * 150 + k * 14
          const [s, e] = dir === 1 ? [40, 360] : [360, 40]
          const path = `M${s} ${n(y)} L${e} ${n(y + 10)}`

          return `<g><animateMotion path="${path}" dur="${dur - 1}s" begin="${B(- k * 0.5)}" fill="freeze" calcMode="linear" keyPoints="0;.3;.3;.62;.62;1" keyTimes="0;.15;.3;.55;.7;1"/><g transform="scale(${dir} 1)">${piranha()}</g></g>`
        }).join(''),
      )
    case 16: {
      const [s, e] = dir === 1 ? [40, 360] : [360, 40]
      const mid = (s + e) / 2
      const path = `M${s} 1384 Q${n((s + mid) / 2)} 1352 ${n(mid)} 1384 T${e} 1384`

      return wrap(16, B(), `<g><animateMotion path="${path}" rotate="auto" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(1 ${dir})">${otter()}</g></g>`)
    }
    case 17: {
      const y = 1480 + r(12) * 150
      const [s, e, f] = dir === 1 ? [50, 340, 1] : [340, 50, -1]

      return wrap(17, B(), `<g><animateTransform attributeName="transform" type="translate" values="${s} ${y};${e} ${y - 10}" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(${f} 1)">${ray()}</g></g>`)
    }
    case 18: {
      const pt = (k: number): Pt => [50 + r(k) * 300, Math.max(y0 + 60, 1230 + r(k + 1) * 150)]
      const [p1, p2, p3, p4] = [pt(30), pt(32), pt(34), pt(36)]
      const val = (p: Pt) => `${n(p[0])} ${n(p[1])}`

      return wrap(
        18,
        B(),
        `<g><animateTransform attributeName="transform" type="translate" values="-30 ${n(p1[1])};${val(p1)};${val(p1)};${val(p2)};${val(p2)};${val(p3)};${val(p3)};${val(p4)};440 ${n(p4[1])}" keyTimes="0;.1;.2;.26;.4;.46;.6;.66;1" dur="${dur}s" begin="${B()}" fill="freeze"/>` +
          `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0;0 2;0 0" dur=".5s" repeatCount="indefinite"/>${dragonfly()}</g></g>`,
      )
    }
    case 19: {
      const l = spot ?? LIMBS[1]
      const [s0, e0, f] = dir === 1 ? [l.x0 + 10, l.x1 - 10, 1] : [l.x1 - 10, l.x0 + 10, -1]

      return wrap(
        19,
        B(),
        Array.from({ length: 6 }, (_, k) => `<g><animateTransform attributeName="transform" type="translate" values="${s0} ${l.y - 7};${e0} ${l.y - 7}" dur="${dur}s" begin="${B(- k * 0.8)}" fill="freeze"/><g transform="scale(${f} 1)">${ant()}</g></g>`).join(''),
      )
    }
    case 20: {
      const l = spot ?? LIMBS[1]
      const f = l.side === -1 ? 1 : -1
      const tipx = l.side === -1 ? l.x1 : l.x0
      const tx = tipx - f * 14
      const py = l.y - 12
      const dx = Math.min(350, Math.max(50, tx + f * 40))
      const path = `M${n(tx)} ${n(py)} C${n(tx + f * 20)} ${n(py + 120)} ${n(dx - f * 10)} ${n(1352 - 260)} ${n(dx)} 1352 C${n(dx + f * 8)} ${n(1352 - 100)} ${n(tx + f * 30)} ${n(py + 80)} ${n(tx)} ${n(py)}`

      return wrap(
        20,
        B(),
        `<g><animateMotion path="${path}" dur="${dur}s" begin="${B()}" fill="freeze" calcMode="linear" keyPoints="0;0;.5;.5;1;1" keyTimes="0;.22;.45;.55;.8;1"/><g transform="scale(${f} 1)">${kingfisher()}</g></g>` +
          `<ellipse cx="${n(dx)}" cy="1352" rx="4" ry="1.6" fill="none" stroke="#fff" stroke-width="1.4" opacity="0"><animate attributeName="opacity" values="0;0;.9;0;0" keyTimes="0;.45;.5;.66;1" dur="${dur}s" begin="${B()}" fill="freeze"/><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 0" dur="${dur}s" begin="${B()}"/><animate attributeName="rx" values="4;4;4;22;22" keyTimes="0;.45;.5;.66;1" dur="${dur}s" begin="${B()}" fill="freeze"/></ellipse>`,
      )
    }
    case 21: {
      const l = spot ?? LIMBS[0]
      const f = l.side === -1 ? 1 : -1
      const tipx = l.side === -1 ? l.x1 : l.x0

      return wrap(21, B(), `<g transform="translate(${n(tipx - f * 24)} ${l.y - 8})"><g transform="scale(${f} 1)">${owl()}</g></g>`)
    }
    case 22: {
      const l = spot ?? LIMBS[0]
      const s0 = l.x0 + 40 + r(6) * 20

      return wrap(
        22,
        B(),
        `<g><animateTransform attributeName="transform" type="translate" values="${n(s0)} ${l.y - 6};${n(s0 + 60 * dir)} ${l.y - 6}" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(${dir} 1)">${iguana()}</g></g>`,
      )
    }
    case 23: {
      const l = spot ?? LIMBS[0]
      const a = l.x0 + 30
      const z = l.x1 - 6
      const [s0, e0, f] = dir === 1 ? [a, z, 1] : [z, a, -1]
      const mid = s0 + (e0 - s0) * 0.5

      return wrap(
        23,
        B(),
        `<g><animateTransform attributeName="transform" type="translate" values="${n(s0)} ${l.y - 6};${n(mid)} ${l.y - 6};${n(mid)} ${l.y - 6};${n(e0)} ${l.y - 6}" keyTimes="0;.4;.6;1" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(${f} 1)">${coati()}</g></g>`,
      )
    }
    default: {
      const l = spot ?? LIMBS[1]
      const near = l.side === -1 ? l.x1 - 12 : l.x0 + 12
      const far = l.side === -1 ? l.x1 - 78 : l.x0 + 78

      return wrap(
        7,
        B(),
        `<g><animateTransform attributeName="transform" type="translate" values="${n(near)} ${l.y + 4};${n(far)} ${l.y + 4}" dur="${dur}s" begin="${B()}" fill="freeze"/>` +
          `<g><animateTransform attributeName="transform" type="rotate" values="-3 0 0;3 0 0;-3 0 0" dur="4.5s" repeatCount="indefinite"/>${sloth()}</g></g>`,
      )
    }
  }
}

// ---- the whole picture ---------------------------------------------------------------------------------
// Looping motion shifts back by the time already elapsed, so redrawing the picture never makes it jump.
// Tags marked data-once (the sky darkening for work) are left alone and play from the start.
const retime = (svg: string, elapsed: number) =>
  svg.replace(/<(animate|animateTransform|animateMotion)\b[^>]*>/g, tag => {
    if (tag.includes('data-once')) {
      return tag
    }
    const found = / begin="(-?[\d.]+)s"/.exec(tag)
    const shifted = ` begin="${n((found ? parseFloat(found[1]) : 0) - elapsed)}s"`

    return found ? tag.replace(found[0], shifted) : tag.replace(/^<(\w+)/, `<$1${shifted}`)
  })

// How far the night has come: [from, to]. A rebuilt picture carries on from where the fade already is.
const nightSpan = (w: Falls, now: number): [number, number] => {
  const since = (now - w.startedAt) / 1000
  const sinceEnd = (now - (w.endedAt ?? 0)) / 1000
  if (w.working) {
    return [Math.min(1, since / 1.4), 1]
  }

  return w.endedAt > 0 && sinceEnd < 1.4 ? [1 - sinceEnd / 1.4, 0] : [0, 0]
}

const buildScene = (w: Falls, elapsed: number, vh: number, now: number) => {
  const view = Math.min(H, Math.max(vh, 240))
  const y0 = H - view
  const [a0, a1] = nightSpan(w, now)

  const defs =
    '<defs>' +
    '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3e6"/><stop offset="1" stop-color="#f6efc4"/></linearGradient>' +
    '<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f6ef" stop-opacity="0"/><stop offset="1" stop-color="#e8f6ef" stop-opacity=".75"/></linearGradient>' +
    '<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f8a5c"/><stop offset=".55" stop-color="#456a4a"/><stop offset="1" stop-color="#2c4a3a"/></linearGradient>' +
    '<linearGradient id="fallw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6fbfb"/><stop offset=".5" stop-color="#8fe0e0"/><stop offset="1" stop-color="#3fb8c8"/></linearGradient>' +
    '<linearGradient id="basinw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fe6dc"/><stop offset="1" stop-color="#2aa0a8"/></linearGradient>' +
    '<linearGradient id="pool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46d0bd"/><stop offset=".5" stop-color="#1f8f94"/><stop offset="1" stop-color="#0b4b57"/></linearGradient>' +
    '</defs>'

  const backA =
    SKYLINE +
    CANOPY +
    WALL +
    VINES +
    LIMBS.map((l, k) => limb(l, k)).join('') +
    BASINS.map(([cx, cy, rx], k) => basin(cx, cy, rx, k)).join('') +
    falls(w.working) +
    // where each fall leaves its terrace: a lip of foam
    FALLS.map(([x1, y1, , , w1]) => `<ellipse cx="${x1}" cy="${y1}" rx="${n(w1 / 2 + 4)}" ry="4" fill="#fff" opacity=".7"/>`).join('') +
    leapers() +
    FALLS.map(([, , x2, y2], k) => mist(x2, y2, k, w.working)).join('') +
    BANKS +
    POOL_BASE
  const backB = POOL_TOP + mist(198, POOL_Y, 5, w.working) + mist(176, POOL_Y, 6, w.working) + GROWTH

  // Every kind visits at random times for the next 25 minutes. The picture is not redrawn when one arrives,
  // so nothing flickers; one animal is due at once, so the picture is never empty.
  const slots: { v: Slot; starts: number[]; limbAt: number }[] = []
  const nLimbs = Math.max(1, limbsInView(y0, view).length)
  for (let kind = 0; kind < KINDS; kind++) {
    for (let k = 0; k < SLOTS; k++) {
      const starts: number[] = []
      for (let t = Math.random() * 110; t < HORIZON; t += 80 + Math.random() * 50) starts.push(t)
      const limbAt = LIMB_KINDS.includes(kind) ? Math.floor(Math.random() * nLimbs) : -1
      slots.push({ v: { id: kind * SLOTS + k, kind, seed: Math.floor(Math.random() * 1_000_000) }, starts, limbAt })
    }
  }
  slots[Math.floor(Math.random() * slots.length)].starts.unshift(0.4)

  // A limb holds one visitor at a time: walk through every visit in order and drop any that would
  // overlap an earlier one on the same limb.
  const freeAt: number[] = Array(nLimbs).fill(-1)
  slots
    .flatMap((x, i) => (x.limbAt >= 0 ? x.starts.map(t => ({ i, t })) : []))
    .sort((a, b) => a.t - b.t)
    .forEach(({ i, t }) => {
      const x = slots[i]
      if (t < freeAt[x.limbAt]) {
        x.starts = x.starts.filter(s => s !== t)
      } else {
        freeAt[x.limbAt] = t + LIFE + 1
      }
    })
  const drawn = slots
    .filter(x => x.starts.length > 0)
    .map(x => ({ kind: x.v.kind, svg: visitorSvg(x.v, x.starts, y0, view, x.limbAt) }))
  const under = drawn.filter(x => isUnder(x.kind)).map(x => x.svg).join('')
  const air = drawn.filter(x => !isUnder(x.kind)).map(x => x.svg).join('')

  const front = RAYS + FRAME + nightLayer(a0, a1)

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${n(y0)} ${W} ${n(view)}" width="${W}" height="${n(view)}" preserveAspectRatio="xMidYMax slice">${defs}` +
    `<rect x="0" y="${n(y0)}" width="${W}" height="${n(view)}" fill="#12241c"/>` +
    retime(backA, elapsed) +
    under +
    retime(backB, elapsed) +
    air +
    retime(front, elapsed) +
    '</svg>'
  )
}
// ---scene-end

const TERMINAL_ART: [string, string][] = [
  ['  ♣  ~~~  ┃┃  ~~~  ♣', '#43a863'],
  ['     ▟▙  ┃┃┃  ▟▙', '#8a929a'],
  ['  ♣   ▐  ┃┃┃  ▌   ♣', '#8fd8e4'],
  ['     ▟▙ ┃┃┃┃ ▟▙', '#8a929a'],
  ['  ≈≈≈≈≈≈ ◎ ◎ ≈≈≈≈≈≈', '#46d0bd'],
]

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))

  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const label = (w: Falls, now: number) => (w.working ? `작업 중 ${clock(now - w.startedAt)} · 도구 ${w.tools}회` : '쉬는 중')

const jungle = atom(
  { plugin: 'jungle-falls', key: 'calm' } as const,
  { working: false, prev: false, tools: 0, startedAt: 0, endedAt: 0, tick: 0 } as Falls,
)

// The picture is built again only when the state it draws changes; the same text keeps it running.
let t0 = 0
let cache = { key: '', svg: '' }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    t0 = await $.clock.now()
    await $.command.register({
      name: 'falls',
      description: 'Open the jungle waterfall pane',
    })
    // Wakes the pane each second while Claude works, for the stopwatch in its top line.
    $.clock.every(1000, () => {
      void read($, jungle)
        .then(r => (r.working ? update($, jungle, v => ({ ...v, tick: v.tick + 1 })) : undefined))
        .catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'falls' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: '정글 폭포를 열었습니다.' }
  })

  // The main loop's turns only: a subagent's run is not Claude at work.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, jungle, v => ({ ...v, prev: false, working: true, tools: 0, startedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // Each finished turn draws the picture afresh, with an animal due straight away.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, jungle, v => ({ ...v, prev: true, working: false, endedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await update($, jungle, v => ({ ...v, tools: v.tools + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const w = await read($, jungle)
    const now = await $.clock.now()
    if (t0 === 0) t0 = now
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 20
    const line = label(w, now)

    if (e.surface !== 'terminal') {
      const { Box, Text, Svg } = els as ElementTable<'desktop'>
      // The pane's px: its cells over the code font's advance (about 7.8 px) and line height
      // (about 19.5 px). Short of the whole picture, the top of the jungle is cut, never the pool.
      const width = Math.max(160, Math.round(cols * 7.8))
      const full = Math.round((width * H) / W)
      const tall = e.props?.scroll?.bodyRows ? Math.round((rows - 1) * 19.5) : full
      const height = Math.min(full, tall)
      const [n0, n1] = nightSpan(w, now)
      const key = `${w.working}|${n0 > 0 && n0 < 1 ? 'f' : n0}|${n1}|${w.startedAt}|${w.endedAt}|${height}|${width}`
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
