import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import type { Moon } from '../types'

const PANE = 'moon-view'
const STRINGS = {
  en: {
    title: 'Moon',
    alt: 'The universe seen from the Moon. An astronaut bounces beside the lander, the Earth hangs in the sky, and shooting stars, rockets, satellites, UFOs and planets pass at random.',
    working: (clock: string, tools: number) => `Working ${clock} · tools ${tools}`,
    idle: 'Idle',
    opened: 'Opened the moon pane.',
    note: 'The animation shows in the desktop app.',
  },
  ko: {
    title: '달',
    alt: '달 표면에서 본 우주. 달착륙선 옆에서 우주인이 통통 뛰고, 하늘에는 지구가 떠 있으며, 별똥별과 로켓, 위성, UFO, 행성이 무작위로 지나갑니다.',
    working: (clock: string, tools: number) => `작업 중 ${clock} · 도구 ${tools}회`,
    idle: '쉬는 중',
    opened: '달 표면을 열었습니다.',
    note: '그림 움직임은 데스크톱 앱에서 보입니다.',
  },
}

type Words = (typeof STRINGS)['en']

// ---scene-start
const W = 400
const H = 1200
const HORIZON = 960
const GY = 1068 // where the astronaut's boots land
const KINDS = 15
const HORIZON_SECONDS = 800 // how far ahead visits are laid out

const n = (v: number) => String(Math.round(v * 10) / 10)
const EASE = '.45 0 .55 1'
const pick = <T,>(list: T[], s: number): T => list[((s % list.length) + list.length) % list.length]
const rnd = (s: number) => {
  const v = Math.sin(s * 127.1 + 311.7) * 43758.5453

  return v - Math.floor(v)
}

// Looping motion shifts back by the time already elapsed, so redrawing the picture never makes it jump.
const retime = (svg: string, elapsed: number) =>
  svg.replace(/<(animate|animateTransform|animateMotion)\b[^>]*>/g, tag => {
    const found = / begin="(-?[\d.]+)s"/.exec(tag)
    const shifted = ` begin="${n((found ? parseFloat(found[1]) : 0) - elapsed)}s"`

    return found ? tag.replace(found[0], shifted) : tag.replace(/^<(\w+)/, `<$1${shifted}`)
  })

// ---- space: stars, a faint Milky Way, and the Earth ----------------------------------------------------------------
const STARS = Array.from({ length: 110 }, (_, k) => {
  const y = rnd(k * 2 + 1) * 950
  const r = 0.5 + rnd(k + 90) * 1.4
  const twinkle = k % 2 === 0 ? `<animate attributeName="opacity" values=".3;1;.3" dur="${n(2 + rnd(k + 5) * 4)}s" begin="${n(-rnd(k + 9) * 6)}s" repeatCount="indefinite"/>` : ''

  return `<circle cx="${n(rnd(k * 2) * W)}" cy="${n(y)}" r="${n(r)}" fill="${pick(['#fff', '#cfe0ff', '#fff3c8', '#ffd9d0'], k)}" opacity=".85">${twinkle}</circle>`
}).join('')

const MILKY = '<polygon points="-20,300 120,120 220,60 260,100 140,260 20,420" fill="#aab4ff" opacity=".06"/><polygon points="40,520 200,330 330,240 350,280 220,420 90,600" fill="#c8b4ff" opacity=".05"/>'

const EARTH_AT: [number, number] = [262, 620]
const R = 100
// continents and clouds slide across the disc, so the Earth turns
const strip = (blobs: number, seed: number, colors: string[], opacity: number, dur: number) => {
  const one = Array.from({ length: blobs }, (_, k) => {
    const x = rnd(seed + k) * 400
    const y = EARTH_AT[1] - R + 16 + rnd(seed + k + 40) * (2 * R - 32)

    return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(16 + rnd(seed + k + 80) * 34)}" ry="${n(7 + rnd(seed + k + 120) * 20)}" fill="${pick(colors, k)}" opacity="${opacity}"/>`
  }).join('')

  return `<g><animateTransform attributeName="transform" type="translate" values="-100 0;-500 0" dur="${dur}s" repeatCount="indefinite"/>${one}<g transform="translate(400 0)">${one}</g></g>`
}

const EARTH =
  `<circle cx="${EARTH_AT[0]}" cy="${EARTH_AT[1]}" r="${R + 14}" fill="#7fb8ff" opacity=".12"/><circle cx="${EARTH_AT[0]}" cy="${EARTH_AT[1]}" r="${R + 6}" fill="#7fb8ff" opacity=".16"/>` +
  `<g clip-path="url(#earth)"><rect x="${EARTH_AT[0] - R}" y="${EARTH_AT[1] - R}" width="${2 * R}" height="${2 * R}" fill="url(#ocean)"/>` +
  `<g transform="translate(${EARTH_AT[0] - R - 100} 0)">${strip(9, 10, ['#4f9a4a', '#3f8a3f', '#c9a45a', '#5aa55a'], 0.95, 180)}</g>` +
  `<ellipse cx="${EARTH_AT[0]}" cy="${EARTH_AT[1] - R + 4}" rx="60" ry="9" fill="#fff" opacity=".85"/><ellipse cx="${EARTH_AT[0]}" cy="${EARTH_AT[1] + R - 4}" rx="56" ry="8" fill="#fff" opacity=".85"/>` +
  `<g transform="translate(${EARTH_AT[0] - R - 100} 0)">${strip(14, 200, ['#fff'], 0.62, 120)}</g>` +
  `<rect x="${EARTH_AT[0] - R}" y="${EARTH_AT[1] - R}" width="${2 * R}" height="${2 * R}" fill="url(#shade)"/></g>` +
  `<circle cx="${EARTH_AT[0]}" cy="${EARTH_AT[1]}" r="${R}" fill="none" stroke="#9fd0ff" stroke-width="3" opacity=".5"/>`

