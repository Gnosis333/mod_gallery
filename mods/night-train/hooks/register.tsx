import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import type { Train } from '../types'

const PANE = 'night-train'
const TITLE = 'Night train'
const ALT = 'A night-train window. At rest it waits at a lamp-lit station; while Claude works, hills, trees and poles stream past the glass.'

// ---scene-start
type Ride = { working: boolean; startedAt: number; endedAt: number; travelled: number }

const W = 400
const H = 960
const GL = 40 // the glass: left, right, top, bottom
const GR = 360
const GT = 40
const GB = 820
const TABLE = 862
const T = 400 // every moving layer repeats every T px
const DEPART = 2.5 // seconds to pull out of the station
const ARRIVE = 3 // and to pull in

const n = (v: number) => String(Math.round(v * 10) / 10)
const EASE_IN = '.5 0 .9 .6'
const EASE_OUT = '.1 .4 .5 1'
const rnd = (s: number) => {
  const v = Math.sin(s * 127.1 + 311.7) * 43758.5453

  return v - Math.floor(v)
}

// Looping motion shifts back by the time already elapsed, so redrawing the picture never makes it jump.
// Tags marked data-once (the scenery, the station sliding in or out) are timed from now and left alone.
const retime = (svg: string, elapsed: number) =>
  svg.replace(/<(animate|animateTransform|animateMotion)\b[^>]*>/g, tag => {
    if (tag.includes('data-once')) {
      return tag
    }
    const found = / begin="(-?[\d.]+)s"/.exec(tag)
    const shifted = ` begin="${n((found ? parseFloat(found[1]) : 0) - elapsed)}s"`

    return found ? tag.replace(found[0], shifted) : tag.replace(/^<(\w+)/, `<$1${shifted}`)
  })

// ---- the sky, which moves with nothing ----------------------------------------------------------------
const STARS = Array.from({ length: 34 }, (_, k) => {
  const x = GL + 6 + rnd(k) * (GR - GL - 12)
  const y = GT + 14 + rnd(k + 60) * 430
  const r = 0.7 + rnd(k + 120) * 1.1
  const twinkle = k % 4 === 0 ? `<animate attributeName="opacity" values=".9;.2;.9" dur="${n(2.6 + rnd(k + 7) * 3)}s" begin="${n(-rnd(k + 9) * 4)}s" repeatCount="indefinite"/>` : ''

  return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="#fff6d8" opacity=".9">${twinkle}</circle>`
}).join('')

const MOON =
  '<circle cx="282" cy="150" r="46" fill="#f6efc4" opacity=".1"/><circle cx="282" cy="150" r="24" fill="#f6efc4"/>' +
  '<circle cx="274" cy="144" r="4.4" fill="#e3d9a8"/><circle cx="290" cy="158" r="3" fill="#e3d9a8"/><circle cx="286" cy="139" r="2" fill="#e3d9a8"/>'

const CLOUDS = [0, 1]
  .map(
    k =>
      `<g opacity=".18"><animateTransform attributeName="transform" type="translate" values="${k ? 420 : -160} 0;${k ? -160 : 420} 0" dur="${k ? 150 : 190}s" begin="${-60 - k * 70}s" repeatCount="indefinite"/>` +
      `<ellipse cx="0" cy="${k ? 300 : 230}" rx="70" ry="9" fill="#c9d4f0"/><ellipse cx="30" cy="${k ? 294 : 224}" rx="40" ry="8" fill="#c9d4f0"/></g>`,
  )
  .join('')

const SHOOTING =
  '<path d="M0 0 L46 -22" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0">' +
  '<animateTransform attributeName="transform" type="translate" values="330 110;200 172;200 172" keyTimes="0;.05;1" dur="27s" begin="-8s" repeatCount="indefinite"/>' +
  '<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.01;.05;1" dur="27s" begin="-8s" repeatCount="indefinite"/></path>'

// now and then a flock of migrating birds crosses the sky in a V, wings beating out of step
const FLOCK = (() => {
  const birds = Array.from({ length: 9 }, (_, k) => {
    const side = k === 0 ? 0 : k % 2 ? 1 : -1
    const rank = Math.ceil(k / 2)
    const x = rank * 15
    const y = side * rank * 11

    return `<path d="M-6 0 Q-3 -4 0 0 Q3 -4 6 0" fill="none" stroke="#aab6d8" stroke-width="1.8" stroke-linecap="round" transform="translate(${x} ${y})"><animate attributeName="d" values="M-6 0 Q-3 -4 0 0 Q3 -4 6 0;M-6 -2 Q-3 2 0 0 Q3 2 6 -2;M-6 0 Q-3 -4 0 0 Q3 -4 6 0" dur=".7s" begin="${n(-k * 0.11)}s" repeatCount="indefinite"/></path>`
  }).join('')
  const fly = (y: number, dur: number, begin: number) =>
    `<g><animateTransform attributeName="transform" type="translate" values="420 ${y};420 ${y};-80 ${y - 40};-80 ${y - 40}" keyTimes="0;.62;.92;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>${birds}</g>`

  return fly(250, 70, -30) + fly(380, 97, -80)
})()

