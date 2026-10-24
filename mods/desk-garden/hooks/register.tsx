import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import type { Work } from '../types'

const PANE = 'desk-garden'
const STRINGS = {
  en: {
    title: 'Desk garden',
    alt: 'A flowerpot on a desk by a window: five flowers sway in the breeze while birds and insects pass outside.',
    altWork: 'While Claude works the lamp comes on and the character types; each finished turn opens one more flower in the bed.',
    bubble: { work: 'Working…', cheer: 'Done! A flower bloomed', rest: 'Idle' },
    line: (blooms: number, slots: number, done: number, tools: number) => `Flowers ${blooms}/${slots} · turns done ${done} · tools ${tools}`,
    on: '● Working',
    off: '○ Idle',
    opened: 'Opened the desk garden pane.',
    note: 'The animation shows in the desktop app.',
  },
  ko: {
    title: '책상 위 화분',
    alt: '창가 책상 위 화분에 꽃 다섯 송이가 바람에 흔들리고, 창밖으로 새와 곤충이 지나갑니다.',
    altWork: 'Claude가 일하는 동안 램프가 켜지고 캐릭터가 타이핑하며, 한 턴이 끝날 때마다 화단에 꽃이 한 송이씩 핍니다.',
    bubble: { work: '작업 중…', cheer: '완료! 꽃이 피었어요', rest: '쉬는 중' },
    line: (blooms: number, slots: number, done: number, tools: number) => `꽃 ${blooms}/${slots} · 완료 ${done}턴 · 도구 ${tools}회`,
    on: '● 작업 중',
    off: '○ 쉬는 중',
    opened: '책상 위 화분을 열었습니다.',
    note: '그림 움직임은 데스크톱 앱에서 보입니다.',
  },
}

type Words = (typeof STRINGS)['en']

// ---scene-start
type Attrs = Record<string, string | number>

const n = (v: number) => String(Math.round(v * 10) / 10)
const fine = (v: number) => +v.toFixed(3)
const EASE = '.45 0 .55 1'
const keyed = (times: number[]) =>
  `keyTimes="${times.join(';')}" calcMode="spline" keySplines="${times
    .slice(1)
    .map(() => EASE)
    .join(';')}"`

const rotateAbout = (
  angles: number[],
  cx: number,
  cy: number,
  dur: number,
  begin: number,
  times: number[],
) =>
  `<animateTransform attributeName="transform" type="rotate" values="${angles
    .map(a => `${a} ${cx} ${cy}`)
    .join(';')}" ${keyed(times)} dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`

// ---- flowers (drawn around 0,0) -------------------------------------------
const ring = (count: number, rx: number, ry: number, dist: number, fill: string) =>
  Array.from(
    { length: count },
    (_, i) =>
      `<ellipse cx="0" cy="${-dist}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${n(
        (360 / count) * i,
      )})"/>`,
  ).join('')

const pointed = (count: number, fill: string, scale: number, turn: number) =>
  Array.from(
    { length: count },
    (_, i) =>
      `<path d="M0 0 C-6 -6 -5 -15 0 -20 C5 -15 6 -6 0 0Z" fill="${fill}" transform="rotate(${n(
        (360 / count) * i + turn,
      )}) scale(${scale})"/>`,
  ).join('')

const FLOWERS = {
  cosmos: () =>
    ring(8, 5.2, 9, 9, '#e58fa6') +
    ring(8, 1.8, 5, 11, '#f2b6c6') +
    '<circle r="3.6" fill="#f0c94e"/>',
  daisy: () =>
    ring(14, 2.4, 8, 10, '#f3d35a') +
    '<circle r="5.6" fill="#8a5a2b"/><circle r="2.4" fill="#6b4220"/>',
  poppy: () =>
    ring(5, 8.5, 8, 7.5, '#e2735a') +
    ring(5, 5, 5, 6, '#ec9078') +
    '<circle r="3.2" fill="#3a2a2a"/>',
  violet: () =>
    pointed(6, '#9b7fd1', 1, 0) +
    pointed(6, '#b9a2e6', 0.6, 30) +
    '<circle r="2.6" fill="#f4e6a6"/>',
  tulip: () =>
    '<path d="M-9 0 C-11 -12 -6 -19 -6 -23 L0 -15 L6 -23 C6 -19 11 -12 9 0 C5 5 -5 5 -9 0Z" fill="#f0a35e"/>' +
    '<path d="M-3 4 C-8 -4 -3 -14 0 -15 C3 -14 8 -4 3 4Z" fill="#f7c58f"/>',
}

type Plant = {
  bx: number
  hx: number
  hy: number
  bend: number
  flower: keyof typeof FLOWERS
  leaves: [number, number, number][]
}

const BASE_Y = 218

const PLANTS: Plant[] = [
  { bx: 262, hx: 226, hy: 68, bend: -14, flower: 'cosmos', leaves: [[0.28, -1, 1.2], [0.55, 1, 1], [0.8, -1, 0.8]] },
  { bx: 270, hx: 262, hy: 4, bend: 8, flower: 'daisy', leaves: [[0.3, 1, 1.3], [0.55, -1, 1.1], [0.8, 1, 0.8]] },
  { bx: 280, hx: 304, hy: 38, bend: 12, flower: 'poppy', leaves: [[0.3, -1, 1.2], [0.58, 1, 1.2], [0.82, -1, 0.8]] },
  { bx: 288, hx: 336, hy: 110, bend: 12, flower: 'violet', leaves: [[0.4, 1, 1.1], [0.7, -1, 0.9]] },
  { bx: 266, hx: 252, hy: 150, bend: -4, flower: 'tulip', leaves: [[0.3, -1, 1.3], [0.6, 1, 1.1]] },
]

// A gust: still, a push, a few settling swings, still again.
const GUST = [0, 0, 4.2, -3.2, 2.6, -1.6, 0.8, 0, 0]
const GUST_T = [0, 0.4, 0.47, 0.54, 0.62, 0.7, 0.78, 0.86, 1]

