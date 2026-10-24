import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'reef-tank',
  component: 'Pane',
  requestId: 'reef-tank',
  props: {
    title: '어항',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const answers = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  on('command.register', () => ({ value: { command: 'reef' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('clock.every', () => ({ value: { cancel: () => {} } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: 'done' }))
  on('tool.call', () => ({ result: {} }))
}

test('the pane draws the aquarium as one animated SVG off the terminal', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = JSON.stringify(await ui.find({ type: 'Svg' }))

    expect(svg).toMatch(/animateMotion/)
    expect(svg).not.toMatch(/M250 70 C285/)
    expect((await ui.find({ type: 'Text', text: /쉬는 중/ }))?.text).toBe('쉬는 중 · 진주 0개')
    await ui.unmount()
  }
})

test('at work the top line counts and the diver goes down; a finished turn keeps a pearl', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Read', file_path: '/x' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /작업 중/ }))?.text).toBe('작업 중 00:00 · 도구 2회')
  expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toMatch(/M250 70 C285/)

  await $.turn.complete({ reason: 'answer', text: 'ok' })
  expect((await ui.find({ type: 'Text', text: /진주/ }))?.text).toBe('쉬는 중 · 진주 1개')
  await ui.unmount()
})

test('the terminal gets a still text aquarium', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /데스크톱 앱/ })).toBeTruthy()
  expect(await ui.find({ type: 'Svg' })).toBeFalsy()
  await ui.unmount()
})
