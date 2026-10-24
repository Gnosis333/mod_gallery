export type Snapshot = {
  tokens?: number
  window: number
  percent?: number
  limits: { kind: string; percent: number; resetsAt?: string }[]
  usd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { snapshot: Snapshot | null }
  }
}
