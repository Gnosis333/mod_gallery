export type Dive = {
  working: boolean
  tools: number
  startedAt: number
  endedAt: number
  tick: number
}

declare module 'claude-code' {
  interface PluginState {
    'deep-sub': { dive: Dive }
  }
}