const SKY =
  `<rect x="${GL}" y="${GT}" width="${GR - GL}" height="${GB - GT}" fill="url(#night)"/>` + STARS + MOON + CLOUDS + SHOOTING + FLOCK

// ---- the scenery, in layers that run at their own speeds ----------------------------------------------
// far mountains, hills with a village, trees by the line, the telegraph poles, and speed streaks
const far = (dx: number) =>
  `<path d="M${dx} 600 L${dx + 40} 548 L${dx + 90} 578 L${dx + 150} 500 L${dx + 210} 562 L${dx + 262} 524 L${dx + 330} 586 L${dx + 400} 600 V720 H${dx}Z" fill="#1f2c52"/>` +
  `<path d="M${dx + 136} 518 L${dx + 150} 500 L${dx + 166} 520 L${dx + 156} 516 L${dx + 150} 522Z M${dx + 252} 534 L${dx + 262} 524 L${dx + 274} 536Z" fill="#4a5a8a"/>`

const HOUSES = Array.from({ length: 6 }, (_, k) => {
  const x = 20 + k * 64 + rnd(k + 300) * 20
  const y = 618 + Math.sin((x / T) * Math.PI * 2) * 8
  const lit = rnd(k + 330) < 0.75

  return [x, y, lit] as const
})

const mid = (dx: number) =>
  `<path d="M${dx} 640 Q${dx + 100} 604 ${dx + 200} 632 T${dx + 400} 640 V740 H${dx}Z" fill="#152040"/>` +
  HOUSES.map(
    ([x, y, lit]) =>
      `<path d="M${n(dx + x - 9)} ${n(y + 10)} V${n(y)} L${n(dx + x)} ${n(y - 8)} L${n(dx + x + 9)} ${n(y)} V${n(y + 10)}Z" fill="#101830"/>` +
      (lit ? `<rect x="${n(dx + x - 3)}" y="${n(y + 1)}" width="5" height="4" fill="#ffd27a"/>` : ''),
  ).join('')

const TREES = [30, 92, 150, 214, 270, 336].map((x, k) => [x, 58 + rnd(k + 400) * 56] as const)

const near = (dx: number) =>
  `<rect x="${dx}" y="700" width="${T}" height="${GB - 700}" fill="#0a0f1e"/>` +
  TREES.map(([x, h]) => `<path d="M${dx + x - 16} 712 L${dx + x} ${n(712 - h)} L${dx + x + 16} 712Z" fill="#0b1226"/>`).join('')

const poles = (dx: number) =>
  [100, 300].map(x => `<rect x="${dx + x - 3}" y="586" width="6" height="${GB - 586}" fill="#05080f"/><rect x="${dx + x - 16}" y="596" width="32" height="4" fill="#05080f"/>`).join('') +
  `<path d="M${dx} 622 Q${dx + 50} 632 ${dx + 100} 600 Q${dx + 200} 646 ${dx + 300} 600 Q${dx + 350} 632 ${dx + 400} 622" fill="none" stroke="#05080f" stroke-width="1.4"/>`

