import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import type { Beach } from '../types'

const PANE = 'beach-day'
const STRINGS = {
  en: {
    title: 'Beach',
    alt: 'A top-down beach. Gentle waves wash the shore, people in sunglasses lie on sunbeds under parasols, and swimmers float on rings out at sea, a pink unicorn among them.',
    working: (clock: string, tools: number) => `Working ${clock} · tools ${tools}`,
    idle: 'Idle',
    opened: 'Opened the beach pane.',
    note: 'The animation shows in the desktop app.',
  },
  ko: {
    title: '해변',
    alt: '위에서 내려다본 해변. 잔잔한 파도가 밀려오고, 파라솔 아래 썬베드에 선글라스를 낀 사람들이 누워 있으며, 바다에는 핑크 유니콘 튜브를 비롯한 여러 튜브를 탄 사람들이 떠 있습니다.',
    working: (clock: string, tools: number) => `작업 중 ${clock} · 도구 ${tools}회`,
    idle: '쉬는 중',
    opened: '해변을 열었습니다.',
    note: '그림 움직임은 데스크톱 앱에서 보입니다.',
  },
}

type Words = (typeof STRINGS)['en']

// ---scene-start
type Ride = { working: boolean }
type Look = { skin: string; hair: string; long?: boolean; suit: string; style: 'bikini' | 'one' | 'trunks'; shades?: boolean }

const W = 400
const H = 1100
const SHORE = 660 // where the sea meets the sand

const n = (v: number) => String(Math.round(v * 10) / 10)
const EASE = '.45 0 .55 1'
const rnd = (s: number) => {
  const v = Math.sin(s * 127.1 + 311.7) * 43758.5453

  return v - Math.floor(v)
}

// Looping motion shifts back by the time already elapsed, so redrawing the picture never makes it jump.
const retime = (svg: string, elapsed: number) =>
  svg.replace(/<(animate|animateTransform|animateMotion)\b[^>]*>/g, tag => {
    const found = / begin="(-?[\d.]+)s"/.exec(tag)
    const shifted = ` begin="${n((found ? parseFloat(found[1] ?? '0') : 0) - elapsed)}s"`

    return found ? tag.replace(found[0], shifted) : tag.replace(/^<(\w+)/, `<$1${shifted}`)
  })

// ---- people, seen from above ----------------------------------------------------------------------------
const SHADES =
  '<ellipse cx="-2.6" cy=".6" rx="2.6" ry="1.8" fill="#1a1a22"/><ellipse cx="2.6" cy=".6" rx="2.6" ry="1.8" fill="#1a1a22"/>' +
  '<path d="M-.4 .3 H.4" stroke="#1a1a22" stroke-width="1"/><circle cx="-3.4" cy="0" r=".6" fill="#fff" opacity=".7"/><circle cx="1.8" cy="0" r=".6" fill="#fff" opacity=".7"/>'

const head = (p: Look) =>
  (p.long ? `<ellipse cx="0" cy="-3.4" rx="8.8" ry="10" fill="${p.hair}"/>` : `<circle cx="0" cy="-1.8" r="7" fill="${p.hair}"/>`) +
  `<circle cx="0" cy="1" r="6" fill="${p.skin}"/>` +
  (p.shades ? SHADES : '<path d="M-3.6 .4 h2 M1.6 .4 h2" stroke="#3a2a20" stroke-width="1" stroke-linecap="round"/>') +
  '<path d="M-1.6 4 q1.6 1.2 3.2 0" stroke="#a0522d" stroke-width=".8" fill="none" stroke-linecap="round"/>'

// lying on the back, head at the origin and feet toward +y
const lying = (p: Look) => {
  const suit =
    p.style === 'bikini'
      ? `<path d="M-8.4 14 Q-4.4 9.4 -.6 14 Q-4.4 19 -8.4 14Z M8.4 14 Q4.4 9.4 .6 14 Q4.4 19 8.4 14Z" fill="${p.suit}"/><path d="M-9 12.6 H9" stroke="${p.suit}" stroke-width="1"/>` +
        `<path d="M-8.8 28 H8.8 L5 36 H-5Z" fill="${p.suit}"/>`
      : p.style === 'one'
        ? `<path d="M-8.6 10 Q0 15 8.6 10 L8.8 30 L5 37 H-5 L-8.8 30Z" fill="${p.suit}"/><path d="M-8.6 22 H8.6" stroke="#fff" stroke-width="1.4" opacity=".6"/>`
        : `<rect x="-10" y="27" width="20" height="15" rx="3" fill="${p.suit}"/><path d="M0 30 V42" stroke="#000" stroke-opacity=".25"/><path d="M-10 31 H10" stroke="#fff" stroke-width="1.2" opacity=".5"/>`

  return (
    `<rect x="-6.6" y="30" width="5.6" height="38" rx="2.8" fill="${p.skin}"/><rect x="1" y="30" width="5.6" height="38" rx="2.8" fill="${p.skin}"/>` +
    `<rect x="-14.4" y="9" width="4.8" height="29" rx="2.4" fill="${p.skin}"/><rect x="9.6" y="9" width="4.8" height="29" rx="2.4" fill="${p.skin}"/>` +
    `<rect x="-9.8" y="6" width="19.6" height="31" rx="8" fill="${p.skin}"/>` +
    suit +
    head(p)
  )
}