const plantSvg = (p: Plant, i: number) => {
  const cx = (p.bx + p.hx) / 2 + p.bend
  const cy = (BASE_Y + p.hy) / 2
  const at = (t: number) => [
    (1 - t) ** 2 * p.bx + 2 * (1 - t) * t * cx + t ** 2 * p.hx,
    (1 - t) ** 2 * BASE_Y + 2 * (1 - t) * t * cy + t ** 2 * p.hy,
  ]
  const leaves = p.leaves
    .map(([t, side, size]) => {
      const [x, y] = at(t)

      return `<path d="M0 0 C7 -9 18 -9 25 -2 C16 5 7 5 0 0Z" fill="#5f9457" transform="translate(${n(
        x,
      )} ${n(y)}) rotate(${side > 0 ? -22 : 202}) scale(${size})"/>`
    })
    .join('')

  return (
    `<g>${rotateAbout([-0.9, 0.9, -0.9], p.bx, BASE_Y, 6.5 + i * 0.9, -i * 1.3, [0, 0.5, 1])}` +
    `<g>${rotateAbout(GUST, p.bx, BASE_Y, 19, -8 + i * 0.28, GUST_T)}` +
    `<path d="M${p.bx} ${BASE_Y} Q${n(cx)} ${n(cy)} ${p.hx} ${p.hy}" fill="none" stroke="#4f7d4a" stroke-width="2.6" stroke-linecap="round"/>` +
    leaves +
    `<g transform="translate(${p.hx} ${p.hy}) scale(1.15)">${FLOWERS[p.flower]()}</g>` +
    '</g></g>'
  )
}

// ---- window -----------------------------------------------------------------
const cloud = (y: number, s: number, dur: number, phase: number) =>
  `<g transform="translate(-80 0)"><animateTransform attributeName="transform" type="translate" values="-80 0;210 0" dur="${dur}s" begin="${-dur * phase}s" repeatCount="indefinite"/>` +
  `<g transform="translate(0 ${y}) scale(${s})" fill="#fff" opacity=".92">` +
  '<ellipse cx="0" cy="0" rx="18" ry="7"/><ellipse cx="12" cy="-5" rx="12" ry="8"/><ellipse cx="-10" cy="-4" rx="10" ry="6"/></g></g>'

const bird = (dx: number, dy: number, scale: number, phase: number) =>
  `<g transform="translate(${dx} ${dy}) scale(${scale})">` +
  '<path d="M-8 0 q4 -5 8 0 q4 -5 8 0" fill="none" stroke="#4a5058" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  `<animate attributeName="d" values="M-8 0 q4 -5 8 0 q4 -5 8 0;M-8 0 q4 3 8 0 q4 3 8 0;M-8 0 q4 -5 8 0 q4 -5 8 0" dur=".75s" begin="${phase}s" repeatCount="indefinite"/></path></g>`

// A flock crosses during the first `share` of its cycle and rests off-glass the rest.
const flock = (
  mates: [number, number][],
  scale: number,
  from: [number, number],
  to: [number, number],
  dur: number,
  begin: number,
  share: number,
) =>
  `<g transform="translate(${from[0]} ${from[1]})">` +
  `<animateTransform attributeName="transform" type="translate" values="${from.join(' ')};${to.join(' ')};${to.join(' ')}" keyTimes="0;${share};1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>` +
  mates.map(([dx, dy], i) => bird(dx, dy, scale, i * 0.11)).join('') +
  '</g>'

const V_RIGHT: [number, number][] = [[0, 0], [-9, 5], [-9, -5], [-18, 10], [-18, -10]]
const V_LEFT: [number, number][] = [[0, 0], [8, 4], [8, -4], [16, 8]]

const WINDOW =
  '<rect x="18" y="36" width="156" height="200" rx="3" fill="#f6f1e6" stroke="#cfc3ac"/>' +
  '<rect x="30" y="48" width="132" height="176" fill="url(#sky)"/>' +
  '<g clip-path="url(#glass)">' +
  '<circle cx="136" cy="84" r="26" fill="#fff6d0" opacity=".25"/><circle cx="136" cy="84" r="13" fill="#fff6d8" opacity=".85"/>' +
  cloud(78, 1, 95, 0.35) +
  cloud(118, 0.7, 140, 0.8) +
  '<path d="M30 205 C60 188 80 196 110 192 C135 188 150 196 162 190 L162 224 L30 224Z" fill="#a9c8a0"/>' +
  '<path d="M30 214 C70 200 100 210 130 206 C145 204 155 208 162 206 L162 224 L30 224Z" fill="#8fb88a"/>' +
  flock(V_RIGHT, 1, [-30, 112], [195, 92], 42, 3, 0.3) +
  flock(V_LEFT, 0.8, [200, 70], [-40, 86], 57, 31, 0.28) +
  flock([[0, 0]], 1.3, [-20, 150], [190, 140], 71, 14, 0.22) +
  '</g>' +
  '<rect x="94" y="48" width="4" height="176" fill="#f6f1e6"/><rect x="30" y="133" width="132" height="4" fill="#f6f1e6"/>' +
  '<rect x="30" y="48" width="132" height="176" fill="none" stroke="#cfc3ac" stroke-width="1.5"/>' +
  '<rect x="10" y="232" width="172" height="10" rx="2" fill="#efe7d6" stroke="#cfc3ac"/>' +
  '<rect x="14" y="242" width="164" height="3" fill="#000" opacity=".12"/>'

// ---- insects (top view, heading +x, about 14 units long) ---------------------
const wing = (px: number, py: number, rot: number, rx: number, ry: number, flip: number, fill = '#e9f1f5') =>
  `<g transform="translate(${px} ${py})"><g><animateTransform attributeName="transform" type="rotate" values="${-flip * 10};${flip * 24};${-flip * 10}" dur=".14s" repeatCount="indefinite"/>` +
  `<ellipse cx="0" cy="${flip * ry}" rx="${rx}" ry="${ry}" fill="${fill}" fill-opacity=".72" stroke="#9fb0ba" stroke-width=".4" transform="rotate(${flip * rot})"/></g></g>`

const BEE = () =>
  wing(0, -2.4, 25, 3, 5.4, -1) +
  wing(0, 2.4, 25, 3, 5.4, 1) +
  '<ellipse rx="6" ry="3.8" fill="#e9b824"/>' +
  '<path d="M-1.8 -3.4 v6.8 M1.6 -3.4 v6.8" stroke="#2b2623" stroke-width="1.8"/>' +
  '<circle cx="6.4" r="2.3" fill="#2b2623"/>'

