import { atom, read, update } from 'claude-code'
import type { ElementTable, EngineInterface, Register } from 'claude-code'

import type { Ball, BallKind, Board, Layout, Reel, ReelOutcome } from '../types'

const PANE = 'pachinko'
const TITLE = '파칭코'
const ALT = '핀이 촘촘히 박힌 판 위로 공이 튕기며 떨어져 아래 배율 칸에 들어갑니다. 가운데 칸에 들어가면 숫자 릴이 돕니다.'

// ---- the board ------------------------------------------------------------------------
const W = 340
const H = 680
// The ball moves on a half-pin lattice: lane p sits at LEFT + p * DX / 2. Even rows hold pins on the even
// lanes, odd rows on the odd ones, so the grid fills the board wall to wall; the two outer lanes are walls.
const LEFT = 14
const DX = 24
const LANES = 26
const ROWS = 13 // odd, so the last hop lands between two pins: in a slot
const Y0 = 64
const DY = 40
const LAST = Y0 + (ROWS - 1) * DY
const SLOT_TOP = LAST + 22
const REST = SLOT_TOP + 52
const MULT = [1.5, 0.2, 0.8, 0.2, 1, 0.3, 8, 0.3, 1, 0.2, 0.8, 0.2, 1.5]
const CENTER = 6 // the slot that spins the reels
const FALL = 4 // the quickest a ball takes from the top to its slot, in seconds; each takes up to a second more
const GAP = 180 // ms between balls dropped together
const MAX_FLYING = 40
const MAX_REELS = 4 // spins waiting their turn
const KAKUHEN_BALLS = 15
const KAKUHEN_MAX = 45
const KAKUHEN_MULT = 2
const JACKPOT_MULT = 20
const GOLD_PAY = 0.5 // each gold pin hit adds half the ball's value, before the boosts
const CENTER_MULT = 8
const FEVER_MS = 30_000
const JACKPOT_CHANCE = 0.005
// One goal, the same every time: about nine ordinary turns of work (see the economy test). `goalLevel`
// counts the goals filled so far, plus one.
export const GOAL_COINS = 10_000
const CELEBRATE_MS = 4600
const RESET_WINDOW = 5000
const BUMP = 5 // lanes a bumper throws the ball
const STRONG = 0.4 // the chance a plain or gold pin kicks the ball three lanes instead of one
const MOMENTUM = 0.2 // how much a ball leans the way it last went

const laneX = (p: number) => LEFT + (p * DX) / 2
const slotX = (k: number) => laneX(2 * k + 1)
const r1 = (v: number) => String(Math.round(v * 10) / 10)
const s3 = (v: number) => String(Math.round(v * 1000) / 1000)
const FONT = 'font-family="system-ui,sans-serif"'

const pinId = (r: number, p: number) => r * 100 + p
const isWall = (p: number) => p === 0 || p === LANES

// A fresh board: about one pin in eight missing, a few bumpers that throw the ball three lanes, a few gold
// pins that pay on the way down. Row 0 stays whole, so every ball starts on a pin, and so do the walls.
export const makeLayout = (id: number, rand: () => number): Layout => {
  const gaps: number[] = []
  const bumpers: number[] = []
  const golds: number[] = []
  // A gap never touches another: not beside it, not in the row above or below, not two rows up in the same
  // lane, so a ball falls through at most one gap at a time and never in a long free drop.
  const isGap = new Set<number>()
  const touchesGap = (r: number, p: number) =>
    [pinId(r, p - 2), pinId(r - 1, p - 1), pinId(r - 1, p + 1), pinId(r - 2, p)].some(id => isGap.has(id))
  for (let r = 1; r < ROWS; r++) {
    for (let p = r % 2; p <= LANES; p += 2) {
      if (isWall(p)) continue
      const roll = rand()
      if (roll < 0.12) {
        // a roll for a gap that would touch another leaves a pin
        if (touchesGap(r, p)) continue
        isGap.add(pinId(r, p))
        gaps.push(pinId(r, p))
      } else if (roll < 0.155) bumpers.push(pinId(r, p))
      else if (roll < 0.195) golds.push(pinId(r, p))
    }
  }

  return { id, gaps, bumpers, golds }
}
export const PLAIN: Layout = { id: 0, gaps: [], bumpers: [], golds: [] }

let pinCache = { id: -1, svg: '' }
const pinsSvg = (layout: Layout) => {
  if (pinCache.id === layout.id) return pinCache.svg
  const gaps = new Set(layout.gaps)
  const bumpers = new Set(layout.bumpers)
  const golds = new Set(layout.golds)
  let svg = ''
  for (let r = 0; r < ROWS; r++) {
    for (let p = r % 2; p <= LANES; p += 2) {
      const id = pinId(r, p)
      if (gaps.has(id)) continue
      const x = r1(laneX(p))
      const y = Y0 + r * DY
      if (bumpers.has(id)) {
        // a ringed magenta bumper, unlike any ball
        svg +=
          `<circle cx="${x}" cy="${y}" r="7.5" fill="none" stroke="#b9789a" stroke-width="1.6"/>` +
          `<circle cx="${x}" cy="${y}" r="4.2" fill="#8a4a6a"/>`
      } else if (golds.has(id)) {
        // a gold pin with a still, soft halo
        svg += `<circle cx="${x}" cy="${y}" r="7" fill="#d9b65a" opacity=".16"/><circle cx="${x}" cy="${y}" r="3.8" fill="#c9a24a"/>`
      } else {
        svg += `<circle cx="${x}" cy="${y}" r="3" fill="#6a7078"/>`
      }
    }
  }
  pinCache = { id: layout.id, svg }

  return svg
}

const slotsSvg = () =>
  Array.from({ length: MULT.length + 1 }, (_, j) => {
    const x = laneX(2 * j)

    return `<rect x="${r1(x - 1.5)}" y="${SLOT_TOP}" width="3" height="${REST - SLOT_TOP + 10}" rx="1.5" fill="#454a51"/>`
  }).join('') +
  MULT.map((base, k) => {
    const m = k === CENTER ? CENTER_MULT : base
    const hot = m >= 5 ? '#d9b65a' : m >= 1 ? '#9cbf9f' : '#6e747b'

    return (
      `<rect x="${r1(slotX(k) - DX / 2 + 2)}" y="${REST + 10}" width="${DX - 4}" height="22" rx="4" fill="${hot}" opacity=".18"/>` +
      `<text x="${r1(slotX(k))}" y="${REST + 26}" text-anchor="middle" font-size="9" font-weight="700" ${FONT} fill="${hot}">×${m}</text>`
    )
  }).join('') +
  `<text x="${r1(slotX(CENTER))}" y="${REST + 46}" text-anchor="middle" font-size="9" font-weight="700" ${FONT} fill="#d9b65a">SPIN</text>`

const DEFS =
  '<defs>' +
  '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26282b"/><stop offset="1" stop-color="#1c1e21"/></linearGradient>' +
  '<linearGradient id="fever" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#30252a"/><stop offset="1" stop-color="#1f1c20"/></linearGradient>' +
  '<linearGradient id="kakuhen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2c2834"/><stop offset=".5" stop-color="#22252b"/><stop offset="1" stop-color="#2a2b30"/></linearGradient>' +
  '<radialGradient id="gold"><stop offset="0" stop-color="#fff7c0"/><stop offset=".6" stop-color="#ffc83a"/><stop offset="1" stop-color="#d48a00"/></radialGradient>' +
  '<linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d6d"/><stop offset=".25" stop-color="#ffd23f"/><stop offset=".5" stop-color="#3ddc84"/><stop offset=".75" stop-color="#3ad4ff"/><stop offset="1" stop-color="#b07cff"/></linearGradient>' +
  '</defs>'

