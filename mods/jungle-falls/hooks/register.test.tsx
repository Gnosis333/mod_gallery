import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'jungle-falls',
  component: 'Pane',
  requestId: 'jungle-falls',
  props: {
    title: 'Jungle',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const answers = (on: Parameters<Parameters<typeof test>[1]>[1], now: () => number = () => 1_000_000) => {
  on('command.register', () => ({ value: { command: 'falls' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: now() }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: 'done' }))
  on('tool.call', () => ({ result: {} }))
}

const text = async (ui: { find: (q: object) => Promise<{ text?: string } | undefined> }, re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text

test('the pane draws the winding falls and leaping fish, by day', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = JSON.stringify(await ui.find({ type: 'Svg' }))

    expect(svg).toMatch(/stroke-dashoffset/)
    expect(svg).toMatch(/data-fish/)
    expect(svg).not.toMatch(/#e8ff7a/)
    expect(await text(ui, /Idle/)).toBe('Idle')
    await ui.unmount()
  }
})

test('at work it is night and the water runs harder; a finished turn draws it afresh', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Read', file_path: '/x' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await text(ui, /Working/)).toBe('Working 00:00 · tools 2')
  expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toMatch(/#e8ff7a/)

  await $.turn.complete({ reason: 'answer', text: 'ok' })
  expect(await text(ui, /Idle/)).toBe('Idle')
  expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toMatch(/data-visitor/)
  await ui.unmount()
})

test('every kind of animal is laid out, hidden until its time, and the picture stays under the size limit', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const working of [false, true]) {
    if (working) await $.turn.start({ text: 'hi' })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const node = (await ui.find({ type: 'Svg' })) as { props: { source: string } }
    const svg = node.props.source
    const kinds = new Set([...svg.matchAll(/data-visitor="(\d+)"/g)].map(m => m[1]))

    expect(kinds.size).toBe(24)
    expect(svg).toMatch(/display="none"/)
    expect(svg.length).toBeLessThan(131072)
    await ui.unmount()
  }
})

test('the terminal gets a still text waterfall', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /desktop app/ })).toBeTruthy()
  expect(await ui.find({ type: 'Svg' })).toBeFalsy()
  await ui.unmount()
})
