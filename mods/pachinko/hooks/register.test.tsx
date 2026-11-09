import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { Board } from '../types'
import { BALL_GUIDE, CANNON, EMPTY, GOAL_COINS, PLAIN, RAIN, buildBoard, checkGoal, guideText, resetBoard, comboMult, dropBalls, goalLine, launch, makeLayout, reelMs, rollReel, settle, walk, workBalls } from './register'
import type { Drop } from './register'

const PANE = {
  plugin: 'pachinko',
  component: 'Pane',
  requestId: 'pachinko',
  props: {
    title: '파칭코',
    isFocused: false,
    bodyColumns: 44,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 48 },
    view: {},
  },
} as const

// A seeded stream, so a run of thousands of balls is the same each time.
const seeded = (seed: number) => {
  let s = seed

  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}
const WHITE: Drop = { color: '#fff', value: 10 }
const one = (b: Board, rand: () => number, d: Drop = WHITE) => dropBalls(b, [d], 0, rand).board.balls[0]!
// Answers a, b, a, b, ...
const alternate = (a: number, b: number) => {
  let i = 0

  return () => (i++ % 2 === 0 ? a : b)
}
// Answers the given numbers in turn, then the last one forever.
const script = (...xs: number[]) => {
  let i = 0

  return () => xs[Math.min(i++, xs.length - 1)] ?? 0.5
}
declare const console: { log: (...args: unknown[]) => void }
const landsAt = (ball: { at: number; dur: number }) => ball.at + ball.dur * 1000

const run = (args: string) => ({
  command: 'pachinko',
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 80 },
})

const answers = (on: On, bank?: unknown) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, bank ? { bank } : {})
  on('command.register', () => ({ value: { command: 'pachinko' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: 'done' }))

  return clock
}

