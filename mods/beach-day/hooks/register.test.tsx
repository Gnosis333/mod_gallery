import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'beach-day',
  component: 'Pane',
  requestId: 'beach-day',
  props: {
    title: 'Beach',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const answers = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  on('command.register', () => ({ value: { command: 'beach' } }))
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

test('at rest: waves, sunbeds under parasols, and swimmers on rings, the pink unicorn among them', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await source(ui)

    // the unicorn's ring and its golden horn
    expect(svg).toMatch(/stroke="#ffa6d2"/)
    expect(svg).toMatch(/M-2\.8 -44 L0 -62 L2\.8 -44Z" fill="#ffd34a"/)
    // seven floats and seven people on sunbeds and towels, most in sunglasses
    expect(svg.match(/<ellipse cx="6" cy="7" rx="28"/g)?.length).toBe(7)
    expect(svg.match(/fill="#1a1a22"\/><ellipse cx="2\.6"/g)?.length).toBeGreaterThan(8)
    // no jet ski or banana boat at rest
    expect(svg).not.toMatch(/fill="#e84a4a"\/><path d="M-12 -4 H2/)
    expect(await text(ui, /Idle/)).toBe('Idle')
    await ui.unmount()
  }
})

test('at work a jet ski and a banana boat run past, and the waves come in quicker', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await text(ui, /Working/)).toBe('Working 00:00 · tools 1')
  const busy = await source(ui)
  expect(busy).toMatch(/fill="#e84a4a"\/><path d="M-12 -4 H2/)
  expect(busy).toMatch(/fill="#ffd23f"\/><path d="M-30 0 H32"/)
  expect(busy).toMatch(/dur="7s"/)
  // three crabs on the sand
  expect(busy.match(/<ellipse rx="9\.4" ry="6\.8" fill="#e8502e"\/>/g)?.length).toBe(3)
  expect(busy.length).toBeLessThan(131072)

  await $.turn.complete({ reason: 'answer', text: 'ok' })
  const calm = await source(ui)
  expect(calm).not.toMatch(/M-30 0 H32/)
  expect(calm).not.toMatch(/fill="#e8502e"\/><ellipse cx="-2"/)
  await ui.unmount()
})

test('the terminal gets a still text beach', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /desktop app/ })).toBeTruthy()
  expect(await ui.find({ type: 'Svg' })).toBeFalsy()
  await ui.unmount()
})
