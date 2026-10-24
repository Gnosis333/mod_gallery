import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'snow-cabin',
  component: 'Pane',
  requestId: 'snow-cabin',
  props: {
    title: 'Snowy cabin',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

let now = 1_000_000

const answers = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  on('command.register', () => ({ value: { command: 'snow' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: now }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: 'done' }))
  on('tool.call', () => ({ result: {} }))
}

const text = async (ui: { find: (q: object) => Promise<{ text?: string } | undefined> }, re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
const source = async (ui: { find: (q: object) => Promise<unknown> }) => ((await ui.find({ type: 'Svg' })) as { props: { source: string } }).props.source

const NIGHT = /fill="#0c1838"/
const SNOWMAN = /<ellipse cx="4" cy="0" rx="28" ry="6" fill="#c9d6e4"\/>/g

test('by day the snow falls softly: no night, no lit windows, no snowmen yet, and the animals come by', async ($, on) => {
  now = 1_000_000
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await source(ui)

    expect(svg).not.toMatch(NIGHT)
    expect(svg).not.toMatch(/fill="#ffd27a"><animate/)
    expect(svg.match(SNOWMAN)).toBeNull()
    // the white rabbit's pink ear, the fox's amber eye, the magpie's blue-black tail
    expect(svg).toMatch(/#f6c6d0/)
    expect(svg).toMatch(/#c88a2a/)
    expect(svg).toMatch(/#1f2a4a/)
    // and the husky's ice-blue eye
    expect(svg).toMatch(/#6ac6ff/)
    // eighty-odd flakes
    expect(svg.match(/<circle r="[\d.]+" fill="#fff" opacity="0?\.\d+">/g)?.length).toBe(84)
    expect(await text(ui, /Idle/)).toBe('Idle')
    await ui.unmount()
  }
})

test('at work night falls, the windows glow, the smoke thickens and snowmen are built one by one; they stay after', async ($, on) => {
  now = 1_000_000
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const dark = await source(ui)
  expect(dark).toMatch(NIGHT)
  expect(dark).toMatch(/fill="#ffd27a"><animate/)
  // six smoke puffs, and all six snowmen laid out, each to be built in its own time
  expect(dark.match(/<circle cx="296" cy="684"/g)?.length).toBe(6)
  expect(dark.match(SNOWMAN)?.length).toBe(6)
  expect(dark).toMatch(/type="scale" values="0;1\.14;1" keyTimes="0;\.7;1" dur="\.7s" begin="2s"/)
  expect(dark.length).toBeLessThan(131072)

  // 20 seconds in, two are built; the turn ends and they stand in the daylight
  now += 20_000
  await $.turn.complete({ reason: 'answer', text: 'ok' })
  now += 5_000
  await ui.unmount()
  const ui2 = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const day = await source(ui2)
  expect(day).not.toMatch(NIGHT)
  expect(day.match(SNOWMAN)?.length).toBe(2)
  expect(day).not.toMatch(/type="scale" values="0;1\.14;1"/)
  await ui2.unmount()
})

test('the terminal gets a still text cabin', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /desktop app/ })).toBeTruthy()
  expect(await ui.find({ type: 'Svg' })).toBeFalsy()
  await ui.unmount()
})
