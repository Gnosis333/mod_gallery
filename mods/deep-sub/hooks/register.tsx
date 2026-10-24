import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import type { Dive } from '../types'

const PANE = 'deep-sub'
const TITLE = '심해'
const ALT = '깊은 바다 속 잠수정. 야광 해파리와 아귀, 샛비늘치 떼가 지나가고, 저 아래 어둠 속에서 알 수 없는 거대한 것이 희미하게 움직입니다.'

// ---scene-start
type Sub = { working: boolean }

const W = 400
const H = 1200
// the submersible wanders the water on a slow loop, easing from one spot to the next
const ROUTE: [number, number][] = [
  [110, 520],
  [230, 430],
  [290, 600],
  [210, 760],
  [90, 700],
  [70, 590],
  [110, 520],
]
const ROUTE_DUR = 84

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

// a soft halo: rings of the same colour fading outward
const halo = (r: number, color: string, strength = 1) =>
  [1, 0.6, 0.3].map((k, i) => `<circle r="${n(r * (1 + i * 0.9))}" fill="${color}" opacity="${Math.round(16 * k * strength) / 100}"/>`).join('')

// ---- the water: the dark, and marine snow sinking through it --------------------------------------------
const SNOWFALL = Array.from({ length: 46 }, (_, k) => {
  const x = rnd(k + 10) * 400
  const dur = 30 + rnd(k + 20) * 30
  const r = 0.6 + rnd(k + 30) * 1.1

  return `<circle r="${n(r)}" fill="#9ab4c8" opacity="${n(0.25 + rnd(k + 40) * 0.35)}"><animateTransform attributeName="transform" type="translate" values="${n(x)} -10;${n(x + 14)} ${H / 2};${n(x - 6)} ${H + 10}" dur="${n(dur)}s" begin="${n(-rnd(k + 50) * dur)}s" repeatCount="indefinite"/></circle>`
}).join('')

// ---- far below: something vast, rising out of the floor, its tentacles reaching up the sides of the dark,
// almost never quite seen
const THING = (() => {
  // feelers hanging from the face, then great arms climbing on either side
  const angles = [-24, -8, 8, 24, -150, -128, -106, -84, 84, 106, 128, 150]
  const arms = angles.map((a, k) => {
    const len = (Math.abs(a) < 30 ? 70 : 170) + rnd(k + 60) * 80
    const curl = (k % 2 ? 1 : -1) * (30 + rnd(k + 70) * 30)

    return (
      `<g transform="rotate(${n(a)})"><g><animateTransform attributeName="transform" type="rotate" values="-8;8;-8" calcMode="spline" keyTimes="0;.5;1" keySplines="${EASE};${EASE}" dur="${n(9 + rnd(k + 80) * 6)}s" begin="${n(-k * 1.7)}s" repeatCount="indefinite"/>` +
      `<path d="M-9 0 Q${n(curl)} ${n(len * 0.5)} ${n(-curl * 0.4)} ${n(len)} Q${n(curl * 0.2)} ${n(len * 0.55)} 9 0Z" fill="#0f2634"/></g></g>`
    )
  }).join('')

  return (
    '<g transform="translate(200 1086) scale(2.6)" opacity="0"><animate attributeName="opacity" values="0;0;.5;.5;0;0" keyTimes="0;.25;.45;.6;.8;1" dur="80s" begin="-34s" repeatCount="indefinite"/>' +
    // two vestigial wings, then the head and its hanging feelers
    '<path d="M-60 -40 Q-170 -150 -150 -20 Q-120 -60 -60 -10Z M60 -40 Q170 -150 150 -20 Q120 -60 60 -10Z" fill="#0c1f2c"/>' +
    `<g transform="translate(0 30)">${arms}</g>` +
    '<path d="M-90 30 Q-100 -110 0 -120 Q100 -110 90 30 Q0 50 -90 30Z" fill="#0d2230"/>' +
    '<path d="M-60 -60 Q-40 -90 0 -96 M30 -80 Q50 -70 60 -40" stroke="#14303e" stroke-width="3" fill="none"/>' +
    // its eyes open, slowly, once in a long while
    '<g opacity="0"><animate attributeName="opacity" values="0;0;.9;0;0" keyTimes="0;.42;.5;.58;1" dur="80s" begin="-34s" repeatCount="indefinite"/>' +
    '<ellipse cx="-34" cy="-30" rx="9" ry="4" fill="#7dffb0"/><ellipse cx="34" cy="-30" rx="9" ry="4" fill="#7dffb0"/><ellipse cx="-34" cy="-30" rx="2" ry="4" fill="#062014"/><ellipse cx="34" cy="-30" rx="2" ry="4" fill="#062014"/>' +
    '<circle cx="-34" cy="-30" r="22" fill="#7dffb0" opacity=".12"/><circle cx="34" cy="-30" r="22" fill="#7dffb0" opacity=".12"/></g></g>'
  )
})()