// in a ring: only the shoulders and head above the water, arms resting on the ring
const legsBelow = (p: Look) => `<path d="M-4 6 L-7 28 M4 6 L7 28" stroke="${p.skin}" stroke-width="5" stroke-linecap="round" opacity=".35"/>`

const bather = (p: Look) => {
  const top =
    p.style === 'bikini'
      ? `<ellipse cx="-3.6" cy="3" rx="3.1" ry="2.5" fill="${p.suit}"/><ellipse cx="3.6" cy="3" rx="3.1" ry="2.5" fill="${p.suit}"/>`
      : p.style === 'one'
        ? `<path d="M-8 1 Q0 6 8 1 L7 9 Q0 12 -7 9Z" fill="${p.suit}"/>`
        : ''

  return (
    `<path d="M-7 0 L-20 -8 M7 0 L20 -8" stroke="${p.skin}" stroke-width="4.6" stroke-linecap="round"/>` +
    `<ellipse cx="0" cy="3" rx="9.4" ry="7.4" fill="${p.skin}"/>` +
    top +
    `<g transform="translate(0 -8)">${head(p)}</g>`
  )
}

// ---- the floats ---------------------------------------------------------------------------------------
const ring = (color: string, extra = '') =>
  `<circle r="20" fill="none" stroke="${color}" stroke-width="11"/>${extra}<circle r="20" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="9 24" stroke-linecap="round" opacity=".55" transform="rotate(-40)"/>`

const RAINBOW = ['#ff5a6a', '#ffa64a', '#ffe04a', '#5ad27a', '#4ab0ff', '#9a6aff']

const unicorn = (p: Look) =>
  legsBelow(p) +
  // the rainbow mane down its back, along the ring, and its tail
  RAINBOW.map((c, k) => `<path d="M${n(-7 - k * 1.4)} ${n(-26 + k * 0.6)} A${n(25 + k * 1.4)} ${n(25 + k * 1.4)} 0 0 0 ${n(-24 - k)} ${n(4 + k)}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`).join('') +
  ring('#ffa6d2') +
  RAINBOW.map((c, k) => `<path d="M0 22 L${n(-10 + k * 4)} 38" stroke="${c}" stroke-width="2.8" stroke-linecap="round"/>`).join('') +
  // its head, rising off the front of the ring
  '<path d="M-7 -20 Q-9 -34 0 -38 Q9 -34 7 -20Z" fill="#ffc4e2"/><ellipse cx="0" cy="-40" rx="9" ry="10" fill="#fff4fb"/><ellipse cx="0" cy="-48" rx="6.4" ry="5" fill="#ffd6ea"/>' +
  '<circle cx="-2.4" cy="-48.4" r=".9" fill="#c46a9a"/><circle cx="2.4" cy="-48.4" r=".9" fill="#c46a9a"/>' +
  '<path d="M-6 -41 q2 1.6 4 0 M2 -41 q2 1.6 4 0" stroke="#3a2a40" stroke-width="1.1" fill="none" stroke-linecap="round"/><circle cx="-6.6" cy="-37.6" r="1.8" fill="#ff9ec8" opacity=".7"/><circle cx="6.6" cy="-37.6" r="1.8" fill="#ff9ec8" opacity=".7"/>' +
  '<path d="M-8 -45 L-5 -52 L-3 -46Z M8 -45 L5 -52 L3 -46Z" fill="#fff4fb"/>' +
  '<path d="M-2.8 -44 L0 -62 L2.8 -44Z" fill="#ffd34a"/><path d="M-2 -48 L2 -50 M-1.4 -53 L1.4 -55 M-.8 -58 L.8 -59" stroke="#e0a020" stroke-width="1"/>' +
  bather(p)

const donut = (p: Look) =>
  legsBelow(p) +
  `<circle r="20" fill="none" stroke="#e8b070" stroke-width="12"/><circle r="20" fill="none" stroke="#ff8fbf" stroke-width="8"/>` +
  Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * Math.PI * 2 + rnd(k) * 0.2
    const rr = 18 + rnd(k + 9) * 4

    return `<rect x="-2" y="-.7" width="4" height="1.4" rx=".7" fill="${RAINBOW[k % 6]}" transform="translate(${n(Math.cos(a) * rr)} ${n(Math.sin(a) * rr)}) rotate(${Math.round(rnd(k + 20) * 180)})"/>`
  }).join('') +
  bather(p)