const BUTTERFLY = () =>
  '<g transform="scale(1.25)">' +
  '<g><animateTransform attributeName="transform" type="scale" values="1 1;1 .25;1 1" dur=".55s" repeatCount="indefinite"/>' +
  '<g fill="#e98a35" stroke="#3b2a22" stroke-width=".6">' +
  '<ellipse cx="1" cy="-6" rx="4.2" ry="6.4"/><ellipse cx="1" cy="6" rx="4.2" ry="6.4"/>' +
  '<ellipse cx="-3.5" cy="-4.2" rx="3.4" ry="4.4" fill="#f0a653"/><ellipse cx="-3.5" cy="4.2" rx="3.4" ry="4.4" fill="#f0a653"/></g>' +
  '<circle cx="0" cy="-8.4" r=".9" fill="#fff"/><circle cx="0" cy="8.4" r=".9" fill="#fff"/></g>' +
  '<ellipse rx="4.2" ry="1.1" fill="#2f2724"/><circle cx="4.4" r="1.3" fill="#2f2724"/>' +
  '<path d="M5 -.4 l3 -2 M5 .4 l3 2" stroke="#2f2724" stroke-width=".4"/></g>'

const BEETLE = (fold: string) =>
  `<g>${fold}${wing(-1, -3.2, 30, 3, 8, -1)}${wing(-1, 3.2, 30, 3, 8, 1)}</g>` +
  '<ellipse rx="6.6" ry="4.6" fill="#4c8a46" stroke="#2b5a30" stroke-width=".8"/>' +
  '<path d="M-6 0 H5" stroke="#2b5a30" stroke-width=".7"/>' +
  '<ellipse cx="-1" cy="-2" rx="3" ry="1" fill="#fff" opacity=".28"/>' +
  '<ellipse cx="7.2" rx="2.4" ry="2.2" fill="#2b2f2a"/>' +
  '<path d="M8.5 -1 l2.6 -2 M8.5 1 l2.6 2" stroke="#2b2f2a" stroke-width=".5"/>'

const LADYBUG = (fold: string) =>
  `<g>${fold}${wing(0, -3.4, 30, 2.6, 7, -1)}${wing(0, 3.4, 30, 2.6, 7, 1)}</g>` +
  '<ellipse rx="5.2" ry="5" fill="#d9453b" stroke="#6b1d18" stroke-width=".7"/>' +
  '<path d="M-5 0 H4.6" stroke="#1d1d1d" stroke-width=".7"/>' +
  '<g fill="#1d1d1d"><circle cx="-2" cy="-2.2" r=".95"/><circle cx="-2" cy="2.2" r=".95"/><circle cx="1.5" cy="-2.8" r=".9"/><circle cx="1.5" cy="2.8" r=".9"/></g>' +
  '<ellipse cx="5.4" rx="2.2" ry="2.8" fill="#1d1d1d"/>'

type Flyer = {
  body: (fold: string) => string
  path: string
  dur: number
  begin: number
  times: number[]
  points: number[]
  turns: boolean
  landed?: [number, number]
}

const flyer = (o: Flyer) => {
  const end = o.times[o.times.length - 2]
  const eps = fine(0.8 / o.dur)
  const fold = o.landed
    ? `<animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="0;${o.landed[0]};${fine(o.landed[0] + 0.004)};${o.landed[1]};${fine(o.landed[1] + 0.004)};1" dur="${o.dur}s" begin="${o.begin}s" repeatCount="indefinite"/>`
    : ''

  return (
    '<g opacity="0">' +
    `<animateMotion path="${o.path}" dur="${o.dur}s" begin="${o.begin}s" repeatCount="indefinite" calcMode="linear" keyPoints="${o.points.join(';')}" keyTimes="${o.times.join(';')}"${o.turns ? ' rotate="auto"' : ''}/>` +
    `<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;${eps};${fine(end - eps)};${end};1" dur="${o.dur}s" begin="${o.begin}s" repeatCount="indefinite"/>` +
    o.body(fold) +
    '</g>'
  )
}

const VISITORS =
  flyer({
    body: BEE,
    path: 'M118 96 C160 70 205 60 226 72 C240 80 250 50 262 14 C280 10 300 40 296 52 C280 90 215 110 190 100 C160 92 135 92 118 96',
    dur: 67,
    begin: 4,
    times: [0, 0.22, 1],
    points: [0, 1, 1],
    turns: true,
  }) +
  flyer({
    body: BUTTERFLY,
    path: 'M100 150 C140 120 170 160 205 120 C235 80 215 40 245 36 C275 30 285 80 310 70 C335 60 325 130 295 150 C265 170 235 165 200 175 C165 185 130 170 100 150',
    dur: 83,
    begin: 12,
    times: [0, 0.26, 1],
    points: [0, 1, 1],
    turns: true,
  }) +
  flyer({
    body: BEETLE,
    path: 'M110 130 C170 120 240 170 322 264 C240 170 170 120 110 130',
    dur: 97,
    begin: 25,
    times: [0, 0.12, 0.2, 0.32, 1],
    points: [0, 0.5, 0.5, 1, 1],
    turns: true,
    landed: [0.12, 0.2],
  }) +
  flyer({
    body: LADYBUG,
    path: 'M120 175 C170 190 240 150 298 213 C240 150 170 190 120 175',
    dur: 113,
    begin: 40,
    times: [0, 0.1, 0.17, 0.27, 1],
    points: [0, 0.5, 0.5, 1, 1],
    turns: true,
    landed: [0.1, 0.17],
  })

// ---- room -------------------------------------------------------------------
const steam = (x: number, begin: number) =>
  `<path d="M${x} 232 q-4 -6 0 -12 q4 -6 0 -12" fill="none" stroke="#b9ad98" stroke-width="1.6" stroke-linecap="round" opacity="0">` +
  `<animate attributeName="opacity" values="0;.7;0" dur="4.5s" begin="${begin}s" repeatCount="indefinite"/>` +
  `<animateTransform attributeName="transform" type="translate" values="0 0;0 -9" dur="4.5s" begin="${begin}s" repeatCount="indefinite"/></path>`

