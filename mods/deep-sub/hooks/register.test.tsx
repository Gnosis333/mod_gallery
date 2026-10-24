import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'deep-sub',
  component: 'Pane',
  requestId: 'deep-sub',
  props: {
    title: 'Deep sea',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const answers = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  on('command.register', () => ({ value: { command: 'deep' } }))
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

const BEAM = /fill="url\(#beam\)"/
const SQUID = /M150 0 Q120 -30 40 -28/

test('at rest the submersible hangs in the dark; jellyfish, an anglerfish and the thing below drift by', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await source(ui)

    // three glowing jellyfish, the anglerfish's lure, and the eyes of the thing far below
    expect(svg.match(/fill-opacity="\.28"/g)?.length).toBe(3)
    expect(svg).toMatch(/fill="#e8fff8"/)
    expect(svg).toMatch(/fill="#7dffb0"/)
    // the dumbo octopus, the gulper eel's red tail light, and the ghost of a whale
    expect(svg).toMatch(/fill="#f8bccb"/)
    expect(svg).toMatch(/fill="#ff4a6a"/)
    expect(svg).toMatch(/<g opacity="\.13">/)
    expect(svg).not.toMatch(BEAM)
    expect(svg).not.toMatch(SQUID)
    expect(await text(ui, /Idle/)).toBe('Idle')
    await ui.unmount()
  }
})

test('at work the searchlight comes on, sonar pings, and the giant squid passes; at rest again they go', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await text(ui, /Working/)).toBe('Working 00:00 · tools 1')
  const busy = await source(ui)
  expect(busy).toMatch(BEAM)
  expect(busy).toMatch(SQUID)
  expect(busy).toMatch(/values="30;260"/)
  expect(busy.length).toBeLessThan(131072)

  await $.turn.complete({ reason: 'answer', text: 'ok' })
  const calm = await source(ui)
  expect(calm).not.toMatch(BEAM)
  expect(calm).not.toMatch(SQUID)
  await ui.unmount()
})

test('the terminal gets a still text submersible', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /desktop app/ })).toBeTruthy()
  expect(await ui.find({ type: 'Svg' })).toBeFalsy()
  await ui.unmount()
})
