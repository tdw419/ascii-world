import { readFileSync } from 'fs'
import { join } from 'path'

export interface ViewData {
  state: string
  timestamp?: string
  appVersion?: string
  status?: string
  [key: string]: any
}

export class AsciiGenerator {
  private templates: Map<string, string> = new Map()

  constructor() {
    this.loadTemplates()
  }

  private loadTemplates(): void {
    const templatesDir = join(import.meta.dir)
    const { readdirSync, statSync } = require('fs')

    try {
      const files = readdirSync(templatesDir)
      for (const file of files) {
        if (file.endsWith('.ascii')) {
          const name = file.replace('.ascii', '').toUpperCase()
          const path = join(templatesDir, file)
          this.templates.set(name, readFileSync(path, 'utf8'))
        }
      }
    } catch (error) {
      console.error(`Failed to load templates from ${templatesDir}:`, error)
    }
  }

  render(state: string, data: ViewData = {}): string {
    let template = this.templates.get(state)

    if (!template) {
      return `Error: No template found for state ${state}`
    }

    // Set defaults
    data = {
      timestamp: new Date().toISOString(),
      appVersion: '1.0.0',
      status: 'READY',
      ...data
    }

    // Replace {{variable}} with values
    template = template.replace(/{{(\w+)}}/g, (match, key) => {
      return String(data[key] ?? '')
    })

    return template
  }
}
