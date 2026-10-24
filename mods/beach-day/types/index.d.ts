export type Beach = {
  working: boolean
  tools: number
  startedAt: number
  endedAt: number
  tick: number
}

declare module 'claude-code' {
  interface PluginState {
    'beach-day': { shore: Beach }
  }
}
