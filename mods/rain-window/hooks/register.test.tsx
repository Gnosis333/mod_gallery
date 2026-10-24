import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'rain-window',
  component: 'Pane',
  requestId: 'rain-window',
  props: {
    title: 'Rainy window',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const answers = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  on('command.register', () => ({ value: { command: 'rain' } }))
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

test('at first the rain is light: drops run down the glass, no lightning and no rainbow', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await source(ui)

    expect(svg).toMatch(/clip-path="url\(#glass\)"/)
    expect(svg).toMatch(/keyTimes="0;\.1;\.18;\.3;\.4;\.52;\.6;\.7;\.9;1"/)
    expect(svg).not.toMatch(/#f4f0ff/)
    expect(svg).not.toMatch(/#c6e04a/)
    expect(svg).not.toMatch(/values="1;1;0;0;0;0;1;1"/)
    expect(svg).not.toMatch(/values="1;1;\.1;\.9;\.2;\.8;1;1"/)
    expect(svg).not.toMatch(/#ff4d4d/)
    expect(await text(ui, /Idle/)).toBe('Idle')
    await ui.unmount()
  }
})

test('at work the rain pours and lightning flashes; when it is done a rainbow comes out and fades away', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Read', file_path: '/x' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await text(ui, /Working/)).toBe('Working 00:00 · tools 2')
  const storm = await source(ui)
  expect(storm).toMatch(/#f4f0ff/)
  // the cat's eyes open with each of the two lightning strokes
  expect(storm.match(/#c6e04a/g)?.length).toBe(4)
  // and the z's of its sleep go for as long as they are open
  expect(storm.match(/values="1;1;0;0;0;0;1;1"/g)?.length).toBe(2)
  // the stand lamp flickers with each stroke: its glow, the light on the glass, and a dark shade
  expect(storm.match(/values="1;1;\.1;\.9;\.2;\.8;1;1"/g)?.length).toBe(4)
  // (the same pattern as the two lightning strokes themselves, plus the dark shade for each)
  expect(storm.match(/values="0;0;1;\.2;1;\.3;0;0"/g)?.length).toBe(4)
  expect(storm).not.toMatch(/#ff4d4d/)

  await $.turn.complete({ reason: 'answer', text: 'ok' })
  expect(await text(ui, /Idle/)).toBe('Idle')
  const calm = await source(ui)
  expect(calm).toMatch(/#ff4d4d/)
  expect(calm).not.toMatch(/#f4f0ff/)
  expect(calm.length).toBeLessThan(131072)
  expect(storm.length).toBeLessThan(131072)
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

test('with language set to ko the labels are Korean', { options: { language: 'ko' } }, async ($, on) => {
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