const ROOM =
  '<rect width="400" height="258" fill="url(#wall)"/>' +
  WINDOW +
  '<rect y="258" width="400" height="16" fill="#b58b61"/><rect y="258" width="400" height="2" fill="#cfa77c"/>' +
  '<rect y="274" width="400" height="46" fill="#8e6844"/>' +
  '<path d="M30 262 L165 262 L182 272 L47 272Z" fill="#fff6d8" opacity=".2"/>' +
  // mug
  '<rect x="338" y="238" width="28" height="30" rx="4" fill="#f4efe6" stroke="#cfc3ac"/>' +
  '<path d="M366 245 h5 a6 6 0 0 1 0 14 h-5" fill="none" stroke="#cfc3ac" stroke-width="3"/>' +
  '<ellipse cx="352" cy="240" rx="12" ry="2.6" fill="#6b4a33"/>' +
  steam(347, 0) +
  steam(357, 2.2) +
  // pot
  '<ellipse cx="280" cy="268" rx="46" ry="5" fill="#000" opacity=".14"/>' +
  PLANTS.map(plantSvg).join('') +
  '<ellipse cx="275" cy="266" rx="36" ry="5" fill="#b4623f"/>' +
  '<path d="M246 224 L304 224 L298 264 L252 264Z" fill="#c9714a"/>' +
  '<path d="M246 224 L254 224 L259 264 L252 264Z" fill="#fff" opacity=".1"/>' +
  '<rect x="241" y="212" width="68" height="13" rx="3" fill="#d27d55"/>' +
  '<rect x="241" y="212" width="68" height="3" rx="1.5" fill="#fff" opacity=".18"/>' +
  VISITORS

// ---- building shell (shared by both halves) ---------------------------------
const BRICK = '#6b5b52'
const HALF_W = 400
const HALF_H = 680
const D1 = 90 // taller window room
const T = 70 // taller fish tank
const D3 = 160 // extra wall above the workshop

const DEFS =
  '<defs>' +
  '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ccbea"/><stop offset="1" stop-color="#e4f1f4"/></linearGradient>' +
  '<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe6d4"/><stop offset="1" stop-color="#ddd1bb"/></linearGradient>' +
  '<linearGradient id="wall2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9dcc6"/><stop offset="1" stop-color="#d6c6aa"/></linearGradient>' +
  '<linearGradient id="shop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d3dccd"/><stop offset="1" stop-color="#bccab8"/></linearGradient>' +
  '<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3ef"/><stop offset="1" stop-color="#7fb9cf"/></linearGradient>' +
  '<clipPath id="glass"><rect x="30" y="48" width="132" height="176"/></clipPath>' +
  `<clipPath id="roomclip"><rect x="6" y="24" width="388" height="${290 + D1}"/></clipPath>` +
  '<clipPath id="screen"><rect x="78" y="223" width="124" height="82"/></clipPath>' +
  '</defs>'

const frame = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HALF_W} ${HALF_H}" width="${HALF_W}" height="${HALF_H}">${DEFS}${inner}` +
  `<rect x="0" y="0" width="6" height="${HALF_H}" fill="${BRICK}"/><rect x="394" y="0" width="6" height="${HALF_H}" fill="${BRICK}"/></svg>`

// ---- upper half: the window room, the cat and the fish tank --------------------
const WB = 452 + T
const seaweed = (x: number, h: number, begin: number) =>
  `<g><animateTransform attributeName="transform" type="rotate" values="-5 ${x} ${WB};5 ${x} ${WB};-5 ${x} ${WB}" ${keyed([0, 0.5, 1])} dur="${4 + begin}s" begin="${-begin}s" repeatCount="indefinite"/>` +
  `<path d="M${x} ${WB} q-7 ${-h / 3} 0 ${-h / 2} q7 ${-h / 3} 0 ${-h / 2}" fill="none" stroke="#4f9a63" stroke-width="3.2" stroke-linecap="round"/></g>`

const bubble = (x: number, r: number, dur: number, begin: number) =>
  `<circle cx="${x}" cy="${WB - 4}" r="${r}" fill="#fff" fill-opacity=".55" stroke="#fff" stroke-opacity=".8" stroke-width=".6" opacity="0">` +
  `<animate attributeName="cy" values="${WB - 4};362" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>` +
  `<animate attributeName="opacity" values="0;.9;.9;0" keyTimes="0;.1;.8;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></circle>`

const fish = (
  body: string,
  fin: string,
  from: [number, number],
  to: [number, number],
  lift: number,
  dur: number,
  begin: number,
) => {
  const out = `C${from[0] + (to[0] - from[0]) * 0.3} ${from[1] - lift} ${from[0] + (to[0] - from[0]) * 0.7} ${to[1] + lift} ${to[0]} ${to[1]}`
  const back = `C${from[0] + (to[0] - from[0]) * 0.7} ${to[1] + lift} ${from[0] + (to[0] - from[0]) * 0.3} ${from[1] - lift} ${from[0]} ${from[1]}`

  return (
    '<g>' +
    `<animateMotion path="M${from[0]} ${from[1]} ${out} ${back}" dur="${dur}s" begin="${-begin}s" repeatCount="indefinite" calcMode="spline" keyPoints="0;.5;1" keyTimes="0;.5;1" keySplines=".4 0 .6 1;.4 0 .6 1"/>` +
    `<g><animateTransform attributeName="transform" type="scale" values="1 1;-1 1" keyTimes="0;.5" calcMode="discrete" dur="${dur}s" begin="${-begin}s" repeatCount="indefinite"/>` +
    `<path d="M-8 0 L-17 -6 L-17 6Z" fill="${fin}"><animateTransform attributeName="transform" type="rotate" values="-10 -8 0;10 -8 0;-10 -8 0" dur=".5s" repeatCount="indefinite"/></path>` +
    `<ellipse rx="10" ry="5.4" fill="${body}"/><path d="M-2 -5 q3 5 0 10" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.6"/>` +
    '<circle cx="5.5" cy="-1.2" r="1.3" fill="#1d2a30"/></g></g>'
  )
}