const duck = (p: Look) =>
  legsBelow(p) +
  ring('#ffd23f') +
  '<path d="M-5 20 L0 30 L5 20Z" fill="#ffd23f"/>' +
  '<circle cx="0" cy="-32" r="9.4" fill="#ffd23f"/><ellipse cx="0" cy="-42" rx="5.6" ry="3.6" fill="#ff8a2a"/><circle cx="-3.6" cy="-34" r="1.3" fill="#1a1a22"/><circle cx="3.6" cy="-34" r="1.3" fill="#1a1a22"/>' +
  bather(p)

const striped = (p: Look) =>
  legsBelow(p) + ring('#e84a4a', '<circle r="20" fill="none" stroke="#fff" stroke-width="11" stroke-dasharray="7.85 7.85"/>') + bather(p)

const flamingo = (p: Look) =>
  legsBelow(p) +
  ring('#ff7aa8') +
  '<path d="M0 -24 Q-8 -34 0 -40 Q8 -46 2 -52" fill="none" stroke="#ff7aa8" stroke-width="5" stroke-linecap="round"/><circle cx="1" cy="-54" r="5" fill="#ff8fb4"/>' +
  '<path d="M5 -54 Q10 -54 10 -50 L7 -51Z" fill="#1a1a22"/><path d="M5 -55 L8 -55 L7.6 -52Z" fill="#fff"/><circle cx="0" cy="-55.4" r="1" fill="#1a1a22"/>' +
  '<path d="M-6 22 L-10 30 M0 22 L0 31 M6 22 L10 30" stroke="#ff9ec0" stroke-width="3" stroke-linecap="round"/>' +
  bather(p)

// a watermelon-slice lilo and a striped one, each with someone stretched out on it (head toward -x)
const lilo = (p: Look, kind: 'melon' | 'stripes') =>
  (kind === 'melon'
    ? '<rect x="-50" y="-19" width="100" height="38" rx="18" fill="#3fae4a"/><rect x="-46" y="-15" width="92" height="30" rx="14" fill="#c8f0a0"/><rect x="-43" y="-13" width="86" height="26" rx="12" fill="#ff5a6a"/>' +
      Array.from({ length: 10 }, (_, k) => `<ellipse cx="${-36 + k * 8}" cy="${k % 2 ? 6 : -6}" rx="1.2" ry="2" fill="#2a1a1a"/>`).join('')
    : '<rect x="-50" y="-18" width="100" height="36" rx="10" fill="#4ab0ff"/>' +
      [-30, -10, 10, 30].map(x => `<rect x="${x - 4}" y="-18" width="8" height="36" fill="#fff" opacity=".8"/>`).join('') +
      '<rect x="-50" y="-18" width="22" height="36" rx="10" fill="#2f8ad8"/>') +
  `<g transform="translate(-38 0) rotate(-90)">${lying(p)}</g>`

// bobbing on the swell, turning a little, with a ripple spreading round it
const float = (x: number, y: number, k: number, inner: string, rot = 0, scale = 1) =>
  `<g transform="translate(${x} ${y})">` +
  `<circle r="30" fill="none" stroke="#fff" stroke-width="1.6" opacity="0"><animate attributeName="r" values="${n(26 * scale)};${n(48 * scale)}" dur="3.6s" begin="${n(-k * 0.7)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".5;0" dur="3.6s" begin="${n(-k * 0.7)}s" repeatCount="indefinite"/></circle>` +
  `<g><animateTransform attributeName="transform" type="translate" values="0 0;3 -2;0 2;-2 0;0 0" dur="${7 + (k % 3)}s" begin="${n(-k * 1.3)}s" repeatCount="indefinite"/>` +
  `<g transform="scale(${scale})"><g><animateTransform attributeName="transform" type="rotate" values="${rot - 5};${rot + 5};${rot - 5}" calcMode="spline" keyTimes="0;.5;1" keySplines="${EASE};${EASE}" dur="${11 + k}s" begin="${n(-k * 2)}s" repeatCount="indefinite"/>` +
  `<ellipse cx="6" cy="7" rx="28" ry="26" fill="#0a3a5a" opacity=".16"/>${inner}</g></g></g></g>`