// The ball's way down along its lanes: a hop over each pin it meets, higher off a bumper, a straight drop
// through a gap, and a last hop off a divider when it comes down on one.
export const pathOf = (ball: Ball, jitter: number) => {
  const lanes = ball.lanes
  let x = laneX(lanes[0] ?? ball.start)
  let d = `M${r1(x + jitter)} 10 L${r1(x)} ${Y0 - 9}`
  for (let r = 0; r <= ROWS; r++) {
    const nx = laneX(lanes[r + 1] ?? 0)
    const y = Y0 + r * DY - 9
    const ny = r === ROWS ? REST : r === ROWS - 1 ? SLOT_TOP - 9 : y + DY
    // each hop its own height, from the ball and the row
    const lift = 12 + ((ball.id * 13 + r * 7) % 13)
    const hit = ball.hits[r] ?? ''
    if (nx === x) d += ` L${r1(x)} ${ny}`
    else if (Math.abs(nx - x) > DX) {
      // a kick of three lanes or more travels along the gap between two rows of pins, so it never runs through
      // one, and drops onto the pin it meets at the far end
      const dx = nx - x
      d += ` C${r1(x + dx * 0.1)} ${y - 17} ${r1(nx - dx * 0.25)} ${y - 17} ${r1(nx)} ${y - 12} L${r1(nx)} ${ny}`
    } else if (hit === 'k') d += ` Q${r1(x + (nx - x) * 0.5)} ${y - 44 - (lift % 8)} ${r1(nx)} ${ny}`
    else if (hit === 'B' || hit === 'G') d += ` Q${r1(x + (nx - x) * 0.5)} ${y - 24 - (lift % 6)} ${r1(nx)} ${ny}`
    else d += ` Q${r1(x + (nx - x) * 0.55)} ${y - lift} ${r1(nx)} ${ny}`
    x = nx
  }

  return d
}

const ballSvg = (ball: Ball, begin: number) => {
  const b = s3(begin)
  const land = s3(begin + ball.dur)
  const jitter = ((ball.id * 37) % 9) - 4
  const x = slotX(ball.slot)
  const isJackpot = ball.kind === 'jackpot'
  const isBust = ball.kind === 'bust'
  const isSpecial = ball.kind === 'special'
  const radius = isJackpot || isSpecial ? 7.5 : 5.5
  const fill = isJackpot ? 'url(#gold)' : isSpecial ? 'url(#rainbow)' : ball.color
  const stroke = isBust ? '#ff4d4d' : '#ffffff'
  const golds = [...ball.hits].filter(h => h === 'g' || h === 'G').length
  const label = isBust
    ? '꽝'
    : `${ball.isFree ? '무료 ' : ''}${ball.label ? `${ball.label} ` : ''}${golds > 0 ? `★${golds} ` : ''}+${ball.payout.toLocaleString('en-US')}`
  const labelColor = isBust ? '#ff6b6b' : ball.isFree ? '#8d939a' : isJackpot || isSpecial ? '#ffe066' : '#ffffff'

  // An animation whose whole run ended before the picture was built never runs, so its fill="freeze" never
  // holds: a part already done is left out, and every part here ends at opacity 0 anyway.
  const isLive = (dur: number) => begin + ball.dur + dur > 0

  return (
    // the slot lights up as the ball drops in
    (isLive(0.7)
      ? `<rect x="${r1(x - DX / 2 + 2)}" y="${SLOT_TOP}" width="${DX - 4}" height="${REST - SLOT_TOP + 32}" rx="4" fill="${isBust ? '#c4675e' : '#dfe4ea'}" opacity="0">` +
        `<animate attributeName="opacity" values="0;.3;0" begin="${land}s" dur=".7s" fill="freeze"/></rect>`
      : '') +
    (isJackpot && isLive(1.2)
      ? `<rect width="${W}" height="${H}" fill="#dfe4ea" opacity="0"><animate attributeName="opacity" values="0;.18;0" begin="${land}s" dur="1.2s" fill="freeze"/></rect>`
      : '') +
    (isLive(0)
      ? `<circle r="${radius}" fill="${fill}" stroke="${stroke}" stroke-opacity=".7" stroke-width="1.2" opacity="0">` +
        `<animateMotion path="${pathOf(ball, jitter)}" begin="${b}s" dur="${s3(ball.dur)}s" fill="freeze"/>` +
        `<animate attributeName="opacity" values="1;1;0" keyTimes="0;.82;1" begin="${b}s" dur="${s3(ball.dur + 0.6)}s" fill="freeze"/></circle>`
      : '') +
    (isLive(1.4)
      ? `<text x="${r1(Math.min(W - 40, Math.max(40, x)))}" y="${SLOT_TOP + 20}" text-anchor="middle" font-size="${isJackpot || isSpecial ? 16 : 12}" font-weight="800" ${FONT} fill="${labelColor}" stroke="#000" stroke-width=".6" opacity="0">${label}` +
        `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.7;1" begin="${land}s" dur="1.4s" fill="freeze"/>` +
        `<animateTransform attributeName="transform" type="translate" values="0 0;0 -46" begin="${land}s" dur="1.4s" fill="freeze"/></text>`
      : '')
  )
}

// ---- the reels ------------------------------------------------------------------------
// Each reel's stop, in seconds from the spin: two alike make a reach, and the last reel takes its time.
export const reelStops = (reel: Pick<Reel, 'digits'>) => (reel.digits[0] === reel.digits[1] ? [1, 1.5, 3.2] : [1, 1.5, 2])
export const reelMs = (reel: Pick<Reel, 'digits'>) => (reelStops(reel)[2] ?? 2) * 1000
const REEL_LINGER = 2200 // ms the result stays after the last reel stops

export const rollReel = (rand: () => number): { digits: number[]; outcome: ReelOutcome } => {
  const r = rand()
  const digit = () => 1 + Math.floor(rand() * 9)
  const other = (a: number) => (a % 9) + 1
  if (r < 0.05) return { digits: [7, 7, 7], outcome: 'kakuhen' }
  if (r < 0.17) {
    const a = digit()

    return { digits: [a === 7 ? 3 : a, a === 7 ? 3 : a, a === 7 ? 3 : a], outcome: 'bonus' }
  }
  const a = digit()
  if (r < 0.45) {
    // a reach that misses
    const c = digit()

    return { digits: [a, a, c === a ? other(a) : c], outcome: 'miss' }
  }
  const b = digit()

  return { digits: [a, b === a ? other(a) : b, digit()], outcome: 'miss' }
}

const RW = 50
const RH = 60
const RX = W / 2 - (3 * RW + 2 * 10) / 2
const RY = 250

