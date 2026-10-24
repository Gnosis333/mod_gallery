import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'campfire',
  component: 'Pane',
  requestId: 'campfire',
  props: {
    title: 'Campfire',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

let now = 1_000_000

const answers = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  on('command.register', () => ({ value: { command: 'fire' } }))
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

const SPARKS = /<circle r="[\d.]+" fill="#(ffd27a|fff2c0)"><animateMotion/g

test('at rest a small fire crackles: flames, sparks, flowers, the fox and the owl', async ($, on) => {
  now = 1_000_000
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await source(ui)

    expect(svg).toMatch(/<g transform="scale\(0\.72\)">/)
    // nine tongues of flame, each licking through its shapes
    expect(svg.match(/<path d="M[^"]+" fill="#(e8401a|ff7a1e|ffb52e|ffe9a0|fffbe8)"><animate attributeName="d"/g)?.length).toBe(10)
    // sixteen drifting sparks and two crackles of six
    expect(svg.match(SPARKS)?.length).toBe(28)
    // the owl's yellow eyes, the fox's white-tipped tail, a tulip and a poppy
    expect(svg).toMatch(/#ffc83a/)
    expect(svg).toMatch(/#d8642a/)
    expect(svg).toMatch(/#e8405a/)
    expect(svg).toMatch(/#e83a2a/)
    // the deer's antlers, the raccoon's mask, the hedgehog's spines, and six logs round the fire
    expect(svg).toMatch(/#d8c8a8/)
    expect(svg).toMatch(/fill="#1a1a20"/)
    expect(svg).toMatch(/stroke="#4a3220"/)
    expect(svg.match(/fill="#5a3c22"/g)?.length).toBe(6)
    expect(await text(ui, /Idle/)).toBe('Idle')
    await ui.unmount()
  }
})

test('at work the fire builds up and throws more sparks; when it ends it dies back down', async ($, on) => {
  now = 1_000_000
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const up = await source(ui)
  expect(up).toMatch(/type="scale" values="0\.72;1\.27" dur="2\.5s"/)
  expect(up.match(SPARKS)?.length).toBe(34 + 18)
  expect(up.length).toBeLessThan(131072)

  now += 10_000
  await $.turn.complete({ reason: 'answer', text: 'ok' })
  const down = await source(ui)
  expect(down).toMatch(/type="scale" values="1\.27;0\.72" dur="4s"/)
  expect(down.match(SPARKS)?.length).toBe(28)
  await ui.unmount()
})

test('the terminal gets a still text campfire', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /desktop app/ })).toBeTruthy()
  expect(await ui.find({ type: 'Svg' })).toBeFalsy()
  await ui.unmount()
})

test('with language set to ko the labels are Korean', { options: { language: 'ko' } }, async ($, on) => {
  now = 1_000_000
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await text(ui, /쉬는 중/)).toBe('쉬는 중')
  await $.turn.start({ text: 'hi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(await text(ui, /작업 중/)).toBe('작업 중 00:00 · 도구 1회')
  await ui.unmount()

  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await terminal.find({ type: 'Text', text: /데스크톱 앱/ })).toBeTruthy()
  await terminal.unmount()
})

test('with no language set the labels are English', async ($, on) => {
  now = 1_000_000
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await text(ui, /Idle/)).toBe('Idle')
  await ui.unmount()
})
