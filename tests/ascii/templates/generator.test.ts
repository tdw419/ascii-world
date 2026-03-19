import { describe, test, expect } from 'bun:test'
import { AsciiGenerator } from '../../../src/ascii/templates/generator'

describe('AsciiGenerator', () => {
  test('renders template with variables', () => {
    const generator = new AsciiGenerator()
    const result = generator.render('DASHBOARD', { appVersion: '2.0.0' })
    expect(result).toContain('v2.0.0')
  })

  test('replaces {{variable}} syntax', () => {
    const generator = new AsciiGenerator()
    const result = generator.render('DASHBOARD', { cpu_percent: 45 })
    expect(result).toContain('45')
  })

  test('handles missing variables gracefully', () => {
    const generator = new AsciiGenerator()
    const result = generator.render('DASHBOARD', {})
    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
  })
})