const CAT =
  // rug
  '<ellipse cx="112" cy="494" rx="86" ry="11" fill="#a8574a" opacity=".85"/><ellipse cx="112" cy="494" rx="70" ry="8" fill="none" stroke="#e7c9a0" stroke-width="1.4"/>' +
  // tail
  '<g><animateTransform attributeName="transform" type="rotate" values="-5 70 480;6 70 480;-5 70 480" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="3.4s" repeatCount="indefinite"/>' +
  '<path d="M70 482 C42 486 40 506 78 504 C108 502 130 498 140 494" fill="none" stroke="#d9a066" stroke-width="10" stroke-linecap="round"/>' +
  '<path d="M52 497 q-6 4 -1 8" fill="none" stroke="#b9824a" stroke-width="3" stroke-linecap="round"/></g>' +
  // body, breathing
  '<g transform="translate(112 486)"><g><animateTransform attributeName="transform" type="scale" values="1 1;1 1.045;1 1" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="3.2s" repeatCount="indefinite"/>' +
  '<g transform="translate(-112 -486)"><g transform="translate(0 -8)"><ellipse cx="112" cy="480" rx="48" ry="24" fill="#d9a066"/>' +
  '<path d="M92 460 q4 14 -2 28 M112 457 q4 16 0 32 M132 460 q3 14 -1 27" fill="none" stroke="#b9824a" stroke-width="3.4" stroke-linecap="round"/></g></g></g></g>' +
  // head
  '<g transform="translate(0 -4)"><ellipse cx="156" cy="480" rx="17" ry="14" fill="#d9a066"/>' +
  '<path d="M143 470 L146 456 L154 466Z M169 470 L166 456 L158 466Z" fill="#d9a066"/><path d="M146 468 L147 460 L151 466Z M166 468 L165 460 L161 466Z" fill="#f0b9a0"/>' +
  '<path d="M148 480 q4 3 8 0 M158 480 q4 3 8 0" fill="none" stroke="#3b2a22" stroke-width="1.5" stroke-linecap="round"/>' +
  '<path d="M154 485 l3 3 l3 -3Z" fill="#e08a8a"/></g>' +
  // sleeping z
  '<g font-family="sans-serif" font-size="13" fill="#6f7f93">' +
  [0, 1.6, 3.2]
    .map(
      b =>
        `<text x="178" y="458" opacity="0">z<animate attributeName="opacity" values="0;.85;0" dur="4.8s" begin="${b}s" repeatCount="indefinite"/>` +
        `<animateTransform attributeName="transform" type="translate" values="0 0;8 -16" dur="4.8s" begin="${b}s" repeatCount="indefinite"/></text>`,
    )
    .join('') +
  '</g>'

const TANK =
  // stand
  `<rect x="200" y="${476 + T}" width="172" height="8" rx="2" fill="#8e6844"/><rect x="208" y="${484 + T}" width="6" height="36" fill="#7a5a3c"/><rect x="358" y="${484 + T}" width="6" height="36" fill="#7a5a3c"/>` +
  // water
  `<rect x="206" y="350" width="160" height="${124 + T}" rx="4" fill="url(#water)"/>` +
  `<rect x="206" y="${454 + T}" width="160" height="20" fill="#e6d3a3"/><ellipse cx="250" cy="${456 + T}" rx="14" ry="5" fill="#b9a985"/><ellipse cx="330" cy="${458 + T}" rx="10" ry="4" fill="#a9997a"/>` +
  seaweed(228, 104, 0) +
  seaweed(236, 72, 1.4) +
  seaweed(344, 116, 0.7) +
  seaweed(352, 80, 2.1) +
  fish('#f08a3c', '#f6b46e', [238, 396], [334, 430], 12, 15, 0) +
  fish('#4f8fd0', '#8dbbe6', [334, 478], [250, 498], 10, 11, 4) +
  fish('#f0d04a', '#f6e486', [250, 372], [338, 462], 14, 19, 9) +
  bubble(232, 2.4, 6.6, 0) +
  bubble(236, 1.6, 8.4, 1.7) +
  bubble(230, 2, 7.5, 3.1) +
  // glass and lid
  `<rect x="206" y="350" width="160" height="${124 + T}" rx="4" fill="none" stroke="#9fb7bd" stroke-width="3"/><rect x="202" y="344" width="168" height="7" rx="2" fill="#4a5058"/>` +
  `<path d="M214 358 v${50 + T * 0.6}" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`

const TOP =
  frame(
    '<rect width="400" height="24" fill="#7a5f55"/><rect y="20" width="400" height="4" fill="#5a463e"/>' +
      '<rect x="28" y="0" width="22" height="16" fill="#5a463e"/>' +
      `<rect x="6" y="24" width="388" height="${290 + D1}" fill="#efe6d4"/>` +
      `<g clip-path="url(#roomclip)"><g transform="translate(0 ${24 + D1 - 30})">${ROOM}</g></g>` +
      `<rect x="0" y="${314 + D1}" width="400" height="8" fill="${BRICK}"/>` +
      `<g transform="translate(0 ${D1})">` +
      `<rect x="6" y="322" width="388" height="${198 + T}" fill="url(#wall2)"/>` +
      `<rect x="6" y="${470 + T}" width="388" height="50" fill="#b79a78"/><rect x="6" y="${466 + T}" width="388" height="5" fill="#efe6d4"/>` +
      `<path d="M6 ${494 + T} H394 M6 ${518 + T} H394" stroke="#a38865" stroke-opacity=".6"/>` +
      `<g transform="translate(0 ${T})">${CAT}</g>` +
      TANK +
      '</g>',
  )

// ---- lower half: Claude's workshop, driven by what Claude is doing --------------------
type Look = { working: boolean; prev: boolean; done: number; fresh: boolean }

const GARDEN_SLOTS = 12
const BLOOM_KINDS = ['cosmos', 'daisy', 'poppy', 'violet', 'tulip'] as const

const bloomsOf = (done: number) => (done === 0 ? 0 : ((done - 1) % GARDEN_SLOTS) + 1)

const gardenSlot = (i: number, blooms: number, fresh: boolean) => {
  const sx = 41 + 29.8 * i
  const baseY = 458
  if (i > blooms) return ''
  if (i === blooms) {
    return `<g transform="translate(${n(sx)} ${baseY})"><path d="M0 0 q-6 -10 -13 -8 q4 8 13 8Z M0 0 q6 -10 13 -8 q-4 8 -13 8Z" fill="#5f9457"/></g>`
  }
  const h = 38 + ((i * 13) % 5) * 7
  const lean = ((i * 7) % 5) - 2
  const hx = sx + lean * 2
  const hy = baseY - h
  const popped = fresh && i === blooms - 1
  const kind = BLOOM_KINDS[i % BLOOM_KINDS.length]
  const head = popped
    ? `<g><animateTransform attributeName="transform" type="scale" values="0;1.25;1" keyTimes="0;.6;1" dur="1.4s" begin="0s" fill="freeze"/>${FLOWERS[kind]()}</g>`
    : FLOWERS[kind]()

  return (
    `<g>${rotateAbout([-2.2, 2.2, -2.2], sx, baseY, 4 + (i % 4) * 0.7, -i * 0.6, [0, 0.5, 1])}` +
    `<path d="M${n(sx)} ${baseY} Q${n(sx + lean * 3)} ${baseY - h / 2} ${n(hx)} ${n(hy)}" fill="none" stroke="#4f7d4a" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M0 0 C7 -9 18 -9 25 -2 C16 5 7 5 0 0Z" fill="#5f9457" transform="translate(${n(sx + lean * 1.4)} ${baseY - h * 0.45}) rotate(-22) scale(.5)"/>` +
    `<g transform="translate(${n(hx)} ${n(hy)}) scale(.7)">${head}</g></g>`
  )
}