const reelSvg = (reel: Reel, begin: number) => {
  const stops = reelStops(reel)
  const end = begin + (stops[2] ?? 2)
  const isReach = reel.digits[0] === reel.digits[1]
  let g =
    `<g opacity="0"><set attributeName="opacity" to="1" begin="${s3(begin)}s"/><set attributeName="opacity" to="0" begin="${s3(end + REEL_LINGER / 1000)}s"/>` +
    `<rect x="${r1(RX - 14)}" y="${RY - 30}" width="${3 * RW + 20 + 28}" height="${RH + 70}" rx="12" fill="#1a1c1f" fill-opacity=".94" stroke="#4d535a" stroke-width="2"/>` +
    `<text x="${W / 2}" y="${RY - 12}" text-anchor="middle" font-size="11" font-weight="800" ${FONT} fill="#8b9198">★ SPIN ★</text>`
  reel.digits.forEach((res, i) => {
    const x = RX + i * (RW + 10)
    const n = 18 + i * 6
    const clip = `rc${reel.id}_${i}`
    const column = Array.from({ length: n }, (_, j) => {
      const d = (res + (n - 1 - j)) % 10
      const color = d === 7 ? '#b8453a' : '#26282b'

      return `<text x="${r1(x + RW / 2)}" y="${RY + 44 + j * RH}" text-anchor="middle" font-size="40" font-weight="900" ${FONT} fill="${color}">${d}</text>`
    }).join('')
    const stop = stops[i] ?? 1
    // a reel that stopped before the picture was built is drawn stopped: a spin over by then never runs
    const spin =
      begin + stop > 0
        ? `<g>${column}<animateTransform attributeName="transform" type="translate" values="0 0;0 ${-(n - 1) * RH}" calcMode="spline" keyTimes="0;1" keySplines=".25 .6 .3 1" begin="${s3(begin)}s" dur="${stop}s" fill="freeze"/></g>`
        : `<g transform="translate(0 ${-(n - 1) * RH})">${column}</g>`
    g +=
      `<clipPath id="${clip}"><rect x="${r1(x)}" y="${RY}" width="${RW}" height="${RH}" rx="6"/></clipPath>` +
      `<rect x="${r1(x)}" y="${RY}" width="${RW}" height="${RH}" rx="6" fill="#dde1e6"/>` +
      `<g clip-path="url(#${clip})">${spin}</g>`
  })
  if (isReach && end > 0) {
    g +=
      `<text x="${W / 2}" y="${RY + RH + 30}" text-anchor="middle" font-size="16" font-weight="900" ${FONT} fill="#ff4d6d" opacity="0">리치!` +
      `<animate attributeName="opacity" values="0;1" begin="${s3(begin + (stops[1] ?? 1.5))}s" dur="${s3((stops[2] ?? 3) - (stops[1] ?? 1.5))}s"/></text>`
  }
  const [word, color] =
    reel.outcome === 'kakuhen'
      ? [reel.isFree ? '777! (무료)' : '찬스 타임!', '#ffd23f']
      : reel.outcome === 'bonus'
        ? ['보너스 10구!', '#3ddc84']
        : ['아쉽…', '#8a96a8']
  g +=
    `<text x="${W / 2}" y="${RY + RH + 30}" text-anchor="middle" font-size="18" font-weight="900" ${FONT} fill="${color}" opacity="0">${word}` +
    `<set attributeName="opacity" to="1" begin="${s3(end)}s"/></text>`
  if (reel.outcome === 'kakuhen' && end + 1.2 > 0) {
    g += `<rect width="${W}" height="${H}" fill="#dfe4ea" opacity="0"><animate attributeName="opacity" values="0;.18;0" begin="${s3(end)}s" dur="1.2s" fill="freeze"/></rect>`
  }

  return g + '</g>'
}

// ---- the goal ------------------------------------------------------------------------

// Moves past every goal the balance has filled, carrying the surplus into the next. Undefined when none was.
export const checkGoal = (b: Board, now: number) => {
  let level = b.goalLevel
  let start = b.goalStart
  const reached: number[] = []
  while (level > 0 && b.balance - start >= GOAL_COINS) {
    start += GOAL_COINS
    reached.push(level)
    level += 1
  }
  if (reached.length === 0) return undefined

  return {
    board: { ...b, goalLevel: level, goalStart: start, celebrateAt: now, log: pushLog(b.log, `🎉 목표 ${reached[reached.length - 1]}번째 달성! 다시 ${coins(GOAL_COINS)}코인`) },
    reached,
  }
}

const CONFETTI = ['#f2c14e', '#f28b82', '#7fd1ae', '#8ab4f8', '#c58af9', '#f6aea9', '#fde293', '#e8eaed']
export const RAIN = 70 // confetti falling from the top
export const CANNON = 40 // confetti shot up from each bottom corner

// One piece of confetti on a path: a strip, a square or a dot, spinning as it goes, gone by the end.
const piece = (i: number, path: string, at: number, dur: number) => {
  const color = CONFETTI[(i * 5) % CONFETTI.length]
  const spin = (i % 2 === 0 ? 1 : -1) * (240 + ((i * 41) % 480))
  const kind = i % 4
  const shape =
    kind === 0
      ? `<rect x="-6" y="-1.5" width="12" height="3" rx="1" fill="${color}">`
      : kind === 1
        ? `<rect x="-3.5" y="-3.5" width="7" height="7" rx="1" fill="${color}">`
        : kind === 2
          ? `<circle r="3" fill="${color}">`
          : `<rect x="-4" y="-2.5" width="8" height="5" rx="1" fill="${color}">`
  const close = kind === 2 ? '</circle>' : '</rect>'

  return (
    `<g class="cf" opacity="0"><set attributeName="opacity" to="1" begin="${s3(at)}s"/>` +
    `<animateMotion path="${path}" begin="${s3(at)}s" dur="${s3(dur)}s" fill="freeze"/>` +
    `<animate attributeName="opacity" values="1;1;0" keyTimes="0;.8;1" begin="${s3(at)}s" dur="${s3(dur)}s" fill="freeze"/>` +
    shape +
    `<animateTransform attributeName="transform" type="rotate" values="0;${spin}" begin="${s3(at)}s" dur="${s3(dur)}s" fill="freeze"/>${close}</g>`
  )
}

// Two confetti cannons fire from the bottom corners, a rain of it follows from the top, a starburst and a ring
// open behind the words, and the words bounce in. It all ends within CELEBRATE_MS and none of it loops. A
// celebration already over when the board is rebuilt is not drawn.
const celebrationSvg = (b: Board, begin: number) => {
  const total = CELEBRATE_MS / 1000
  if (b.celebrateAt === 0 || begin + total <= 0) return ''
  const t = s3(begin)
  const reached = b.goalLevel - 1
  const cx = W / 2
  const cy = Math.round(H * 0.42)
  let g =
    `<rect width="${W}" height="${H}" rx="14" fill="#0e1012" opacity="0">` +
    `<animate attributeName="opacity" values="0;.6;.6;0" keyTimes="0;.08;.85;1" begin="${t}s" dur="${total}s" fill="freeze"/></rect>`

  // the starburst: rays that shoot out once from behind the words and fade
  const rays = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2
    const long = i % 2 === 0 ? 150 : 105

    return `<line x1="${r1(Math.cos(a) * 22)}" y1="${r1(Math.sin(a) * 22)}" x2="${r1(Math.cos(a) * long)}" y2="${r1(Math.sin(a) * long)}" stroke="${i % 2 === 0 ? '#f2c14e' : '#fde293'}" stroke-width="${i % 2 === 0 ? 3 : 2}" stroke-linecap="round"/>`
  }).join('')
  g +=
    `<g transform="translate(${cx} ${cy})" opacity="0">` +
    `<animate attributeName="opacity" values="0;.75;0" keyTimes="0;.25;1" begin="${s3(begin + 0.15)}s" dur="1.3s" fill="freeze"/>` +
    `<g>${rays}<animateTransform attributeName="transform" type="scale" values=".2;1.15" calcMode="spline" keyTimes="0;1" keySplines=".2 .7 .3 1" begin="${s3(begin + 0.15)}s" dur="1.3s" fill="freeze"/></g></g>` +
    `<circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="#f2c14e" stroke-width="3" opacity="0">` +
    `<animate attributeName="r" values="10;175" begin="${s3(begin + 0.1)}s" dur="1.1s" fill="freeze"/>` +
    `<animate attributeName="opacity" values="0;.7;0" keyTimes="0;.15;1" begin="${s3(begin + 0.1)}s" dur="1.1s" fill="freeze"/></circle>`

  // the cannons: each piece flies up and out from its corner, then falls
  for (let i = 0; i < CANNON * 2; i++) {
    const isLeft = i % 2 === 0
    const sx = isLeft ? 14 : W - 14
    const sy = H - 120
    const reach = 50 + ((i * 47) % 230)
    const ex = isLeft ? sx + reach : sx - reach
    const apex = 260 + ((i * 31) % 300)
    const at = begin + ((i * 13) % 12) / 40
    g += piece(i, `M${sx} ${sy} Q${r1((sx + ex) / 2)} ${sy - apex * 2} ${r1(ex)} ${r1(sy - apex * 0.4 + 260)}`, at, 2.3 + ((i * 29) % 10) / 12)
  }
  // the rain from the top, a beat later
  for (let i = 0; i < RAIN; i++) {
    const x = 10 + ((i * 53) % (W - 20))
    const drift = ((i * 37) % 90) - 45
    g += piece(i + 7, `M${x} -10 Q${x + drift} ${H * 0.35} ${x + drift / 2} ${H * 0.85}`, begin + 0.35 + ((i * 17) % 20) / 18, 2.2 + ((i * 29) % 10) / 9)
  }

  // the words, bouncing in over the burst
  g +=
    `<g transform="translate(${cx} ${cy})" opacity="0">` +
    `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.06;.85;1" begin="${t}s" dur="${total}s" fill="freeze"/>` +
    `<g><animateTransform attributeName="transform" type="scale" values=".3;1.22;.94;1.04;1" keyTimes="0;.08;.13;.17;.21" begin="${t}s" dur="${total}s" fill="freeze"/>` +
    `<text y="-4" text-anchor="middle" font-size="38" font-weight="900" ${FONT} fill="#f2c14e" stroke="#7a5a12" stroke-width="1.2" paint-order="stroke">목표 달성!</text>` +
    `<text y="28" text-anchor="middle" font-size="16" font-weight="800" ${FONT} fill="#f1f3f4">${reached}번째 클리어</text>` +
    `<text y="52" text-anchor="middle" font-size="12" font-weight="700" ${FONT} fill="#aeb4bb">다시 ${coins(GOAL_COINS)}코인</text>` +
    '</g></g>'

  return g
}