const STREAKS = Array.from({ length: 6 }, (_, k) => {
  const y = 728 + k * 15
  const len = 60 + rnd(k + 500) * 90
  const d = 0.5 + rnd(k + 520) * 0.6

  return `<path d="M0 ${y} H${n(len)}" stroke="${k % 3 === 0 ? '#ffd27a' : '#cfe0ff'}" stroke-width="1.6" stroke-linecap="round" opacity=".35"><animateTransform attributeName="transform" type="translate" values="${GR} 0;${n(GL - len)} 0" dur="${n(d)}s" begin="${n(-rnd(k + 540) * d)}s" repeatCount="indefinite"/></path>`
}).join('')

// now and then a tunnel swallows the window, its lamps rushing past
// a long one: the window stays dark for about four and a half seconds
const TUNNEL_LEN = 3000
const TUNNEL =
  `<g><animateTransform attributeName="transform" type="translate" values="420 0;420 0;${-TUNNEL_LEN - 20} 0;${-TUNNEL_LEN - 20} 0" keyTimes="0;.6;.72;1" dur="48s" begin="-12s" repeatCount="indefinite"/>` +
  `<rect x="0" y="${GT}" width="${TUNNEL_LEN}" height="${GB - GT}" fill="#06070c"/><rect x="0" y="${GT}" width="14" height="${GB - GT}" fill="#20222c"/><rect x="${TUNNEL_LEN - 14}" y="${GT}" width="14" height="${GB - GT}" fill="#20222c"/>` +
  Array.from({ length: 16 }, (_, k) => 120 + k * 180).map(x => `<circle cx="${x}" cy="120" r="5" fill="#ffb347"/><circle cx="${x}" cy="120" r="16" fill="#ffb347" opacity=".2"/>`).join('') +
  Array.from({ length: 19 }, (_, k) => 60 + k * 150).map(x => `<rect x="${x}" y="660" width="40" height="4" rx="2" fill="#ffb347" opacity=".8"/>`).join('') +
  '</g>'

// a layer that runs (its place taken from how far the train has gone) or stands where it stopped
const layer = (draw: (dx: number) => string, period: number, run: number, moving: boolean) => {
  const body = draw(0) + draw(T)
  if (!moving) {
    return `<g transform="translate(${n(-((run % period) / period) * T)} 0)">${body}</g>`
  }

  return `<g><animateTransform data-once="1" attributeName="transform" type="translate" values="0 0;${-T} 0" dur="${period}s" begin="${n(-(run % period))}s" repeatCount="indefinite"/>${body}</g>`
}

// ---- the station --------------------------------------------------------------------------------------
const lamp = (x: number) =>
  `<rect x="${x - 2}" y="606" width="4" height="86" fill="#1c1c26"/><path d="M${x - 9} 606 H${x + 9} L${x + 5} 596 H${x - 5}Z" fill="#2a2a36"/>` +
  `<circle cx="${x}" cy="610" r="34" fill="#ffd27a" opacity=".16"><animate attributeName="opacity" values=".14;.2;.14" dur="5s" repeatCount="indefinite"/></circle><circle cx="${x}" cy="610" r="6" fill="#ffe6a8"/>` +
  `<ellipse cx="${x}" cy="702" rx="40" ry="6" fill="#ffd27a" opacity=".12"/>`

const person = (body: string, x: number, y: number) =>
  `<g transform="translate(${x} ${y})"><circle cy="-34" r="6" fill="#161620"/><rect x="-6" y="-28" width="12" height="22" rx="4" fill="${body}"/><rect x="-5" y="-7" width="4" height="10" fill="#161620"/><rect x="1" y="-7" width="4" height="10" fill="#161620"/></g>`

// one passenger strolls along the platform; another waits with a suitcase
const WALKER =
  `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.04;.36;.4;1" dur="40s" begin="-6s" repeatCount="indefinite"/>` +
  `<g><animateTransform attributeName="transform" type="translate" values="30 0;380 0;380 0" keyTimes="0;.4;1" dur="40s" begin="-6s" repeatCount="indefinite"/>` +
  `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -1.6;0 0" dur=".6s" repeatCount="indefinite"/>${person('#5a6a8a', 0, 712)}</g></g></g>`

