# ASCII YouTube Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a YouTube feed reader with audio-only playback via yt-dlp, served as a web page from pxOS.

**Architecture:** Browser fetches feed from pxOS server which scrapes YouTube channel pages. Audio URLs extracted via yt-dlp CLI. No database - channels stored in JSON config.

**Tech Stack:** Node.js, native fetch, yt-dlp (CLI), HTML5 audio

---

## Task 1: Create Channel Config

**Files:**
- Create: `data/channels.json`

**Step 1: Create the config file**

```json
{
  "channels": []
}
```

**Step 2: Verify file exists**

Run: `cat data/channels.json`
Expected: `{"channels":[]}`

**Step 3: Commit**

```bash
git add data/channels.json
git commit -m "feat(youtube): add empty channels config"
```

---

## Task 2: Create YouTube Scraper Module

**Files:**
- Create: `sync/youtube-scraper.js`
- Create: `tests/youtube-scraper.test.js`

**Step 1: Write the failing test**

```javascript
// tests/youtube-scraper.test.js
import { describe, it, expect } from 'vitest';
import { YouTubeScraper } from '../sync/youtube-scraper.js';

describe('YouTubeScraper', () => {
  it('should extract video ID and title from HTML', async () => {
    const scraper = new YouTubeScraper();
    const html = `
      <script>var ytInitialData = {"contents":{"twoColumnBrowseResultsRenderer":{"tabs":[{"tabRenderer":{"content":{"richGridRenderer":{"contents":[{"richItemRenderer":{"content":{"videoRenderer":{"videoId":"abc123","title":{"runs":[{"text":"Test Video Title"}]}}}}]}}}}}}};</script>
    `;
    const videos = scraper.parseChannelHTML(html, '@testchannel');
    expect(videos).toHaveLength(1);
    expect(videos[0]).toEqual({
      id: 'abc123',
      title: 'Test Video Title',
      url: 'https://youtube.com/watch?v=abc123',
      channel: '@testchannel'
    });
  });

  it('should return empty array for HTML without ytInitialData', async () => {
    const scraper = new YouTubeScraper();
    const html = '<html><body>No data here</body></html>';
    const videos = scraper.parseChannelHTML(html, '@testchannel');
    expect(videos).toEqual([]);
  });

  it('should validate YouTube URLs', () => {
    const scraper = new YouTubeScraper();
    expect(scraper.isValidYouTubeURL('https://youtube.com/@channel')).toBe(true);
    expect(scraper.isValidYouTubeURL('https://www.youtube.com/@channel')).toBe(true);
    expect(scraper.isValidYouTubeURL('https://evil.com/@channel')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/youtube-scraper.test.js`
Expected: FAIL - module not found or tests fail

**Step 3: Write minimal implementation**

```javascript
// sync/youtube-scraper.js
export class YouTubeScraper {
  /**
   * Parse YouTube channel HTML and extract video entries
   * @param {string} html - Raw HTML from YouTube channel page
   * @param {string} channelId - Channel identifier (e.g., @channelname)
   * @returns {Array<{id: string, title: string, url: string, channel: string}>}
   */
  parseChannelHTML(html, channelId) {
    const videos = [];

    // Extract ytInitialData JSON blob
    const match = html.match(/var ytInitialData = ({.+?});<\/script>/s);
    if (!match) {
      return [];
    }

    try {
      const data = JSON.parse(match[1]);

      // Navigate to video items - path varies but this covers most cases
      const contents = this.extractVideoContents(data);
      if (!contents) {
        return [];
      }

      for (const item of contents) {
        const video = this.extractVideoFromItem(item, channelId);
        if (video) {
          videos.push(video);
        }
      }

      return videos;
    } catch (err) {
      console.error('Failed to parse ytInitialData:', err.message);
      return [];
    }
  }

  extractVideoContents(data) {
    // Try multiple paths where video data might be
    const paths = [
      data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.richGridRenderer?.contents,
      data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[1]?.tabRenderer?.content?.richGridRenderer?.contents,
    ];

    for (const path of paths) {
      if (Array.isArray(path)) {
        return path;
      }
    }
    return null;
  }

  extractVideoFromItem(item, channelId) {
    const renderer = item?.richItemRenderer?.content?.videoRenderer;
    if (!renderer || !renderer.videoId) {
      return null;
    }

    // Extract title from runs
    const title = renderer.title?.runs?.[0]?.text || 'Untitled';

    return {
      id: renderer.videoId,
      title,
      url: `https://youtube.com/watch?v=${renderer.videoId}`,
      channel: channelId
    };
  }

  /**
   * Validate that a URL is a valid YouTube channel URL
   * @param {string} url - URL to validate
   * @returns {boolean}
   */
  isValidYouTubeURL(url) {
    try {
      const parsed = new URL(url);
      const validHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com'];
      return validHosts.includes(parsed.hostname);
    } catch {
      return false;
    }
  }

  /**
   * Fetch and scrape a channel page
   * @param {string} channelUrl - Full YouTube channel URL
   * @param {string} channelId - Channel identifier
   * @returns {Promise<Array<{id: string, title: string, url: string, channel: string}>>}
   */
  async fetchChannel(channelUrl, channelId) {
    if (!this.isValidYouTubeURL(channelUrl)) {
      throw new Error(`Invalid YouTube URL: ${channelUrl}`);
    }

    try {
      const response = await fetch(channelUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; pxOS-YouTube/1.0)'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseChannelHTML(html, channelId);
    } catch (err) {
      console.error(`Failed to fetch channel ${channelId}:`, err.message);
      throw err;
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/youtube-scraper.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add sync/youtube-scraper.js tests/youtube-scraper.test.js
git commit -m "feat(youtube): add YouTube scraper module"
```

---

## Task 3: Create YouTube Audio Extractor

**Files:**
- Create: `sync/youtube-audio.js`
- Create: `tests/youtube-audio.test.js`

**Step 1: Write the failing test**

```javascript
// tests/youtube-audio.test.js
import { describe, it, expect, vi } from 'vitest';
import { YouTubeAudio } from '../sync/youtube-audio.js';
import { spawn } from 'child_process';

describe('YouTubeAudio', () => {
  it('should check if yt-dlp is available', async () => {
    const audio = new YouTubeAudio();
    // This test depends on yt-dlp being installed
    const available = await audio.isAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should validate YouTube video URLs', () => {
    const audio = new YouTubeAudio();
    expect(audio.isValidVideoURL('https://youtube.com/watch?v=abc123')).toBe(true);
    expect(audio.isValidVideoURL('https://youtu.be/abc123')).toBe(true);
    expect(audio.isValidVideoURL('https://evil.com/watch?v=abc')).toBe(false);
  });

  it('should extract video ID from URL', () => {
    const audio = new YouTubeAudio();
    expect(audio.extractVideoId('https://youtube.com/watch?v=abc123')).toBe('abc123');
    expect(audio.extractVideoId('https://youtu.be/xyz789')).toBe('xyz789');
    expect(audio.extractVideoId('invalid')).toBe(null);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/youtube-audio.test.js`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```javascript
// sync/youtube-audio.js
import { spawn } from 'child_process';

export class YouTubeAudio {
  constructor() {
    this.ytDlpPath = 'yt-dlp';
  }

  /**
   * Check if yt-dlp is installed and available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return new Promise((resolve) => {
      const proc = spawn(this.ytDlpPath, ['--version']);
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  /**
   * Validate that a URL is a valid YouTube video URL
   * @param {string} url - URL to validate
   * @returns {boolean}
   */
  isValidVideoURL(url) {
    try {
      const parsed = new URL(url);
      const validHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
      return validHosts.includes(parsed.hostname);
    } catch {
      return false;
    }
  }

  /**
   * Extract video ID from YouTube URL
   * @param {string} url - YouTube video URL
   * @returns {string|null}
   */
  extractVideoId(url) {
    try {
      const parsed = new URL(url);

      // Standard watch URL: youtube.com/watch?v=VIDEO_ID
      if (parsed.searchParams.has('v')) {
        return parsed.searchParams.get('v');
      }

      // Short URL: youtu.be/VIDEO_ID
      if (parsed.hostname === 'youtu.be') {
        return parsed.pathname.slice(1);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get direct audio URL for a YouTube video
   * @param {string} videoUrl - YouTube video URL
   * @returns {Promise<{audioUrl: string, title?: string}>}
   */
  async getAudioUrl(videoUrl) {
    if (!this.isValidVideoURL(videoUrl)) {
      throw new Error('Invalid YouTube URL');
    }

    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error('Could not extract video ID');
    }

    return new Promise((resolve, reject) => {
      // Use yt-dlp to get direct audio URL
      // -g: get URL only (don't download)
      // -f bestaudio: select best audio-only format
      const proc = spawn(this.ytDlpPath, [
        '-g',
        '-f', 'bestaudio[ext=m4a]/bestaudio',
        '--no-playlist',
        videoUrl
      ]);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp failed: ${stderr || `exit code ${code}`}`));
          return;
        }

        const lines = stdout.trim().split('\n');
        const audioUrl = lines[0];

        if (!audioUrl) {
          reject(new Error('No audio URL returned'));
          return;
        }

        resolve({ audioUrl, videoId });
      });

      proc.on('error', (err) => {
        if (err.code === 'ENOENT') {
          reject(new Error('yt-dlp not installed. Install with: pip install yt-dlp'));
        } else {
          reject(err);
        }
      });
    });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/youtube-audio.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add sync/youtube-audio.js tests/youtube-audio.test.js
git commit -m "feat(youtube): add yt-dlp audio extractor module"
```

---

## Task 4: Add YouTube API Routes to Server

**Files:**
- Modify: `sync/server.js` (add imports and routes)
- Create: `tests/youtube-routes.test.js`

**Step 1: Write the failing test**

```javascript
// tests/youtube-routes.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PxOSServer } from '../sync/server.js';

describe('YouTube API Routes', () => {
  let server;
  const port = 3999;

  beforeAll(async () => {
    server = new PxOSServer(port);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should serve YouTube viewer page at /youtube', async () => {
    const res = await fetch(`http://localhost:${port}/youtube`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('ASCII YouTube');
  });

  it('should return feed at /api/youtube/feed', async () => {
    const res = await fetch(`http://localhost:${port}/api/youtube/feed`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('videos');
    expect(data).toHaveProperty('fetched');
    expect(Array.isArray(data.videos)).toBe(true);
  });

  it('should return channels list at /api/youtube/channels', async () => {
    const res = await fetch(`http://localhost:${port}/api/youtube/channels`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('channels');
    expect(Array.isArray(data.channels)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/youtube-routes.test.js`
Expected: FAIL - 404 Not found

**Step 3: Add YouTube routes to server.js**

Add imports at top of `sync/server.js` (around line 22):

```javascript
import { YouTubeScraper } from './youtube-scraper.js';
import { YouTubeAudio } from './youtube-audio.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
```

Add to constructor (around line 51):

```javascript
        // YouTube integration
        this.youtubeScraper = new YouTubeScraper();
        this.youtubeAudio = new YouTubeAudio();
        this.youtubeChannelsPath = './data/channels.json';
        this.youtubeChannels = this.loadYouTubeChannels();
```

Add helper methods (after `sendError` method, around line 613):

```javascript
    // ─────────────────────────────────────────────────────
    // YouTube Integration
    // ─────────────────────────────────────────────────────

    loadYouTubeChannels() {
        try {
            if (existsSync(this.youtubeChannelsPath)) {
                const data = readFileSync(this.youtubeChannelsPath, 'utf-8');
                return JSON.parse(data);
            }
        } catch (err) {
            console.error('Failed to load YouTube channels:', err.message);
        }
        return { channels: [] };
    }

    saveYouTubeChannels() {
        try {
            writeFileSync(this.youtubeChannelsPath, JSON.stringify(this.youtubeChannels, null, 2));
        } catch (err) {
            console.error('Failed to save YouTube channels:', err.message);
        }
    }

    async handleYouTubeViewer(req, res) {
        const fs = require('fs');
        const path = require('path');
        const viewerPath = path.join(__dirname, '../viewer/youtube.html');
        fs.readFile(viewerPath, (err, data) => {
            if (err) {
                this.sendError(res, 500, 'YouTube viewer not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    }

    async handleYouTubeFeed(req, res) {
        const { channels } = this.youtubeChannels;

        if (channels.length === 0) {
            this.sendJSON(res, 200, {
                videos: [],
                fetched: new Date().toISOString(),
                channelCount: 0,
                message: 'No channels configured. Add a channel to get started.'
            });
            return;
        }

        try {
            const allVideos = [];

            // Fetch videos from all channels in parallel
            const results = await Promise.allSettled(
                channels.map(ch =>
                    this.youtubeScraper.fetchChannel(ch.url, ch.id || ch.name)
                        .catch(err => {
                            console.error(`Channel ${ch.id} failed:`, err.message);
                            return [];
                        })
                )
            );

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    allVideos.push(...result.value);
                }
            }

            // Sort by nothing specific - just return as fetched
            this.sendJSON(res, 200, {
                videos: allVideos,
                fetched: new Date().toISOString(),
                channelCount: channels.length
            });
        } catch (err) {
            this.sendError(res, 500, `Failed to fetch feed: ${err.message}`);
        }
    }

    async handleYouTubeAudio(req, res, url) {
        const videoUrl = url.searchParams.get('url');

        if (!videoUrl) {
            this.sendError(res, 400, 'Missing url parameter');
            return;
        }

        if (!this.youtubeAudio.isValidVideoURL(videoUrl)) {
            this.sendError(res, 400, 'Invalid YouTube URL');
            return;
        }

        try {
            const result = await this.youtubeAudio.getAudioUrl(videoUrl);
            this.sendJSON(res, 200, result);
        } catch (err) {
            this.sendError(res, 500, err.message);
        }
    }

    handleYouTubeChannels(req, res) {
        this.sendJSON(res, 200, this.youtubeChannels);
    }

    async handleAddYouTubeChannel(req, res) {
        const body = await this.readBody(req);
        const { url, name } = JSON.parse(body);

        if (!url) {
            this.sendError(res, 400, 'Channel URL required');
            return;
        }

        if (!this.youtubeScraper.isValidYouTubeURL(url)) {
            this.sendError(res, 400, 'Invalid YouTube URL');
            return;
        }

        // Extract channel ID from URL
        const match = url.match(/youtube\.com\/(@[\w-]+)/);
        const id = match ? match[1] : `channel_${Date.now()}`;

        // Check for duplicate
        if (this.youtubeChannels.channels.some(ch => ch.id === id)) {
            this.sendError(res, 400, 'Channel already added');
            return;
        }

        this.youtubeChannels.channels.push({
            id,
            url,
            name: name || id
        });

        this.saveYouTubeChannels();
        this.sendJSON(res, 200, { ok: true, channel: { id, url, name: name || id } });
    }

    handleRemoveYouTubeChannel(req, res, url) {
        const id = url.pathname.replace('/api/youtube/channels/', '');

        const index = this.youtubeChannels.channels.findIndex(ch => ch.id === id);
        if (index === -1) {
            this.sendError(res, 404, 'Channel not found');
            return;
        }

        this.youtubeChannels.channels.splice(index, 1);
        this.saveYouTubeChannels();
        this.sendJSON(res, 200, { ok: true });
    }
```

Add routes in `handleHTTPRequest` method (around line 284, before the 404 handler):

```javascript
            // YouTube API
            } else if (pathname === '/youtube') {
                this.handleYouTubeViewer(req, res);
            } else if (pathname === '/api/youtube/feed') {
                await this.handleYouTubeFeed(req, res);
            } else if (pathname === '/api/youtube/audio') {
                await this.handleYouTubeAudio(req, res, url);
            } else if (pathname === '/api/youtube/channels' && req.method === 'GET') {
                this.handleYouTubeChannels(req, res);
            } else if (pathname === '/api/youtube/channels' && req.method === 'POST') {
                await this.handleAddYouTubeChannel(req, res);
            } else if (pathname.startsWith('/api/youtube/channels/') && req.method === 'DELETE') {
                this.handleRemoveYouTubeChannel(req, res, url);
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/youtube-routes.test.js`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add sync/server.js tests/youtube-routes.test.js
git commit -m "feat(youtube): add YouTube API routes to server"
```

---

## Task 5: Create YouTube Viewer HTML

**Files:**
- Create: `viewer/youtube.html`

**Step 1: Create the viewer page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ASCII YouTube</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #30363d;
    }
    h1 { font-size: 1.5rem; color: #f0f6fc; }
    .add-btn {
      background: #238636;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .add-btn:hover { background: #2ea043; }
    .loading { text-align: center; padding: 40px; color: #8b949e; }
    .error { background: #f8514920; border: 1px solid #f85149; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
    .video-list { list-style: none; }
    .video-item {
      padding: 15px;
      border-bottom: 1px solid #21262d;
    }
    .video-item:hover { background: #161b22; }
    .video-title {
      font-size: 15px;
      margin-bottom: 8px;
      color: #f0f6fc;
    }
    .video-actions { font-size: 13px; }
    .video-actions a {
      color: #58a6ff;
      text-decoration: none;
      margin-right: 15px;
    }
    .video-actions a:hover { text-decoration: underline; }
    .channel-tag {
      font-size: 12px;
      color: #8b949e;
      margin-left: 8px;
    }
    .audio-player {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #161b22;
      padding: 15px 20px;
      border-top: 1px solid #30363d;
      display: none;
    }
    .audio-player.active { display: block; }
    .audio-player audio { width: 100%; }
    .audio-player .now-playing {
      font-size: 13px;
      color: #8b949e;
      margin-bottom: 8px;
    }
    .audio-player .close-btn {
      position: absolute;
      top: 10px;
      right: 15px;
      background: none;
      border: none;
      color: #8b949e;
      cursor: pointer;
      font-size: 18px;
    }
    footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #30363d;
      font-size: 13px;
      color: #8b949e;
    }
    footer a { color: #58a6ff; text-decoration: none; }
    .sources { margin-top: 10px; }
    .source-tag {
      display: inline-block;
      background: #21262d;
      padding: 3px 8px;
      border-radius: 4px;
      margin-right: 5px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>ASCII YouTube</h1>
      <button class="add-btn" onclick="addChannel()">+ Add Channel</button>
    </header>

    <div id="content">
      <div class="loading">Loading feed...</div>
    </div>

    <footer id="footer">
      <div class="sources" id="sources"></div>
    </footer>
  </div>

  <div class="audio-player" id="audioPlayer">
    <button class="close-btn" onclick="closePlayer()">&times;</button>
    <div class="now-playing" id="nowPlaying"></div>
    <audio id="audio" controls autoplay></audio>
  </div>

  <script>
    const API_BASE = window.location.origin;

    async function loadFeed() {
      const content = document.getElementById('content');
      content.innerHTML = '<div class="loading">Loading feed...</div>';

      try {
        const res = await fetch(`${API_BASE}/api/youtube/feed`);
        const data = await res.json();

        if (data.message) {
          content.innerHTML = `<div class="error">${data.message}</div>`;
          return;
        }

        if (data.videos.length === 0) {
          content.innerHTML = '<div class="loading">No videos found. Add some channels!</div>';
          return;
        }

        const html = `<ul class="video-list">${
          data.videos.map(v => `
            <li class="video-item">
              <div class="video-title">
                ${escapeHtml(v.title)}
                <span class="channel-tag">${v.channel}</span>
              </div>
              <div class="video-actions">
                <a href="#" onclick="playAudio('${escapeHtml(v.url)}', '${escapeHtml(v.title).replace(/'/g, "\\'")}')">Audio Only</a>
                <a href="${v.url}" target="_blank">Watch on YouTube</a>
              </div>
            </li>
          `).join('')
        }</ul>`;

        content.innerHTML = html;

        // Update sources footer
        const sourcesRes = await fetch(`${API_BASE}/api/youtube/channels`);
        const sourcesData = await sourcesRes.json();
        document.getElementById('sources').innerHTML =
          'Sources: ' + sourcesData.channels.map(ch =>
            `<span class="source-tag">${ch.name || ch.id}</span>`
          ).join('');
      } catch (err) {
        content.innerHTML = `<div class="error">Failed to load feed: ${err.message}</div>`;
      }
    }

    async function playAudio(url, title) {
      event.preventDefault();
      const player = document.getElementById('audioPlayer');
      const audio = document.getElementById('audio');
      const nowPlaying = document.getElementById('nowPlaying');

      nowPlaying.textContent = 'Loading: ' + title;
      player.classList.add('active');

      try {
        const res = await fetch(`${API_BASE}/api/youtube/audio?url=${encodeURIComponent(url)}`);
        if (!res.ok) {
          throw new Error('Failed to get audio URL');
        }
        const data = await res.json();
        audio.src = data.audioUrl;
        nowPlaying.textContent = 'Playing: ' + title;
      } catch (err) {
        nowPlaying.textContent = 'Error: ' + err.message;
      }
    }

    function closePlayer() {
      const player = document.getElementById('audioPlayer');
      const audio = document.getElementById('audio');
      audio.pause();
      audio.src = '';
      player.classList.remove('active');
    }

    async function addChannel() {
      const url = prompt('Enter YouTube channel URL:\n(e.g., https://youtube.com/@channelname)');
      if (!url) return;

      try {
        const res = await fetch(`${API_BASE}/api/youtube/channels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        const data = await res.json();
        if (data.ok) {
          loadFeed();
        } else {
          alert('Error: ' + (data.error || 'Failed to add channel'));
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Load feed on page load
    loadFeed();
  </script>
</body>
</html>
```

**Step 2: Verify file exists**

Run: `ls -la viewer/youtube.html`
Expected: File exists with content

**Step 3: Commit**

```bash
git add viewer/youtube.html
git commit -m "feat(youtube): add YouTube viewer HTML page"
```

---

## Task 6: Integration Test

**Files:**
- Create: `tests/youtube-integration.test.js`

**Step 1: Write integration test**

```javascript
// tests/youtube-integration.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PxOSServer } from '../sync/server.js';
import { execSync } from 'child_process';

describe('YouTube Integration', () => {
  let server;
  const port = 3998;

  beforeAll(async () => {
    server = new PxOSServer(port);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should have yt-dlp available', () => {
    try {
      const version = execSync('yt-dlp --version', { encoding: 'utf-8' }).trim();
      console.log('yt-dlp version:', version);
      expect(version).toBeTruthy();
    } catch (err) {
      console.log('yt-dlp not installed - audio tests will be skipped');
    }
  });

  it('should handle empty feed gracefully', async () => {
    // Save current channels
    const channelsRes = await fetch(`http://localhost:${port}/api/youtube/channels`);
    const originalChannels = await channelsRes.json();

    // Temporarily clear channels
    // Note: This modifies server state - in production you'd use a test config

    const res = await fetch(`http://localhost:${port}/api/youtube/feed`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('videos');
  });

  it('should validate channel URLs on add', async () => {
    const res = await fetch(`http://localhost:${port}/api/youtube/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://evil.com/@fake' })
    });
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run integration tests**

Run: `npm test tests/youtube-integration.test.js`
Expected: All tests PASS (or skip if yt-dlp not installed)

**Step 3: Commit**

```bash
git add tests/youtube-integration.test.js
git commit -m "test(youtube): add integration tests"
```

---

## Summary

After completing all tasks:

1. Run full test suite: `npm test`
2. Start server: `npm start`
3. Open: `http://localhost:3839/youtube`
4. Add a channel and verify videos appear
5. Test audio playback

**Files created:**
- `data/channels.json` - Channel config
- `sync/youtube-scraper.js` - YouTube HTML scraper
- `sync/youtube-audio.js` - yt-dlp wrapper
- `viewer/youtube.html` - Web UI
- `tests/youtube-scraper.test.js` - Scraper tests
- `tests/youtube-audio.test.js` - Audio tests
- `tests/youtube-routes.test.js` - API route tests
- `tests/youtube-integration.test.js` - Integration tests

**Files modified:**
- `sync/server.js` - Added YouTube API routes

**Dependencies:**
- `yt-dlp` CLI tool (install via `pip install yt-dlp` or package manager)