export const buildBoard = (b: Board, now: number) => {
  const isFever = b.feverUntil > now
  const isKakuhen = b.kakuhen > 0
  const layer = isKakuhen
    ? `<rect width="${W}" height="${H}" rx="14" fill="url(#kakuhen)"/>`
    : isFever
      ? `<rect width="${W}" height="${H}" rx="14" fill="url(#fever)"/>`
      : ''
  const banner = isKakuhen ? `찬스 ×${KAKUHEN_MULT}` : isFever ? '피버 ×2' : ''
  const frame = isKakuhen
    ? `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="12" fill="none" stroke="#9a86b8" stroke-width="3"/>`
    : isFever
      ? `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="12" fill="none" stroke="#b56a5e" stroke-width="3"/>`
      : `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="12" fill="none" stroke="#4d535a" stroke-width="2.5"/>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${DEFS}` +
    `<rect width="${W}" height="${H}" rx="14" fill="url(#bg)"/>` +
    layer +
    (banner ? `<text x="${W / 2}" y="34" text-anchor="middle" font-size="22" font-weight="900" ${FONT} fill="${isKakuhen ? '#d9b65a' : '#c98a7a'}" opacity=".35">${banner}</text>` : '') +
    frame +
    pinsSvg(b.layout) +
    slotsSvg() +
    b.balls.map(ball => ballSvg(ball, (ball.at - now) / 1000)).join('') +
    b.reels.map(reel => reelSvg(reel, (reel.at - now) / 1000)).join('') +
    celebrationSvg(b, (b.celebrateAt - now) / 1000) +
    '</svg>'
  )
}

// ---- the game -------------------------------------------------------------------------
const COLORS: Record<string, [string, number]> = {
  Edit: ['#f5c542', 20],
  Write: ['#f5c542', 20],
  NotebookEdit: ['#f5c542', 20],
  Bash: ['#ef5a5a', 15],
  PowerShell: ['#ef5a5a', 15],
  Read: ['#5aa9ef', 8],
  Grep: ['#5aa9ef', 8],
  Glob: ['#5aa9ef', 8],
  WebFetch: ['#4fd1a5', 12],
  WebSearch: ['#4fd1a5', 12],
  Agent: ['#b07cff', 15],
}
const TURN: [string, number] = ['#ffffff', 10]
const OTHER: [string, number] = ['#c8ccd4', 10]
const SHELLS = new Set(['Bash', 'PowerShell'])
const EDITS = new Set(['Edit', 'Write', 'NotebookEdit'])
const COMMIT = /\bgit\s+commit\b/
const TEST =
  /\b(pytest|jest|vitest|mocha|unittest|(npm|pnpm|yarn|bun)\s+(run\s+)?test|cargo\s+test|go\s+test|dotnet\s+test|gradlew?\s+test|mvn\s+test|plugin\s+test)\b/
const RUSH_FILES = 10

// ---- what each ball is ------------------------------------------------------------------
export type GuideKey = 'start' | 'read' | 'edit' | 'shell' | 'web' | 'other' | 'agent' | 'commit' | 'test' | 'comeback' | 'bust' | 'jackpot' | 'bonus' | 'multi' | 'free'
const worth = (tool: string) => COLORS[tool]?.[1] ?? OTHER[1]
const KIND_OF: Record<string, GuideKey> = {
  Edit: 'edit', Write: 'edit', NotebookEdit: 'edit', Bash: 'shell', PowerShell: 'shell',
  Read: 'read', Grep: 'read', Glob: 'read', WebFetch: 'web', WebSearch: 'web', Agent: 'agent',
}

// One line each: the dot is the ball's color, shown in the log when it drops and in the guide.
export const BALL_GUIDE: { key: GuideKey; dot: string; name: string; when: string; effect: string }[] = [
  { key: 'start', dot: '⚪', name: '시작 공', when: 'Claude가 작업(턴)을 시작할 때', effect: `값 ${TURN[1]}` },
  { key: 'read', dot: '🔵', name: '읽기 공', when: 'Read · Grep · Glob', effect: `값 ${worth('Read')}` },
  { key: 'edit', dot: '🟡', name: '수정 공', when: 'Edit · Write · NotebookEdit', effect: `값 ${worth('Edit')}, 가장 큼` },
  { key: 'shell', dot: '🔴', name: '명령 공', when: 'Bash · PowerShell', effect: `값 ${worth('Bash')}` },
  { key: 'web', dot: '🟢', name: '웹 공', when: 'WebFetch · WebSearch', effect: `값 ${worth('WebFetch')}` },
  { key: 'other', dot: '🔘', name: '기타 공', when: '그 밖의 도구', effect: `값 ${OTHER[1]}` },
  { key: 'agent', dot: '🟣', name: '서브에이전트 공', when: '서브에이전트(Agent) 실행', effect: `5개가 한꺼번에, 값 ${worth('Agent')}씩` },
  { key: 'commit', dot: '📦', name: '커밋 공', when: 'git commit 실행', effect: `무지개 공, 값 ${worth('Bash') * 5} (×5)` },
  { key: 'test', dot: '🧪', name: '테스트 공', when: '테스트 명령이 에러 없이 끝남', effect: `무지개 공, 값 ${worth('Bash') * 3} (×3)` },
  { key: 'comeback', dot: '🔁', name: '역전 공', when: '실패했던 테스트가 다시 통과', effect: `무지개 공, 값 ${worth('Bash') * 10} (×10)` },
  { key: 'bust', dot: '⚫', name: '꽝 공', when: '도구가 에러로 끝남', effect: '0코인, 콤보가 끊김' },
  { key: 'jackpot', dot: '⭐', name: '잭팟 공', when: '공이 떨어질 때 0.5% 확률', effect: `금빛 공, 코인 ×${JACKPOT_MULT}` },
  { key: 'bonus', dot: '🎰', name: '보너스 공', when: '릴에서 7이 아닌 같은 숫자 3개', effect: '흰 공 10개 추가' },
  { key: 'multi', dot: '✨', name: '멀티볼', when: '공이 떨어질 때 약 2% 확률', effect: '흰 공 3개 추가' },
  { key: 'free', dot: '◽', name: '무료 공', when: '/pachinko drop', effect: '보기용, 코인·목표에 안 들어감' },
]
export const GUIDE_NOTES = [
  '코인 = 공 값 × 칸 배율(황금 핀마다 +0.5) × 콤보 × 피버(×2) × 찬스 타임(×2)',
  '공이 칸에 들어갈 때 번 코인이 떠오릅니다',
]
export const guideLine = (g: { dot: string; name: string; when: string; effect: string }) => `${g.dot} ${g.name} · ${g.when} → ${g.effect}`
export const guideText = () => ['공 설명', ...BALL_GUIDE.map(guideLine), ...GUIDE_NOTES].join('\n')
// The log line for an ordinary tool ball: what it is and what set it off.
const plainLine = (tool: string, value: number) => {
  const g = BALL_GUIDE.find(one => one.key === (KIND_OF[tool] ?? 'other'))!

  return `${g.dot} ${g.name} · ${tool} (값 ${value})`
}