// now and then another train rolls by on the far track, all its windows lit
const PASSING =
  '<g><animateTransform attributeName="transform" type="translate" values="-760 0;-760 0;440 0;440 0" keyTimes="0;.74;.84;1" dur="36s" begin="-4s" repeatCount="indefinite"/>' +
  '<rect x="0" y="618" width="720" height="58" rx="10" fill="#38415a"/><rect x="0" y="664" width="720" height="6" fill="#c94f4f"/>' +
  Array.from({ length: 18 }, (_, k) => `<rect x="${16 + k * 39}" y="630" width="24" height="18" rx="3" fill="#ffd9a0"/>`).join('') +
  '</g>'

const STATION =
  // the station house and its sign
  '<rect x="64" y="560" width="148" height="132" fill="#4a3b4a"/><path d="M54 562 L138 520 L222 562Z" fill="#6a4a52"/>' +
  [80, 118, 156, 188].map(x => `<rect x="${x}" y="584" width="18" height="26" fill="#ffd27a"/><rect x="${x + 8}" y="584" width="2" height="26" fill="#4a3b4a"/>`).join('') +
  '<rect x="122" y="640" width="32" height="52" fill="#2c2230"/><rect x="110" y="532" width="56" height="20" rx="4" fill="#f6efc4"/>' +
  '<text x="138" y="547" text-anchor="middle" font-size="13" font-weight="bold" letter-spacing="1" font-family="sans-serif" fill="#3a2a2a">STATION</text>' +
  PASSING +
  // the platform, its yellow line, the bench and the lamps
  `<rect x="0" y="690" width="${W}" height="72" fill="#3a4152"/><rect x="0" y="690" width="${W}" height="7" fill="#525a70"/><rect x="0" y="702" width="${W}" height="3" fill="#c9b46a"/>` +
  // the platform's edge, then our own track: gravel, sleepers and two rails
  `<rect x="0" y="756" width="${W}" height="6" fill="#565e74"/><rect x="0" y="762" width="${W}" height="${GB - 762}" fill="#24262e"/>` +
  Array.from({ length: 14 }, (_, k) => `<rect x="${k * 30}" y="784" width="18" height="30" fill="#3b2f26"/>`).join('') +
  `<rect x="0" y="788" width="${W}" height="4" fill="#8a909c"/><rect x="0" y="806" width="${W}" height="4" fill="#8a909c"/>` +
  '<rect x="252" y="672" width="64" height="5" fill="#6b4a32"/><rect x="256" y="677" width="3" height="14" fill="#6b4a32"/><rect x="309" y="677" width="3" height="14" fill="#6b4a32"/>' +
  lamp(236) +
  lamp(344) +
  person('#7a4a5a', 222, 712) +
  '<rect x="230" y="696" width="14" height="12" rx="2" fill="#8a6244"/>' +
  WALKER

// ---- the carriage -------------------------------------------------------------------------------------
const WALL =
  `<path d="M0 0 H${W} V${H} H0Z M${GL + 12} ${GT} H${GR - 12} Q${GR} ${GT} ${GR} ${GT + 12} V${GB - 12} Q${GR} ${GB} ${GR - 12} ${GB} H${GL + 12} Q${GL} ${GB} ${GL} ${GB - 12} V${GT + 12} Q${GL} ${GT} ${GL + 12} ${GT}Z" fill="#2a2230" fill-rule="evenodd"/>` +
  `<rect x="${GL - 4}" y="${GT - 4}" width="${GR - GL + 8}" height="${GB - GT + 8}" rx="15" fill="none" stroke="#6b4a32" stroke-width="12"/>` +
  `<rect x="${GL + 2}" y="${GT + 2}" width="${GR - GL - 4}" height="${GB - GT - 4}" rx="11" fill="none" stroke="#8a6244" stroke-width="2"/>`