// ---- the surface -----------------------------------------------------------------------------------------------------------------
const GROUND =
  `<path d="M0 ${HORIZON} Q200 ${HORIZON - 34} 400 ${HORIZON} V${H} H0Z" fill="url(#regolith)"/>` +
  `<path d="M0 ${HORIZON} Q200 ${HORIZON - 34} 400 ${HORIZON}" fill="none" stroke="#e8e8f0" stroke-width="2" opacity=".5"/>` +
  Array.from({ length: 10 }, (_, k) => {
    const x = 20 + rnd(k + 400) * 360
    const y = HORIZON + 24 + rnd(k + 420) * (H - HORIZON - 50)
    const rx = 14 + rnd(k + 440) * 36
    const ry = rx * (0.22 + rnd(k + 460) * 0.12)

    return (
      `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="#6a6a76" opacity=".55"/>` +
      `<ellipse cx="${n(x)}" cy="${n(y + ry * 0.2)}" rx="${n(rx * 0.86)}" ry="${n(ry * 0.8)}" fill="#7e7e8a" opacity=".7"/>` +
      `<path d="M${n(x - rx)} ${n(y)} Q${n(x)} ${n(y - ry * 1.4)} ${n(x + rx)} ${n(y)}" fill="none" stroke="#c9c9d4" stroke-width="1.4" opacity=".6"/>`
    )
  }).join('') +
  Array.from({ length: 14 }, (_, k) => `<ellipse cx="${n(rnd(k + 500) * W)}" cy="${n(HORIZON + 14 + rnd(k + 520) * (H - HORIZON - 30))}" rx="${n(3 + rnd(k + 540) * 8)}" ry="${n(1.6 + rnd(k + 560) * 3)}" fill="${pick(['#5a5a66', '#8a8a96', '#6a6a76'], k)}"/>`).join('') +
  // the astronaut's tracks
  Array.from({ length: 16 }, (_, k) => `<ellipse cx="${n(176 + k * 10)}" cy="${GY + 6 + (k % 2) * 3}" rx="3" ry="1.2" fill="#55555f" opacity=".55"/>`).join('')

const FLAG =
  `<g transform="translate(372 ${GY + 2})"><rect x="-1" y="-62" width="2" height="62" fill="#e8e8f0"/><rect x="1" y="-62" width="26" height="16" fill="#f4f5f8"/><path d="M5 -58 l2 4 l4 -4 l-4 1 l-2 -3Z" fill="#d94f4f"/><rect x="1" y="-62" width="26" height="3" fill="#3f6fd0"/><ellipse cy="1" rx="8" ry="2.4" fill="#55555f" opacity=".5"/></g>`

// The two windows of the ascent stage look like eyes: they blink bright now and then, and flicker while Claude works.
const eye = (x: number, working: boolean) => {
  const flash = working ? '#fff2a8' : '#cfe8ff'
  const dur = working ? 0.7 : 5
  const times = working ? '0;.3;.4;.7;.8;1' : '0;.9;.93;.97;1'
  const fills = working ? `#2a3550;${flash};#2a3550;${flash};#2a3550;#2a3550` : `#2a3550;#2a3550;${flash};${flash};#2a3550`
  const glow = working ? '0;.8;0;.8;0;0' : '0;0;.7;.7;0'

  return (
    `<circle cx="${x}" cy="-68" r="${working ? 12 : 10}" fill="${flash}" opacity="0"><animate attributeName="opacity" values="${glow}" keyTimes="${times}" dur="${dur}s" repeatCount="indefinite"/></circle>` +
    `<polygon points="${x - 6},-72 ${x + 6},-72 ${x},-62" fill="#2a3550"><animate attributeName="fill" values="${fills}" keyTimes="${times}" dur="${dur}s" repeatCount="indefinite"/></polygon>`
  )
}