export const EMPTY: Board = {
  seq: 1,
  layout: PLAIN,
  balls: [],
  reels: [],
  balance: 0,
  combo: 0,
  feverUntil: 0,
  kakuhen: 0,
  goalLevel: 0,
  goalStart: 0,
  celebrateAt: 0,
  resetArmedAt: 0,
  isGuideOpen: false,
  testFailed: false,
  turnFiles: [],
  isRush: false,
  log: [],
  tick: 0,
  totalBalls: 0,
  jackpots: 0,
  kakuhens: 0,
  best: 0,
}
const board = atom({ plugin: 'pachinko', key: 'board' } as const, EMPTY, { shape: 'board-8' })

type Bank = Pick<Board, 'balance' | 'totalBalls' | 'jackpots' | 'kakuhens' | 'best' | 'goalLevel' | 'goalStart'>
const BANK = 'bank'

export const comboMult = (combo: number) => Math.min(3, 1 + Math.floor(combo / 5) * 0.5)
const coins = (n: number) => n.toLocaleString('en-US')
const pushLog = (log: string[], line: string) => [line, ...log].slice(0, 5)

export type Aim = 'any' | 'left' | 'center' | 'right'
export type Drop = { color: string; value: number; kind?: BallKind; label?: string; aim?: Aim; isFree?: boolean }

// Which top-row pins a launch aims at, as the first and last pin (lane / 2).
const AIMS: Record<Aim, [number, number]> = { any: [0, 13], left: [0, 4], center: [5, 8], right: [9, 13] }
const AIM_NAMES: Record<Aim, string> = { any: '아무 데나', left: '왼쪽', center: '가운데', right: '오른쪽' }
const LAUNCH_VALUE = 10
const LAUNCH_COLOR = '#d3d8de'
const MAX_LAUNCH = 20
export type GameEvent = 'jackpot' | 'fever' | 'multiball' | 'kakuhen' | 'bonus' | 'freeBonus' | 'shuffle'

// One ball's way down the layout. At a pin it bounces left or right, leaning the way it last went
// (MOMENTUM) and toward the center by `pull`; one bounce in four is a strong one that kicks it three lanes
// ('B', 'G' on a gold pin). A bumper throws it five, a gap or the space between pins lets it fall a row, and
// one that comes down on a divider hops off it into a slot. A kick that would leave the board is cut short.
export const walk = (layout: Layout, start: number, pull: number, rand: () => number) => {
  const gaps = new Set(layout.gaps)
  const bumpers = new Set(layout.bumpers)
  const golds = new Set(layout.golds)
  let last = 0
  const lean = (p: number) => Math.min(0.9, Math.max(0.1, 0.5 + (p < LANES / 2 ? pull : p > LANES / 2 ? -pull : 0) + last * MOMENTUM))
  const onBoard = (q: number) => q >= 0 && q <= LANES
  const lanes = [start]
  let hits = ''
  let p = start
  for (let r = 0; r < ROWS; r++) {
    const id = pinId(r, p)
    if (p % 2 !== r % 2 || gaps.has(id)) {
      hits += 'f'
      lanes.push(p)
      continue
    }
    const dir = p === 0 ? 1 : p === LANES ? -1 : rand() < lean(p) ? 1 : -1
    if (bumpers.has(id)) {
      hits += 'k'
      p += [BUMP, 3, 1].map(n => dir * n).find(step => onBoard(p + step)) ?? dir
    } else {
      const isGold = golds.has(id)
      const isStrong = rand() < STRONG && onBoard(p + dir * 3)
      hits += isGold ? (isStrong ? 'G' : 'g') : isStrong ? 'B' : 'b'
      p += isStrong ? dir * 3 : dir
    }
    last = dir
    lanes.push(p)
  }
  if (p % 2 === 0) p += p === 0 ? 1 : p === LANES ? -1 : rand() < lean(p) ? 1 : -1
  lanes.push(p)

  return { lanes, hits }
}

// Lays the path and the payout of each ball now; the coins land with the ball.
export const dropBalls = (b: Board, drops: Drop[], now: number, rand: () => number = Math.random) => {
  const events: GameEvent[] = []
  let at = Math.max(now, ...b.balls.map(one => one.at + GAP))
  let feverUntil = b.feverUntil
  let kakuhen = b.kakuhen
  let seq = b.seq
  let layout = b.layout
  const queue = [...drops]
  const balls: Ball[] = []
  while (queue.length > 0) {
    const drop = queue.shift()!
    // chance time leans each bounce toward the center lane
    const pull = kakuhen > 0 ? 0.08 : 0
    // a random pin of the top row to start on, within the aim; at a wall the only way is back in
    const [lo, hi] = AIMS[drop.aim ?? 'any']
    const start = 2 * (lo + Math.floor(rand() * (hi - lo + 1)))
    const { lanes, hits } = walk(layout, start, pull, rand)
    const slot = ((lanes[lanes.length - 1] ?? 1) - 1) / 2
    const dur = Math.round((FALL + rand()) * 1000) / 1000
    let kind: BallKind = drop.kind ?? 'normal'
    const isFree = drop.isFree === true
    if (kind === 'normal') {
      const roll = rand()
      const jackpot = JACKPOT_CHANCE
      if (roll < jackpot) {
        kind = 'jackpot'
        if (!isFree) events.push('jackpot')
      } else if (isFree) {
        if (roll < jackpot + 0.03 && roll >= jackpot + 0.01) queue.push(...Array.from({ length: 3 }, () => ({ ...drop })))
      } else if (roll < jackpot + 0.01 && feverUntil <= now) {
        feverUntil = now + FEVER_MS
        events.push('fever')
      } else if (roll < jackpot + 0.03) {
        queue.push(...Array.from({ length: 3 }, () => ({ color: '#ffffff', value: 10 })))
        events.push('multiball')
      } else if (roll < jackpot + 0.045) {
        layout = makeLayout(seq++, rand)
        events.push('shuffle')
      }
    }
    const isKakuhen = !isFree && kakuhen > 0
    if (isKakuhen) kakuhen -= 1
    const mult = slot === CENTER ? CENTER_MULT : (MULT[slot] ?? 1)
    const boost = isFree
      ? kind === 'jackpot' ? JACKPOT_MULT : 1
      : comboMult(b.combo) * (feverUntil > at ? 2 : 1) * (isKakuhen ? KAKUHEN_MULT : 1) * (kind === 'jackpot' ? JACKPOT_MULT : 1)
    const gold = [...hits].filter(h => h === 'g' || h === 'G').length * GOLD_PAY
    const payout = kind === 'bust' ? 0 : Math.max(1, Math.round(drop.value * (mult + gold) * boost))
    balls.push({
      id: seq++,
      at,
      start,
      lanes,
      hits,
      dur,
      slot,
      color: kind === 'bust' ? '#2a2a2a' : drop.color,
      payout,
      kind,
      label: drop.label ?? '',
      isFree,
      isPaid: false,
    })
    at += GAP + Math.round(rand() * 120)
  }
  const flying = [...b.balls, ...balls].slice(-MAX_FLYING)

  const counted = balls.filter(one => !one.isFree).length

  return { board: { ...b, seq, layout, balls: flying, feverUntil, kakuhen, totalBalls: b.totalBalls + counted }, events }
}

