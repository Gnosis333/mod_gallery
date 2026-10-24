export type Moon = {
  working: boolean
  prev: boolean
  tools: number
  startedAt: number
  endedAt: number
  tick: number
}

declare module 'claude-code' {
  interface PluginState {
    'moon-view': { surface: Moon }
  }
}