describe('the board', () => {
  test('on any layout a ball starts all across the top, moves only as the pins allow, and ends in a slot', () => {
    const rand = seeded(7)
    const starts = new Set<number>()
    const slots = new Set<number>()
    const met = new Set<string>()
    for (let i = 0; i < 3000; i++) {
      // a new layout every 30 balls
      const b = { ...EMPTY, layout: i % 30 === 0 ? makeLayout(i, rand) : EMPTY.layout }
      const ball = one(i % 30 === 0 ? b : { ...EMPTY, layout: makeLayout(Math.floor(i / 30), seeded(i - (i % 30) + 1)) }, rand, { ...WHITE, kind: 'bust' })
      starts.add(ball.start)
      slots.add(ball.slot)
      expect(Number.isInteger(ball.slot)).toBe(true)
      expect(ball.slot >= 0 && ball.slot <= 12).toBe(true)
      expect(ball.lanes.length).toBe(15)
      expect(ball.hits.length).toBe(13)
      expect(ball.lanes.every(p => p >= 0 && p <= 26)).toBe(true)
      ball.lanes.slice(1).forEach((p, r) => {
        const step = Math.abs(p - ball.lanes[r]!)
        const hit = ball.hits[r] ?? 'end'
        met.add(hit)
        if (hit === 'f') expect(step).toBe(0)
        else if (hit === 'k') expect([1, 3, 5]).toContain(step)
        else if (hit === 'B' || hit === 'G') expect(step).toBe(3)
        else if (hit === 'end') expect([0, 1]).toContain(step)
        else expect(step).toBe(1)
      })
      expect(ball.dur >= 4 && ball.dur <= 5).toBe(true)
    }
    expect(starts.size).toBe(14)
    expect(slots.size).toBe(13)
    expect([...met].sort()).toEqual(['B', 'G', 'b', 'end', 'f', 'g', 'k'])
  })

  test('strong bounces and momentum send balls on wide, varied ways down', () => {
    const rand = seeded(29)
    const layout = makeLayout(1, rand)
    let strong = 0
    let swing = 0
    const ways = new Set<string>()
    const slots = Array.from({ length: 13 }, () => 0)
    // every ball from the same pin, so only the bounces tell them apart
    for (let i = 0; i < 2000; i++) {
      const { lanes, hits } = walk(layout, 12, 0, rand)
      strong += [...hits].filter(h => h === 'B' || h === 'G').length
      swing += Math.max(...lanes) - Math.min(...lanes)
      ways.add(lanes.join(','))
      slots[((lanes[lanes.length - 1] ?? 1) - 1) / 2]! += 1
    }
    const spread = slots.filter(n => n > 0).length
    console.log(`from one pin: ${ways.size} different ways in 2000 · ${(strong / 2000).toFixed(1)} strong kicks a ball · swing ${(swing / 2000).toFixed(1)} lanes · ${spread} slots reached`)
    expect(strong / 2000).toBeGreaterThan(1.5)
    // plain one-lane bounces swing about 5 lanes on their way down
    expect(swing / 2000).toBeGreaterThan(8)
    expect(ways.size).toBeGreaterThan(1500)
    expect(spread).toBe(13)
  })

  test('no gap touches another, so a ball never has a long free drop', () => {
    const rand = seeded(33)
    for (let i = 0; i < 300; i++) {
      const gaps = new Set(makeLayout(i, rand).gaps)
      for (const id of gaps) {
        const r = Math.floor(id / 100)
        const p = id % 100
        for (const near of [r * 100 + p - 2, r * 100 + p + 2, (r - 1) * 100 + p - 1, (r - 1) * 100 + p + 1, (r + 1) * 100 + p - 1, (r + 1) * 100 + p + 1, (r - 2) * 100 + p, (r + 2) * 100 + p]) {
          expect(gaps.has(near)).toBe(false)
        }
      }
    }
    // and a ball, on any such layout, is never in the air for more than two rows in a row
    const layout = makeLayout(1, seeded(4))
    const rand2 = seeded(8)
    let longest = 0
    for (let i = 0; i < 3000; i++) {
      const run = walk(layout, 2 * Math.floor(rand2() * 14), 0, rand2).hits.match(/f+/g) ?? []
      longest = Math.max(longest, ...run.map(x => x.length))
    }
    expect(longest).toBeLessThanOrEqual(2)
  })

  test('a layout keeps the top row and the walls whole, and mixes in gaps, bumpers and gold pins', () => {
    const rand = seeded(21)
    let gaps = 0
    let bumpers = 0
    let golds = 0
    for (let i = 0; i < 200; i++) {
      const layout = makeLayout(i, rand)
      for (const id of [...layout.gaps, ...layout.bumpers, ...layout.golds]) {
        expect(Math.floor(id / 100)).toBeGreaterThan(0)
        expect([0, 26]).not.toContain(id % 100)
      }
      gaps += layout.gaps.length
      bumpers += layout.bumpers.length
      golds += layout.golds.length
    }
    console.log(`per layout: gaps ${(gaps / 200).toFixed(1)} · bumpers ${(bumpers / 200).toFixed(1)} · gold pins ${(golds / 200).toFixed(1)}`)
    expect(gaps / 200).toBeGreaterThan(8)
    expect(bumpers / 200).toBeGreaterThan(3)
    expect(golds / 200).toBeGreaterThan(4)
  })

  test('a gap drops the ball two rows, a bumper throws it five lanes, a gold pin pays on the way', () => {
    // from lane 12 at row 0, always bouncing right (0.1) and never strong (0.9)
    const right = alternate(0.1, 0.9)
    expect(walk(PLAIN, 12, 0, right).lanes.slice(0, 4)).toEqual([12, 13, 14, 15])
    // a gap at row 1 lane 13: through rows 1 and 2, then the pin at row 3
    const gap = walk({ ...PLAIN, gaps: [113] }, 12, 0, alternate(0.1, 0.9))
    expect(gap.hits.slice(0, 4)).toBe('bffb')
    expect(gap.lanes.slice(0, 5)).toEqual([12, 13, 13, 13, 14])
    // a bumper at row 1 lane 13 throws to lane 18
    const bump = walk({ ...PLAIN, bumpers: [113] }, 12, 0, alternate(0.1, 0.9))
    expect(bump.hits[1]).toBe('k')
    expect(bump.lanes[2]).toBe(18)
    // near a wall it throws as far as the board allows
    expect(walk({ ...PLAIN, bumpers: [123] }, 22, 0, alternate(0.1, 0.9)).lanes[2]).toBe(26)
    expect(walk({ ...PLAIN, bumpers: [125] }, 24, 0, alternate(0.1, 0.9)).lanes[2]).toBe(26)

    // 0.5 starts on lane 14, then 0.1 bounces right and 0.9 keeps it a plain bounce: row 1 meets lane 15
    const gold = { ...EMPTY, layout: { ...PLAIN, golds: [115] } }
    const plainBall = dropBalls(EMPTY, [WHITE], 0, script(0.5, 0.1, 0.9, 0.1, 0.9)).board.balls[0]!
    const goldBall = dropBalls(gold, [WHITE], 0, script(0.5, 0.1, 0.9, 0.1, 0.9)).board.balls[0]!
    expect(goldBall.hits[1]).toBe('g')
    expect(goldBall.slot).toBe(plainBall.slot)
    expect(goldBall.payout).toBe(plainBall.payout + 5)
  })

  test('a ball off the right wall that keeps going left ends in the center and pays ×8', () => {
    // 0.99 starts on the right wall pin; every later 0.99 bounces left
    const ball = one(EMPTY, () => 0.99)
    expect(ball.start).toBe(26)
    expect(ball.slot).toBe(6)
    expect(ball.payout).toBe(80)
  })

  test('combo, kakuhen and a bust each change the payout', () => {
    expect(comboMult(0)).toBe(1)
    expect(comboMult(10)).toBe(2)
    expect(comboMult(100)).toBe(3)
    expect(one({ ...EMPTY, combo: 10 }, () => 0.99).payout).toBe(160)
    expect(one(EMPTY, () => 0.99, { ...WHITE, kind: 'bust' }).payout).toBe(0)

    const { board } = dropBalls({ ...EMPTY, kakuhen: 5 }, [WHITE], 0, () => 0.99)
    expect(board.balls[0]?.payout).toBe(160)
    expect(board.kakuhen).toBe(4)
  })

  test('chance time pulls balls toward the center', () => {
    const share = (b: Board) => {
      const rand = seeded(11)
      let center = 0
      for (let i = 0; i < 4000; i++) if (one(b, rand, { ...WHITE, kind: 'bust' }).slot === 6) center++

      return center / 4000
    }
    const plain = share(EMPTY)
    const kakuhen = share({ ...EMPTY, kakuhen: 60 })
    console.log(`center share: plain ${(plain * 100).toFixed(1)}% · chance time ${(kakuhen * 100).toFixed(1)}%`)
    expect(kakuhen).toBeGreaterThan(plain * 1.3)
  })

  test('the coins arrive when the ball lands, and the ball leaves after its number fades', () => {
    const { board } = dropBalls(EMPTY, [WHITE], 0, () => 0.2)
    const ball = board.balls[0]!
    expect(ball.slot).not.toBe(6)
    expect(settle(board, 2000)).toBeUndefined()
    const landed = settle(board, landsAt(ball))!.board
    expect(landed.balance).toBe(ball.payout)
    expect(landed.balls[0]?.isPaid).toBe(true)
    expect(landed.reels.length).toBe(0)
    expect(settle(landed, landsAt(ball) + 100)).toBeUndefined()
    expect(settle(landed, landsAt(ball) + 1600)?.board.balls.length).toBe(0)
  })
})