// A launch by hand: n free balls at the aim. They play out on the board like any other, but the coins they
// show are never counted, so they cost nothing and fill no goal.
export const launch = (b: Board, n: number, aim: Aim, now: number, rand: () => number = Math.random) => {
  const drops = Array.from({ length: Math.min(MAX_LAUNCH, Math.max(1, n)) }, () => ({ color: LAUNCH_COLOR, value: LAUNCH_VALUE, aim, isFree: true }))
  const out = dropBalls(b, drops, now, rand)

  return { board: { ...out.board, log: pushLog(out.board.log, `🎯 ${AIM_NAMES[aim]} 무료 발사 ${drops.length}개`) }, events: out.events }
}

// Pays the balls that reached their slot, spins the reels for the ones in the center, applies the reels
// that stopped, and lets go of what has faded. Undefined when nothing changed.
export const settle = (b: Board, now: number, rand: () => number = Math.random) => {
  const landsAt = (one: Ball) => one.at + one.dur * 1000
  const landed = b.balls.filter(one => !one.isPaid && landsAt(one) <= now)
  const stopped = b.reels.filter(reel => !reel.isDone && reel.at + reelMs(reel) <= now)
  const fadedBall = b.balls.some(one => landsAt(one) + 1600 <= now)
  const fadedReel = b.reels.some(reel => reel.at + reelMs(reel) + REEL_LINGER <= now)
  if (landed.length === 0 && stopped.length === 0 && !fadedBall && !fadedReel) return undefined

  const events: GameEvent[] = []
  let seq = b.seq
  let kakuhen = b.kakuhen
  let kakuhens = b.kakuhens
  let log = b.log
  const reels = b.reels
    .filter(reel => reel.at + reelMs(reel) + REEL_LINGER > now)
    .map(reel => {
      if (!stopped.includes(reel)) return reel
      if (reel.isFree) {
        if (reel.outcome === 'bonus') events.push('freeBonus')

        return { ...reel, isDone: true }
      }
      if (reel.outcome === 'kakuhen') {
        kakuhen = Math.min(KAKUHEN_MAX, kakuhen + KAKUHEN_BALLS)
        kakuhens += 1
        events.push('kakuhen')
        log = pushLog(log, `🌈 7-7-7 찬스 타임! 공 ${KAKUHEN_BALLS}개 동안 ×${KAKUHEN_MULT}`)
      } else if (reel.outcome === 'bonus') {
        events.push('bonus')
        log = pushLog(log, `🎰 ${reel.digits.join('-')} 보너스 10구`)
      }

      return { ...reel, isDone: true }
    })
  // each center hit queues a spin after the one before it
  for (const one of landed) {
    if (one.slot !== CENTER || one.kind === 'bust') continue
    if (reels.filter(reel => !reel.isDone).length >= MAX_REELS) break
    const last = reels[reels.length - 1]
    const at = Math.max(now, last ? last.at + reelMs(last) + 400 : 0)
    reels.push({ id: seq++, at, ...rollReel(rand), isFree: one.isFree, isDone: false })
  }
  const counted = landed.filter(one => !one.isFree)
  const won = counted.reduce((sum, one) => sum + one.payout, 0)

  return {
    board: {
      ...b,
      seq,
      kakuhen,
      kakuhens,
      log,
      reels,
      balance: b.balance + won,
      best: Math.max(b.best, ...counted.map(one => one.payout)),
      jackpots: b.jackpots + counted.filter(one => one.kind === 'jackpot').length,
      balls: b.balls.filter(one => landsAt(one) + 1600 > now).map(one => (landed.includes(one) ? { ...one, isPaid: true } : one)),
    },
    events,
  }
}

// What a finished tool call drops, read from what it did: a commit, a test run, a rush of edits.
export const workBalls = (b: Board, tool: string, input: Record<string, unknown>, isError: boolean, now: number) => {
  const [color, value] = COLORS[tool] ?? OTHER
  const command = SHELLS.has(tool) && typeof input.command === 'string' ? input.command : ''
  const isTest = TEST.test(command)
  if (isError) {
    return {
      board: { ...b, combo: 0, testFailed: b.testFailed || isTest },
      drops: [{ color, value, kind: 'bust' as const }],
      line: isTest ? '💥 테스트 실패: 꽝 공, 콤보 끊김' : `💥 ${tool} 에러: 꽝 공, 콤보 끊김`,
      toast: undefined,
    }
  }
  const next = { ...b, combo: b.combo + 1 }
  if (tool === 'Agent') {
    return { board: next, drops: Array.from({ length: 5 }, () => ({ color, value })), line: `🟣 서브에이전트 공 5개 · Agent (값 ${value}씩)`, toast: undefined }
  }
  if (COMMIT.test(command)) {
    return {
      board: next,
      drops: [{ color, value: value * 5, kind: 'special' as const, label: '커밋' }],
      line: '📦 커밋 대박 공 (×5)',
      toast: '📦 커밋! 대박 공이 떨어집니다',
    }
  }
  if (isTest && b.testFailed) {
    return {
      board: { ...next, testFailed: false },
      drops: [{ color, value: value * 10, kind: 'special' as const, label: '역전' }],
      line: '🔁 실패했던 테스트 통과: 역전 공 (×10)',
      toast: '🔁 역전! 실패했던 테스트가 통과했습니다',
    }
  }
  if (isTest) {
    return { board: next, drops: [{ color, value: value * 3, kind: 'special' as const, label: '테스트' }], line: '🧪 테스트 통과: 무지개 공 (×3)', toast: undefined }
  }
  const file = EDITS.has(tool) && typeof input.file_path === 'string' ? input.file_path : ''
  if (file && !next.turnFiles.includes(file)) {
    const turnFiles = [...next.turnFiles, file]
    if (turnFiles.length >= RUSH_FILES && !next.isRush) {
      return {
        board: { ...next, turnFiles, isRush: true, feverUntil: Math.max(next.feverUntil, now) + 20_000 },
        drops: [{ color, value }],
        line: `🏃 러시! 한 턴에 파일 ${RUSH_FILES}개: 피버 +20초`,
        toast: `🏃 러시! 한 턴에 파일 ${RUSH_FILES}개 수정`,
      }
    }

    return { board: { ...next, turnFiles }, drops: [{ color, value }], line: plainLine(tool, value), toast: undefined }
  }

  return { board: next, drops: [{ color, value }], line: plainLine(tool, value), toast: undefined }
}

