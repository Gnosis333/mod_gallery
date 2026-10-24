import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'desk-garden',
  component: 'Pane',
  requestId: 'desk-garden',
  props: {
    title: 'Desk garden',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('the pane stacks the window room and the workshop as SVGs off the terminal', async ($, on) => {
  on('command.register', () => ({ value: { command: 'garden' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await ui.find({ type: 'Svg' })

    expect(JSON.stringify(svg)).toMatch(/animateMotion/)
    expect((await ui.find({ type: 'Text', text: /Flowers 0\/12/ }))?.text).toBe('Flowers 0/12 · turns done 0 · tools 0')
    await ui.unmount()
  }
})

test('a finished turn blooms a flower and a tool call is counted', async ($, on) => {
  on('command.register', () => ({ value: { command: 'garden' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: 'done' }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /tools 1/ }))?.text).toBe('Flowers 0/12 · turns done 0 · tools 1')

  await $.turn.complete({ reason: 'answer', text: 'ok' })
  expect((await ui.find({ type: 'Text', text: /turns done 1/ }))?.text).toBe('Flowers 1/12 · turns done 1 · tools 1')
  await ui.unmount()
})

test('the terminal gets a still text flowerpot', async ($, on) => {
  on('command.register', () => ({ value: { command: 'garden' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /desktop app/ })).toBeTruthy()
  expect(await ui.find({ type: 'Svg' })).toBeFalsy()
  await ui.unmount()
})
