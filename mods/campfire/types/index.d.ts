export type Camp = {
  working: boolean
  tools: number
  startedAt: number
  endedAt: number
  tick: number
}

declare module 'claude-code' {
  interface PluginState {
    campfire: { fire: Camp }
  }
}