const curtain = (sway: boolean) =>
  [1, -1]
    .map(s => {
      const g = s === 1 ? '' : `transform="translate(${W} 0) scale(-1 1)"`
      const move = sway ? '<animateTransform attributeName="transform" type="rotate" values="-.6 30 20;.6 30 20;-.6 30 20" dur="1.1s" repeatCount="indefinite"/>' : ''

      return (
        `<g ${g}><g>${move}<path d="M0 20 H60 Q50 240 40 470 Q34 500 46 540 Q30 700 38 ${GB + 20} H0Z" fill="#7a2e3a"/>` +
        '<path d="M18 30 Q16 260 14 470 M32 30 Q29 260 26 470" stroke="#5e2230" stroke-width="2" fill="none"/>' +
        '<rect x="22" y="492" width="30" height="12" rx="5" fill="#c9a24a"/></g></g>'
      )
    })
    .join('')

const VALANCE = `<rect x="0" y="0" width="${W}" height="30" fill="#5a2030"/>` + Array.from({ length: 10 }, (_, k) => `<circle cx="${20 + k * 40}" cy="30" r="20" fill="#5a2030"/>`).join('')

const TABLETOP =
  `<rect x="0" y="${TABLE}" width="${W}" height="${H - TABLE}" fill="#6b4a32"/><rect x="0" y="${TABLE}" width="${W}" height="6" fill="#8a6244"/>` +
  `<rect x="0" y="${TABLE + 34}" width="${W}" height="${H - TABLE - 34}" fill="#4a3222"/>` +
  // a book and a ticket
  `<rect x="54" y="${TABLE - 12}" width="64" height="12" rx="2" fill="#2f5a7a"/><rect x="58" y="${TABLE - 22}" width="56" height="10" rx="2" fill="#8a3a3a"/>` +
  `<g transform="translate(230 ${TABLE - 3}) rotate(-8)"><rect x="0" y="-12" width="44" height="14" rx="2" fill="#efe4c8"/><path d="M6 -7 H30 M6 -3 H22" stroke="#a88a5a" stroke-width="1.4"/><circle cx="37" cy="-5" r="3" fill="none" stroke="#c94f4f" stroke-width="1"/></g>`

const cup = (rocking: boolean) => {
  const shake = rocking ? '<animateTransform attributeName="transform" type="translate" values="0 0;.8 -.6;0 0;-.7 .4;0 0" dur=".42s" repeatCount="indefinite"/>' : ''
  // long wisps of steam: straight up at rest, swept sideways by the draught while the train runs
  const steam = [0, 1, 2]
    .map(k => {
      const x = 150 + k * 9
      const d = rocking
        ? `M${x} ${TABLE - 34} q-8 -14 -22 -12 q-14 2 -22 -10 q-8 -12 -24 -10 q-14 2 -22 -8`
        : `M${x} ${TABLE - 34} q-7 -14 0 -26 q7 -12 0 -24 q-7 -12 0 -24 q7 -12 0 -22`
      const dur = rocking ? 2 : 5.4

      return `<path d="${d}" fill="none" stroke="#f1ecdf" stroke-width="2.4" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;.6;.4;0" keyTimes="0;.3;.7;1" dur="${dur}s" begin="${n(-k * dur / 3)}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 6;${rocking ? '-10 -14' : '0 -26'}" dur="${dur}s" begin="${n(-k * dur / 3)}s" repeatCount="indefinite"/></path>`
    })
    .join('')
  const tea = rocking
    ? `<ellipse cx="164" cy="${TABLE - 32}" rx="18" ry="3" fill="#a8763c"><animate attributeName="ry" values="3;1.6;3" dur=".42s" repeatCount="indefinite"/></ellipse>`
    : `<ellipse cx="164" cy="${TABLE - 32}" rx="18" ry="3" fill="#a8763c"/>`

  return (
    `<g><ellipse cx="164" cy="${TABLE}" rx="34" ry="5" fill="#e9e2d0"/><g>${shake}` +
    `<path d="M144 ${TABLE - 33} H184 L180 ${TABLE - 4} Q164 ${TABLE + 2} 148 ${TABLE - 4}Z" fill="#f4efe2"/><path d="M184 ${TABLE - 26} q16 2 2 18" fill="none" stroke="#f4efe2" stroke-width="4"/>` +
    `<ellipse cx="164" cy="${TABLE - 33}" rx="20" ry="4" fill="#e1d8c4"/>${tea}</g>${steam}</g>`
  )
}

