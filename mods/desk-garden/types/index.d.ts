export type Work = {
  working: boolean
  prev: boolean
  done: number
  fresh: boolean
  tools: number
}

declare module 'claude-code' {
  interface PluginState {
    'desk-garden': { work: Work }
  }
}
