import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'haiku-warning',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 9 },
  },
} as const

const start = async ($: any, on: any, id: string) => {
  on('session.model', () => ({ value: id }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
}

test('Haiku shows the red warning, on terminal and desktop', async ($, on) => {
  await start($, on, 'claude-haiku-5-5')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const row = await ui.find({ type: 'Text', text: /Haiku/ })
    expect(row?.text).toContain('claude-haiku-5-5')
    expect(row?.props.color).toBe('error')
    await ui.unmount()
  }
})

test('Opus shows nothing of the mod', async ($, on) => {
  await start($, on, 'claude-opus-5-5')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Haiku/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})

test('picking Haiku shows the warning without a prompt, and leaving hides it', async ($, on) => {
  const clock = mock.clock(on)
  let picked = 'claude-opus-5-5'
  on('session.model', () => ({ value: picked }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Haiku/ })).toBeUndefined()

  picked = 'claude-haiku-5-5'
  await clock.advance(1500)
  expect((await ui.find({ type: 'Text', text: /Haiku/ }))?.props.color).toBe('error')

  picked = 'claude-sonnet-5-5'
  await clock.advance(1500)
  expect(await ui.find({ type: 'Text', text: /Haiku/ })).toBeUndefined()
  await ui.unmount()
})
