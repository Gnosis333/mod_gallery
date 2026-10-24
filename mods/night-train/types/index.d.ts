export type Train = {
  working: boolean
  tools: number
  startedAt: number
  endedAt: number
  // seconds the train has run in all, so the scenery stops and starts where it was
  travelled: number
  tick: number
}

declare module 'claude-code' {
  interface PluginState {
    'night-train': { ride: Train }
  }
}
