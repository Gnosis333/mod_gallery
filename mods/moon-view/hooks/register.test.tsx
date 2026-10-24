import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'moon-view',
  component: 'Pane',
  requestId: 'moon-view',
  props: {
    title: '달',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

const answers = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  on('command.register', () => ({ value: { command: 'moon' } }))
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

test('the Moon at rest: the Earth in the sky, a lander whose eyes blink, and an astronaut hopping calmly', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await source(ui)
    const kinds = new Set([...svg.matchAll(/data-visitor="(\d+)"/g)].map(m => m[1]))

    expect(svg).toMatch(/clip-path="url\(#earth\)"/)
    expect(svg).toMatch(/path="M170 1068 Q197 938 224 1068/)
    expect(kinds.size).toBe(15)
    expect(svg).not.toMatch(/scale\(-1 -1\)/)
    expect(svg).toMatch(/display="none"/)
    expect(svg).not.toMatch(/#fff2a8/)
    expect(svg).toMatch(/#cfe8ff/)
    expect(svg).not.toMatch(/values="0;360" dur="1.5s"/)
    expect(svg.length).toBeLessThan(131072)
    expect(await text(ui, /쉬는 중/)).toBe('쉬는 중')
    await ui.unmount()
  }
})

test('while Claude works the lander flickers and the astronaut tumbles in the air', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Read', file_path: '/x' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await text(ui, /작업 중/)).toBe('작업 중 00:00 · 도구 2회')
  const busy = await source(ui)
  expect(busy).toMatch(/#fff2a8/)
  expect(busy).toMatch(/values="0;360" dur="1.5s"/)
  expect(busy).toMatch(/Q197 798 224 1068/)
  expect(busy.length).toBeLessThan(131072)

  await $.turn.complete({ reason: 'answer', text: 'ok' })
  expect(await text(ui, /쉬는 중/)).toBe('쉬는 중')
  expect(await source(ui)).not.toMatch(/#fff2a8/)
  await ui.unmount()
})

test('the terminal gets a still text Moon', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /데스크톱 앱/ })).toBeTruthy()
  expect(await ui.find({ type: 'Svg' })).toBeFalsy()
  await ui.unmount()
})

test('never more than a few visitors at once at rest, and never two of the same kind together', async ($, on) => {
  answers(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const LIFE = [3, 9, 18, 12, 18, 14, 22, 16, 22, 18, 10, 22, 20, 12, 14]

  for (let build = 0; build < 12; build++) {
    // a new picture each time: mounting again draws it afresh
    await $.turn.start({ text: 'hi' })
    await $.turn.complete({ reason: 'answer', text: 'ok' })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const svg = await source(ui)
    const events: { kind: number; t: number }[] = []
    for (const m of svg.matchAll(/<g data-visitor="(\d+)" display="none"><animate attributeName="display"[^>]*begin="([^"]*)"/g)) {
      for (const t of m[2].split(';')) events.push({ kind: Number(m[1]), t: parseFloat(t) })
    }
    for (let t = 0; t < 800; t += 1) {
      const on = events.filter(e => t >= e.t && t < e.t + LIFE[e.kind])
      expect(on.length).toBeLessThanOrEqual(3)
      expect(new Set(on.map(e => e.kind)).size).toBe(on.length)
    }
    await ui.unmount()
  }
})