const SWIMMERS =
  float(84, 210, 0, flamingo({ skin: '#f1c7a0', hair: '#e8c070', long: true, suit: '#ff4a8a', style: 'bikini', shades: true }), 10) +
  float(236, 214, 1, lilo({ skin: '#d9a074', hair: '#2a1a10', long: true, suit: '#ffd23f', style: 'bikini', shades: true }, 'melon'), 0) +
  float(300, 286, 2, duck({ skin: '#f6d5b8', hair: '#6a3a1a', long: true, suit: '#2fb8a8', style: 'one' }), -8) +
  float(354, 330, 3, striped({ skin: '#d9a074', hair: '#111', suit: '#2a5a9a', style: 'trunks', shades: true }), 20) +
  float(150, 392, 4, unicorn({ skin: '#f1c7a0', hair: '#c4572a', long: true, suit: '#9a4aff', style: 'bikini', shades: true }), 0, 1.15) +
  float(296, 462, 5, donut({ skin: '#a8724a', hair: '#111', suit: '#e84a4a', style: 'trunks' }), 30) +
  float(96, 540, 6, lilo({ skin: '#f1c7a0', hair: '#6a3a1a', suit: '#ff8a2a', style: 'trunks', shades: true }, 'stripes'), 6)

// someone just swimming near the shore, arms turning over
const SWIMMER =
  '<g transform="translate(330 572)"><animateTransform attributeName="transform" type="translate" values="330 572;250 566;330 572" dur="40s" repeatCount="indefinite"/>' +
  '<path d="M0 0 L22 2" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>' +
  '<g><animateTransform attributeName="transform" type="rotate" values="0;360" dur="1.6s" repeatCount="indefinite"/><path d="M0 -12 V12" stroke="#d9a074" stroke-width="4" stroke-linecap="round"/></g>' +
  '<ellipse cx="2" cy="0" rx="8" ry="5" fill="#d9a074"/><circle cx="-4" cy="0" r="5.4" fill="#2a1a10"/><path d="M-8 -2 a4 4 0 0 1 0 4" fill="#ffd23f"/></g>'

// ---- the sea: deep water, the swell rolling in, glints, the shore washing up and back --------------------
const SPARKLES = Array.from({ length: 22 }, (_, k) => {
  const x = 10 + rnd(k + 600) * 380
  const y = 20 + rnd(k + 640) * (SHORE - 90)

  return `<path d="M${n(x)} ${n(y - 3)} L${n(x + 1)} ${n(y)} L${n(x)} ${n(y + 3)} L${n(x - 1)} ${n(y)}Z" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;.9;0;0" keyTimes="0;.1;.2;1" dur="${n(3 + rnd(k + 680) * 4)}s" begin="${n(-rnd(k + 700) * 6)}s" repeatCount="indefinite"/></path>`
}).join('')

const crest = (k: number, dur: number) =>
  `<path d="M-40 0 Q10 -7 60 0 T160 0 T260 0 T360 0 T460 0" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0">` +
  `<animateTransform attributeName="transform" type="translate" values="${k % 2 ? -20 : 0} 300;${k % 2 ? 0 : -20} ${SHORE - 14}" dur="${dur}s" begin="${n((-k * dur) / 4)}s" repeatCount="indefinite"/>` +
  `<animate attributeName="opacity" values="0;.5;.5;0" keyTimes="0;.2;.85;1" dur="${dur}s" begin="${n((-k * dur) / 4)}s" repeatCount="indefinite"/></path>`

const shoreWash = (dur: number) =>
  `<g><animateTransform attributeName="transform" type="translate" values="0 -8;0 16;0 -8" keyTimes="0;.5;1" calcMode="spline" keySplines="${EASE};${EASE}" dur="${dur}s" repeatCount="indefinite"/>` +
  `<path d="M0 ${SHORE - 40} V${SHORE + 6} Q50 ${SHORE + 16} 100 ${SHORE + 8} T200 ${SHORE + 12} T300 ${SHORE + 6} T400 ${SHORE + 12} V${SHORE - 40}Z" fill="#8fe3d6" opacity=".85"/>` +
  `<path d="M0 ${SHORE + 6} Q50 ${SHORE + 16} 100 ${SHORE + 8} T200 ${SHORE + 12} T300 ${SHORE + 6} T400 ${SHORE + 12}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9"/>` +
  `<path d="M0 ${SHORE - 2} Q60 ${SHORE + 6} 120 ${SHORE} T240 ${SHORE + 4} T400 ${SHORE}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 9" opacity=".7"/></g>`

// ---- the sand ---------------------------------------------------------------------------------------------
const SAND_DOTS = Array.from({ length: 70 }, (_, k) => `<circle cx="${n(rnd(k + 800) * 400)}" cy="${n(SHORE + 40 + rnd(k + 900) * (H - SHORE - 40))}" r="${n(0.8 + rnd(k + 1000))}" fill="#c9a86a" opacity=".5"/>`).join('')

