/**
 * E2E Navigation Test
 *
 * Validates full navigation flow through ASCII World states.
 * Tests that an external system (like an LLM) can navigate and control
 * the ASCII interface.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { spawn, ChildProcess } from 'child_process'

const PORT = 3498 // Use different port to avoid conflicts
const API_URL = `http://localhost:${PORT}`

let serverProcess: ChildProcess | null = null

async function waitForServer(url: string, maxWait: number = 5000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    try {
      const response = await fetch(`${url}/health`)
      if (response.ok) return true
    } catch {}
    await new Promise(r => setTimeout(r, 100))
  }
  return false
}

async function getView(): Promise<string> {
  const response = await fetch(`${API_URL}/view`)
  return await response.text()
}

async function getState(): Promise<any> {
  const response = await fetch(`${API_URL}/state`)
  return await response.json()
}

async function sendControl(label: string): Promise<any> {
  const response = await fetch(`${API_URL}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label })
  })
  return await response.json()
}

describe('E2E Navigation', () => {
  beforeAll(async () => {
    // Start ASCII World server
    serverProcess = spawn('bun', ['run', 'src/ascii/cli.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, ASCII_PORT: String(PORT) },
      stdio: 'pipe'
    })

    const ready = await waitForServer(API_URL)
    if (!ready) {
      throw new Error('Server failed to start')
    }
  })

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill()
    }
  })

  describe('State Navigation', () => {
    it('starts at DASHBOARD state', async () => {
      const state = await getState()
      expect(state.state).toBe('DASHBOARD')
    })

    it('navigates DASHBOARD -> SOURCES via label B', async () => {
      const result = await sendControl('B')
      expect(result.success).toBe(true)
      expect(result.state).toBe('SOURCES')
    })

    it('navigates SOURCES -> CONFIG via label C', async () => {
      const result = await sendControl('C')
      expect(result.success).toBe(true)
      expect(result.state).toBe('CONFIG')
    })

    it('navigates CONFIG -> HISTORY via label D', async () => {
      const result = await sendControl('D')
      expect(result.success).toBe(true)
      expect(result.state).toBe('HISTORY')
    })

    it('navigates HISTORY -> PROVIDERS via label E', async () => {
      const result = await sendControl('E')
      expect(result.success).toBe(true)
      expect(result.state).toBe('PROVIDERS')
    })

    it('navigates back to DASHBOARD via label A', async () => {
      const result = await sendControl('A')
      expect(result.success).toBe(true)
      expect(result.state).toBe('DASHBOARD')
    })
  })

  describe('Action Execution', () => {
    it('executes refresh action via label H', async () => {
      const result = await sendControl('H')
      expect(result.success).toBe(true)
      // H is refresh action
      expect(result.action).toBeDefined()
    })

    it('executes runAnalysis action via label F', async () => {
      const result = await sendControl('F')
      expect(result.success).toBe(true)
      // F is runAnalysis action
      expect(result.action).toBeDefined()
    })
  })

  describe('View Consistency', () => {
    it('returns different ASCII for different states', async () => {
      // Get DASHBOARD view
      await sendControl('A')
      const dashboardView = await getView()

      // Navigate to SOURCES
      await sendControl('B')
      const sourcesView = await getView()

      // Views should be different (state indicator changes)
      expect(dashboardView).not.toBe(sourcesView)
    })

    it('view contains state indicator', async () => {
      await sendControl('A') // Go to DASHBOARD
      const view = await getView()
      expect(view).toContain('DASHBOARD')
    })
  })

  describe('Full Navigation Cycle', () => {
    it('can visit all states in sequence', async () => {
      const states = [
        { label: 'A', expected: 'DASHBOARD' },
        { label: 'B', expected: 'SOURCES' },
        { label: 'C', expected: 'CONFIG' },
        { label: 'D', expected: 'HISTORY' },
        { label: 'E', expected: 'PROVIDERS' },
        { label: 'A', expected: 'DASHBOARD' }
      ]

      for (const { label, expected } of states) {
        const result = await sendControl(label)
        expect(result.success).toBe(true)
        expect(result.state).toBe(expected)
      }
    })
  })
})