// the sea floor: rock, and the glowing pens and worms living on it
const FLOOR =
  `<path d="M0 1120 Q40 1090 90 1104 T190 1096 Q240 1080 290 1100 T400 1090 V${H} H0Z" fill="#03070c"/>` +
  `<path d="M0 1150 Q60 1130 120 1146 T260 1140 T400 1150 V${H} H0Z" fill="#020407"/>` +
  Array.from({ length: 14 }, (_, k) => {
    const x = 12 + k * 28 + rnd(k + 90) * 10
    const y = 1110 + rnd(k + 91) * 30
    const c = ['#5ff0ff', '#ff7ae0', '#a0ff7a'][k % 3]

    return (
      `<path d="M${n(x)} ${n(y)} q-2 -10 0 -20" stroke="${c}" stroke-width="1.6" opacity=".5" fill="none"/>` +
      `<circle cx="${n(x)}" cy="${n(y - 21)}" r="2.2" fill="${c}"><animate attributeName="opacity" values=".3;1;.3" dur="${n(2 + rnd(k + 92) * 3)}s" begin="${n(-rnd(k + 93) * 4)}s" repeatCount="indefinite"/></circle>`
    )
  }).join('')

// ---- glowing jellyfish, rising slowly, bells pulsing ------------------------------------------------------
const jelly = (x: number, dx: number, color: string, dur: number, begin: number, s: number) => {
  const tentacles = [-10, -4, 3, 9]
    .map(
      (tx, i) =>
        `<path d="M${tx} 0 q-4 14 0 28 q4 14 0 28" fill="none" stroke="${color}" stroke-width="1.2" opacity=".6"><animate attributeName="d" values="M${tx} 0 q-4 14 0 28 q4 14 0 28;M${tx} 0 q4 14 0 28 q-4 14 0 28;M${tx} 0 q-4 14 0 28 q4 14 0 28" dur="${n(2.4 + i * 0.3)}s" repeatCount="indefinite"/></path>`,
    )
    .join('')

  return (
    `<g><animateTransform attributeName="transform" type="translate" values="${x} ${H + 80};${x + dx * 0.6} ${H / 2};${x + dx} -120" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>` +
    `<g transform="scale(${s})">${halo(18, color, 0.8)}${tentacles}` +
    '<g><animateTransform attributeName="transform" type="scale" values="1 1;1.14 .84;1 1" dur="1.8s" repeatCount="indefinite"/>' +
    `<path d="M-17 0 Q-17 -22 0 -24 Q17 -22 17 0 Q8 -4 0 0 Q-8 -4 -17 0Z" fill="${color}" fill-opacity=".28" stroke="${color}" stroke-width="1.4"/>` +
    `<path d="M-10 -4 Q-9 -16 0 -17 Q9 -16 10 -4" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.2"/><circle cy="-10" r="3.4" fill="${color}"/>` +
    '</g></g></g>'
  )
}

const JELLIES = jelly(70, 40, '#5ff0ff', 70, -10, 1.2) + jelly(320, -50, '#ff7ae0', 84, -46, 1) + jelly(250, 30, '#a0ff7a', 96, -70, 0.8)

