import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-band',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 9 },
  },
} as const

const usage = (percent: number | undefined, extra = {}) => ({
  context: { tokens: percent === undefined ? undefined : percent * 2000, window: 200000, percent },
  rateLimits: [{ kind: 'five_hour', percentUsed: 38 }],
  cost: { usd: 1.234 },
  ...extra,
})

const setup = async ($: any, on: any, first: unknown) => {
  on('session.usage', () => ({ value: first }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.measure', (_: unknown, e: unknown) => ({ changed: (e as { changed: string[] }).changed }))
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
}

const texts = async (ui: any, pattern: RegExp) => (await ui.find({ type: 'Text', text: pattern })) as any

const BLUE = '#7b9bb5'
const CAUTION = '#c09a5b'
const ALERT = '#bf6a5f'

test('the band shows context, limit and cost on a graphite plate, in the accent colors under 70%', async ($, on) => {
  await setup($, on, usage(52))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await texts(ui, /컨텍스트/)).props.color).toBe(BLUE)
    expect((await texts(ui, /^━{5}$/)).props.color).toBe(BLUE)
    expect((await texts(ui, /^─{5}$/)).props.color).toBe('#4d5157')
    const percent = await texts(ui, /52%/)
    expect(percent.text).toBe(' 52%')
    expect(percent.props.color).toBe(BLUE)
    expect((await texts(ui, /104k\/200k/)).text).toBe(' 104k/200k')
    expect((await texts(ui, /5시간/)).props.color).toBe('#86a695')
    expect((await texts(ui, /38%/)).props.color).toBe('#86a695')
    expect((await texts(ui, /\$1\.23/)).props.color).toBe('#c2b08a')
    await ui.unmount()
  }
})

test('the context and the limits turn amber at 70% and brick at 85%, each turn it is measured', async ($, on) => {
  await setup($, on, usage(52))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await $.session.measure({ ...usage(70), changed: ['context'] } as any)
  expect((await texts(ui, /70%/)).props.color).toBe(CAUTION)
  expect((await texts(ui, /^━{7}$/)).props.color).toBe(CAUTION)

  await $.session.measure({ ...usage(85), changed: ['context'] } as any)
  expect((await texts(ui, /85%/)).props.color).toBe(ALERT)
  expect((await texts(ui, /^━{9}$/)).props.color).toBe(ALERT)

  await $.session.measure({
    ...usage(40),
    rateLimits: [{ kind: 'seven_day', percentUsed: 90 }],
    changed: ['context', 'rateLimits'],
  } as any)
  expect((await texts(ui, /40%/)).props.color).toBe(BLUE)
  expect((await texts(ui, /90%/)).props.color).toBe(ALERT)
  expect((await texts(ui, /7일/)).props.color).toBe('#9a95b5')
  await ui.unmount()
})

test('before the first response it says so, and a survey gets the band', async ($, on) => {
  await setup($, on, usage(undefined, { rateLimits: [], cost: undefined }))

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await texts(ui, /컨텍스트/)).text).toBe('컨텍스트 ')
  expect((await texts(ui, /첫 응답/)).text).toBe(' 첫 응답 후 표시')
  await ui.unmount()

  const survey = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, hasSurvey: true } })
  expect(await survey.find({ type: 'Text', text: /컨텍스트/ })).toBeUndefined()
  expect((await texts(survey, /engine/)).text).toBe('engine')
  await survey.unmount()
})

test('the weekly slot always shows beside the 5-hour one, a dash while it is not reported', async ($, on) => {
  await setup($, on, usage(52))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await $.session.measure({
    ...usage(52),
    rateLimits: [{ kind: 'five_hour', percentUsed: 38 }],
    changed: ['rateLimits'],
  } as any)
  expect((await texts(ui, /7일/)).props.color).toBe('#9a95b5')
  expect((await texts(ui, /^–$/)).props.color).toBe('#8a9099')

  await $.session.measure({
    ...usage(52),
    rateLimits: [
      { kind: 'five_hour', percentUsed: 38 },
      { kind: 'seven_day', percentUsed: 12 },
    ],
    changed: ['rateLimits'],
  } as any)
  expect((await texts(ui, /12%/)).props.color).toBe('#9a95b5')
  expect(await ui.find({ type: 'Text', text: /^–$/ })).toBeUndefined()
  await ui.unmount()
})

test('each limit shows when it starts over: the 5-hour one as a clock time, the weekly one as month/day', async ($, on) => {
  const five = new Date(Date.now() + 3 * 3600_000)
  const week = new Date(Date.now() + 3 * 86_400_000)
  await setup($, on, {
    ...usage(10),
    rateLimits: [
      { kind: 'five_hour', percentUsed: 38, resetsAt: five.toISOString() },
      { kind: 'seven_day', percentUsed: 12, resetsAt: week.toISOString() },
    ],
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const two = (v: number) => String(v).padStart(2, '0')
  const clock = `${two(five.getHours())}:${two(five.getMinutes())}`
  const reset = (await ui.find({ type: 'Text', text: /↻/ })) as any

  expect(reset.text).toMatch(new RegExp(`^ ↻(내일 )?${clock}$`))
  expect((await ui.find({ type: 'Text', text: new RegExp(` ↻${week.getMonth() + 1}/${week.getDate()}$`) })) as any).toBeTruthy()
  await ui.unmount()
})