// the lander, gold-wrapped below and grey above; its lamp is lit while Claude works
const lander = (working: boolean) =>
  '<ellipse cx="0" cy="2" rx="62" ry="5" fill="#000" opacity=".28"/>' +
  '<path d="M-30 -30 L-54 -2 M30 -30 L54 -2 M-30 -30 L-18 -4 M30 -30 L18 -4" stroke="#aab0bc" stroke-width="3" fill="none" stroke-linecap="round"/>' +
  '<ellipse cx="-54" cy="0" rx="10" ry="3.4" fill="#8a8f9b"/><ellipse cx="54" cy="0" rx="10" ry="3.4" fill="#8a8f9b"/><ellipse cx="-18" cy="-1" rx="7" ry="2.6" fill="#8a8f9b"/><ellipse cx="18" cy="-1" rx="7" ry="2.6" fill="#8a8f9b"/>' +
  '<path d="M-50 -6 L-62 -34 M-62 -34 H-54 M-62 -22 H-54 M-62 -12 H-54" stroke="#d6dae4" stroke-width="1.6" fill="none"/>' +
  '<rect x="-34" y="-52" width="68" height="26" rx="3" fill="#d9a441"/><path d="M-34 -44 H34 M-34 -36 H34 M-14 -52 V-26 M10 -52 V-26" stroke="#b8862c" stroke-width="1.2" fill="none"/>' +
  '<polygon points="-24,-52 24,-52 30,-72 14,-86 -14,-86 -30,-72" fill="#c7ccd6" stroke="#8a8f9b" stroke-width="1.2"/>' +
  eye(-12, working) + eye(12, working) +
  '<path d="M20 -86 V-98 M20 -98 a8 4 0 1 0 0.01 0" stroke="#e8eaf0" stroke-width="1.6" fill="none"/><path d="M-6 -86 V-96" stroke="#e8eaf0" stroke-width="1.6"/>' +
  `<circle cx="-34" cy="-46" r="${working ? 9 : 4}" fill="${working ? '#fff2a8' : '#6a7080'}" opacity="${working ? 0.4 : 0.6}"/><circle cx="-34" cy="-46" r="2.6" fill="${working ? '#fff2a8' : '#6a7080'}"/>`

// the astronaut: a long, slow hop in low gravity, three hops out and three back
// Three hops out and three back. Working, he leaves the ground much higher and cannot keep his balance.
const hopPath = (lift: number) => {
  const right = [0, 1, 2].map(k => `Q${197 + 54 * k} ${GY - lift} ${224 + 54 * k} ${GY}`).join(' ')
  const left = [0, 1, 2].map(k => `Q${305 - 54 * k} ${GY - lift} ${278 - 54 * k} ${GY}`).join(' ')

  return `M170 ${GY} ${right} ${left}`
}

const astronaut = (working: boolean) => {
  const swing = working ? 0.4 : 2.4
  const kick = working ? 0.35 : 0
  const body =
    '<rect x="-12" y="-36" width="9" height="18" rx="3" fill="#cfd4de"/><rect x="-6" y="-34" width="13" height="20" rx="6" fill="#f4f5f8"/><rect x="-6" y="-22" width="13" height="3" fill="#d94f4f"/>' +
    (kick
      ? `<g><animateTransform attributeName="transform" type="rotate" values="-40 -3 -15;40 -3 -15;-40 -3 -15" dur="${kick}s" repeatCount="indefinite"/><rect x="-5" y="-15" width="4.4" height="15" rx="2" fill="#e6e8ee"/><rect x="-6" y="-3" width="6.4" height="3.6" rx="1.8" fill="#8a8f9b"/></g>` +
        `<g><animateTransform attributeName="transform" type="rotate" values="40 3 -15;-40 3 -15;40 3 -15" dur="${kick}s" repeatCount="indefinite"/><rect x="1.4" y="-15" width="4.4" height="15" rx="2" fill="#e6e8ee"/><rect x="1" y="-3" width="6.4" height="3.6" rx="1.8" fill="#8a8f9b"/></g>`
      : '<rect x="-5" y="-15" width="4.4" height="15" rx="2" fill="#e6e8ee"/><rect x="1.4" y="-15" width="4.4" height="15" rx="2" fill="#e6e8ee"/><rect x="-6" y="-3" width="6.4" height="3.6" rx="1.8" fill="#8a8f9b"/><rect x="1" y="-3" width="6.4" height="3.6" rx="1.8" fill="#8a8f9b"/>') +
    `<g><animateTransform attributeName="transform" type="rotate" values="-35 0 -30;30 0 -30;-35 0 -30" dur="${swing}s" repeatCount="indefinite"/><rect x="-2.2" y="-31" width="4.4" height="15" rx="2.2" fill="#f4f5f8"/></g>` +
    (working ? `<g><animateTransform attributeName="transform" type="rotate" values="35 0 -30;-30 0 -30;35 0 -30" dur="${swing * 1.3}s" repeatCount="indefinite"/><rect x="-2.2" y="-31" width="4.4" height="15" rx="2.2" fill="#f4f5f8"/></g>` : '') +
    '<circle cx="1" cy="-41" r="9" fill="#f4f5f8"/><ellipse cx="3.4" cy="-41" rx="6" ry="5.4" fill="url(#visor)"/><ellipse cx="1.6" cy="-43" rx="2.4" ry="1.6" fill="#fff" opacity=".7"/>'
  // working, the whole body turns over and over about its middle
  const turning = working
    ? `<g transform="translate(0 -22)"><g><animateTransform attributeName="transform" type="rotate" values="0;360" dur="1.5s" repeatCount="indefinite"/><g transform="translate(0 22)">${body}</g></g></g>`
    : body

  return `<g><animateTransform attributeName="transform" type="scale" values="1 1;-1 1" keyTimes="0;.5" calcMode="discrete" dur="34s" repeatCount="indefinite"/>${turning}</g>`
}

