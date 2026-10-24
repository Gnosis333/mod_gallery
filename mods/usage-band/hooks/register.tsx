import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Snapshot } from '../types'

const snapshot = atom({ plugin: 'usage-band', key: 'snapshot' } as const, null)

const WARN = 70
const DANGER = 85
const CELLS = 10
const MINI = 5

// Graphite plate with muted accents; nothing here is neon.
const PLATE = '#26282c'
const TRACK = '#4d5157'
const LABEL = '#aab0b8'
const DIM = '#8a9099'
const CAUTION = '#c09a5b'
const ALERT = '#bf6a5f'
const ACCENT: Record<string, string> = {
  context: '#7b9bb5',
  five_hour: '#86a695',
  seven_day: '#9a95b5',
  cost: '#c2b08a',
}

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d' }

type Usage = {
  context: { tokens?: number; window: number; percent?: number }
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
  cost?: { usd: number }
}

const toSnapshot = (u: Usage): Snapshot => ({
  tokens: u.context.tokens,
  window: u.context.window,
  percent: u.context.percent,
  limits: u.rateLimits.map(l => ({ kind: l.kind, percent: l.percentUsed, resetsAt: l.resetsAt })),
  usd: u.cost?.usd,
})

const tone = (percent: number | undefined, base: string) =>
  percent === undefined ? base : percent >= DANGER ? ALERT : percent >= WARN ? CAUTION : base

const kilo = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

// When a window starts over, in this computer's time: the 5-hour one as a clock time (with "tomorrow" if it
// falls after midnight), the weekly one as month/day.
const two = (v: number) => String(v).padStart(2, '0')
const resetLabel = (kind: string, iso: string | undefined, today: Date = new Date()) => {
  const d = iso ? new Date(iso) : undefined
  if (!d || Number.isNaN(d.getTime())) return undefined
  if (kind === 'seven_day') return `${d.getMonth() + 1}/${d.getDate()}`
  const clock = `${two(d.getHours())}:${two(d.getMinutes())}`
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000)

  return days <= 0 ? clock : days === 1 ? `tomorrow ${clock}` : `${d.getMonth() + 1}/${d.getDate()} ${clock}`
}

const filledCells = (percent: number, cells = CELLS) =>
  Math.max(0, Math.min(cells, Math.round((percent / 100) * cells)))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const usage = await $.session.usage()
    await update($, snapshot, () => toSnapshot(usage))

    return next(e)
  }).catch(($, e, next) => next(e))

  // Pushed by the engine after each main-thread turn and when a limit moves.
  on('session.measure', async ($, e, next) => {
    await update($, snapshot, () => toSnapshot(e))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, snapshot)

    if (e.props.hasSurvey || now === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const { percent, tokens, window, limits, usd } = now
    const color = tone(percent, ACCENT.context)
    const filled = percent === undefined ? 0 : filledCells(percent)
    // Once the account reports any limit, the 5-hour and weekly slots always show;
    // a window the last response left out reads as a dash.
    const slots =
      limits.length === 0
        ? []
        : [
            ...['five_hour', 'seven_day'].map(kind => ({
              kind,
              percent: limits.find(l => l.kind === kind)?.percent,
              resetsAt: limits.find(l => l.kind === kind)?.resetsAt,
            })),
            ...limits.filter(l => l.kind !== 'five_hour' && l.kind !== 'seven_day'),
          ]

    return (
      <Box backgroundColor={PLATE} paddingX={1}>
        <Text color={ACCENT.context} bold>{'Context '}</Text>
        <Text color={color}>{'━'.repeat(filled)}</Text>
        <Text color={TRACK}>{'─'.repeat(CELLS - filled)}</Text>
        {percent === undefined || tokens === undefined ? (
          <Text color={DIM}>{' shown after first reply'}</Text>
        ) : (
          <Box>
            <Text color={color} bold>{` ${percent}%`}</Text>
            <Text color={DIM}>{` ${kilo(tokens)}/${kilo(window)}`}</Text>
          </Box>
        )}
        {slots.map(l => (
          <Box>
            <Text color={TRACK}>{'  │  '}</Text>
            <Text color={ACCENT[l.kind] ?? LABEL}>{`${LABELS[l.kind] ?? l.kind} `}</Text>
            {l.percent === undefined ? (
              <Text color={DIM}>{'–'}</Text>
            ) : (
              <Box>
                <Text color={tone(l.percent, ACCENT[l.kind] ?? LABEL)}>{'━'.repeat(filledCells(l.percent, MINI))}</Text>
                <Text color={TRACK}>{'─'.repeat(MINI - filledCells(l.percent, MINI))}</Text>
                <Text color={tone(l.percent, ACCENT[l.kind] ?? LABEL)} bold>{` ${l.percent}%`}</Text>
                {resetLabel(l.kind, l.resetsAt) !== undefined && <Text color={DIM}>{` ↻${resetLabel(l.kind, l.resetsAt)}`}</Text>}
              </Box>
            )}
          </Box>
        ))}
        {usd !== undefined && (
          <Box>
            <Text color={TRACK}>{'  │  '}</Text>
            <Text color={ACCENT.cost}>{`$${usd.toFixed(2)}`}</Text>
          </Box>
        )}
      </Box>
    )
  })
}