describe('the reels', () => {
  test('each outcome matches its digits, at about the odds meant', () => {
    const rand = seeded(3)
    const count = { kakuhen: 0, bonus: 0, miss: 0, reach: 0 }
    const N = 100_000
    for (let i = 0; i < N; i++) {
      const { digits, outcome } = rollReel(rand)
      const [a, b, c] = digits
      const isTriple = a === b && b === c
      expect(outcome === 'kakuhen').toBe(isTriple && a === 7)
      expect(outcome === 'bonus').toBe(isTriple && a !== 7)
      expect(digits.every(d => d >= 1 && d <= 9)).toBe(true)
      count[outcome]++
      if (a === b && !isTriple) count.reach++
    }
    console.log(
      `reels: 777 ${((count.kakuhen / N) * 100).toFixed(1)}% · bonus ${((count.bonus / N) * 100).toFixed(1)}% · reach-miss ${((count.reach / N) * 100).toFixed(1)}%`,
    )
    expect(Math.abs(count.kakuhen / N - 0.05)).toBeLessThan(0.004)
    expect(Math.abs(count.bonus / N - 0.12)).toBeLessThan(0.005)
    expect(count.reach / N).toBeGreaterThan(0.25)
  })

  test('a center ball spins the reels; 7-7-7 starts kakuhen when the last reel stops', () => {
    const { board } = dropBalls(EMPTY, [WHITE], 0, () => 0.99)
    const land = landsAt(board.balls[0]!)
    // the reel's roll: under 0.05 is 7-7-7
    const landed = settle(board, land, () => 0.01)!.board
    expect(landed.reels.length).toBe(1)
    const reel = landed.reels[0]!
    expect(reel.digits).toEqual([7, 7, 7])
    expect(reelMs(reel)).toBe(3200)

    expect(settle(landed, land + 1000)).toBeUndefined()
    const stopped = settle(landed, land + 3200)!
    expect(stopped.events).toEqual(['kakuhen'])
    expect(stopped.board.kakuhen).toBe(15)
    expect(stopped.board.kakuhens).toBe(1)
    expect(stopped.board.log[0]).toMatch(/찬스 타임/)
    expect(settle(stopped.board, land + 3200 + 2200)?.board.reels.length).toBe(0)
  })

  test('a triple other than 7 pays ten bonus balls; center hits queue one spin after another', () => {
    const { board } = dropBalls(EMPTY, [WHITE, WHITE, WHITE], 0, () => 0.99)
    const landed = settle(board, Math.max(...board.balls.map(landsAt)), () => 0.1)!.board
    expect(landed.reels.length).toBe(3)
    const [a, b] = landed.reels
    expect(b!.at).toBe(a!.at + reelMs(a!) + 400)
    const stopped = settle(landed, a!.at + reelMs(a!), () => 0.1)!
    expect(stopped.events).toEqual(['bonus'])
  })

  test('the board draws the reel overlay with a reach and its result', () => {
    const b: Board = { ...EMPTY, reels: [{ id: 1, at: 0, digits: [3, 3, 5], outcome: 'miss', isFree: false, isDone: false }] }
    const svg = buildBoard(b, 0)
    expect(svg).toMatch(/SPIN/)
    expect(svg).toMatch(/리치!/)
    expect(svg).toMatch(/아쉽/)
    expect(buildBoard({ ...EMPTY, kakuhen: 3 }, 0)).toMatch(/찬스 ×2/)
  })

  test('a board rebuilt after the reels stopped draws them stopped, not spinning from the start', () => {
    // an animation over before the SVG loads never runs, so its freeze never holds
    const b: Board = { ...EMPTY, reels: [{ id: 1, at: 0, digits: [7, 7, 7], outcome: 'kakuhen', isFree: false, isDone: true }] }
    const after = buildBoard(b, 3300)
    expect(after).not.toMatch(/calcMode="spline"/)
    expect((after.match(/<g transform="translate\(0 -\d+\)">/g) ?? []).length).toBe(3)
    expect(after).not.toMatch(/리치!/)
    const during = buildBoard(b, 1200)
    expect((during.match(/calcMode="spline"/g) ?? []).length).toBe(2)
  })

  test('a ball that landed before the board was rebuilt is not drawn at the corner', () => {
    const { board } = dropBalls(EMPTY, [WHITE], 0, () => 0.2)
    const land = landsAt(board.balls[0]!)
    expect(buildBoard(board, 1000)).toMatch(/animateMotion/)
    expect(buildBoard(board, land + 100)).not.toMatch(/animateMotion/)
    expect(buildBoard(board, land + 100)).toMatch(/\+\d/)
    expect(buildBoard(board, land + 1500)).not.toMatch(/\+\d/)
  })

  test('the board draws the layout: no pin in a gap, ringed bumpers, gold pins', () => {
    const plain = buildBoard(EMPTY, 0)
    const layout = { id: 77, gaps: [113, 115], bumpers: [216], golds: [319] }
    const drawn = buildBoard({ ...EMPTY, layout }, 0)
    const pins = (svg: string) => (svg.match(/r="3" fill="#6a7078"/g) ?? []).length
    expect(pins(plain) - pins(drawn)).toBe(4)
    expect(drawn).toMatch(/r="4\.2" fill="#8a4a6a"/)
    expect(drawn).toMatch(/r="3\.8" fill="#c9a24a"/)
  })
})