let cache = { key: '', svg: '' }

async function save($: EngineInterface) {
  const b = await read($, board)
  const bank: Bank = { balance: b.balance, totalBalls: b.totalBalls, jackpots: b.jackpots, kakuhens: b.kakuhens, best: b.best, goalLevel: b.goalLevel, goalStart: b.goalStart }
  await $.store.set(BANK, bank)
}

async function announce($: EngineInterface, events: GameEvent[]) {
  for (const ev of events) {
    if (ev === 'jackpot') {
      $.ui.toast(`🎰 잭팟! 이번 공은 ×${JACKPOT_MULT}`)
      await update($, board, b => ({ ...b, log: pushLog(b.log, `🎰 잭팟 공 등장 (×${JACKPOT_MULT})`) }))
    } else if (ev === 'fever') {
      $.ui.toast(`🔥 피버 타임! ${FEVER_MS / 1000}초 동안 ×2`)
      await update($, board, b => ({ ...b, log: pushLog(b.log, `🔥 피버 ${FEVER_MS / 1000}초 (×2)`) }))
    } else if (ev === 'multiball') {
      await update($, board, b => ({ ...b, log: pushLog(b.log, '✨ 멀티볼 +3') }))
    } else if (ev === 'kakuhen') {
      $.ui.toast(`🌈 7-7-7 찬스 타임! 공 ${KAKUHEN_BALLS}개 동안 ×${KAKUHEN_MULT}`)
    } else if (ev === 'bonus') {
      await drop($, Array.from({ length: 10 }, () => ({ color: '#ffffff', value: 10 })))
    } else if (ev === 'freeBonus') {
      await drop($, Array.from({ length: 10 }, () => ({ color: LAUNCH_COLOR, value: LAUNCH_VALUE, isFree: true })))
    } else if (ev === 'shuffle') {
      $.ui.toast('🔀 핀 셔플! 판이 바뀌었습니다')
      await update($, board, b => ({ ...b, log: pushLog(b.log, '🔀 핀 셔플: 새 판') }))
    }
  }
}

async function drop($: EngineInterface, drops: Drop[], line?: string) {
  const now = await $.clock.now()
  let events: GameEvent[] = []
  await update($, board, b => {
    const out = dropBalls(b, drops, now)
    events = out.events

    return line ? { ...out.board, log: pushLog(out.board.log, line) } : out.board
  })
  await announce($, events)
}

async function reachGoals($: EngineInterface) {
  const now = await $.clock.now()
  let reached: number[] = []
  await update($, board, b => {
    const out = checkGoal(b, now)
    reached = out?.reached ?? []

    return out?.board ?? b
  })
  if (reached.length === 0) return
  await save($)
  const b = await read($, board)
  $.ui.toast(`🎉 목표 ${reached[reached.length - 1]}번째 달성! 다시 ${coins(GOAL_COINS)}코인`)
}

async function tick($: EngineInterface) {
  const now = await $.clock.now()
  const b = await read($, board)
  const second = Math.floor(now / 1000)
  if (settle(b, now)) {
    let events: GameEvent[] = []
    await update($, board, cur => {
      const out = settle(cur, now)
      events = out?.events ?? []

      return out?.board ?? cur
    })
    await save($)
    await reachGoals($)
    await announce($, events)
  } else if (b.resetArmedAt !== 0 && b.resetArmedAt + RESET_WINDOW <= now) {
    await update($, board, cur => ({ ...cur, resetArmedAt: 0 }))
  } else if (b.celebrateAt !== 0 && b.celebrateAt + CELEBRATE_MS <= now) {
    await update($, board, cur => ({ ...cur, celebrateAt: 0 }))
  } else if (b.feverUntil > now && b.tick !== second) {
    // the fever countdown in the top line
    await update($, board, cur => ({ ...cur, tick: second }))
  } else if (b.feverUntil !== 0 && b.feverUntil <= now) {
    await update($, board, cur => ({ ...cur, feverUntil: 0 }))
  }
}

async function fire($: EngineInterface, n: number, aim: Aim) {
  const now = await $.clock.now()
  let events: GameEvent[] | undefined
  await update($, board, b => {
    const out = launch(b, n, aim, now)
    events = out.events

    return out.board
  })
  await announce($, events ?? [])
}

const AIM_WORDS: Record<string, Aim> = { left: 'left', center: 'center', right: 'right', 왼쪽: 'left', 가운데: 'center', 오른쪽: 'right' }

// Back to the start: no coins, the first goal, no counts, nothing in play. The board's layout stays.
export const resetBoard = (b: Board): Board => ({
  ...EMPTY,
  seq: b.seq,
  layout: b.layout,
  goalLevel: 1,
  goalStart: 0,
  log: ['↺ 점수 리셋: 0코인부터 다시'],
})

// A press arms the reset; a second press within RESET_WINDOW does it. Says whether it reset.
async function pressReset($: EngineInterface) {
  const now = await $.clock.now()
  let isReset = false
  await update($, board, b => {
    isReset = b.resetArmedAt !== 0 && now - b.resetArmedAt < RESET_WINDOW

    return isReset ? resetBoard(b) : { ...b, resetArmedAt: now }
  })
  if (!isReset) return false
  await save($)
  $.ui.toast('↺ 점수를 리셋했습니다')

  return true
}