// a comb jelly, its rows of cilia running through the colours
const COMB =
  '<g><animateTransform attributeName="transform" type="translate" values="-40 360;440 300" dur="60s" begin="-20s" repeatCount="indefinite"/>' +
  '<ellipse rx="10" ry="16" fill="#cfe8ff" fill-opacity=".12" stroke="#cfe8ff" stroke-opacity=".35"/>' +
  [-6, -2, 2, 6]
    .map(
      (x, i) =>
        `<path d="M${x} -14 Q${x * 1.3} 0 ${x} 14" fill="none" stroke-width="1.6" stroke-dasharray="2 2"><animate attributeName="stroke" values="#ff6a6a;#ffd36a;#6aff9a;#6ac8ff;#c86aff;#ff6a6a" dur="2s" begin="${-i * 0.4}s" repeatCount="indefinite"/></path>`,
    )
    .join('') +
  '</g>'

// ---- an anglerfish, all mouth, its lure bobbing in the dark ----------------------------------------------
// ---- a dumbo octopus, flapping its ear-fins, drifting up and down as it crosses ------------------------
const DUMBO =
  '<g><animateTransform attributeName="transform" type="translate" values="440 700;300 640;160 720;-60 660;-60 660" keyTimes="0;.2;.42;.66;1" calcMode="spline" keySplines="' + [EASE, EASE, EASE, EASE].join(';') + '" dur="70s" begin="-48s" repeatCount="indefinite"/>' +
  halo(16, '#ffb0c8', 0.5) +
  // the webbed arms below, pulsing as it swims
  '<g><animateTransform attributeName="transform" type="scale" values="1 1;1.2 .8;1 1" dur="2.4s" repeatCount="indefinite"/>' +
  '<path d="M-14 6 Q-18 20 -10 22 Q-6 14 -3 22 Q0 14 3 22 Q6 14 10 22 Q18 20 14 6Z" fill="#f2a6b8" opacity=".85"/></g>' +
  '<ellipse cy="-4" rx="15" ry="14" fill="#f8bccb"/><ellipse cx="-4" cy="-10" rx="6" ry="4" fill="#fff" opacity=".35"/>' +
  // the two ear-fins
  [-1, 1]
    .map(
      s =>
        `<g transform="translate(${s * 12} -12)"><g><animateTransform attributeName="transform" type="rotate" values="${s * -20};${s * 25};${s * -20}" dur="1.2s" repeatCount="indefinite"/><ellipse cx="${s * 8}" cy="-2" rx="9" ry="5" fill="#f2a6b8"/></g></g>`,
    )
    .join('') +
  '<circle cx="-5" cy="-3" r="2.4" fill="#2a1420"/><circle cx="5" cy="-3" r="2.4" fill="#2a1420"/><circle cx="-4.4" cy="-3.8" r=".8" fill="#fff"/><circle cx="5.6" cy="-3.8" r=".8" fill="#fff"/>' +
  '</g>'

// ---- a gulper eel: a huge hinged mouth, a whip of a tail, and a red light at its tip ------------------
const GULPER =
  '<g><animateTransform attributeName="transform" type="translate" values="-140 470;-140 470;520 520;520 520" keyTimes="0;.3;.8;1" dur="58s" begin="-20s" repeatCount="indefinite"/>' +
  // the tail whipping behind (to the left), its light flickering
  '<path d="M-14 0 Q-50 -14 -80 0 T-150 0" fill="none" stroke="#1a1622" stroke-width="3" stroke-linecap="round"><animate attributeName="d" values="M-14 0 Q-50 -14 -80 0 T-150 0;M-14 0 Q-50 14 -80 0 T-150 0;M-14 0 Q-50 -14 -80 0 T-150 0" dur="1.8s" repeatCount="indefinite"/></path>' +
  '<g><animateTransform attributeName="transform" type="translate" values="-150 0;-150 0;-150 0" dur="1.8s" repeatCount="indefinite"/>' + halo(5, '#ff4a6a', 1.6) + '<circle r="2.4" fill="#ffd0d8"><animate attributeName="opacity" values="1;.3;1;1" dur="1.4s" repeatCount="indefinite"/></circle></g>' +
  '<path d="M-16 -4 Q0 -8 10 -6 L10 6 Q0 8 -16 4Z" fill="#1a1622" stroke="#2c3442"/>' +
  // the mouth, opening and closing like a pelican's pouch
  '<g><animateTransform attributeName="transform" type="rotate" values="0 8 0;-18 8 0;0 8 0" dur="5s" repeatCount="indefinite"/><path d="M8 -6 L46 -16 L44 -10 L8 0Z" fill="#1a1622" stroke="#2c3442"/></g>' +
  '<g><animateTransform attributeName="transform" type="rotate" values="0 8 0;22 8 0;0 8 0" dur="5s" repeatCount="indefinite"/><path d="M8 0 Q30 22 46 12 L44 6 Q28 12 8 6Z" fill="#120e18" stroke="#2c3442"/></g>' +
  '<circle cx="12" cy="-5" r="1.4" fill="#9ab4c8"/>' +
  '</g>'