const ASTRO_SHADOW = `<ellipse cx="0" cy="${GY + 4}" rx="12" ry="3" fill="#000" opacity=".3"><animateTransform attributeName="transform" type="translate" values="170 0;332 0;170 0" dur="34s" repeatCount="indefinite"/></ellipse>`

// ---- visitors, each drawn for its own time and then gone ------------------------------------------------------------------------------------------
type Slot = { id: number; kind: number; seed: number }

const LIFE = [3, 9, 18, 12, 18, 14, 22, 16, 22, 18, 10, 22, 20, 12, 14]

// ---- a long time ago, in a galaxy far, far away: plain look-alikes ----------------------------------------------------------------------------------
const deathStar = () =>
  '<circle r="34" fill="#cfe0ff" opacity=".08"/><circle r="28" fill="#a8adb8"/><circle r="28" fill="none" stroke="#6a707c" stroke-width="1.4"/>' +
  '<path d="M-28 2 Q0 8 28 2" fill="none" stroke="#5a5f6c" stroke-width="2.4"/><path d="M-20 -14 Q0 -8 20 -16 M-24 12 Q0 20 24 12" fill="none" stroke="#8a909c" stroke-width="1"/>' +
  '<circle cx="-9" cy="-9" r="7.4" fill="#7a808c"/><circle cx="-9" cy="-9" r="4.6" fill="#5a606c"/><circle cx="-9" cy="-9" r="1.8" fill="#7dff7d"><animate attributeName="opacity" values=".3;1;.3" dur="2.4s" repeatCount="indefinite"/></circle>'

const starDestroyer = () =>
  '<polygon points="70,0 -64,-17 -64,17" fill="#8e94a2"/><polygon points="70,0 -64,-17 -40,0" fill="#a9afbc"/><path d="M-46 -12 L50 -1 M-46 12 L50 1 M-20 -6 L-20 6 M10 -3 L10 3" stroke="#6a707c" stroke-width="1" fill="none"/>' +
  '<rect x="-58" y="-5" width="16" height="10" fill="#7a808c"/><rect x="-54" y="-9" width="5" height="4" fill="#6a707c"/><rect x="-48" y="-9" width="5" height="4" fill="#6a707c"/>' +
  [-9, 0, 9].map(y => `<circle cx="-66" cy="${y}" r="3.4" fill="#7fd0ff"><animate attributeName="opacity" values=".6;1;.6" dur=".8s" repeatCount="indefinite"/></circle>`).join('')

const xWing = () =>
  '<path d="M-9 -2 L-3 -2 L-5 -19 L-13 -19Z M-9 2 L-3 2 L-5 19 L-13 19Z" fill="#cfd4de"/><rect x="-14" y="-21" width="9" height="3" rx="1" fill="#8a909c"/><rect x="-14" y="18" width="9" height="3" rx="1" fill="#8a909c"/>' +
  '<path d="M18 0 L2 -3.4 L-10 -3 L-12 0 L-10 3 L2 3.4Z" fill="#e8eaf0"/><ellipse cx="6" cy="0" rx="3" ry="1.6" fill="#2a3550"/><path d="M-3 -19 l3 0 M-3 19 l3 0" stroke="#d94f4f" stroke-width="2"/>' +
  '<circle cx="-13" cy="0" r="2.6" fill="#ff8a5c"><animate attributeName="opacity" values="1;.4;1" dur=".2s" repeatCount="indefinite"/></circle>'

const tieFighter = () =>
  '<path d="M-11 0 H11" stroke="#5a606c" stroke-width="2"/>' +
  '<polygon points="-11,-14 -4,-7 -4,7 -11,14 -18,7 -18,-7" fill="#3a3f4c" stroke="#8a909c" stroke-width="1"/><polygon points="11,-14 18,-7 18,7 11,14 4,7 4,-7" fill="#3a3f4c" stroke="#8a909c" stroke-width="1"/>' +
  '<path d="M-11 -14 V14 M-18 0 H-4 M11 -14 V14 M4 0 H18" stroke="#8a909c" stroke-width=".8"/>' +
  '<circle r="5.6" fill="#6a707c" stroke="#aab0bc" stroke-width="1"/><circle r="2.4" fill="#1a1e2a"/>'

const bolts = (lag: number) =>
  [0, 1].map(k => `<path d="M0 0 H12" stroke="#ff4040" stroke-width="2.4" stroke-linecap="round" opacity="0"><animateTransform attributeName="transform" type="translate" values="16 ${k ? 4 : -4};110 ${k ? 4 : -4}" dur=".7s" begin="${n(lag + k * 0.35)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" dur=".7s" begin="${n(lag + k * 0.35)}s" repeatCount="indefinite"/></path>`).join('')

const falcon = () =>
  '<ellipse rx="15" ry="13" fill="#b8bcc6" stroke="#7a808c" stroke-width="1.2"/><path d="M13 -7 L28 -5 L28 -2 L14 -2Z M13 7 L28 5 L28 2 L14 2Z" fill="#a0a5b0" stroke="#7a808c" stroke-width="1"/>' +
  '<path d="M-10 -9 L10 -5 M-10 9 L10 5 M-12 0 H10 M0 -12 V12" stroke="#8a909c" stroke-width=".9" fill="none"/><circle cx="2" cy="0" r="4" fill="#9aa0ac" stroke="#7a808c" stroke-width="1"/>' +
  '<rect x="6" y="10" width="14" height="5" rx="2.4" fill="#8a909c"/><circle cx="19" cy="12.4" r="1.8" fill="#2a3550"/>' +
  '<rect x="-19" y="-7" width="5" height="14" fill="#7fd0ff"><animate attributeName="opacity" values="1;.5;1" dur=".3s" repeatCount="indefinite"/></rect>'

