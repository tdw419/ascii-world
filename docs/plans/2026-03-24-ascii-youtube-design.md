# ASCII YouTube - Design Document

**Date:** 2026-03-24
**Status:** Approved

## Overview

A YouTube feed reader with a minimal web interface that displays video titles as clickable links. Users can browse their subscribed channels and play videos with an audio-only option.

## Goals

- Fetch video listings from YouTube channels via HTML scraping
- Display as a simple, minimal RSS-style feed
- Provide "Audio Only" playback via yt-dlp audio extraction
- No API keys required, no auto-refresh

## Architecture

```
Browser                        pxOS Server                    yt-dlp
───────                        ───────────                    ──────
┌─────────┐   GET /api/youtube/feed    ┌──────────┐
│  HTML   │ ─────────────────────────► │  server  │ ──► scrape YouTube
│  + JS   │                            │          │
│         │   GET /api/youtube/audio   │          │ ──► yt-dlp -g -f bestaudio
│         │ ─────────────────────────► │          │
└─────────┘                            └──────────┘
```

## Data Structures

### Channel Config (`data/channels.json`)
```json
{
  "channels": [
    {
      "id": "@channelname",
      "url": "https://youtube.com/@channelname",
      "name": "Display Name"
    }
  ]
}
```

### Video Entry (scraped, in-memory)
```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Video Title Here",
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "channel": "@channelname"
}
```

### Feed Response (API output)
```json
{
  "videos": [...],
  "fetched": "2026-03-24T10:30:00Z",
  "channelCount": 3
}
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/youtube` | Serve the HTML viewer page |
| `GET` | `/api/youtube/feed` | Scrape all channels (called on page load) |
| `GET` | `/api/youtube/audio?url=...` | Get direct audio URL via yt-dlp |
| `POST` | `/api/youtube/channels` | Add a channel to config |
| `DELETE` | `/api/youtube/channels/:id` | Remove a channel |

### Audio Endpoint Flow
```
GET /api/youtube/audio?url=https://youtube.com/watch?v=xyz
  ↓
server runs: yt-dlp -g -f bestaudio "url"
  ↓
returns: { "audioUrl": "https://..." }
```

**No caching** - feed is fetched fresh on each page load.

## Frontend UI

### Page Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ ASCII YouTube                                    [+ Add Channel] │
├─────────────────────────────────────────────────────────────────┤
│ Never Gonna Give You Up                                          │
│   ↳ Audio Only | Watch on YouTube                               │
│                                                                 │
│ Another Video Title                                              │
│   ↳ Audio Only | Watch on YouTube                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Sources: @channel1 @channel2 @channel3  [Edit]                  │
└─────────────────────────────────────────────────────────────────┘
```

### Click Behaviors
- **"Audio Only"** → Fetches audio URL, opens in native HTML5 audio player
- **"Watch on YouTube"** → Opens YouTube in new tab
- **"+ Add Channel"** → Prompts for URL, POSTs to channels endpoint

### Audio Playback
Uses native HTML5 `<audio>` element:
```html
<audio controls autoplay src="https://...audio-url..."></audio>
```

## Files to Create

| File | Purpose |
|------|---------|
| `sync/youtube-scraper.js` | Scrape video titles/URLs from YouTube channel pages |
| `sync/youtube-audio.js` | Wrap yt-dlp to extract audio URLs |
| `viewer/youtube.html` | The feed viewer page |
| `data/channels.json` | Channel subscription config (default empty) |

## Files to Modify

| File | Change |
|------|--------|
| `sync/server.js` | Add new `/api/youtube/*` routes and `/youtube` static page |

## Dependencies

- **yt-dlp** - Must be installed on the system (CLI tool, not npm package)
- No new npm packages required (uses native `fetch`)

## Scraping Approach

1. Fetch channel HTML page
2. Extract `ytInitialData` JSON blob via regex
3. Parse JSON to find video items
4. Extract video ID and title from each item

## Error Handling

| Scenario | Handling |
|----------|----------|
| Scraping fails | Show error message in feed area |
| yt-dlp not found | Show "yt-dlp not installed" error |
| Audio extraction fails | Show "Audio unavailable", fall back to YouTube link |
| No channels configured | Show "Add a channel to get started" message |

## Security Considerations

- Input validation on channel URLs (must be youtube.com domain)
- No user-provided URLs passed to shell commands without sanitization
- yt-dlp called with explicit args, not user string interpolation
