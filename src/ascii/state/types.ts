export type AsciiState =
  | 'DASHBOARD'
  | 'SOURCES'
  | 'CONFIG'
  | 'HISTORY'
  | 'PROVIDERS'

export interface AsciiStateData {
  state: AsciiState
  timestamp: string
  appVersion: string
  status: 'READY' | 'LOADING' | 'ERROR'
  [key: string]: any
}

export interface BindingConfig {
  stateTransitions: Record<AsciiState, Record<string, AsciiState>>
  actions: Record<string, string>
}