// ---- far off, the ghost of a sperm whale gliding through the dark ------------------------------------
const WHALE =
  '<g opacity=".13"><animateTransform attributeName="transform" type="translate" values="-460 230;520 170" dur="150s" begin="-40s" repeatCount="indefinite"/>' +
  '<g transform="scale(1.4)">' +
  // the great square head, the body tapering to the flukes, which beat slowly
  '<path d="M150 -30 Q172 -28 172 0 Q170 26 140 30 L-60 26 Q-140 18 -200 4 L-200 -4 Q-140 -18 -60 -30Z" fill="#7aa6c8"/>' +
  '<path d="M60 26 Q90 50 110 40 Q96 30 90 22Z" fill="#7aa6c8"/>' +
  '<g><animateTransform attributeName="transform" type="rotate" values="-10 -200 0;10 -200 0;-10 -200 0" dur="6s" repeatCount="indefinite"/><path d="M-196 0 L-250 -30 Q-238 0 -250 30Z" fill="#7aa6c8"/></g>' +
  '<path d="M140 20 Q100 26 40 24" stroke="#4a6a88" stroke-width="2" fill="none"/>' +
  '</g></g>'

const ANGLER =
  '<g><animateTransform attributeName="transform" type="translate" values="470 820;470 820;180 800;-120 830;-120 830" keyTimes="0;.2;.55;.85;1" dur="52s" begin="-6s" repeatCount="indefinite"/>' +
  '<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0" dur="4s" repeatCount="indefinite"/>' +
  // body, tail and fins, barely darker than the water, with a faint edge
  '<path d="M-30 -6 Q-28 -34 4 -36 Q40 -34 48 -6 Q50 18 30 26 Q0 36 -26 20 Q-36 10 -30 -6Z" fill="#100c16" stroke="#26323f" stroke-width="1.2"/>' +
  '<path d="M46 -4 L72 -22 L68 4 L74 24 L46 10Z" fill="#100c16" stroke="#26323f" stroke-width="1.2"><animateTransform attributeName="transform" type="rotate" values="-8 46 4;8 46 4;-8 46 4" dur="1.6s" repeatCount="indefinite"/></path>' +
  '<path d="M10 14 L22 30 L28 14Z" fill="#16121e" stroke="#26323f"/>' +
  // the gaping jaw and its needle teeth
  '<path d="M-30 -2 Q-44 4 -36 18 Q-26 26 -14 22 Q-24 12 -30 -2Z" fill="#05040a" stroke="#26323f"/>' +
  '<path d="M-33 1 l2 6 l2 -6 l2 7 l2 -7 l2 6 l2 -5 M-34 19 l3 -6 l2 5 l3 -7 l2 6 l3 -6" stroke="#e8eef4" stroke-width="1" fill="none"/>' +
  '<circle cx="-14" cy="-14" r="3" fill="#cfe8ff" opacity=".7"/><circle cx="-14" cy="-14" r="1.2" fill="#000"/>' +
  // the lure on its rod
  '<g><animateTransform attributeName="transform" type="rotate" values="-6 -6 -32;8 -6 -32;-6 -6 -32" calcMode="spline" keyTimes="0;.5;1" keySplines="' + EASE + ';' + EASE + '" dur="3s" repeatCount="indefinite"/>' +
  '<path d="M-6 -32 Q-20 -64 -46 -52" fill="none" stroke="#26323f" stroke-width="1.6"/>' +
  '<g transform="translate(-48 -48)">' + halo(9, '#a8fff0', 1.4) + '<circle r="4.4" fill="#e8fff8"><animate attributeName="opacity" values="1;.55;1" dur="2.2s" repeatCount="indefinite"/></circle></g></g>' +
  '</g></g>'

