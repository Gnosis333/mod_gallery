export type Tower = {
  working: boolean
  prev: boolean
  floors: number
  towers: number
  fresh: boolean
  tools: number
  startedAt: number
  tick: number
}

declare module 'claude-code' {
  interface PluginState {
    'tower-cut': { tower: Tower }
  }
}