describe('work-linked balls', () => {
  test('a commit drops a ×5 special ball', () => {
    const out = workBalls(EMPTY, 'Bash', { command: 'git add . && git commit -m "x"' }, false, 0)
    expect(out.drops[0]).toEqual({ color: '#ef5a5a', value: 75, kind: 'special', label: '커밋' })
    expect(out.toast).toMatch(/커밋/)
    expect(out.board.combo).toBe(1)
  })

  test('a failing test busts; the next passing one is a ×10 comeback, then plain tests are ×3', () => {
    const failed = workBalls({ ...EMPTY, combo: 7 }, 'Bash', { command: 'npm test' }, true, 0)
    expect((failed.drops[0] as Drop | undefined)?.kind).toBe('bust')
    expect(failed.board.testFailed).toBe(true)
    expect(failed.board.combo).toBe(0)

    const back = workBalls(failed.board, 'PowerShell', { command: 'pytest -q' }, false, 0)
    expect(back.drops[0]).toMatchObject({ value: 150, kind: 'special', label: '역전' })
    expect(back.board.testFailed).toBe(false)

    const plain = workBalls(back.board, 'Bash', { command: 'claude plugin test pachinko' }, false, 0)
    expect(plain.drops[0]).toMatchObject({ value: 45, label: '테스트' })
    expect((workBalls(EMPTY, 'Bash', { command: 'ls tests/' }, false, 0).drops[0] as Drop | undefined)?.kind).toBeUndefined()
  })

  test('ten different files edited in one turn start a rush, once', () => {
    let b = EMPTY
    for (let i = 0; i < 9; i++) b = workBalls(b, 'Edit', { file_path: `/f${i}.ts` }, false, 1000).board
    b = workBalls(b, 'Edit', { file_path: '/f0.ts' }, false, 1000).board
    expect(b.isRush).toBe(false)
    const rush = workBalls(b, 'Write', { file_path: '/f9.ts' }, false, 1000)
    expect(rush.board.isRush).toBe(true)
    expect(rush.board.feverUntil).toBe(21_000)
    expect(rush.toast).toMatch(/러시/)
    expect(workBalls(rush.board, 'Edit', { file_path: '/g.ts' }, false, 1000).toast).toBeUndefined()
  })

  test('a subagent drops five balls', () => {
    expect(workBalls(EMPTY, 'Agent', {}, false, 0).drops.length).toBe(5)
  })
})

// Plays thousands of balls through the whole loop (drops, landings, spins, bonus balls, kakuhen) and checks
// the coins come back at a rate that grows with the upgrades, without running away.
describe('the economy', () => {
  const play = (start: Board, n: number, seed: number) => {
    const rand = seeded(seed)
    let b = start
    let now = 0
    let pending = n
    let thrown = 0
    while (pending > 0 || b.balls.some(x => !x.isPaid) || b.reels.some(r => !r.isDone)) {
      if (thrown++ % 50 === 0) b = { ...b, layout: makeLayout(thrown, rand) }
      if (pending > 0) {
        b = dropBalls(b, [WHITE], now, rand).board
        pending--
      }
      now += 1500
      const out = settle(b, now, rand)
      if (out) {
        b = out.board
        for (const ev of out.events) if (ev === 'bonus') pending += 10
      }
    }

    return { coins: b.balance - start.balance, balls: b.totalBalls - start.totalBalls, kakuhens: b.kakuhens, jackpots: b.jackpots }
  }

  test('a plain board pays back a little more than the balls are worth', () => {
    const r = play(EMPTY, 20_000, 5)
    const back = r.coins / (r.balls * 10)
    console.log(`plain: ${r.balls} balls → ${r.coins} coins · ${back.toFixed(2)}× · 찬스 ${r.kakuhens} · 잭팟 ${r.jackpots}`)
    expect(back).toBeGreaterThan(1)
    expect(back).toBeLessThan(3)
    expect(r.kakuhens).toBeGreaterThan(0)
  })

  // A stretch of ordinary work: turns of about fifteen tool calls (mostly reads, then edits and shell), a few
  // errors, now and then a test run or a commit, each turn closed with its combo bonus, a new layout each turn.
  const work = (turns: number, seed: number) => {
    const rand = seeded(seed)
    let b: Board = { ...EMPTY }
    let now = 0
    let calls = 0
    const flush = (until: number) => {
      while (now < until) {
        now += 500
        const out = settle(b, now, rand)
        if (!out) continue
        b = out.board
        for (const ev of out.events) if (ev === 'bonus') b = dropBalls(b, Array.from({ length: 10 }, () => WHITE), now, rand).board
      }
    }
    for (let t = 0; t < turns; t++) {
      b = { ...b, layout: makeLayout(t + 1, rand), turnFiles: [], isRush: false }
      b = dropBalls(b, [{ color: '#fff', value: 10 }], now, rand).board
      const n = 8 + Math.floor(rand() * 15)
      for (let i = 0; i < n; i++) {
        calls++
        const r = rand()
        const isError = rand() < 0.06
        const [tool, input]: [string, Record<string, unknown>] =
          r < 0.45
            ? [['Read', 'Grep', 'Glob'][Math.floor(rand() * 3)]!, {}]
            : r < 0.7
              ? ['Edit', { file_path: `/f${Math.floor(rand() * 8)}.ts` }]
              : r < 0.95
                ? ['Bash', { command: rand() < 0.1 ? 'npm test' : rand() < 0.04 ? 'git commit -m x' : 'ls' }]
                : ['Agent', {}]
        const out = workBalls(b, tool, input, isError, now)
        b = dropBalls(out.board, out.drops, now, rand).board
        flush(now + 3000)
      }
      flush(now + 8000)
      b = { ...b, balance: b.balance + 5 * Math.min(b.combo, 40) }
    }

    return { coins: b.balance, calls }
  }

  test('the first goal takes about twenty minutes of ordinary work: three to six turns', () => {
    const perTurn: number[] = []
    for (let seed = 1; seed <= 40; seed++) perTurn.push(work(20, seed).coins / 20)
    perTurn.sort((x, y) => x - y)
    const median = perTurn[20]!
    const turnsFor = (goal: number) => goal / median
    console.log(
      `coins per turn: median ${Math.round(median)} (slow ${Math.round(perTurn[4]!)}, lucky ${Math.round(perTurn[35]!)}) · ` +
        `goal ${GOAL_COINS} ≈ ${turnsFor(GOAL_COINS).toFixed(1)} turns`,
    )
    // a goal that takes a good while, but not a whole day of work
    expect(turnsFor(GOAL_COINS)).toBeGreaterThan(6)
    expect(turnsFor(GOAL_COINS)).toBeLessThan(15)
    // even a slow stretch gets there within about twice that
    expect(GOAL_COINS / perTurn[4]!).toBeLessThan(20)
  })
})