// ---- a school of lanternfish, each with its rows of blue lights --------------------------------------------
const LANTERNS =
  '<g><animateTransform attributeName="transform" type="translate" values="-160 250;-160 250;460 230;460 230" keyTimes="0;.1;.75;1" dur="34s" begin="-2s" repeatCount="indefinite"/>' +
  Array.from({ length: 9 }, (_, k) => {
    const x = (k % 3) * 34 + rnd(k + 300) * 12 - (k > 5 ? 50 : 0)
    const y = Math.floor(k / 3) * 22 + rnd(k + 310) * 8

    return (
      `<g transform="translate(${n(x)} ${n(y)})"><g><animateTransform attributeName="transform" type="translate" values="0 0;0 ${k % 2 ? 3 : -3};0 0" dur="${n(1.4 + rnd(k + 320))}s" repeatCount="indefinite"/>` +
      '<path d="M-10 0 Q0 -5 9 0 Q0 5 -10 0Z M-10 0 L-15 -4 L-15 4Z" fill="#1a2430" stroke="#2c3c4c" stroke-width=".8"/>' +
      '<circle cx="-4" cy="2" r="1" fill="#6ad8ff"/><circle cx="0" cy="2.4" r="1" fill="#6ad8ff"/><circle cx="4" cy="2" r="1" fill="#6ad8ff"/><circle cx="6" cy="-1" r="1.6" fill="#6ad8ff" opacity=".8"/></g></g>'
    )
  }).join('') +
  '</g>'

// ---- the submersible ---------------------------------------------------------------------------------------
const sub = (lit: boolean) => {
  const glass = lit ? '#ffe7a0' : '#2c6a78'
  const glow = lit ? '#ffe7a0' : '#3ac0d0'

  return (
    // bubbles trailing up from the stern
    Array.from({ length: lit ? 6 : 3 }, (_, k) => {
      const dur = lit ? 3 : 5

      return `<circle r="${n(1.4 + (k % 3))}" fill="none" stroke="#bfe6ff" stroke-opacity=".6"><animateTransform attributeName="transform" type="translate" values="-54 ${-4 + (k % 2) * 6};${-70 - k * 4} -60;${-64 - k * 6} -130" dur="${dur}s" begin="${n(-k * (dur / (lit ? 6 : 3)))}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.6;0" dur="${dur}s" begin="${n(-k * (dur / (lit ? 6 : 3)))}s" repeatCount="indefinite"/></circle>`
    }).join('') +
    // the propeller, a blur when it is busy
    `<g transform="translate(-54 0)"><rect x="-4" y="-2" width="6" height="4" fill="#6a5a3a"/><g><animateTransform attributeName="transform" type="scale" values="1 1;1 -1;1 1" dur="${lit ? 0.18 : 0.8}s" repeatCount="indefinite"/><path d="M-6 0 L-10 -12 L-4 -12Z M-6 0 L-10 12 L-4 12Z" fill="#8a7a5a"/></g></g>` +
    // hull, tower, rails and skids
    '<ellipse cx="0" cy="0" rx="48" ry="25" fill="#e8b42e"/><path d="M-46 6 Q0 34 46 6 Q40 22 0 25 Q-40 22 -46 6Z" fill="#b8841a"/>' +
    '<path d="M-14 -24 V-38 Q-14 -42 -10 -42 H12 Q16 -42 16 -38 V-22" fill="#d8a024"/><rect x="-6" y="-50" width="3" height="10" fill="#8a7a5a"/>' +
    '<path d="M-36 28 H36 M-26 25 V28 M26 25 V28" stroke="#6a5a3a" stroke-width="3"/>' +
    '<path d="M-40 -6 H30" stroke="#b8841a" stroke-width="1.4"/>' +
    // a little arm folded under the bow
    '<path d="M30 16 L44 24 L52 20" fill="none" stroke="#8a7a5a" stroke-width="3" stroke-linecap="round"/><path d="M52 20 l4 -4 M52 20 l5 2" stroke="#8a7a5a" stroke-width="2"/>' +
    // portholes: the big bow window and two small ones
    `<g transform="translate(26 -2)">${halo(12, glow, lit ? 1.2 : 0.6)}<circle r="12" fill="#5a4a2a"/><circle r="9" fill="${glass}"/><path d="M-5 -4 Q-2 -7 2 -7" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" fill="none"/></g>` +
    [-6, -22].map(x => `<circle cx="${x}" cy="-4" r="5" fill="#5a4a2a"/><circle cx="${x}" cy="-4" r="3.4" fill="${glass}" opacity="${lit ? 1 : 0.7}"/>`).join('') +
    // the lamp on the bow
    `<rect x="40" y="2" width="8" height="8" rx="2" fill="#5a4a2a"/><circle cx="48" cy="6" r="3" fill="${lit ? '#fffbe0' : '#4a5a60'}"/>`
  )
}