const CODE_COLORS = ['#7fb4d8', '#e0b36a', '#8fc08a', '#c58fd0', '#cfd6dc', '#7fb4d8', '#e0b36a']
const CODE_WIDTHS = [74, 52, 96, 38, 84, 62, 46]
const codeLines = (opacity: number) =>
  Array.from(
    { length: 14 },
    (_, i) =>
      `<rect x="${86 + (i % 3 === 1 ? 10 : 0)}" y="${229 + i * 8}" width="${CODE_WIDTHS[i % 7]}" height="4" rx="2" fill="${CODE_COLORS[i % 7]}" opacity="${opacity}"/>`,
  ).join('')

const sparkle = (x: number, y: number, begin: number) =>
  `<path d="M${x} ${y - 6} L${x + 1.8} ${y - 1.8} L${x + 6} ${y} L${x + 1.8} ${y + 1.8} L${x} ${y + 6} L${x - 1.8} ${y + 1.8} L${x - 6} ${y} L${x - 1.8} ${y - 1.8}Z" fill="#ffd96a" opacity="0">` +
  `<animate attributeName="opacity" values="0;1;0" dur="1.6s" begin="${begin}s" repeatCount="indefinite"/></path>`

const workshop = (w: Look, bubble: { work: string; cheer: string; rest: string }) => {
  const blooms = bloomsOf(w.done)
  const mood = w.working ? 'work' : w.fresh ? 'cheer' : 'rest'
  const lit = mood !== 'rest'
  const dimFrom = w.prev ? 0 : 0.4
  const dimTo = lit ? 0 : 0.4
  const glowFrom = w.prev ? 1 : 0
  const glowTo = lit ? 1 : 0

  const label = bubble[mood]
  const pillW = mood === 'cheer' ? 196 : 126
  const dot = { work: '#5fae6b', cheer: '#e0b050', rest: '#9aa3a8' }[mood]

  const eyes = {
    work:
      '<ellipse cx="282" cy="262" rx="3.2" ry="3.2" fill="#2b2623"><animate attributeName="ry" values="3.2;3.2;.4;3.2" keyTimes="0;.9;.95;1" dur="4s" repeatCount="indefinite"/></ellipse>' +
      '<ellipse cx="302" cy="262" rx="3.2" ry="3.2" fill="#2b2623"><animate attributeName="ry" values="3.2;3.2;.4;3.2" keyTimes="0;.9;.95;1" dur="4s" repeatCount="indefinite"/></ellipse>' +
      '<path d="M287 275 h10" stroke="#2b2623" stroke-width="2" stroke-linecap="round"/>',
    cheer:
      '<path d="M277 265 q5 -6 10 0 M297 265 q5 -6 10 0" fill="none" stroke="#2b2623" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M283 274 q9 9 18 0Z" fill="#7a2f22"/>',
    rest:
      '<path d="M277 262 q5 4 10 0 M297 262 q5 4 10 0" fill="none" stroke="#2b2623" stroke-width="2.2" stroke-linecap="round"/>' +
      '<ellipse cx="292" cy="276" rx="2.4" ry="2" fill="#7a2f22"/>',
  }[mood]

  const bulb = mood === 'rest' ? '#9aa3a8' : '#ffd27a'
  const bulbPulse =
    mood === 'work'
      ? '<animate attributeName="r" values="5;7;5" dur="1.2s" repeatCount="indefinite"/>'
      : ''

  const arms = {
    work:
      '<g transform="translate(262 318)"><animateTransform attributeName="transform" type="rotate" values="0 0 0;7 0 0;0 0 0" dur=".35s" repeatCount="indefinite" additive="sum"/>' +
      '<path d="M0 0 L-42 22" stroke="#d9784a" stroke-width="9" stroke-linecap="round"/><circle cx="-42" cy="22" r="6" fill="#e58a5c"/></g>' +
      '<g transform="translate(322 320)"><path d="M0 0 L12 24" stroke="#d9784a" stroke-width="9" stroke-linecap="round"/></g>',
    cheer:
      '<g transform="translate(262 318)"><animateTransform attributeName="transform" type="rotate" values="0 0 0;-9 0 0;0 0 0" dur=".6s" repeatCount="indefinite" additive="sum"/>' +
      '<path d="M0 0 L-26 -40" stroke="#d9784a" stroke-width="9" stroke-linecap="round"/><circle cx="-26" cy="-40" r="6" fill="#e58a5c"/></g>' +
      '<g transform="translate(322 320)"><animateTransform attributeName="transform" type="rotate" values="0 0 0;9 0 0;0 0 0" dur=".6s" repeatCount="indefinite" additive="sum"/>' +
      '<path d="M0 0 L26 -40" stroke="#d9784a" stroke-width="9" stroke-linecap="round"/><circle cx="26" cy="-40" r="6" fill="#e58a5c"/></g>',
    rest:
      '<g transform="translate(262 318)"><path d="M0 0 L-12 26" stroke="#d9784a" stroke-width="9" stroke-linecap="round"/></g>' +
      '<g transform="translate(322 320)"><path d="M0 0 L12 24" stroke="#d9784a" stroke-width="9" stroke-linecap="round"/></g>',
  }[mood]

  const zzz =
    mood === 'rest'
      ? '<g font-family="sans-serif" font-size="13" fill="#51606e">' +
        [0, 1.6, 3.2]
          .map(
            b =>
              `<text x="322" y="246" opacity="0">z<animate attributeName="opacity" values="0;.85;0" dur="4.8s" begin="${b}s" repeatCount="indefinite"/>` +
              `<animateTransform attributeName="transform" type="translate" values="0 0;8 -16" dur="4.8s" begin="${b}s" repeatCount="indefinite"/></text>`,
          )
          .join('') +
        '</g>'
      : ''

  const sparkles = mood === 'cheer' ? sparkle(250, 232, 0) + sparkle(334, 226, 0.5) + sparkle(318, 196, 1) + sparkle(262, 200, 0.3) : ''

  const screen =
    mood === 'rest'
      ? '<rect x="78" y="223" width="124" height="82" fill="#1b232b"/>' +
        `<g clip-path="url(#screen)">${codeLines(0.22)}</g>` +
        '<rect x="88" y="289" width="6" height="10" fill="#9fc3d6"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.2s" repeatCount="indefinite"/></rect>'
      : '<rect x="78" y="223" width="124" height="82" fill="#18252e"/>' +
        `<g clip-path="url(#screen)"><g>${codeLines(0.95)}<animateTransform attributeName="transform" type="translate" values="0 0;0 -56" dur="${mood === 'work' ? 2.8 : 9}s" repeatCount="indefinite"/></g></g>`

  const keys =
    mood === 'work'
      ? Array.from(
          { length: 6 },
          (_, i) =>
            `<rect x="${134 + i * 16}" y="337" width="10" height="4" rx="1" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;.9;0" dur=".5s" begin="${(i * 0.37) % 1.1}s" repeatCount="indefinite"/></rect>`,
        ).join('')
      : ''

  const beam =
    '<g>' +
    `<animate attributeName="opacity" values="${glowFrom};${glowTo}" dur="1.2s" fill="freeze"/>` +
    '<path d="M346 272 L262 340 L350 340Z" fill="#fff0b8" opacity=".32"/><circle cx="347" cy="272" r="13" fill="#fff3b0" opacity=".7"/></g>'

  const pill =
    `<rect x="${200 - pillW / 2}" y="22" width="${pillW}" height="28" rx="14" fill="#fff" opacity=".82"/>` +
    `<circle cx="${200 - pillW / 2 + 18}" cy="36" r="5" fill="${dot}">${mood === 'work' ? '<animate attributeName="r" values="4;6;4" dur="1.2s" repeatCount="indefinite"/>' : ''}</circle>` +
    `<text x="${200 - pillW / 2 + 32}" y="41" font-family="sans-serif" font-size="14" fill="#33404a">${label}</text>`

  // string lights along the extra wall: lit while Claude works or has just finished
  const WIRE = [
    [6, 62, 103, 122, 200, 72],
    [200, 72, 297, 122, 394, 62],
  ]
  const BULB_COLORS = ['#f26d6d', '#f2b84b', '#7bc77e', '#6bb5e8', '#c58fe0']
  const bulbs = WIRE.flatMap(([x0, y0, cx, cy, x1, y1], arc) =>
    [0.2, 0.45, 0.7, 0.92].map((t, i) => {
      const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1
      const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1 + 5
      const c = BULB_COLORS[(arc * 4 + i) % BULB_COLORS.length]
      const twinkle = mood === 'work' ? `<animate attributeName="opacity" values="1;.55;1" dur="${1.4 + (i % 3) * 0.4}s" begin="${i * 0.3}s" repeatCount="indefinite"/>` : ''

      return (
        `<circle cx="${n(x)}" cy="${n(y)}" r="10" fill="${c}" opacity="${lit ? 0.28 : 0}"/>` +
        `<circle cx="${n(x)}" cy="${n(y)}" r="4.2" fill="${c}" opacity="${lit ? 1 : 0.45}">${twinkle}</circle>`
      )
    }),
  ).join('')
  const lights = `<path d="M6 62 Q103 122 200 72 Q297 122 394 62" fill="none" stroke="#6a6a62" stroke-width="1.4"/>${bulbs}`

  const NOTES: [number, number, number, string][] = [
    [146, 126, -5, '#f6e27a'],
    [186, 122, 3, '#f4a6a6'],
    [226, 128, -3, '#a6d8f0'],
    [160, 166, 4, '#b8e0a0'],
    [212, 168, -4, '#f6c88a'],
  ]
  const board =
    '<rect x="132" y="108" width="136" height="112" rx="4" fill="#8e6844"/><rect x="138" y="114" width="124" height="100" fill="#c9a06a"/>' +
    NOTES.map(
      ([x, y, rot, c]) =>
        `<g transform="translate(${x} ${y}) rotate(${rot})"><rect width="32" height="30" fill="${c}"/>` +
        '<path d="M5 10 h20 M5 16 h16 M5 22 h18" stroke="#000" stroke-opacity=".28" stroke-width="1.6"/><circle cx="16" cy="3" r="2.4" fill="#c4423a"/></g>',
    ).join('')

  return frame(
    `<g transform="translate(0 ${D3})">` +
      `<rect x="6" y="${8 - D3}" width="388" height="${396 + D3}" fill="url(#shop)"/>` +
      `<g transform="translate(0 ${-D3})">${lights}${board}</g>` +
      // shelf with books and a small plant
      '<rect x="24" y="152" width="126" height="6" rx="1" fill="#8e6844"/>' +
      '<rect x="30" y="120" width="12" height="32" fill="#c4675a"/><rect x="44" y="126" width="10" height="26" fill="#5b86a6"/><rect x="56" y="116" width="13" height="36" fill="#d6b25a"/><rect x="71" y="128" width="9" height="24" fill="#6a9a73"/>' +
      '<rect x="108" y="136" width="26" height="16" rx="2" fill="#c9714a"/><path d="M121 136 q-8 -10 -2 -16 M121 136 q0 -14 6 -18 M121 136 q8 -8 12 -12" fill="none" stroke="#5f9457" stroke-width="3" stroke-linecap="round"/>' +
      // wall clock
      '<circle cx="330" cy="118" r="26" fill="#fbf8f0" stroke="#8b6b4a" stroke-width="3"/>' +
      '<path d="M330 96 v4 M330 136 v4 M308 118 h4 M348 118 h4" stroke="#8b6b4a" stroke-width="2"/>' +
      '<path d="M330 118 v-14" stroke="#2f3338" stroke-width="2.6" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="0 330 118;360 330 118" dur="43200s" repeatCount="indefinite"/></path>' +
      '<path d="M330 118 v-19" stroke="#2f3338" stroke-width="1.8" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="0 330 118;360 330 118" dur="3600s" repeatCount="indefinite"/></path>' +
      '<path d="M330 118 v-21" stroke="#c4675a" stroke-width="1" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="0 330 118;360 330 118" dur="60s" repeatCount="indefinite"/></path>' +
      // character, behind the desk
      '<ellipse cx="292" cy="330" rx="38" ry="32" fill="#d9784a"/>' +
      '<circle cx="292" cy="266" r="31" fill="#e58a5c"/>' +
      '<path d="M292 235 V222" stroke="#8a5a3c" stroke-width="3" stroke-linecap="round"/>' +
      `<circle cx="292" cy="217" r="5" fill="${bulb}">${bulbPulse}</circle>` +
      '<circle cx="272" cy="272" r="4.5" fill="#f0a98a" opacity=".8"/><circle cx="312" cy="272" r="4.5" fill="#f0a98a" opacity=".8"/>' +
      eyes +
      zzz +
      sparkles +
      // desk
      '<rect x="6" y="330" width="388" height="14" fill="#b58b61"/><rect x="6" y="330" width="388" height="2" fill="#cfa77c"/>' +
      '<rect x="6" y="344" width="388" height="60" fill="#8e6844"/><path d="M110 352 v44 M290 352 v44" stroke="#7a5a3c" stroke-width="2"/>' +
      // monitor
      '<rect x="128" y="318" width="24" height="12" fill="#3a3f45"/><rect x="112" y="326" width="56" height="6" rx="2" fill="#3a3f45"/>' +
      '<rect x="70" y="215" width="140" height="98" rx="6" fill="#2f3338"/>' +
      screen +
      // keyboard, mug
      '<rect x="128" y="335" width="106" height="9" rx="2" fill="#4a5058"/>' +
      keys +
      '<rect x="244" y="318" width="22" height="22" rx="3" fill="#f4efe6" stroke="#cfc3ac"/><path d="M266 324 h4 a5 5 0 0 1 0 10 h-4" fill="none" stroke="#cfc3ac" stroke-width="2.4"/>' +
      // lamp
      '<ellipse cx="368" cy="332" rx="17" ry="4" fill="#4a4f55"/><path d="M368 330 V294 L350 270" fill="none" stroke="#4a4f55" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M336 276 L354 258 L366 270 L348 286Z" fill="#e8b84a"/>' +
      arms +
      // floor and planter
      '<rect x="6" y="404" width="388" height="116" fill="#b79a78"/><rect x="6" y="400" width="388" height="6" fill="#efe6d4"/>' +
      '<path d="M6 430 H394 M6 462 H394 M6 494 H394" stroke="#a38865" stroke-opacity=".55"/>' +
      '<rect x="22" y="456" width="356" height="46" rx="4" fill="#8b5e3c"/><rect x="22" y="456" width="356" height="8" fill="#4a3426"/><rect x="22" y="470" width="356" height="2" fill="#fff" opacity=".1"/>' +
      // idle dusk, fading between states
      `<rect x="6" y="${8 - D3}" width="388" height="${512 + D3}" fill="#16213a" opacity="${dimTo}"><animate attributeName="opacity" values="${dimFrom};${dimTo}" dur="1.2s" fill="freeze"/></rect>` +
      beam +
      Array.from({ length: GARDEN_SLOTS }, (_, i) => gardenSlot(i, blooms, w.fresh && w.done > 0)).join('') +
      '</g>' +
      `<rect x="0" y="0" width="400" height="8" fill="${BRICK}"/>` +
      pill,
  )
}

