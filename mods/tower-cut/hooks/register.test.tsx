import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'tower-cut',
  component: 'Pane',
  requestId: 'tower-cut',
  props: {
    title: 'Tower',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const answers = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  on('command.register', () => ({ value: { command: 'tower' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: 'done' }))
  on('tool.call', () => ({ result: {} }))
}

const text = async (ui: { find: (q: object) => Promise<{ text?: string } | undefined> }, re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text

test('the pane draws an empty lot at first, with no scaffolding and no fireworks', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = JSON.stringify(await ui.find({ type: 'Svg' }))

    expect(svg).toMatch(/animateTransform/)
    expect(svg).not.toMatch(/#f08a1c/)
    expect(svg).not.toMatch(/data-fx/)
    expect(await text(ui, /Idle/)).toBe('Idle · tower 1 0/20 floors · completed 0')
    await ui.unmount()
  }
})

test('at work a floor goes up under scaffolding; a finished turn completes it', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Read', file_path: '/x' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await text(ui, /Working/)).toBe('Working 00:00 · tools 2 · building floor 1')
  expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toMatch(/#f08a1c/)

  await $.turn.complete({ reason: 'answer', text: 'ok' })
  expect(await text(ui, /Idle/)).toBe('Idle · tower 1 1/20 floors · completed 0')
  expect(JSON.stringify(await ui.find({ type: 'Svg' }))).not.toMatch(/#f08a1c/)
  await ui.unmount()
})

test('twenty answers top the tower out; the next turn starts a new one beside it', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (let i = 0; i < 20; i++) {
    await $.turn.start({ text: 'hi' })
    await $.turn.complete({ reason: 'answer', text: 'ok' })
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await text(ui, /Topped out!/)).toBe('Topped out! · tower 1 20/20 floors · completed 1')
  const svg = JSON.stringify(await ui.find({ type: 'Svg' }))
  expect(svg).toMatch(/data-fx/)
  expect(svg.length).toBeLessThan(130000)

  await $.turn.start({ text: 'again' })
  expect(await text(ui, /Working/)).toBe('Working 00:00 · tools 0 · building floor 1')
  await $.turn.complete({ reason: 'answer', text: 'ok' })
  expect(await text(ui, /Idle/)).toBe('Idle · tower 2 1/20 floors · completed 1')
  await ui.unmount()
})

test('the terminal gets a still text building', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /desktop app/ })).toBeTruthy()
  expect(await ui.find({ type: 'Svg' })).toBeFalsy()
  await ui.unmount()
})