// '🎯 목표 ▰▰▰▰▱▱▱▱▱▱ 4,400 / 10,000'
export const goalLine = (b: Board) => {
  const got = Math.min(GOAL_COINS, Math.max(0, b.balance - b.goalStart))
  const filled = Math.round((got / GOAL_COINS) * 10)

  return `🎯 목표 ${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${coins(got)} / ${coins(GOAL_COINS)}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const bank = (await $.store.get(BANK)) as Partial<Bank> | undefined
    if (bank) {
      await update($, board, b => ({
        ...b,
        balance: Math.max(b.balance, bank.balance ?? 0),
        totalBalls: Math.max(b.totalBalls, bank.totalBalls ?? 0),
        jackpots: Math.max(b.jackpots, bank.jackpots ?? 0),
        kakuhens: Math.max(b.kakuhens, bank.kakuhens ?? 0),
        best: Math.max(b.best, bank.best ?? 0),
        ...((bank.goalLevel ?? 0) > b.goalLevel ? { goalLevel: bank.goalLevel ?? 0, goalStart: bank.goalStart ?? 0 } : {}),
      }))
    }
    // the first goal counts from what is in the bank now
    await update($, board, b => (b.goalLevel === 0 ? { ...b, goalLevel: 1, goalStart: b.balance } : b))
    // a board of its own for each session
    await update($, board, b => ({ ...b, seq: b.seq + 1, layout: makeLayout(b.seq, Math.random) }))
    await $.command.register({ name: 'pachinko', description: 'Open the pachinko pane and see the goal; "/pachinko balls" explains each ball, "/pachinko drop [n] [left|center|right]" drops free balls, "/pachinko reset" starts the score over' })
    void $.ui.open({ id: PANE, title: TITLE })

    $.clock.every(400, () => {
      void tick($).catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'pachinko' }, async ($, e) => {
    await $.ui.open({ id: PANE, title: TITLE })
    const [verb, what, ...rest] = e.args.trim().split(/\s+/)
    if (verb === 'balls' || verb === '공') return { text: guideText() }
    if (verb === 'reset' || verb === '리셋') {
      const b = await read($, board)
      await update($, board, cur => resetBoard(cur))
      await save($)

      return { text: `점수를 리셋했습니다 (${coins(b.balance)}코인 → 0)` }
    }
    if (verb === 'drop' || verb === '발사') {
      const words = [what, ...rest].filter((w): w is string => !!w)
      const n = Math.min(MAX_LAUNCH, Math.max(1, Number(words.find(w => /^\d+$/.test(w)) ?? 1)))
      const aim = words.map(w => AIM_WORDS[w]).find(a => a !== undefined) ?? 'any'
      await fire($, n, aim)

      return { text: `${AIM_NAMES[aim]} 무료 발사 ${n}개 · 이 공으로 번 코인은 목표에 들어가지 않습니다` }
    }
    const b = await read($, board)

    return {
      text:
        `파칭코: ${coins(b.balance)} 코인 · 공 ${coins(b.totalBalls)}개 · 잭팟 ${b.jackpots}번 · 찬스 ${b.kakuhens}번 · 최고 한 방 ${coins(b.best)}\n` +
        goalLine(b),
    }
  })

  // The main loop's turn: a new board, a white ball to start, and a fresh count of edited files for the rush.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, board, b => ({ ...b, seq: b.seq + 1, layout: makeLayout(b.seq, Math.random), turnFiles: [], isRush: false }))
      await drop($, [{ color: TURN[0], value: TURN[1] }], `⚪ 시작 공 · 작업 시작 (값 ${TURN[1]})`)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran
    const now = await $.clock.now()
    let out: ReturnType<typeof workBalls> | undefined
    await update($, board, b => {
      out = workBalls(b, e.tool, e as unknown as Record<string, unknown>, ran.isError === true, now)

      return out.board
    })
    if (out) {
      await drop($, out.drops, out.line)
      if (out.toast) $.ui.toast(out.toast)
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    if (e.agentId === undefined && e.trigger !== 'precompute') {
      const now = await $.clock.now()
      await update($, board, b => ({ ...b, feverUntil: Math.max(b.feverUntil, now) + 60_000, log: pushLog(b.log, '🌀 컨텍스트 압축: 피버 60초') }))
      $.ui.toast('🌀 컨텍스트 압축! 피버 60초 (×2)')
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      if (e.reason === 'answer') {
        const b = await read($, board)
        const bonus = 5 * Math.min(b.combo, 40)
        if (bonus > 0) {
          await update($, board, cur => ({ ...cur, balance: cur.balance + bonus, log: pushLog(cur.log, `✅ 완료 정산: 콤보 ${cur.combo} → +${coins(bonus)}`) }))
          await save($)
          await reachGoals($)
        }
      } else if (e.reason === 'aborted') {
        await update($, board, b => ({ ...b, combo: 0, log: pushLog(b.log, '⏹ 중단: 콤보 초기화') }))
      } else {
        await update($, board, b => ({ ...b, combo: 0, log: pushLog(b.log, '⚠ 턴 에러: 콤보 초기화') }))
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const b = await read($, board)
    const now = await $.clock.now()
    const isFever = b.feverUntil > now
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 24
    // the goals filled so far sit beside the combo
    const clears = Math.max(0, b.goalLevel - 1)
    const top = `💰 ${coins(b.balance)} 코인 · 콤보 ${b.combo} (×${comboMult(b.combo)})${clears > 0 ? ` · 목표 ${clears}회 달성` : ''}`
    const status =
      b.kakuhen > 0
        ? `🌈 찬스 타임 ${b.kakuhen}구 남음 (×${KAKUHEN_MULT})${isFever ? ` · 🔥 피버 ${Math.ceil((b.feverUntil - now) / 1000)}초` : ''}`
        : isFever
          ? `🔥 피버 ×2 · ${Math.ceil((b.feverUntil - now) / 1000)}초`
          : `공 ${coins(b.totalBalls)}개 · 잭팟 ${b.jackpots}번 · 찬스 ${b.kakuhens}번 · 최고 ${coins(b.best)}`
    const statusColor = b.kakuhen > 0 ? '#ffd23f' : isFever ? '#ff5a8a' : undefined
    const guideButton = (Button: (typeof els)['Button']) => (
      <Button
        key="guide"
        label={b.isGuideOpen ? '← 판으로 돌아가기' : '📖 공 설명'}
        onPress={() => void update($, board, cur => ({ ...cur, isGuideOpen: !cur.isGuideOpen }))}
      />
    )
    const isArmed = b.resetArmedAt !== 0 && now - b.resetArmedAt < RESET_WINDOW
    const resetButton = (Button: (typeof els)['Button']) => (
      <Button
        key="reset"
        label={isArmed ? '↺ 한 번 더 누르면 리셋 (5초)' : '↺ 점수 리셋'}
        dimColor={!isArmed}
        onPress={() => void pressReset($)}
      />
    )
    if (e.surface !== 'terminal') {
      const { Box, Text, Svg, Button } = els as ElementTable<'desktop'>
      // Rebuilt only when what the board draws changes; the same text keeps the balls falling.
      const key = `${b.balls.map(one => one.id).join(',')}|${b.reels.map(reel => reel.id).join(',')}|${isFever}|${b.kakuhen > 0}|${b.layout.id}|${b.celebrateAt}|${b.isGuideOpen}`
      if (cache.key !== key) cache = { key, svg: buildBoard(b, now) }
      // The pane's px: its cells over the code font's advance (about 7.8 px) and line height (about 19.5 px),
      // less the text lines and buttons around the board.
      const around = 10
      const room = Math.max(200, Math.round((rows - around) * 19.5))
      const width = Math.max(160, Math.min(Math.round(cols * 7.8), Math.round((room * W) / H)))
      const height = Math.round((width * H) / W)

      return (
        <Box flexDirection="column">
          <Text bold>{top}</Text>
          <Text color="#a9bacb">{goalLine(b)}</Text>
          <Text color={statusColor} dimColor={!statusColor}>
            {status}
          </Text>
          {b.isGuideOpen ? (
            <Box flexDirection="column">
              <Text bold>📖 공 설명</Text>
              {BALL_GUIDE.map(g => (
                <Text>{guideLine(g)}</Text>
              ))}
              {GUIDE_NOTES.map(note => (
                <Text dimColor>{note}</Text>
              ))}
            </Box>
          ) : (
            <Svg source={cache.svg} alt={ALT} width={width} height={height} isInteractive />
          )}
          {b.log.map((line, i) => (
            <Text dimColor={i > 0}>{line}</Text>
          ))}
          {guideButton(Button)}
          {resetButton(Button)}
        </Box>
      )
    }

    const { Box, Text, Button } = els as ElementTable<'terminal'>
    const flying = b.balls.filter(one => !one.isPaid).length
    const spinning = b.reels.find(reel => reel.at <= now && !reel.isDone)

    return (
      <Box flexDirection="column">
        <Text bold>{top}</Text>
        <Text color="#a9bacb">{goalLine(b)}</Text>
        <Text color={statusColor} dimColor={!statusColor}>
          {status}
        </Text>
        {b.isGuideOpen ? (
          <Box flexDirection="column">
            <Text bold>📖 공 설명</Text>
            {BALL_GUIDE.map(g => (
              <Text>{guideLine(g)}</Text>
            ))}
            {GUIDE_NOTES.map(note => (
              <Text dimColor>{note}</Text>
            ))}
          </Box>
        ) : (
          <Text>{spinning ? '🎰 릴이 도는 중…' : flying > 0 ? `● 떨어지는 공 ${flying}개` : '○ 대기 중'}</Text>
        )}
        {b.log.map((line, i) => (
          <Text dimColor={i > 0}>{line}</Text>
        ))}
        {guideButton(Button)}
        {resetButton(Button)}
        <Text dimColor>공 애니메이션은 데스크톱 앱에서 보입니다.</Text>
      </Box>
    )
  })
}