const parasol = (x: number, y: number, a: string, b: string, k: number, r = 44) => {
  const wedges = Array.from({ length: 8 }, (_, i) => {
    const a0 = (i / 8) * Math.PI * 2
    const a1 = ((i + 1) / 8) * Math.PI * 2

    return `<path d="M0 0 L${n(Math.cos(a0) * r)} ${n(Math.sin(a0) * r)} A${r} ${r} 0 0 1 ${n(Math.cos(a1) * r)} ${n(Math.sin(a1) * r)}Z" fill="${i % 2 ? b : a}"/>`
  }).join('')

  return (
    `<ellipse cx="${x + 16}" cy="${y + 14}" rx="${r}" ry="${r * 0.92}" fill="#8a6a3a" opacity=".28"/>` +
    `<g transform="translate(${x} ${y})"><g><animateTransform attributeName="transform" type="rotate" values="-3;3;-3" calcMode="spline" keyTimes="0;.5;1" keySplines="${EASE};${EASE}" dur="${8 + k}s" begin="${-k * 2}s" repeatCount="indefinite"/>` +
    `${wedges}<circle r="${r}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="1.4"/>` +
    Array.from({ length: 8 }, (_, i) => `<path d="M0 0 L${n(Math.cos((i / 8) * Math.PI * 2) * r)} ${n(Math.sin((i / 8) * Math.PI * 2) * r)}" stroke="#000" stroke-opacity=".1"/>`).join('') +
    '<circle r="4" fill="#fff"/><circle r="2" fill="#bbb"/></g></g>'
  )
}

const sunbed = (x: number, y: number, cushion: string, p: Look) =>
  `<rect x="${x - 15}" y="${y + 6}" width="34" height="92" rx="4" fill="#8a6a3a" opacity=".25"/>` +
  `<rect x="${x - 18}" y="${y}" width="36" height="92" rx="4" fill="#f4f4f0"/><rect x="${x - 15}" y="${y + 3}" width="30" height="86" rx="3" fill="${cushion}"/>` +
  Array.from({ length: 6 }, (_, k) => `<path d="M${x - 15} ${y + 16 + k * 13} H${x + 15}" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>`).join('') +
  `<g transform="translate(${x} ${y + 14})">${lying(p)}</g>`

const towel = (x: number, y: number, a: string, b: string, p: Look) =>
  `<g transform="translate(${x} ${y}) rotate(-6)"><rect x="-19" y="0" width="38" height="92" rx="2" fill="${a}"/>` +
  [14, 34, 54, 74].map(t => `<rect x="-19" y="${t}" width="38" height="8" fill="${b}"/>`).join('') +
  `<g transform="translate(0 14)">${lying(p)}</g></g>`

const BEACH_THINGS =
  // a sandcastle with a flag, a bucket and spade, a beach ball, a cooler, flip-flops and footprints
  '<g transform="translate(244 1000)"><rect x="-22" y="-14" width="44" height="28" rx="3" fill="#e2bf7c"/><rect x="-26" y="-18" width="14" height="14" fill="#d8b06a"/><rect x="12" y="-18" width="14" height="14" fill="#d8b06a"/><rect x="-26" y="4" width="14" height="14" fill="#d8b06a"/><rect x="12" y="4" width="14" height="14" fill="#d8b06a"/><rect x="-8" y="-8" width="16" height="16" fill="#cfa45c"/><path d="M0 -8 V-24" stroke="#6a4a2a" stroke-width="1.4"/><path d="M0 -24 L10 -20 L0 -16Z" fill="#e84a4a"><animate attributeName="d" values="M0 -24 L10 -20 L0 -16Z;M0 -24 L9 -22 L0 -16Z;M0 -24 L10 -20 L0 -16Z" dur="1.2s" repeatCount="indefinite"/></path></g>' +
  '<g transform="translate(292 1028)"><circle r="10" fill="#4ab0ff"/><circle r="7" fill="#7fd0ff"/><path d="M8 -6 L22 -16" stroke="#ffd23f" stroke-width="3" stroke-linecap="round"/><rect x="18" y="-22" width="8" height="10" rx="2" fill="#ffd23f" transform="rotate(30 22 -17)"/></g>' +
  '<g transform="translate(340 960)"><circle r="13" fill="#fff"/><path d="M0 -13 A13 13 0 0 1 11.3 6.5 L0 0Z" fill="#e84a4a"/><path d="M11.3 6.5 A13 13 0 0 1 -11.3 6.5 L0 0Z" fill="#4ab0ff"/><circle r="3" fill="#ffd23f"/><circle cx="-4" cy="-6" r="2.4" fill="#fff" opacity=".7"/></g>' +
  '<g transform="translate(352 1052) rotate(12)"><rect x="-20" y="-13" width="40" height="26" rx="4" fill="#2f8ad8"/><rect x="-20" y="-13" width="40" height="9" rx="3" fill="#fff"/><rect x="-6" y="-16" width="12" height="4" rx="2" fill="#ddd"/></g>' +
  '<g transform="translate(206 1066)"><ellipse cx="0" cy="0" rx="4.6" ry="10" fill="#ff5a8a" transform="rotate(-10)"/><ellipse cx="11" cy="2" rx="4.6" ry="10" fill="#ff5a8a" transform="rotate(14 11 2)"/></g>' +
  Array.from({ length: 9 }, (_, k) => `<ellipse cx="${n(210 + k * 4 + (k % 2) * 8)}" cy="${SHORE + 40 + k * 26}" rx="3" ry="5" fill="#c9a86a" opacity=".55"/>`).join('')