// while Claude works: the searchlight sweeping ahead, and sonar pinging outward
const BEAM =
  `<g><animateTransform attributeName="transform" type="rotate" values="-7 48 6;9 48 6;-7 48 6" calcMode="spline" keyTimes="0;.5;1" keySplines="${EASE};${EASE}" dur="11s" repeatCount="indefinite"/>` +
  '<polygon points="48,1 48,11 340,170 340,-140" fill="url(#beam)"><animate attributeName="opacity" values=".95;.8;.95;.9;.95" dur="3.4s" repeatCount="indefinite"/></polygon>' +
  '<polygon points="48,4 48,8 340,70 340,-50" fill="url(#beam)" opacity=".6"/></g>'

const SONAR = [0, 1]
  .map(
    k =>
      `<circle r="20" fill="none" stroke="#5ff0ff" stroke-width="1.6" opacity="0"><animate attributeName="r" values="30;260" dur="4s" begin="${-k * 2}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".5;0" dur="4s" begin="${-k * 2}s" repeatCount="indefinite"/></circle>`,
  )
  .join('')

// ...and now and then the shadow of a giant squid sweeps across, mantle first, arms trailing
const SQUID = (() => {
  const arms = Array.from({ length: 8 }, (_, k) => {
    const y = -18 + k * 5
    const len = 150 + (k % 3) * 20
    const a = `M-20 ${y} Q${-len * 0.5} ${y - 18} ${-len} ${y + (k - 3.5) * 6}`
    const b = `M-20 ${y} Q${-len * 0.5} ${y + 18} ${-len} ${y + (k - 3.5) * 9}`

    return `<path d="${a}" fill="none" stroke="#000" stroke-width="${7 - Math.abs(k - 3.5)}" stroke-linecap="round"><animate attributeName="d" values="${a};${b};${a}" dur="${n(1.6 + k * 0.1)}s" repeatCount="indefinite"/></path>`
  }).join('')
  const tentacles = [-1, 1]
    .map(
      s =>
        `<path d="M-20 ${s * 4} Q-160 ${s * 40} -300 ${s * 10}" fill="none" stroke="#000" stroke-width="3"><animate attributeName="d" values="M-20 ${s * 4} Q-160 ${s * 40} -300 ${s * 10};M-20 ${s * 4} Q-160 ${-s * 20} -300 ${s * 30};M-20 ${s * 4} Q-160 ${s * 40} -300 ${s * 10}" dur="2.4s" repeatCount="indefinite"/></path><ellipse cx="-300" cy="${s * 12}" rx="14" ry="5" fill="#000"/>`,
    )
    .join('')

  return (
    '<g opacity=".72"><animateTransform attributeName="transform" type="translate" values="-560 300;-560 300;980 210;980 210" keyTimes="0;.62;.86;1" dur="32s" begin="-14s" repeatCount="indefinite"/>' +
    `<g transform="scale(1.3)">${tentacles}${arms}` +
    '<path d="M150 0 Q120 -30 40 -28 Q0 -26 -20 -14 L-20 14 Q0 26 40 28 Q120 30 150 0Z" fill="#000"/>' +
    '<path d="M150 0 L110 -42 L96 -18Z M150 0 L110 42 L96 18Z" fill="#000"/>' +
    '<circle cx="-8" cy="-8" r="5" fill="#0a1218"/></g></g>'
  )
})()

