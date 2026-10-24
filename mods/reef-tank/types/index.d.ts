export type Reef = {
  working: boolean
  prev: boolean
  done: number
  fresh: boolean
  tools: number
  startedAt: number
  tick: number
}

declare module 'claude-code' {
  interface PluginState {
    'reef-tank': { reef: Reef }
  }
}