describe('the goal', () => {
  test('every goal is the same 10,000 coins', () => {
    expect(GOAL_COINS).toBe(10_000)
  })

  test('filling a goal starts the next one, carries the surplus, and starts the celebration', () => {
    const b: Board = { ...EMPTY, goalLevel: 1, goalStart: 500, balance: 500 + 9_999 }
    expect(checkGoal(b, 0)).toBeUndefined()
    const out = checkGoal({ ...b, balance: 500 + 10_100 }, 7000)!
    expect(out.reached).toEqual([1])
    expect(out.board.goalLevel).toBe(2)
    expect(out.board.goalStart).toBe(10_500)
    expect(out.board.celebrateAt).toBe(7000)
    expect(out.board.log[0]).toMatch(/목표 1번째 달성! 다시 10,000코인/)
    // a jackpot big enough for two goals passes both
    expect(checkGoal({ ...b, balance: 500 + 20_000 }, 0)?.reached).toEqual([1, 2])
    // before the first goal is set there is nothing to reach
    expect(checkGoal({ ...EMPTY, balance: 99_999 }, 0)).toBeUndefined()
  })

  test('the goal line shows a bar and the coins toward it', () => {
    expect(goalLine({ ...EMPTY, goalLevel: 1, goalStart: 1000, balance: 1000 + 5_000 })).toBe('🎯 목표 ▰▰▰▰▰▱▱▱▱▱ 5,000 / 10,000')
    // spent below the start, it shows nothing yet, not a negative
    expect(goalLine({ ...EMPTY, goalLevel: 1, goalStart: 1000, balance: 900 })).toBe('🎯 목표 ▱▱▱▱▱▱▱▱▱▱ 0 / 10,000')
  })

  test('the celebration fires cannons and rain, bursts, shows the words, ends, and is gone once over', () => {
    const b: Board = { ...EMPTY, goalLevel: 2, goalStart: 10_000, celebrateAt: 10_000 }
    const svg = buildBoard(b, 10_000)
    expect(svg).toMatch(/목표 달성!/)
    expect(svg).toMatch(/1번째 클리어/)
    expect(svg).toMatch(/다시 10,000코인/)
    expect((svg.match(/<g class="cf"/g) ?? []).length).toBe(RAIN + CANNON * 2)
    expect(RAIN + CANNON * 2).toBeGreaterThanOrEqual(150)
    expect((svg.match(/animateMotion path="M\d+ -10/g) ?? []).length).toBe(RAIN)
    expect((svg.match(/<line /g) ?? []).length).toBe(18)
    expect(svg).not.toMatch(/repeatCount/)
    // halfway through it is still drawn, from where it is
    expect(buildBoard(b, 11_800)).toMatch(/목표 달성!/)
    expect(buildBoard(b, 14_700)).not.toMatch(/목표 달성!/)
    expect(buildBoard({ ...b, celebrateAt: 0 }, 10_000)).not.toMatch(/목표 달성!/)
  })
})

describe('the pane', () => {
  test('a turn drops a ball that pays when it lands, on the engine clock', async ($, on) => {
    const clock = answers(on)
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    await $.turn.start({ turnId: 't1', text: 'hi' })

    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect((await ui.find({ type: 'Text', text: /코인/ }))?.text).toMatch(/^💰 0 코인 · 콤보 0/)
    expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toMatch(/animateMotion/)
    expect(await ui.find({ type: 'Text', text: /작업 시작/ })).toBeTruthy()

    await clock.advance(6000)
    expect((await ui.find({ type: 'Text', text: /코인/ }))?.text).not.toMatch(/^💰 0 코인/)
    await ui.unmount()
  })

  test('the first goal counts from the coins already banked', async ($, on) => {
    answers(on, { balance: 1000, totalBalls: 0, jackpots: 0, kakuhens: 0, best: 0 })
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect((await ui.find({ type: 'Text', text: /목표/ }))?.text).toBe('🎯 목표 ▱▱▱▱▱▱▱▱▱▱ 0 / 10,000')
    await ui.unmount()
    expect((await $.command.run(run('')))?.text).toMatch(/🎯 목표 ▱/)
  })

  test('a goal reached in play celebrates on the board and in a toast', async ($, on) => {
    const clock = answers(on, { balance: 0, totalBalls: 0, jackpots: 0, kakuhens: 0, best: 0, goalLevel: 1, goalStart: -9_999 })
    const toasts: string[] = []
    on('ui.toast', (_, e) => {
      toasts.push(e.text)

      return { value: undefined }
    })
    on('tool.call', () => ({ result: {} }))
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    // 9,999 of 10,000 already: one ball that pays at all (every ball pays at least 1) fills it
    await $.tool.call({ tool: 'Edit', file_path: '/a.ts', old_string: 'a', new_string: 'b' })
    await clock.advance(5600)
    expect(toasts.some(t => /목표 1번째 달성!/.test(t))).toBe(true)
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect((await ui.find({ type: 'Text', text: /콤보/ }))?.text).toMatch(/콤보 \d+ \(×[\d.]+\) · 목표 1회 달성$/)
    expect((await ui.find({ type: 'Text', text: /🎯/ }))?.text).toMatch(/^🎯 목표 [▰▱]{10} [\d,]+ \/ 10,000$/)
    expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toMatch(/목표 달성!/)
    // the celebration ends (4.6 s after the ball landed, up to 4 s in) and the board goes back to play
    await clock.advance(6000)
    expect(JSON.stringify(await ui.find({ type: 'Svg' }))).not.toMatch(/목표 달성!/)
    await ui.unmount()
  })

  test('a commit through the shell shows as a special ball and a toast', async ($, on) => {
    answers(on)
    const toasts: string[] = []
    on('ui.toast', (_, e) => {
      toasts.push(e.text)

      return { value: undefined }
    })
    on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }))
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    await $.tool.call({ tool: 'Bash', command: 'git commit -m "wip"' })
    expect(toasts.some(t => /커밋/.test(t))).toBe(true)

    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toMatch(/>커밋 (★\d )?\+\d/)
    await ui.unmount()
  })

  test('the terminal gets the numbers, the goal and the reset button without the board', async ($, on) => {
    answers(on)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /데스크톱 앱/ })).toBeTruthy()
    expect(await ui.find({ type: 'Svg' })).toBeFalsy()
    expect(await ui.find({ type: 'Text', text: /🎯 목표/ })).toBeTruthy()
    expect(await ui.find({ key: 'reset' })).toBeTruthy()
    expect(await ui.find({ key: 'fire-ten' })).toBeFalsy()
    await ui.unmount()
  })
})

