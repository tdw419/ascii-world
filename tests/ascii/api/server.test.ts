import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { startApiServer, stopApiServer } from '../../../src/ascii/api/server'

describe('ASCII API Server', () => {
  beforeAll(async () => {
    await startApiServer({ port: 3499 })
  })

  afterAll(() => {
    stopApiServer()
  })

  test('GET /health returns healthy', async () => {
    const res = await fetch('http://localhost:3499/health')
    const data = await res.json()
    expect(data.status).toBe('healthy')
  })

  test('GET /view returns ASCII', async () => {
    const res = await fetch('http://localhost:3499/view')
    const text = await res.text()
    expect(text).toContain('# State:')
  })

  test('POST /control transitions state', async () => {
    const res = await fetch('http://localhost:3499/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'B' })
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.state).toBe('SOURCES')
  })

  test('GET /state returns current state', async () => {
    const res = await fetch('http://localhost:3499/state')
    const data = await res.json()
    expect(data.state).toBeDefined()
  })

  test('GET /bindings returns binding config', async () => {
    const res = await fetch('http://localhost:3499/bindings')
    const data = await res.json()
    expect(data.stateTransitions).toBeDefined()
    expect(data.actions).toBeDefined()
  })
})
