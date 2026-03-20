import { serve, Server } from 'bun'
import { asciiStateStore } from '../state/store'
import { AsciiGenerator } from '../templates/generator'
import { $ } from 'bun'

let server: Server | null = null
let generator: AsciiGenerator | null = null
let youtubeProcess: any = null

export interface ApiServerOptions {
  port?: number
}

// YouTube player state
let youtubeState = {
  videos: [] as { title: string; id: string }[],
  nowPlaying: '',
  status: 'READY',
  volume: 60,
  volumeBar: '██████░░░░'
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
    hostname: '0.0.0.0',
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

          // Add YouTube state to template data
          const templateData = {
            ...data,
            video1_title: youtubeState.videos[0]?.title || '',
            video1_id: youtubeState.videos[0]?.id || '',
            video2_title: youtubeState.videos[1]?.title || '',
            video2_id: youtubeState.videos[1]?.id || '',
            video3_title: youtubeState.videos[2]?.title || '',
            video3_id: youtubeState.videos[2]?.id || '',
            now_playing: youtubeState.nowPlaying,
            status: youtubeState.status,
            volume: youtubeState.volume,
            volume_bar: youtubeState.volumeBar
          }

          const ascii = generator!.render(data.state as string, templateData as any)
          return Response.json({
            state: data.state,
            view: ascii,
            timestamp: data.timestamp
          }, { headers })
        }

        if (path === '/control' && req.method === 'POST') {
          const body = await req.json() as { label?: string }
          const label = body.label

          if (!label) {
            return Response.json({ error: 'Missing label' }, { status: 400, headers })
          }

          const transitioned = asciiStateStore.transition(label)
          const action = asciiStateStore.getAction(label)

          // Handle YouTube actions
          if (asciiStateStore.getState() === 'SAFE_YOUTUBE') {
            if (['1', '2', '3'].includes(label)) {
              const idx = parseInt(label) - 1
              if (youtubeState.videos[idx]) {
                youtubeState.nowPlaying = youtubeState.videos[idx].title
                youtubeState.status = 'AUDIO ONLY'
                // Play audio via Python backend
                try {
                  youtubeProcess = Bun.spawn([
                    'python3',
                    'apps/safe_browsing/src/youtube_backend.py',
                    'play',
                    youtubeState.videos[idx].id
                  ])
                } catch (e) {
                  console.error('Failed to start playback:', e)
                }
              }
            } else if (label === 'S') {
              youtubeState.nowPlaying = ''
              youtubeState.status = 'READY'
              if (youtubeProcess) {
                youtubeProcess.kill()
                youtubeProcess = null
              }
            } else if (label === 'M') {
              youtubeState.volume = youtubeState.volume === 0 ? 60 : 0
              youtubeState.volumeBar = '█'.repeat(youtubeState.volume / 10) + '░'.repeat(10 - youtubeState.volume / 10)
            }
          }

          return Response.json({
            success: transitioned || !!action,
            state: asciiStateStore.getState(),
            action,
            youtube: youtubeState
          }, { headers })
        }

        // YouTube-specific endpoints
        if (path === '/youtube/videos' && req.method === 'POST') {
          const body = await req.json() as { urls?: string[] }
          if (!body.urls || !Array.isArray(body.urls)) {
            return Response.json({ error: 'Missing urls array' }, { status: 400, headers })
          }

          // Fetch video info via Python backend
          try {
            const result = Bun.spawn([
              'python3',
              'apps/safe_browsing/src/youtube_backend.py',
              'fetch',
              JSON.stringify(body.urls)
            ], { stdout: 'pipe' })
            const text = await new Response(result.stdout).text()
            youtubeState.videos = JSON.parse(text)
            asciiStateStore.setState('SAFE_YOUTUBE')
          } catch (e) {
            return Response.json({ error: 'Failed to fetch videos' }, { status: 500, headers })
          }

          return Response.json({ success: true, videos: youtubeState.videos }, { headers })
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