const tableLamp = (rocking: boolean) => {
  const sway = rocking ? '<animateTransform attributeName="transform" type="rotate" values="-1.4 320 862;1.4 320 862;-1.4 320 862" dur=".9s" repeatCount="indefinite"/>' : ''

  return (
    `<g>${sway}<rect x="318" y="${TABLE - 52}" width="4" height="52" fill="#2a2a36"/><ellipse cx="320" cy="${TABLE}" rx="16" ry="4" fill="#2a2a36"/>` +
    `<path d="M300 ${TABLE - 52} H340 L330 ${TABLE - 78} H310Z" fill="#ffcf88"/><ellipse cx="320" cy="${TABLE - 52}" rx="20" ry="3.6" fill="#ffe3b3"/></g>` +
    `<circle cx="320" cy="${TABLE - 52}" r="56" fill="#ffd9a0" opacity=".06"/>`
  )
}

// ---- the whole picture --------------------------------------------------------------------------------
const fade = (from: number, to: number, dur: number, since: number, inner: string) =>
  since >= dur
    ? to > 0
      ? inner
      : ''
    : `<g opacity="${from}"><animate data-once="1" attributeName="opacity" values="${from};${to}" dur="${dur}s" begin="${n(-since)}s" fill="freeze"/>${inner}</g>`

const buildScene = (w: Ride, elapsed: number, vh: number, now: number) => {
  const view = Math.min(H, Math.max(vh, 240))
  const y0 = H - view
  const since = (now - w.startedAt) / 1000
  const sinceEnd = (now - w.endedAt) / 1000
  const arriving = !w.working && w.endedAt > 0 && sinceEnd < ARRIVE
  // how far the train has gone (counting the roll into the station); while it runs, or still rolls in,
  // the scenery runs from there
  const run = w.working ? w.travelled + since : arriving ? w.travelled - ARRIVE + sinceEnd : w.travelled
  const moving = w.working || arriving

  const defs =
    '<defs>' +
    '<linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1130"/><stop offset=".6" stop-color="#1c2a55"/><stop offset="1" stop-color="#3a3a6a"/></linearGradient>' +
    `<clipPath id="glass"><rect x="${GL}" y="${GT}" width="${GR - GL}" height="${GB - GT}" rx="12"/></clipPath>` +
    '</defs>'

  const running =
    layer(mid, 30, run, true) +
    layer(near, 7, run, true) +
    layer(poles, 1.4, run, true) +
    (w.working ? STREAKS + TUNNEL : '')

  // the station slides away as the train leaves, and back in as it arrives
  const station = w.working
    ? since < DEPART
      ? `<g><animateTransform data-once="1" attributeName="transform" type="translate" values="0 0;-440 0" keySplines="${EASE_IN}" calcMode="spline" keyTimes="0;1" dur="${DEPART}s" begin="${n(-since)}s" fill="freeze"/>${STATION}</g>`
      : ''
    : arriving
      ? `<g><animateTransform data-once="1" attributeName="transform" type="translate" values="440 0;0 0" keySplines="${EASE_OUT}" calcMode="spline" keyTimes="0;1" dur="${ARRIVE}s" begin="${n(-sinceEnd)}s" fill="freeze"/>${STATION}</g>`
      : STATION

  const outside =
    SKY +
    layer(far, 90, run, moving) +
    (w.working ? fade(0, 1, DEPART, since, running) : arriving ? fade(1, 0, ARRIVE, sinceEnd, running) : '') +
    station

  // the carriage rocks a little while it runs
  const rock = w.working ? '<animateTransform attributeName="transform" type="translate" values="0 0;0 1.2;0 0;0 -.6;0 0" dur=".7s" repeatCount="indefinite"/>' : ''
  const glass = `<g clip-path="url(#glass)"><g>${rock}${outside}</g><polygon points="70,${GT} 120,${GT} 40,${GB} ${GL - 10},${GB}" fill="#fff" opacity=".04"/></g>`

  const room = WALL + curtain(w.working) + VALANCE + TABLETOP + cup(w.working) + tableLamp(w.working)

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${n(y0)} ${W} ${n(view)}" width="${W}" height="${n(view)}" preserveAspectRatio="xMidYMax slice">${defs}` +
    `<rect x="0" y="${n(y0)}" width="${W}" height="${n(view)}" fill="#1b1624"/>` +
    retime(glass + room, elapsed) +
    '</svg>'
  )
}
// ---scene-end