const scene = { top: TOP, work: workshop }
// ---scene-end

const TERMINAL_ART = [
  '    ✿',
  ' ❀  │   ❁',
  '  ╲ │  ╱ ✾',
  '   ╲│ ╱',
  '  ╭─┴─┴─╮',
  '  ╰╮   ╭╯',
  '   ╰───╯',
]

const glyphColor = (ch: string) =>
  ({ '✿': '#f3d35a', '❀': '#e58fa6', '❁': '#e2735a', '✾': '#9b7fd1' })[ch] ??
  ('╭╮╯╰─┴'.includes(ch) ? '#c9714a' : '#5f9457')

const work = atom(
  { plugin: 'desk-garden', key: 'work' } as const,
  { working: false, prev: false, done: 0, fresh: false, tools: 0 } as Work,
)

export const register: Register = (on, options) => {
  // `language` is a field of the plugin's userConfig: 'en' (default) or 'ko'
  const T: Words = STRINGS[options.language === 'ko' ? 'ko' : 'en']

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'garden',
      description: 'Open the desk garden pane',
    })

    return next(e)
  })

  on('command.run', { command: 'garden' }, async $ => {
    await $.ui.open({ id: PANE, title: T.title })

    return { text: T.opened }
  })

  // The main loop's turns only: a subagent's run is not Claude "at the desk".
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, work, w => ({ ...w, prev: w.working || w.fresh, working: true, fresh: false }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const isAnswer = e.reason === 'answer'
      await update($, work, w => ({
        ...w,
        prev: w.working,
        working: false,
        fresh: isAnswer,
        done: w.done + (isAnswer ? 1 : 0),
      }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // Counted as text beneath the pictures: the pictures themselves are left alone.
  on('tool.call', async ($, e, next) => {
    await update($, work, w => ({ ...w, tools: w.tools + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const w = await read($, work)
    const els = $.ui.resolve(e)
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 20
    const line = T.line(bloomsOf(w.done), GARDEN_SLOTS, w.done, w.tools)
    // The pane's width in px: its cells over the code font's advance (about 7.6 px).
    const width = Math.max(160, Math.round(cols * 7.6))
    const height = Math.round((width * HALF_H) / HALF_W)

    if (e.surface !== 'terminal') {
      const { Box, Text, Svg } = els as ElementTable<'desktop'>

      return (
        <Box flexDirection="column" justifyContent="flex-end" minHeight={rows}>
          <Box justifyContent="center">
            <Text dimColor>{line}</Text>
          </Box>
          <Svg source={scene.top} alt={T.alt} width={width} height={height} isInteractive />
          <Svg source={scene.work(w, T.bubble)} alt={T.altWork} width={width} height={height} isInteractive />
        </Box>
      )
    }

    const { Box, Text } = els as ElementTable<'terminal'>

    return (
      <Box flexDirection="column">
        {TERMINAL_ART.map(row => (
          <Box>
            {[...row].map(ch => (
              <Text color={glyphColor(ch)}>{ch}</Text>
            ))}
          </Box>
        ))}
        <Text>{w.working ? T.on : T.off}</Text>
        <Text dimColor>{line}</Text>
        <Text dimColor>{T.note}</Text>
      </Box>
    )
  })
}
