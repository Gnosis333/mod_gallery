export type Cabin = {
  working: boolean
  tools: number
  startedAt: number
  endedAt: number
  // snowmen standing now, and how many stood when this turn began
  built: number
  base: number
  tick: number
}

declare module 'claude-code' {
  interface PluginState {
    'snow-cabin': { yard: Cabin }
  }
}