const wrap = (kind: number, starts: number[], body: string) => {
  const life = LIFE[kind]
  const begin = starts.map(t => `${n(t)}s`).join(';')

  return (
    `<g data-visitor="${kind}" display="none"><animate attributeName="display" values="inline;inline" calcMode="discrete" dur="${life}s" begin="${begin}"/>` +
    `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.08;.9;1" dur="${life}s" begin="${begin}" fill="freeze"/>${body}</g></g>`
  )
}

const visitor = (v: Slot, starts: number[], y0: number) => {
  const B = (lag = 0) => starts.map(t => `${n(t + lag)}s`).join(';')
  const r = (k: number) => rnd(v.seed + k)
  const life = LIFE[v.kind]
  const dur = life - 0.6
  const top = Math.max(y0 + 50, 60)
  const px = 50 + r(1) * 300
  // the Earth fills the middle of the sky, so things pass above it or in the strip under it
  const useUpper = top < 380 && r(2) < 0.82
  const lowerFrom = Math.max(top, 800)
  const py = useUpper ? top + r(6) * (400 - top) : lowerFrom + r(6) * (890 - lowerFrom)
  const dir = r(3) < 0.5 ? 1 : -1
  const [from, to] = dir === 1 ? [-50, 450] : [450, -50]

  switch (v.kind) {
    case 0: {
      const x = 80 + r(4) * 280

      return wrap(
        0,
        starts,
        `<g><animateTransform attributeName="transform" type="translate" values="${n(x)} ${n(py)};${n(x - 190)} ${n(py + 130)}" dur="${dur}s" begin="${B()}" fill="freeze"/>` +
          '<path d="M0 0 L40 -28" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/><path d="M0 0 L90 -63" stroke="#cfe0ff" stroke-width="1" opacity=".4"/><circle r="2.6" fill="#fff"/></g>',
      )
    }
    case 1:
      return wrap(
        1,
        starts,
        `<g transform="translate(${n(px)} ${n(py)})"><g><animateTransform attributeName="transform" type="scale" values="0 0;1 1;1.3 1.3;1.1 1.1" keyTimes="0;.15;.4;1" dur="${dur}s" begin="${B()}" fill="freeze"/>` +
          '<circle r="40" fill="#ffe9a8" opacity=".25"/><circle r="22" fill="#fff6c8" opacity=".6"/><circle r="9" fill="#fff"/>' +
          Array.from({ length: 8 }, (_, k) => `<path d="M0 0 L${n(Math.cos((k * Math.PI) / 4) * 64)} ${n(Math.sin((k * Math.PI) / 4) * 64)}" stroke="${k % 2 ? '#9fd0ff' : '#fff3c8'}" stroke-width="${k % 2 ? 1.4 : 2.4}" opacity=".7"/>`).join('') +
          `</g><circle r="6" fill="none" stroke="#9fd0ff" stroke-width="2"><animate attributeName="r" values="6;110" dur="${dur}s" begin="${B()}" fill="freeze"/><animate attributeName="opacity" values=".9;0" dur="${dur}s" begin="${B()}" fill="freeze"/></circle></g>`,
      )
    case 2:
      return wrap(
        2,
        starts,
        `<g transform="translate(${n(px)} ${n(py)}) rotate(${n(-18 + r(5) * 36)})"><g><animateTransform attributeName="transform" type="scale" values="0 0;1 1;1 1;0 0" keyTimes="0;.15;.85;1" dur="${dur}s" begin="${B()}" fill="freeze"/>` +
          '<circle r="40" fill="#fff" opacity=".07"/><ellipse rx="62" ry="17" fill="none" stroke="#ff9a3c" stroke-width="7" opacity=".85"/><ellipse rx="62" ry="17" fill="none" stroke="#fff2c8" stroke-width="2.4"/>' +
          '<circle r="25" fill="#000" stroke="#fff" stroke-width="1" opacity=".95"/><path d="M-62 0 A62 17 0 0 0 62 0" fill="none" stroke="#ffd27a" stroke-width="5"/><path d="M-62 0 A62 17 0 0 0 62 0" fill="none" stroke="#fff" stroke-width="1.6"/>' +
          '<circle r="36" fill="none" stroke="#cfe0ff" stroke-width="1" stroke-dasharray="2 6" opacity=".6"/></g></g>',
      )
    case 3: {
      const path = `M${from} ${n(py + 60)} C${n(from + (to - from) * 0.3)} ${n(py - 60)} ${n(from + (to - from) * 0.6)} ${n(py + 80)} ${to} ${n(py - 40)}`

      return wrap(
        3,
        starts,
        `<g><animateMotion path="${path}" rotate="auto" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(1 ${dir})">` +
          '<path d="M-12 -4 L-20 -9 L-20 -3Z M-12 4 L-20 9 L-20 3Z" fill="#d94f4f"/><rect x="-14" y="-4" width="22" height="8" rx="2" fill="#f4f1ea"/><path d="M8 -4 Q18 0 8 4Z" fill="#d94f4f"/><circle cx="0" cy="0" r="1.8" fill="#7fd0ff"/>' +
          '<path d="M-14 0 L-34 -3 L-30 0 L-34 3Z" fill="#ffb347"><animate attributeName="opacity" values="1;.4;1" dur=".22s" repeatCount="indefinite"/></path></g></g>',
      )
    }
    case 4:
      return wrap(
        4,
        starts,
        `<g><animateTransform attributeName="transform" type="translate" values="${from} ${n(py)};${to} ${n(py + 30)}" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(${dir} 1)"><g><animateTransform attributeName="transform" type="rotate" values="-8;8;-8" dur="9s" repeatCount="indefinite"/>` +
          '<rect x="-5" y="-4" width="10" height="8" rx="1.5" fill="#cfd6e4"/><path d="M-5 0 H-22 M5 0 H22" stroke="#8a96ad" stroke-width="1.2"/><rect x="-34" y="-5" width="12" height="10" fill="#3f6fd0"/><rect x="22" y="-5" width="12" height="10" fill="#3f6fd0"/>' +
          '<circle cy="-8" r="2.6" fill="#e8eaf0"/><circle cy="4" r="1.2" fill="#ff6a6a"><animate attributeName="opacity" values="1;.1;1" dur="1.6s" repeatCount="indefinite"/></circle></g></g></g>',
      )
    case 5: {
      const path = `M${from} ${n(py)} C${n(from + (to - from) * 0.2)} ${n(py - 80)} ${n(from + (to - from) * 0.32)} ${n(py + 80)} ${n(from + (to - from) * 0.5)} ${n(py)} C${n(from + (to - from) * 0.66)} ${n(py - 70)} ${n(from + (to - from) * 0.8)} ${n(py + 60)} ${to} ${n(py - 20)}`

      return wrap(
        5,
        starts,
        `<g><animateMotion path="${path}" dur="${dur}s" begin="${B()}" fill="freeze"/><g><animateTransform attributeName="transform" type="rotate" values="-8;8;-8" dur="1.8s" repeatCount="indefinite"/>` +
          '<polygon points="-4,6 4,6 22,70 -22,70" fill="#b4ffb4" opacity="0"><animate attributeName="opacity" values="0;0;.35;.35;0;0" keyTimes="0;.4;.45;.6;.65;1" dur="' + dur + 's" begin="' + B() + '" fill="freeze"/></polygon>' +
          '<ellipse cx="0" cy="-5" rx="11" ry="8" fill="#7fe8ff" opacity=".8"/><ellipse rx="26" ry="7" fill="#aab4c8"/><ellipse cx="0" cy="3" rx="22" ry="3" fill="#7a849a"/>' +
          [-16, -8, 0, 8, 16].map((x, k) => `<circle cx="${x}" cy="1" r="1.8" fill="${pick(['#ff6a6a', '#ffd45e', '#6aff9a'], k)}"><animate attributeName="opacity" values="1;.2;1" dur="${n(0.8 + k * 0.15)}s" repeatCount="indefinite"/></circle>`).join('') +
          '</g></g>',
      )
    }
    case 6:
      return wrap(
        6,
        starts,
        `<g><animateTransform attributeName="transform" type="translate" values="${n(px)} ${n(py)};${n(px - 36)} ${n(py + 6)}" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="rotate(-18)">` +
          '<path d="M-40 0 A40 10 0 0 1 40 0" fill="none" stroke="#c9b27a" stroke-width="4"/><circle r="21" fill="#e8d3a0"/><path d="M-20 -6 Q0 -2 20 -6 M-21 4 Q0 8 21 4 M-16 12 Q0 15 16 12" stroke="#c9a96a" stroke-width="2" fill="none"/>' +
          '<path d="M-40 0 A40 10 0 0 0 40 0" fill="none" stroke="#d9c38a" stroke-width="4"/><path d="M-30 0 A30 7 0 0 0 30 0" fill="none" stroke="#f0e2b4" stroke-width="2"/></g></g>',
      )
    case 7:
      return wrap(
        7,
        starts,
        `<g><animateTransform attributeName="transform" type="translate" values="${n(px)} ${n(py)};${n(px + 30)} ${n(py - 8)}" dur="${dur}s" begin="${B()}" fill="freeze"/>` +
          '<circle r="13" fill="#c9553a"/><ellipse cx="-3" cy="2" rx="6" ry="3" fill="#9a3a2a"/><ellipse cx="5" cy="-4" rx="4" ry="2" fill="#9a3a2a"/><ellipse cy="-12" rx="5" ry="1.6" fill="#fff" opacity=".85"/><circle cx="-5" cy="-5" r="3" fill="#fff" opacity=".12"/></g>',
      )
    case 8: {
      const id = `jp${v.id}`

      return wrap(
        8,
        starts,
        `<clipPath id="${id}"><circle r="27"/></clipPath><g><animateTransform attributeName="transform" type="translate" values="${n(px)} ${n(py)};${n(px - 30)} ${n(py + 8)}" dur="${dur}s" begin="${B()}" fill="freeze"/>` +
          `<g clip-path="url(#${id})"><circle r="27" fill="#e0b88a"/>${[-18, -9, 0, 10, 19].map((y, k) => `<rect x="-28" y="${y - 3}" width="56" height="${5 + (k % 2) * 2}" fill="${pick(['#b8794a', '#e8d0a8', '#a8683a', '#d8a878'], k)}"/>`).join('')}<ellipse cx="9" cy="6" rx="7" ry="4" fill="#c0452f"/></g></g>`,
      )
    }
    case 9:
      return wrap(
        9,
        starts,
        `<g><animateTransform attributeName="transform" type="translate" values="${n(px)} ${n(py)};${n(px + 26)} ${n(py + 10)}" dur="${dur}s" begin="${B()}" fill="freeze"/>` +
          '<circle r="17" fill="#3f6fd0"/><circle r="17" fill="none" stroke="#9fc0ff" stroke-width="1.6" opacity=".7"/><path d="M-14 -4 Q0 -8 14 -4" stroke="#cfe0ff" stroke-width="2" fill="none"/><ellipse cx="4" cy="5" rx="5" ry="3" fill="#264a9a"/>' +
          '<circle cx="28" cy="-6" r="2.4" fill="#cfd4de"><animateTransform attributeName="transform" type="rotate" values="0;360" dur="9s" repeatCount="indefinite"/></circle></g>',
      )
    case 11:
      return wrap(
        11,
        starts,
        `<g><animateTransform attributeName="transform" type="translate" values="${n(px)} ${n(py)};${n(px - 30)} ${n(py + 8)}" dur="${dur}s" begin="${B()}" fill="freeze"/>${deathStar()}` +
          `<path d="M-9 -9 L-260 -80" stroke="#7dff7d" stroke-width="3.4" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;0;1;.8;0;0" keyTimes="0;.55;.58;.66;.7;1" dur="${dur}s" begin="${B()}" fill="freeze"/></path>` +
          `<circle cx="-9" cy="-9" r="11" fill="#7dff7d" opacity="0"><animate attributeName="opacity" values="0;0;.8;0;0" keyTimes="0;.52;.58;.7;1" dur="${dur}s" begin="${B()}" fill="freeze"/></circle></g>`,
      )
    case 12:
      return wrap(
        12,
        starts,
        `<g><animateTransform attributeName="transform" type="translate" values="${from} ${n(py)};${to} ${n(py + 24)}" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(${dir} 1)">${starDestroyer()}</g></g>`,
      )
    case 13: {
      const path = `M${from} ${n(py + 40)} C${n(from + (to - from) * 0.3)} ${n(py - 50)} ${n(from + (to - from) * 0.6)} ${n(py + 60)} ${to} ${n(py - 30)}`
      const ship = (draw: string, lag: number, dy: number, shooting = false) =>
        `<g transform="translate(0 ${dy})"><g><animateMotion path="${path}" rotate="auto" dur="${dur}s" begin="${B(lag)}" fill="freeze"/><g transform="scale(1 ${dir})">${draw}${shooting ? bolts(0) : ''}</g></g></g>`

      return wrap(13, starts, ship(xWing(), -1.8, 0) + ship(tieFighter(), -0.9, 10, true) + ship(tieFighter(), 0, -8, true))
    }
    case 14:
      return wrap(
        14,
        starts,
        `<g><animateTransform attributeName="transform" type="translate" values="${from} ${n(py)};${to} ${n(py - 40)}" dur="${dur}s" begin="${B()}" fill="freeze"/><g transform="scale(${dir} 1)"><g><animateTransform attributeName="transform" type="rotate" values="-10;10;-10" dur="3s" repeatCount="indefinite"/>${falcon()}</g></g></g>`,
      )
    default: {
      const x = 90 + r(4) * 250

      return wrap(
        10,
        starts,
        `<g><animateTransform attributeName="transform" type="translate" values="${n(x + 120)} ${n(py - 80)};${n(x - 160)} ${n(py + 120)}" dur="${dur}s" begin="${B()}" fill="freeze"/>` +
          '<path d="M0 0 L120 -80 L110 -92Z" fill="#cfe8ff" opacity=".35"/><path d="M0 0 L80 -52" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/><circle r="14" fill="#9fd0ff" opacity=".3"/><circle r="5.6" fill="#fff"/></g>',
      )
    }
  }
}