// ---- the whole picture --------------------------------------------------------------------------------
const buildScene = (w: Sub, elapsed: number, vh: number) => {
  const view = Math.min(H, Math.max(vh, 240))
  // a short pane trims the water above and below the submersible alike
  const y0 = (H - view) / 2
  const lit = w.working

  const defs =
    '<defs>' +
    '<linearGradient id="deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a2236"/><stop offset=".45" stop-color="#05121e"/><stop offset="1" stop-color="#010409"/></linearGradient>' +
    `<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6c8" stop-opacity=".55"/><stop offset=".6" stop-color="#cfefff" stop-opacity=".16"/><stop offset="1" stop-color="#cfefff" stop-opacity="0"/></linearGradient>` +
    '</defs>'

  const water =
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#deep)"/>` +
    // the last of the light, far above
    [1, 1.5, 2.1].map(k => `<ellipse cx="200" cy="-80" rx="${n(180 * k)}" ry="${n(110 * k)}" fill="#2a5a7a" opacity=".07"/>`).join('') +
    WHALE +
    THING +
    FLOOR +
    SNOWFALL +
    COMB +
    LANTERNS +
    GULPER +
    DUMBO +
    JELLIES +
    ANGLER

  const craft =
    `<g><animateTransform attributeName="transform" type="translate" values="${ROUTE.map(([x, y]) => `${x} ${y}`).join(';')}" calcMode="spline" keyTimes="${ROUTE.map((_, k) => n(k / (ROUTE.length - 1))).join(';')}" keySplines="${ROUTE.slice(1).map(() => EASE).join(';')}" dur="${ROUTE_DUR}s" repeatCount="indefinite"/>` +
    (lit ? SONAR : '') +
    `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -7;0 0" calcMode="spline" keyTimes="0;.5;1" keySplines="${EASE};${EASE}" dur="6s" repeatCount="indefinite"/>` +
    `<g><animateTransform attributeName="transform" type="rotate" values="-1.6;1.6;-1.6" dur="9s" repeatCount="indefinite"/>${lit ? BEAM : ''}${sub(lit)}</g></g></g>` +
    (lit ? SQUID : '')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${n(y0)} ${W} ${n(view)}" width="${W}" height="${n(view)}" preserveAspectRatio="xMidYMid slice">${defs}` +
    retime(water + craft, elapsed) +
    '</svg>'
  )
}
// ---scene-end

const TERMINAL_ART: [string, string][] = [
  ['   ·    ◌      ·   ◌ ', '#5ff0ff'],
  ['      ▄▄█▄▄  ─ ─ ─ ─', '#e8b42e'],
  ['   ◖ ████◉█▶ ═══    ', '#e8b42e'],
  ['  ·    ◌   ·    ◌    ', '#ff7ae0'],
  ['  ▁▂▃▂▁▁▂▃▄▃▂▁▁▂▃▂▁ ', '#26323f'],
]

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))

  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const label = (w: Dive, now: number) => (w.working ? `작업 중 ${clock(now - w.startedAt)} · 도구 ${w.tools}회` : '쉬는 중')

const dive = atom({ plugin: 'deep-sub', key: 'dive' } as const, { working: false, tools: 0, startedAt: 0, endedAt: 0, tick: 0 } as Dive)

// The picture is built again only when the state it draws changes; the same text keeps it running.
let t0 = 0
let cache = { key: '', svg: '' }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    t0 = await $.clock.now()
    await $.command.register({
      name: 'deep',
      description: 'Open the deep-sea submersible pane',
    })
    // Wakes the pane each second while Claude works, for the stopwatch in its top line.
    $.clock.every(1000, () => {
      void read($, dive)
        .then(r => (r.working ? update($, dive, v => ({ ...v, tick: v.tick + 1 })) : undefined))
        .catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'deep' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: '심해를 열었습니다.' }
  })

  // The main loop's turns only: a subagent's run is not Claude at work.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, dive, v => ({ ...v, working: true, tools: 0, startedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, dive, v => ({ ...v, working: false, endedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await update($, dive, v => ({ ...v, tools: v.tools + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const w = await read($, dive)
    const now = await $.clock.now()
    if (t0 === 0) t0 = now
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 20
    const line = label(w, now)

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
