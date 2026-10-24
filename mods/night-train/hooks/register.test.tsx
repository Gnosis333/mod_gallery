import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'night-train',
  component: 'Pane',
  requestId: 'night-train',
  props: {
    title: 'Night train',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const answers = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  on('command.register', () => ({ value: { command: 'train' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: 'done' }))
  on('tool.call', () => ({ result: {} }))
}

const text = async (ui: { find: (q: object) => Promise<{ text?: string } | undefined> }, re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
const source = async (ui: { find: (q: object) => Promise<unknown> }) => ((await ui.find({ type: 'Svg' })) as { props: { source: string } }).props.source

test('at rest the train waits at the station: the platform, its lamps, and no scenery running', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await source(ui)

    expect(svg).toMatch(/clip-path="url\(#glass\)"/)
    expect(svg).toMatch(/>STATION</)
    // a flock of nine birds, twice
    expect(svg.match(/values="M-6 0 Q-3 -4 0 0/g)?.length).toBe(18)
    expect(svg).toMatch(/#c9b46a/)
    expect(svg).not.toMatch(/#06070c/)
    expect(svg).not.toMatch(/values="0 0;-400 0"/)
    expect(await text(ui, /Idle/)).toBe('Idle')
    await ui.unmount()
  }
})

test('at work the station slides away and the scenery runs; when the turn ends the train pulls in again', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await text(ui, /Working/)).toBe('Working 00:00 · tools 1')
  const run = await source(ui)
  // leaving the station
  expect(run).toMatch(/values="0 0;-440 0"/)
  // the far mountains, the hills, the trees and the poles each run
  expect(run.match(/values="0 0;-400 0"/g)?.length).toBe(4)
  // a tunnel now and then
  expect(run).toMatch(/#06070c/)

  await $.turn.complete({ reason: 'answer', text: 'ok' })
  expect(await text(ui, /Idle/)).toBe('Idle')
  const arrive = await source(ui)
  expect(arrive).toMatch(/values="440 0;0 0"/)
  expect(arrive).not.toMatch(/#06070c/)
  expect(run.length).toBeLessThan(131072)
  expect(arrive.length).toBeLessThan(131072)
  await ui.unmount()
})

test('the terminal gets a still text window', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /desktop app/ })).toBeTruthy()
  expect(await ui.find({ type: 'Svg' })).toBeFalsy()
  await ui.unmount()
})