// ---- overhead: gulls and their shadows; out at sea a sailing boat ---------------------------------------
const gull = (path: string, dur: number, begin: number) =>
  [0, 1]
    .map(s => {
      const wing = s ? '#6a5a3a' : '#fff'
      const off = s ? 'translate(18 24)' : ''

      return (
        `<g transform="${off}" opacity="${s ? 0.18 : 1}"><g><animateMotion path="${path}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>` +
        `<path d="M-11 0 Q-5 -6 0 0 Q5 -6 11 0" fill="none" stroke="${wing}" stroke-width="2.4" stroke-linecap="round"><animate attributeName="d" values="M-11 0 Q-5 -6 0 0 Q5 -6 11 0;M-11 -3 Q-5 2 0 0 Q5 2 11 -3;M-11 0 Q-5 -6 0 0 Q5 -6 11 0" dur=".8s" repeatCount="indefinite"/></path>${s ? '' : '<circle r="2" fill="#fff"/>'}</g></g>`
      )
    })
    .join('')

const GULLS =
  gull('M-30 900 C120 760 260 820 440 620 L440 620 L440 620 L440 620', 34, -6) +
  gull('M430 300 C300 380 160 300 -40 420 L-40 420 L-40 420', 46, -20)

const SAILBOAT =
  '<g><animateTransform attributeName="transform" type="translate" values="-40 46;440 30" dur="160s" begin="-50s" repeatCount="indefinite"/>' +
  '<path d="M-12 0 Q0 6 14 0 L10 -3 H-10Z" fill="#fff"/><path d="M0 -2 L-2 -24 L12 -4Z" fill="#fff"/><path d="M-1 -4 L-3 -18 L-10 -5Z" fill="#ffd23f"/>' +
  '<path d="M-14 1 L-40 3" stroke="#fff" stroke-width="1.6" opacity=".5"/></g>'

// ---- while Claude works: a jet ski cuts across and a banana boat is towed past --------------------------
const JETSKI =
  '<g><animateTransform attributeName="transform" type="translate" values="-90 132;-90 132;600 120;600 120" keyTimes="0;.1;.55;1" dur="15s" begin="-3s" repeatCount="indefinite"/>' +
  '<path d="M-16 0 L-110 -18 M-16 0 L-110 18" stroke="#fff" stroke-width="2" opacity=".6"/><path d="M-16 0 H-90" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".7"/>' +
  '<path d="M-16 -7 H8 Q18 0 8 7 H-16Z" fill="#e84a4a"/><path d="M-12 -4 H2 V4 H-12Z" fill="#fff"/>' +
  '<ellipse cx="-6" cy="0" rx="6" ry="5" fill="#2a5a9a"/><circle cx="-4" cy="0" r="4" fill="#2a1a10"/><path d="M-2 -5 L4 -7 M-2 5 L4 7" stroke="#d9a074" stroke-width="2.6" stroke-linecap="round"/></g>'

const BANANA =
  '<g><animateTransform attributeName="transform" type="translate" values="520 64;520 64;-260 80;-260 80" keyTimes="0;.15;.75;1" dur="24s" begin="-2s" repeatCount="indefinite"/>' +
  '<path d="M18 0 L100 -12 M18 0 L100 12" stroke="#fff" stroke-width="2" opacity=".6"/><path d="M-12 -6 H12 Q22 0 12 6 H-12Z" fill="#fff"/><path d="M-22 0 Q-16 -10 -8 -6 L-8 6 Q-16 10 -22 0Z" fill="#fff"/><circle cx="2" cy="0" r="4" fill="#111"/>' +
  '<path d="M14 0 H54" stroke="#ddd" stroke-width="1"/>' +
  '<g transform="translate(90 0)"><path d="M-36 -8 Q0 -14 38 -6 Q44 0 38 6 Q0 14 -36 8 Q-42 0 -36 -8Z" fill="#ffd23f"/><path d="M-30 0 H32" stroke="#e8b020" stroke-width="2"/>' +
  [-22, -6, 10, 26].map((x, k) => `<circle cx="${x}" cy="0" r="5.4" fill="${['#2a1a10', '#e8c070', '#6a3a1a', '#111'][k]}"/><path d="M${x - 4} -6 L${x + 2} -10 M${x - 4} 6 L${x + 2} 10" stroke="${['#f1c7a0', '#f6d5b8', '#d9a074', '#a8724a'][k]}" stroke-width="2.4" stroke-linecap="round"/>`).join('') +
  '</g></g>'