const buildScene = (w: Moon, elapsed: number, vh: number) => {
  const view = Math.min(H, Math.max(vh, 300))
  const y0 = H - view
  // visitors come more often while Claude works
  const gap: [number, number] = w.working ? [40, 40] : [140, 120]

  // Lay out every visit, then thin them out so that at most a few are ever on screen together.
  const MOST = w.working ? 7 : 3
  const events: { kind: number; t: number }[] = []
  for (let kind = 0; kind < KINDS; kind++) {
    for (let t = Math.random() * gap[0] * 1.4; t < HORIZON_SECONDS; t += gap[0] + Math.random() * gap[1]) events.push({ kind, t })
  }
  events.sort((x, y) => x.t - y.t)
  // one is due at once, so the sky is never empty
  const first = Math.floor(Math.random() * KINDS)
  const kept: { kind: number; t: number }[] = [{ kind: first, t: 0.4 }]
  for (const e of events) {
    const end = e.t + LIFE[e.kind]
    // never two of the same kind together
    if (kept.some(k => k.kind === e.kind && k.t < end && e.t < k.t + LIFE[k.kind])) continue
    // the busiest moment of its stay, counting what is already kept
    const edges = [e.t, ...kept.filter(k => k.t > e.t && k.t < end).map(k => k.t)]
    const busiest = Math.max(...edges.map(at => kept.filter(k => k.t <= at && at < k.t + LIFE[k.kind]).length + 1))
    if (busiest <= MOST) kept.push(e)
  }
  const slots: { v: Slot; starts: number[] }[] = []
  for (let kind = 0; kind < KINDS; kind++) {
    const starts = kept.filter(k => k.kind === kind).map(k => k.t)
    slots.push({ v: { id: kind, kind, seed: Math.floor(Math.random() * 1_000_000) }, starts })
  }
  const drawn = slots.map(x => visitor(x.v, x.starts, y0)).join('')

  const defs =
    '<defs>' +
    '<linearGradient id="space" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02030c"/><stop offset=".6" stop-color="#070a1c"/><stop offset="1" stop-color="#0d1230"/></linearGradient>' +
    '<linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f9be0"/><stop offset="1" stop-color="#1a4fa0"/></linearGradient>' +
    '<linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></linearGradient>' +
    '<linearGradient id="regolith" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a4a4b0"/><stop offset="1" stop-color="#55555f"/></linearGradient>' +
    '<linearGradient id="visor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8c25a"/><stop offset="1" stop-color="#8a5a1a"/></linearGradient>' +
    `<clipPath id="earth"><circle cx="${EARTH_AT[0]}" cy="${EARTH_AT[1]}" r="${R}"/></clipPath>` +
    '</defs>'

  const sky = `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#space)"/>` + MILKY + STARS + EARTH
  const ground =
    GROUND +
    FLAG +
    `<g transform="translate(70 ${GY})">${lander(w.working)}</g>` +
    ASTRO_SHADOW +
    `<g><animateMotion path="${hopPath(w.working ? 270 : 130)}" dur="34s" repeatCount="indefinite" calcMode="linear"/>${astronaut(w.working)}</g>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${n(y0)} ${W} ${n(view)}" width="${W}" height="${n(view)}" preserveAspectRatio="xMidYMax slice">${defs}` +
    `<rect x="0" y="${n(y0)}" width="${W}" height="${n(view)}" fill="#02030c"/>` +
    retime(sky, elapsed) +
    drawn +
    retime(ground, elapsed) +
    '</svg>'
  )
}
// ---scene-end

