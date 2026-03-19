import { describe, test, expect } from 'bun:test'
import { AsciiStateStore } from '../../../src/ascii/state/store'

describe('AsciiStateStore', () => {
  test('initializes with DASHBOARD state', () => {
    const store = new AsciiStateStore()
    expect(store.getState()).toBe('DASHBOARD')
  })

  test('transitions to new state via label', () => {
    const store = new AsciiStateStore()
    const result = store.transition('B')
    expect(result).toBe(true)
    expect(store.getState()).toBe('SOURCES')
  })

  test('returns false for invalid label', () => {
    const store = new AsciiStateStore()
    const result = store.transition('Z')
    expect(result).toBe(false)
    expect(store.getState()).toBe('DASHBOARD')
  })

  test('notifies subscribers on state change', () => {
    const store = new AsciiStateStore()
    let notified = false
    const unsubscribe = store.subscribe(() => notified = true)
    store.transition('B')
    expect(notified).toBe(true)
    unsubscribe()
  })

  test('setData updates state data', () => {
    const store = new AsciiStateStore()
    store.setData({ cpu_percent: 45 })
    expect(store.getData().cpu_percent).toBe(45)
  })

  test('getAction returns action name for label', () => {
    const store = new AsciiStateStore()
    const action = store.getAction('F')
    expect(action).toBe('runAnalysis')
  })
})
