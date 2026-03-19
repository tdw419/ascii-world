#!/usr/bin/env bun
import { startApiServer } from './api/server'
import { asciiStateStore } from './state/store'

const PORT = parseInt(process.env.ASCII_PORT || '3421')

async function main() {
  console.log('Starting ASCII World...')

  await startApiServer({ port: PORT })

  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║            ASCII World - ASCII-First Interface            ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  API:     http://localhost:${PORT}                          ║
  ║  View:    curl http://localhost:${PORT}/view               ║
  ║  Control: curl -X POST http://localhost:${PORT}/control   ║
  ║           -d '{"label":"B"}'                              ║
  ║  State:   curl http://localhost:${PORT}/state             ║
  ╚═══════════════════════════════════════════════════════════╝
  `)
}

main().catch(console.error)
