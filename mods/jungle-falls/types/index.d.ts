export type Falls = {
  working: boolean
  prev: boolean
  tools: number
  startedAt: number
  endedAt: number
  tick: number
}

declare module 'claude-code' {
  interface PluginState {
    'jungle-falls': { calm: Falls }
  }
}