const TERMINAL_ART: [string, string][] = [
  ['  ┌───────────────┐', '#c9a24a'],
  ['  │ ✦    ☾     ✦  │', '#fff6d8'],
  ['  │  /\\  /\\/\\    │', '#8fa8d8'],
  ['  │ ▲ ▲  ▲ ▲ ▲  ▲ │', '#4a6a8a'],
  ['  └───────────────┘', '#c9a24a'],
  ['  ━━━━ ☕ ━━━━━━━', '#a88a5a'],
]

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))

  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const label = (w: Train, now: number) => (w.working ? `Working ${clock(now - w.startedAt)} · tools ${w.tools}` : 'Idle')

const ride = atom(
  { plugin: 'night-train', key: 'ride' } as const,
  { working: false, tools: 0, startedAt: 0, endedAt: 0, travelled: 0, tick: 0 } as Train,
)

// The picture is built again only when the state it draws changes; the same text keeps it running.
let t0 = 0
let cache = { key: '', svg: '' }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    t0 = await $.clock.now()
    await $.command.register({
      name: 'train',
      description: 'Open the night-train window pane',
    })
    // Wakes the pane each second while Claude works (the stopwatch) and while the train pulls in.
    $.clock.every(1000, () => {
      void Promise.all([read($, ride), $.clock.now()])
        .then(([r, now]) =>
          r.working || (r.endedAt > 0 && now - r.endedAt < (ARRIVE + 1) * 1000) ? update($, ride, v => ({ ...v, tick: v.tick + 1 })) : undefined,
        )
        .catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'train' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Opened the night-train pane.' }
  })

  // The main loop's turns only: a subagent's run is not Claude at work.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, ride, v => {
        // a turn that starts while the train still rolls in counts only the distance it rolled so far
        const short = v.endedAt > 0 ? Math.max(0, ARRIVE - (now - v.endedAt) / 1000) : 0

        return v.working ? v : { ...v, working: true, tools: 0, startedAt: now, travelled: v.travelled - short }
      })
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, ride, v => (v.working ? { ...v, working: false, endedAt: now, travelled: v.travelled + (now - v.startedAt) / 1000 + ARRIVE } : v))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await update($, ride, v => ({ ...v, tools: v.tools + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const w = await read($, ride)
    const now = await $.clock.now()
    if (t0 === 0) t0 = now
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 20
    const line = label(w, now)

    if (e.surface !== 'terminal') {
      const { Box, Text, Svg } = els as ElementTable<'desktop'>
      // The pane's px: its cells over the code font's advance (about 7.8 px) and line height
      // (about 19.5 px). Short of the whole picture, the top of the window is cut, never the table.
      const width = Math.max(160, Math.round(cols * 7.8))
      const full = Math.round((width * H) / W)
      const tall = e.props?.scroll?.bodyRows ? Math.round((rows - 1) * 19.5) : full
      const height = Math.min(full, tall)
      // leaving and arriving each draw the station sliding; once that is over the picture settles
      const leaving = w.working && (now - w.startedAt) / 1000 < DEPART
      const arriving = !w.working && w.endedAt > 0 && (now - w.endedAt) / 1000 < ARRIVE
      const key = `${w.working}|${leaving}|${arriving}|${w.startedAt}|${w.endedAt}|${height}|${width}`
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
        <Text dimColor>The animation shows in the desktop app.</Text>
      </Box>
    )
  })
}