const TERMINAL_ART: [string, string][] = [
  ['   ✦    ✧        ✦', '#cfd8ff'],
  ['      ✧     ◖██◗  ✦', '#4f9be0'],
  ['   ✦        ◖██◗', '#4f9be0'],
  ['  ✧      ✦   ☄', '#cfd8ff'],
  ['      🛸', '#b4ffb4'],
  ['  ▁▂▃▂▁ ⛺ 🧑‍🚀 ▁▂▃▂▁', '#a4a4b0'],
  ['▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓', '#7a7a86'],
]

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))

  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const label = (w: Moon, now: number, T: Words) => (w.working ? T.working(clock(now - w.startedAt), w.tools) : T.idle)

const moon = atom(
  { plugin: 'moon-view', key: 'surface' } as const,
  { working: false, prev: false, tools: 0, startedAt: 0, endedAt: 0, tick: 0 } as Moon,
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
      name: 'moon',
      description: 'Open the Moon pane',
    })
    // Wakes the pane each second while Claude works, for the stopwatch in its top line.
    $.clock.every(1000, () => {
      void read($, moon)
        .then(r => (r.working ? update($, moon, v => ({ ...v, tick: v.tick + 1 })) : undefined))
        .catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'moon' }, async $ => {
    await $.ui.open({ id: PANE, title: T.title })

    return { text: T.opened }
  })

  // The main loop's turns only: a subagent's run is not Claude at work.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, moon, v => ({ ...v, prev: false, working: true, tools: 0, startedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, moon, v => ({ ...v, prev: true, working: false, endedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await update($, moon, v => ({ ...v, tools: v.tools + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const w = await read($, moon)
    const now = await $.clock.now()
    if (t0 === 0) t0 = now
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 20
    const line = label(w, now, T)

    if (e.surface !== 'terminal') {
      const { Box, Text, Svg } = els as ElementTable<'desktop'>
      // The pane's px: its cells over the code font's advance (about 7.8 px) and line height
      // (about 19.5 px). Short of the whole picture, the top of the sky is cut, never the surface.
      const width = Math.max(160, Math.round(cols * 7.8))
      const full = Math.round((width * H) / W)
      const tall = e.props?.scroll?.bodyRows ? Math.round((rows - 1) * 19.5) : full
      const height = Math.min(full, tall)
      const key = `${w.working}|${w.startedAt}|${w.endedAt}|${height}|${width}`
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
