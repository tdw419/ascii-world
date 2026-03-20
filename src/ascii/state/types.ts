export type AsciiState =
  | 'DASHBOARD'
  | 'SOURCES'
  | 'CONFIG'
  | 'HISTORY'
  | 'PROVIDERS'
  | 'SAFE_YOUTUBE'

export interface VideoInfo {
  id: string
  title: string
  duration: number
}

export interface AsciiStateData {
  state: AsciiState
  timestamp: string
  appVersion: string
  status: 'READY' | 'LOADING' | 'ERROR'
  // YouTube state
  videos?: VideoInfo[]
  nowPlaying?: string
  volume?: number
  volumeBar?: string
  [key: string]: any
}

export interface BindingConfig {
  stateTransitions: Record<AsciiState, Record<string, AsciiState>>
  actions: Record<string, string>
}
