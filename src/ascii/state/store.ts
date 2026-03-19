import type { AsciiState, AsciiStateData, BindingConfig } from './types'
import bindings from '../bindings.json'

export class AsciiStateStore {
  private _state: AsciiState = 'DASHBOARD'
  private _data: Partial<AsciiStateData> = {}
  private _listeners: Set<() => void> = new Set()
  private bindings: BindingConfig = bindings as BindingConfig

  getState(): AsciiState {
    return this._state
  }

  getData(): Partial<AsciiStateData> {
    return { ...this._data, state: this._state }
  }

  setData(data: Partial<AsciiStateData>): void {
    this._data = { ...this._data, ...data }
    this._notify()
  }

  transition(label: string): boolean {
    const transitions = this.bindings.stateTransitions[this._state]
    if (transitions && transitions[label]) {
      this._state = transitions[label] as AsciiState
      this._notify()
      return true
    }
    return false
  }

  getAction(label: string): string | undefined {
    return this.bindings.actions[label]
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  setState(state: AsciiState): void {
    this._state = state
    this._notify()
  }

  getBindings(): BindingConfig {
    return this.bindings
  }

  private _notify(): void {
    this._listeners.forEach(listener => {
      try {
        listener()
      } catch (error) {
        console.error('[AsciiStateStore] Listener error:', error)
      }
    })
  }
}

export const asciiStateStore = new AsciiStateStore()
