export type BallKind = 'normal' | 'bust' | 'jackpot' | 'special'

export type Ball = {
  id: number
  // when it leaves the top, epoch ms
  at: number
  // the top-row lane it starts over
  start: number
  // the lane it is in at each pin row, then past the last row, then in its slot
  lanes: number[]
  // what it met at each pin row: 'b' a pin, 'k' a bumper, 'g' a gold pin, 'f' a gap it fell through
  hits: string
  // seconds from the top to the slot
  dur: number
  slot: number
  color: string
  payout: number
  kind: BallKind
  // drawn with the payout of a special ball ('커밋', '테스트', '역전'); '' for the rest
  label: string
  // launched by hand: its coins are shown but never counted
  isFree: boolean
  isPaid: boolean
}

export type ReelOutcome = 'kakuhen' | 'bonus' | 'miss'

export type Reel = {
  id: number
  // when the three reels start spinning, epoch ms
  at: number
  digits: number[]
  outcome: ReelOutcome
  // spun by a free ball: shown, but changes nothing in play
  isFree: boolean
  isDone: boolean
}

// Pins are named r * 100 + lane. Row 0 and the wall pins are always there.
export type Layout = {
  id: number
  gaps: number[]
  bumpers: number[]
  golds: number[]
}

export type Board = {
  seq: number
  layout: Layout
  balls: Ball[]
  reels: Reel[]
  balance: number
  combo: number
  feverUntil: number
  // balls left in chance time, '찬스 타임' (×2 and pulled toward the center)
  kakuhen: number
  // the goal: its level (0 before the first is set), the balance it counts from, and when the last one was reached
  goalLevel: number
  goalStart: number
  celebrateAt: number
  // when the reset button was pressed once; a second press within RESET_WINDOW resets
  resetArmedAt: number
  // the pane shows the ball guide in place of the board
  isGuideOpen: boolean
  // the last test command failed: the next passing one is a comeback
  testFailed: boolean
  // files edited this turn, for the rush
  turnFiles: string[]
  isRush: boolean
  log: string[]
  tick: number
  // across sessions, mirrored in $.store
  totalBalls: number
  jackpots: number
  kakuhens: number
  best: number
}

declare module 'claude-code' {
  interface PluginState {
    pachinko: { board: Shaped<Board> }
  }
}