// ---- while Claude works: crabs scuttle sideways over the sand, stopping now and then ----------------
const crab = (x: number, y: number, span: number, dur: number, begin: number, scale = 1) => {
  const legs = [-1, 1]
    .map(s =>
      [0, 1, 2]
        .map(i => `<path d="M${s * 7} ${-1 + i * 3} q${s * 6} ${-2 + i * 2} ${s * 9} ${3 + i * 2}" fill="none" stroke="#c8401f" stroke-width="1.6" stroke-linecap="round"/>`)
        .join(''),
    )
    .map((g, k) => `<g><animateTransform attributeName="transform" type="rotate" values="${k ? -8 : 8};${k ? 8 : -8};${k ? -8 : 8}" dur=".24s" repeatCount="indefinite"/>${g}</g>`)
    .join('')
  const claws = [-1, 1]
    .map(
      s =>
        `<path d="M${s * 5} -5 L${s * 9} -11" stroke="#e8502e" stroke-width="2.2" stroke-linecap="round"/>` +
        `<g transform="translate(${s * 10} -13)"><ellipse rx="3.6" ry="3" fill="#e8502e"/><path d="M${s * -1} -2 L${s * 1} -5.4 L${s * 2.6} -2" fill="#c8401f">` +
        `<animateTransform attributeName="transform" type="rotate" values="0;${s * 14};0" dur="1.1s" begin="${n(-begin)}s" repeatCount="indefinite"/></path></g>`,
    )
    .join('')

  return (
    `<g transform="translate(${x} ${y}) scale(${scale})"><g>` +
    `<animateTransform attributeName="transform" type="translate" values="0 0;${span} 0;${span} 0;${n(span * 0.4)} 0;${n(span * 0.4)} 0;0 0" keyTimes="0;.3;.45;.65;.8;1" calcMode="spline" keySplines="${EASE};${EASE};${EASE};${EASE};${EASE}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>` +
    `<ellipse cx="2" cy="3" rx="11" ry="7.4" fill="#8a6a3a" opacity=".22"/>${legs}${claws}` +
    '<ellipse rx="9.4" ry="6.8" fill="#e8502e"/><ellipse cx="-2" cy="-1.6" rx="5" ry="2.6" fill="#ff7a52" opacity=".7"/>' +
    '<path d="M-3 -6 V-9 M3 -6 V-9" stroke="#c8401f" stroke-width="1.2"/><circle cx="-3" cy="-9.6" r="1.6" fill="#1a1a22"/><circle cx="3" cy="-9.6" r="1.6" fill="#1a1a22"/>' +
    '<circle cx="-3.4" cy="-10" r=".5" fill="#fff"/><circle cx="2.6" cy="-10" r=".5" fill="#fff"/></g></g>'
  )
}

// on the wet sand by the water, between the sunbeds, and by the sandcastle
const CRABS = crab(176, 716, 90, 9, -1) + crab(210, 880, -70, 11, -5, 0.9) + crab(320, 1082, -70, 8, -3, 0.8)