describe('easy on the eyes', () => {
  test('nothing on the board loops forever, and no flash goes past a soft wash', () => {
    const busy: Board = {
      ...EMPTY,
      layout: { id: 5, gaps: [113], bumpers: [216], golds: [319] },
      kakuhen: 5,
      feverUntil: 10_000,
      reels: [{ id: 1, at: 0, digits: [7, 7, 7], outcome: 'kakuhen', isFree: false, isDone: false }],
    }
    const { board } = dropBalls(busy, [{ ...WHITE }], 0, () => 0.99)
    const svg = buildBoard({ ...board, balls: board.balls.map(one => ({ ...one, kind: 'jackpot' as const })) }, 0)
    expect(svg).not.toMatch(/repeatCount/)
    // the washes and glows are rects that start and end unseen; the numbers that float up are text
    const peaks = [...svg.matchAll(/<rect [^>]*opacity="0"><animate attributeName="opacity" values="([^"]+)"/g)]
      .map(m => m[1]!.split(';').map(Number))
      .filter(values => values[0] === 0 && values[values.length - 1] === 0)
      .map(values => Math.max(...values))
    expect(peaks.length).toBeGreaterThan(0)
    expect(Math.max(...peaks)).toBeLessThanOrEqual(0.3)
    expect(svg).not.toMatch(/#1d1840|#d8e0ea/)
    // and none of the old yellowed browns: the board is a neutral graphite
    expect(svg).not.toMatch(/#2b2723|#201d1a|#8a7550|#5e584f|#7d766b|#e8c873|#e6dcc6/)
    const [r, g, bl] = (svg.match(/id="bg".*?stop-color="#(..)(..)(..)"/)!.slice(1)).map(h => parseInt(h, 16))
    expect(Math.max(r!, g!, bl!) - Math.min(r!, g!, bl!)).toBeLessThanOrEqual(6)
  })
})

describe('free balls', () => {
  test('a launch costs nothing, aims where asked, and drops at most twenty', () => {
    const ten = launch({ ...EMPTY, balance: 15 }, 10, 'any', 0, seeded(2))
    expect(ten.board.balance).toBe(15)
    // a free multiball may add three more
    expect(ten.board.balls.length).toBeGreaterThanOrEqual(10)
    expect(ten.board.balls.every(one => one.isFree)).toBe(true)
    expect(ten.board.totalBalls).toBe(0)
    expect(ten.board.log[0]).toBe('🎯 아무 데나 무료 발사 10개')
    expect(launch(EMPTY, 99, 'left', 0, seeded(3)).board.log[0]).toBe('🎯 왼쪽 무료 발사 20개')

    const rand = seeded(4)
    const starts = (aim: 'left' | 'center' | 'right') => new Set(Array.from({ length: 300 }, () => launch(EMPTY, 1, aim, 0, rand).board.balls[0]!.start))
    expect([...starts('left')].sort((x, y) => x - y)).toEqual([0, 2, 4, 6, 8])
    expect([...starts('center')].sort((x, y) => x - y)).toEqual([10, 12, 14, 16])
    expect([...starts('right')].sort((x, y) => x - y)).toEqual([18, 20, 22, 24, 26])
  })

  test('thousands of free balls never change the coins, the goal, the counts or chance time', () => {
    const rand = seeded(17)
    const start: Board = { ...EMPTY, balance: 1234, goalLevel: 1, goalStart: 1000, kakuhen: 6, combo: 10 }
    let b = start
    let now = 0
    let shown = 0
    let freeSpins = 0
    for (let i = 0; i < 3000 || b.balls.some(x => !x.isPaid) || b.reels.some(r => !r.isDone); i++) {
      if (i % 50 === 0) b = { ...b, layout: makeLayout(i, rand) }
      if (i < 3000) b = launch(b, 1, 'center', now, rand).board
      now += 1500
      const out = settle(b, now, rand)
      if (!out) continue
      freeSpins += out.board.reels.filter(r => r.isFree && !b.reels.some(old => old.id === r.id)).length
      shown += b.balls.filter(one => !one.isPaid && one.at + one.dur * 1000 <= now).reduce((sum, one) => sum + one.payout, 0)
      b = out.board
      for (const ev of out.events) if (ev === 'freeBonus') b = dropBalls(b, Array.from({ length: 10 }, () => ({ color: '#fff', value: 10, isFree: true })), now, rand).board
      expect(out.events.filter(ev => ev !== 'freeBonus')).toEqual([])
    }
    console.log(`free: 3000 balls showed ${shown} coins over ${freeSpins} spins; counted 0`)
    expect(shown).toBeGreaterThan(10_000)
    expect(freeSpins).toBeGreaterThan(50)
    expect([b.balance, b.goalLevel, b.goalStart, b.kakuhen, b.kakuhens, b.jackpots, b.best, b.totalBalls, b.combo, b.feverUntil]).toEqual([1234, 1, 1000, 6, 0, 0, 0, 0, 10, 0])
  })

  test('a free ball shows its number in grey, marked 무료', () => {
    const { board } = launch(EMPTY, 1, 'any', 0, () => 0.5)
    const svg = buildBoard(board, board.balls[0]!.at + board.balls[0]!.dur * 1000 + 100)
    expect(svg).toMatch(/fill="#8d939a"[^>]*>무료 (★\d )?\+\d/)
  })

  test('/pachinko drop works with no coins at all and changes none', async ($, on) => {
    answers(on, { balance: 15, totalBalls: 0, jackpots: 0, kakuhens: 0, best: 0 })
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    for (const key of ['fire-left', 'fire-center', 'fire-right', 'fire-ten']) expect(await ui.find({ key })).toBeFalsy()
    expect((await $.command.run(run('drop 10')))?.text).toBe('아무 데나 무료 발사 10개 · 이 공으로 번 코인은 목표에 들어가지 않습니다')
    expect((await $.command.run(run('drop 3 가운데')))?.text).toMatch(/^가운데 무료 발사 3개/)
    expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toMatch(/animateMotion/)
    expect((await ui.find({ type: 'Text', text: /코인/ }))?.text).toMatch(/^💰 15 코인/)
    await ui.unmount()
  })
})

describe('resetting the score', () => {
  test('a reset clears coins, goal and counts, and keeps the board layout', () => {
    const layout = makeLayout(9, seeded(9))
    const { board } = dropBalls({ ...EMPTY, layout, balance: 12_345, goalLevel: 3, goalStart: 11_000, jackpots: 4, kakuhens: 2, best: 900, combo: 12, kakuhen: 8, feverUntil: 99_000, celebrateAt: 5 }, [WHITE], 0, () => 0.5)
    const after = resetBoard({ ...board, totalBalls: 300 })
    expect(after.balance).toBe(0)
    expect(after.goalLevel).toBe(1)
    expect(after.goalStart).toBe(0)
    expect([after.totalBalls, after.jackpots, after.kakuhens, after.best, after.combo, after.kakuhen, after.feverUntil, after.celebrateAt]).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(after.balls).toEqual([])
    expect(after.layout).toBe(layout)
    expect(after.seq).toBe(board.seq)
    expect(goalLine(after)).toBe('🎯 목표 ▱▱▱▱▱▱▱▱▱▱ 0 / 10,000')
  })

  test('the button resets only on a second press within five seconds, and the bank follows', async ($, on) => {
    const clock = answers(on, { balance: 4200, totalBalls: 80, jackpots: 1, kakuhens: 1, best: 600, goalLevel: 2, goalStart: 1000 })
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const coinsNow = async () => (await ui.find({ type: 'Text', text: /코인/ }))?.text ?? ''

    await ui.press({ key: 'reset' })
    expect(await coinsNow()).toMatch(/^💰 4,200 코인/)
    expect((await ui.find({ key: 'reset' }))?.props).toMatchObject({ label: '↺ 한 번 더 누르면 리셋 (5초)' })
    // left alone, it disarms
    await clock.advance(5600)
    expect((await ui.find({ key: 'reset' }))?.props).toMatchObject({ label: '↺ 점수 리셋' })
    await ui.press({ key: 'reset' })
    expect(await coinsNow()).toMatch(/^💰 4,200 코인/)

    // two presses close together reset
    await clock.advance(1000)
    await ui.press({ key: 'reset' })
    expect(await coinsNow()).toMatch(/^💰 0 코인 · 콤보 0/)
    expect((await ui.find({ type: 'Text', text: /목표/ }))?.text).toBe('🎯 목표 ▱▱▱▱▱▱▱▱▱▱ 0 / 10,000')
    expect(await ui.find({ type: 'Text', text: /점수 리셋: 0코인/ })).toBeTruthy()
    await ui.unmount()

    // a reload of the module reads the bank: the reset holds
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    expect((await $.command.run(run('')))?.text).toMatch(/파칭코: 0 코인 · 공 0개 · 잭팟 0번 · 찬스 0번 · 최고 한 방 0\n🎯 목표 /)
  })

  test('/pachinko reset resets at once and says from what', async ($, on) => {
    answers(on, { balance: 3100, totalBalls: 10, jackpots: 0, kakuhens: 0, best: 90, goalLevel: 2, goalStart: 0 })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    expect((await $.command.run(run('reset')))?.text).toBe('점수를 리셋했습니다 (3,100코인 → 0)')
    expect((await $.command.run(run('')))?.text).toMatch(/^파칭코: 0 코인/)
  })
})

describe('the ball guide', () => {
  test('every kind of ball has a line, and the values in it are the ones really dropped', () => {
    expect(BALL_GUIDE.map(g => g.key)).toEqual(['start', 'read', 'edit', 'shell', 'web', 'other', 'agent', 'commit', 'test', 'comeback', 'bust', 'jackpot', 'bonus', 'multi', 'free'])
    const line = (key: string) => BALL_GUIDE.find(g => g.key === key)!.effect
    expect(line('read')).toContain('값 8')
    expect(line('edit')).toContain('값 20')
    expect(line('shell')).toContain('값 15')
    expect(line('web')).toContain('값 12')
    expect(line('agent')).toContain('값 15씩')
    // the special balls are worth what workBalls drops
    expect(line('commit')).toContain(`값 ${workBalls(EMPTY, 'Bash', { command: 'git commit -m x' }, false, 0).drops[0]!.value}`)
    expect(line('test')).toContain(`값 ${workBalls(EMPTY, 'Bash', { command: 'pytest' }, false, 0).drops[0]!.value}`)
    expect(line('comeback')).toContain(`값 ${workBalls({ ...EMPTY, testFailed: true }, 'Bash', { command: 'pytest' }, false, 0).drops[0]!.value}`)
    expect(BALL_GUIDE.every(g => g.dot && g.name && g.when && g.effect)).toBe(true)
  })

  test('each ball names itself in the log the moment it drops', () => {
    const say = (tool: string, input: Record<string, unknown> = {}) => workBalls(EMPTY, tool, input, false, 0).line
    expect(say('Read')).toBe('🔵 읽기 공 · Read (값 8)')
    expect(say('Grep')).toBe('🔵 읽기 공 · Grep (값 8)')
    expect(say('Edit', { file_path: '/a.ts' })).toBe('🟡 수정 공 · Edit (값 20)')
    expect(say('Write', { file_path: '/b.ts' })).toBe('🟡 수정 공 · Write (값 20)')
    expect(say('Bash', { command: 'ls' })).toBe('🔴 명령 공 · Bash (값 15)')
    expect(say('PowerShell', { command: 'ls' })).toBe('🔴 명령 공 · PowerShell (값 15)')
    expect(say('WebSearch')).toBe('🟢 웹 공 · WebSearch (값 12)')
    expect(say('Agent')).toMatch(/^🟣 서브에이전트 공 5개/)
    expect(say('Skill')).toBe('🔘 기타 공 · Skill (값 10)')
    expect(say('Bash', { command: 'git commit -m x' })).toMatch(/커밋/)
    expect(say('Bash', { command: 'pytest' })).toMatch(/테스트 통과/)
    expect(workBalls(EMPTY, 'Read', {}, true, 0).line).toMatch(/꽝 공/)
    // the log keeps the last five
    let log: string[] = []
    for (const tool of ['Read', 'Edit', 'Bash', 'Grep', 'Glob', 'Write']) log = dropBalls({ ...EMPTY, log }, [WHITE], 0, () => 0.5).board.log
    expect(log.length).toBeLessThanOrEqual(5)
  })

  test('/pachinko balls explains every ball in text', async ($, on) => {
    answers(on)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const said = (await $.command.run(run('balls')))?.text ?? ''
    expect(said).toBe(guideText())
    for (const g of BALL_GUIDE) expect(said).toContain(g.name)
    expect(said).toMatch(/코인 = 공 값 × 칸 배율/)
    expect((await $.command.run(run('공')))?.text).toBe(said)
  })

  test('the guide button shows the guide in place of the board, and a turn logs its start ball', async ($, on) => {
    answers(on)
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    await $.turn.start({ turnId: 't1', text: 'hi' })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await ui.find({ type: 'Svg' })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /⚪ 시작 공 · 작업 시작 \(값 10\)/ })).toBeTruthy()
    expect((await ui.find({ key: 'guide' }))?.props).toMatchObject({ label: '📖 공 설명' })

    await ui.press({ key: 'guide' })
    expect(await ui.find({ type: 'Svg' })).toBeFalsy()
    for (const g of BALL_GUIDE) expect(await ui.find({ type: 'Text', text: new RegExp(g.name) })).toBeTruthy()
    expect((await ui.find({ key: 'guide' }))?.props).toMatchObject({ label: '← 판으로 돌아가기' })

    await ui.press({ key: 'guide' })
    expect(await ui.find({ type: 'Svg' })).toBeTruthy()
    await ui.unmount()
  })

  test('the terminal has the guide button too', async ($, on) => {
    answers(on)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await ui.press({ key: 'guide' })
    expect(await ui.find({ type: 'Text', text: /🔵 읽기 공/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /떨어지는 공|대기 중/ })).toBeFalsy()
    await ui.unmount()
  })
})
