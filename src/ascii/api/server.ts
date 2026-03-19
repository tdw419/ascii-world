import { serve, Server } from 'bun'
import { asciiStateStore } from '../state/store'
import { AsciiGenerator } from '../templates/generator'

let server: Server | null = null
let generator: AsciiGenerator | null = null

export interface ApiServerOptions {
  port?: number
}

export async function startApiServer(options: ApiServerOptions = {}): Promise<void> {
  const port = options.port || 3421
  generator = new AsciiGenerator()

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  server = serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)
      const path = url.pathname

      if (req.method === 'OPTIONS') {
        return new Response(null, { headers })
      }

      try {
        if (path === '/health') {
          return Response.json({ status: 'healthy' }, { headers })
        }

        if (path === '/view' && req.method === 'GET') {
          const data = asciiStateStore.getData()
          const ascii = generator!.render(data.state as string, data as any)
          return new Response(ascii, {
            headers: { ...headers, 'Content-Type': 'text/plain' }
          })
        }

        if (path === '/control' && req.method === 'POST') {
          const body = await req.json() as { label?: string }
          const label = body.label

          if (!label) {
            return Response.json({ error: 'Missing label' }, { status: 400, headers })
          }

          const transitioned = asciiStateStore.transition(label)
          const action = asciiStateStore.getAction(label)

          return Response.json({
            success: transitioned || !!action,
            state: asciiStateStore.getState(),
            action
          }, { headers })
        }

        if (path === '/state' && req.method === 'GET') {
          return Response.json(asciiStateStore.getData(), { headers })
        }

        if (path === '/bindings' && req.method === 'GET') {
          return Response.json(asciiStateStore.getBindings(), { headers })
        }

        return Response.json({ error: `Not found: ${path}` }, { status: 404, headers })

      } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500, headers })
      }
    }
  })

  console.log(`ASCII API Server started at http://localhost:${port}`)
}

export function stopApiServer(): void {
  if (server) {
    server.stop()
    server = null
  }
}