// ---- the whole picture --------------------------------------------------------------------------------
const buildScene = (w: Ride, elapsed: number, vh: number) => {
  const view = Math.min(H, Math.max(vh, 240))
  // a short pane trims the open sea above and the sand below in equal measure
  const y0 = (H - view) / 2
  const busy = w.working

  const defs =
    '<defs>' +
    `<linearGradient id="sea" x1="0" y1="0" x2="0" y2="${SHORE}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1c6aa8"/><stop offset=".55" stop-color="#22a4c4"/><stop offset="1" stop-color="#5fd6cc"/></linearGradient>` +
    '</defs>'

  const sea =
    `<rect x="0" y="0" width="${W}" height="${SHORE + 30}" fill="url(#sea)"/>` +
    // light netting on the sandy bottom of the shallows
    Array.from({ length: 6 }, (_, k) => `<path d="M-20 ${SHORE - 150 + k * 22} Q60 ${SHORE - 160 + k * 22} 140 ${SHORE - 148 + k * 22} T300 ${SHORE - 150 + k * 22} T460 ${SHORE - 148 + k * 22}" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1.4"/>`).join('') +
    SPARKLES +
    [0, 1, 2, 3].map(k => crest(k, busy ? 7 : 11)).join('') +
    SAILBOAT +
    (busy ? BANANA + JETSKI : '') +
    SWIMMERS +
    SWIMMER

  const sand =
    `<rect x="0" y="${SHORE}" width="${W}" height="${H - SHORE}" fill="#f1d9a6"/>` +
    `<path d="M0 ${SHORE} V${SHORE + 34} Q60 ${SHORE + 42} 130 ${SHORE + 34} T260 ${SHORE + 36} T400 ${SHORE + 32} V${SHORE}Z" fill="#d9b97c"/>` +
    SAND_DOTS +
    shoreWash(busy ? 5 : 7) +
    BEACH_THINGS +
    (busy ? CRABS : '') +
    // each parasol stands just above the heads, so the faces and sunglasses show
    sunbed(66, 764, '#4ab0ff', { skin: '#f1c7a0', hair: '#2a1a10', long: true, suit: '#ff4a8a', style: 'bikini', shades: true }) +
    sunbed(124, 764, '#4ab0ff', { skin: '#d9a074', hair: '#111', suit: '#2a5a9a', style: 'trunks', shades: true }) +
    parasol(95, 726, '#e84a4a', '#fff', 0, 40) +
    sunbed(282, 806, '#ffd23f', { skin: '#f6d5b8', hair: '#e8c070', long: true, suit: '#2fb8a8', style: 'one', shades: true }) +
    sunbed(340, 806, '#ffd23f', { skin: '#a8724a', hair: '#2a1a10', long: true, suit: '#ffa64a', style: 'bikini', shades: true }) +
    parasol(311, 768, '#2f8ad8', '#ffd23f', 1, 40) +
    sunbed(84, 960, '#5ad27a', { skin: '#a8724a', hair: '#111', suit: '#e84a4a', style: 'trunks', shades: true }) +
    towel(150, 968, '#9a4aff', '#fff', { skin: '#f1c7a0', hair: '#c4572a', long: true, suit: '#1a1a22', style: 'one', shades: true }) +
    parasol(116, 922, '#5ad27a', '#fff', 2, 40) +
    GULLS

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${n(y0)} ${W} ${n(view)}" width="${W}" height="${n(view)}" preserveAspectRatio="xMidYMid slice">${defs}` +
    retime(sea + sand, elapsed) +
    '</svg>'
  )
}
// ---scene-end

const TERMINAL_ART: [string, string][] = [
  ['  ≈≈≈≈≈ ◎ ≈≈≈≈ ◎ ≈≈≈≈', '#4ab0ff'],
  ['  ≈≈ ◎ ≈≈≈≈≈≈≈ ◎ ≈≈≈', '#22a4c4'],
  ['  ~~~~~~~~~~~~~~~~~~~', '#ffffff'],
  ['   ✺  ▭ ▭      ✺ ▭ ▭', '#e84a4a'],
  ['  ░░░░░░░░░░░░░░░░░░░', '#f1d9a6'],
]

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))

  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const label = (w: Beach, now: number, T: Words) => (w.working ? T.working(clock(now - w.startedAt), w.tools) : T.idle)

const shore = atom({ plugin: 'beach-day', key: 'shore' } as const, { working: false, tools: 0, startedAt: 0, endedAt: 0, tick: 0 } as Beach)

// The picture is built again only when the state it draws changes; the same text keeps it running.
let t0 = 0
let cache = { key: '', svg: '' }

export const register: Register = (on, options) => {
  // `language` is a field of the plugin's userConfig: 'en' (default) or 'ko'
  const T: Words = STRINGS[options.language === 'ko' ? 'ko' : 'en']

  on('session.start', async ($, e, next) => {
    t0 = await $.clock.now()
    await $.command.register({
      name: 'beach',
      description: 'Open the beach pane',
    })
    // Wakes the pane each second while Claude works, for the stopwatch in its top line.
    $.clock.every(1000, () => {
      void read($, shore)
        .then(r => (r.working ? update($, shore, v => ({ ...v, tick: v.tick + 1 })) : undefined))
        .catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'beach' }, async $ => {
    await $.ui.open({ id: PANE, title: T.title })

    return { text: T.opened }
  })

  // The main loop's turns only: a subagent's run is not Claude at work.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, shore, v => ({ ...v, working: true, tools: 0, startedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, shore, v => ({ ...v, working: false, endedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await update($, shore, v => ({ ...v, tools: v.tools + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const w = await read($, shore)
    const now = await $.clock.now()
    if (t0 === 0) t0 = now
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 20
    const line = label(w, now, T)

    if (e.surface !== 'terminal') {
      const { Box, Text, Svg } = els as ElementTable<'desktop'>
      // The pane's px: its cells over the code font's advance (about 7.8 px) and line height (about 19.5 px).
      const width = Math.max(160, Math.round(cols * 7.8))
      const full = Math.round((width * H) / W)
      const tall = e.props?.scroll?.bodyRows ? Math.round((rows - 1) * 19.5) : full
      const height = Math.min(full, tall)
      const key = `${w.working}|${height}|${width}`
      if (cache.key !== key) cache = { key, svg: buildScene(w, (now - t0) / 1000, (height * W) / width) }

      return (
        <Box flexDirection="column" justifyContent="center" minHeight={rows}>
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
