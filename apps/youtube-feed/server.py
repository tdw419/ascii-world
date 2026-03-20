#!/usr/bin/env python3
"""
YouTube RSS Feed Generator
Scrapes YouTube trending/search and generates an RSS-like feed.
Port: 3495
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import json
import re
from datetime import datetime
from html import unescape

PORT = 3495

def fetch_trending_yt_dlp():
    """Fetch trending videos using yt-dlp (more reliable)."""
    try:
        result = subprocess.run(
            ["yt-dlp", "--flat-playlist", "--dump-json",
             "https://www.youtube.com/feed/trending"],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0:
            videos = []
            for line in result.stdout.strip().split('\n'):
                if line:
                    try:
                        data = json.loads(line)
                        videos.append({
                            'id': data.get('id', ''),
                            'title': data.get('title', 'Unknown')[:80],
                            'views': '',
                            'duration': '',
                            'thumbnail': f"https://i.ytimg.com/vi/{data.get('id', '')}/hqdefault.jpg"
                        })
                    except json.JSONDecodeError:
                        continue
            return videos[:20]
    except Exception as e:
        print(f"yt-dlp trending error: {e}")
    return []

def fetch_search_yt_dlp(query):
    """Search YouTube using yt-dlp."""
    try:
        result = subprocess.run(
            ["yt-dlp", "--flat-playlist", "--dump-json",
             f"ytsearch20:{query}"],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0:
            videos = []
            for line in result.stdout.strip().split('\n'):
                if line:
                    try:
                        data = json.loads(line)
                        videos.append({
                            'id': data.get('id', ''),
                            'title': data.get('title', 'Unknown')[:80],
                            'views': '',
                            'duration': '',
                            'thumbnail': f"https://i.ytimg.com/vi/{data.get('id', '')}/hqdefault.jpg"
                        })
                    except json.JSONDecodeError:
                        continue
            return videos[:20]
    except Exception as e:
        print(f"yt-dlp search error: {e}")
    return []

def fetch_youtube_page(url="https://www.youtube.com/feed/trending"):
    """Fetch YouTube page HTML using curl (fallback)."""
    try:
        result = subprocess.run(
            ["curl", "-s", "-L", "-H", "User-Agent: Mozilla/5.0", url],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            return result.stdout
    except Exception as e:
        print(f"Error fetching YouTube: {e}")
    return None

def extract_videos(html):
    """Extract video data from YouTube HTML."""
    videos = []

    if not html:
        return videos

    # Method 1: Extract from ytInitialData (most reliable)
    data_match = re.search(r'var ytInitialData = ({.*?});', html)
    if data_match:
        try:
            data = json.loads(data_match.group(1))
            # Navigate the nested structure to find videos
            contents = data.get('contents', {})
            # Try different paths where videos might be
            paths = [
                ['twoColumnBrowseResultsRenderer', 'tabs', 0, 'tabRenderer', 'content', 'sectionListRenderer', 'contents', 0, 'itemSectionRenderer', 'contents', 0, 'shelfRenderer', 'content', 'horizontalListRenderer', 'items'],
                ['twoColumnBrowseResultsRenderer', 'tabs', 0, 'tabRenderer', 'content', 'richGridRenderer', 'contents'],
            ]

            for path in paths:
                try:
                    current = contents
                    for key in path:
                        if isinstance(key, int):
                            current = current[key]
                        else:
                            current = current.get(key, {})

                    for item in current:
                        video = None
                        if 'gridVideoRenderer' in item:
                            v = item['gridVideoRenderer']
                            video = {
                                'id': v.get('videoId', ''),
                                'title': v.get('title', {}).get('runs', [{}])[0].get('text', ''),
                                'views': v.get('viewCountText', {}).get('simpleText', ''),
                                'duration': v.get('thumbnailOverlays', [{}])[0].get('thumbnailOverlayTimeStatusRenderer', {}).get('text', {}).get('simpleText', ''),
                                'thumbnail': f"https://i.ytimg.com/vi/{v.get('videoId', '')}/hqdefault.jpg"
                            }
                        elif 'videoRenderer' in item:
                            v = item['videoRenderer']
                            video = {
                                'id': v.get('videoId', ''),
                                'title': v.get('title', {}).get('runs', [{}])[0].get('text', ''),
                                'views': v.get('viewCountText', {}).get('simpleText', ''),
                                'duration': v.get('lengthText', {}).get('simpleText', ''),
                                'thumbnail': f"https://i.ytimg.com/vi/{v.get('videoId', '')}/hqdefault.jpg"
                            }
                        elif 'shelfRenderer' in item:
                            continue

                        if video and video['id']:
                            videos.append(video)
                except (KeyError, IndexError, TypeError):
                    continue

        except json.JSONDecodeError:
            pass

    # Method 2: Regex fallback for video IDs and titles
    if len(videos) < 5:
        # Find all video IDs
        video_ids = set(re.findall(r'videoId":"([a-zA-Z0-9_-]{11})"', html))
        # Find titles (less reliable)
        title_matches = re.findall(r'"title"\s*:\s*\{"runs"\s*:\s*\[\{"text"\s*:\s*"([^"]+)"', html)

        for i, vid in enumerate(list(video_ids)[:20]):
            title = title_matches[i] if i < len(title_matches) else f"Video {i+1}"
            videos.append({
                'id': vid,
                'title': unescape(title)[:80],
                'views': '',
                'duration': '',
                'thumbnail': f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
            })

    return videos[:20]  # Limit to 20 videos

def generate_rss_xml(videos, title="YouTube Feed"):
    """Generate RSS XML from video list."""
    rss = f'''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>{title}</title>
    <link>https://www.youtube.com</link>
    <description>Generated YouTube Feed</description>
    <lastBuildDate>{datetime.now().strftime('%a, %d %b %Y %H:%M:%S GMT')}</lastBuildDate>

'''
    for v in videos:
        rss += f'''    <item>
      <title>{v['title']}</title>
      <link>https://www.youtube.com/watch?v={v['id']}</link>
      <guid isPermaLink="true">https://www.youtube.com/watch?v={v['id']}</guid>
      <description>Views: {v.get('views', 'N/A')} | Duration: {v.get('duration', 'N/A')}</description>
      <enclosure url="{v['thumbnail']}" type="image/jpeg"/>
    </item>

'''
    rss += '''  </channel>
</rss>'''
    return rss

def generate_ascii_feed(videos, title="YouTube Feed"):
    """Generate ASCII view of the feed."""
    lines = [
        "╔══════════════════════════════════════════════════════════════════════════════╗",
        f"║  YOUTUBE FEED: {title[:60]:<60} ║",
        "╠══════════════════════════════════════════════════════════════════════════════╣",
        "║  [R] Refresh   [S] Search   [1-9] Select Video   [H] Home (Trending)          ║",
        "╠══════════════════════════════════════════════════════════════════════════════╣",
        "║                                                                              ║",
    ]

    for i, v in enumerate(videos[:15], 1):
        label = str(i) if i < 10 else chr(55 + i)  # 1-9, then A-F
        title_short = v['title'][:45] + "..." if len(v['title']) > 45 else v['title']
        duration = v.get('duration', '--:--')[:8].ljust(8)
        lines.append(f"║  [{label}] {title_short:<48} {duration} ║")

    lines.extend([
        "║                                                                              ║",
        "╠══════════════════════════════════════════════════════════════════════════════╣",
        f"║  Videos: {len(videos):<5} | Updated: {datetime.now().strftime('%H:%M:%S'):<8} | Source: YouTube Trending      ║",
        "╚══════════════════════════════════════════════════════════════════════════════╝",
    ])

    return "\n".join(lines)

def generate_json_feed(videos):
    """Generate JSON feed format."""
    return {
        "version": "https://jsonfeed.org/version/1.1",
        "title": "YouTube Feed",
        "home_page_url": "https://www.youtube.com",
        "items": [
            {
                "id": v['id'],
                "url": f"https://www.youtube.com/watch?v={v['id']}",
                "title": v['title'],
                "content_html": f"<p>Views: {v.get('views', 'N/A')} | Duration: {v.get('duration', 'N/A')}</p>",
                "image": v['thumbnail']
            }
            for v in videos
        ]
    }


# Global state
state = {
    "videos": [],
    "last_fetch": None,
    "source": "trending",
    "search_query": ""
}

class YouTubeFeedHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[YouTube-Feed:3495] {args[0]}")

    def do_GET(self):
        global state

        path = self.path.split('?')[0]
        query = self.path.split('?')[1] if '?' in self.path else ''

        # Parse query params
        params = {}
        if query:
            for pair in query.split('&'):
                if '=' in pair:
                    k, v = pair.split('=', 1)
                    params[k] = v

        if path == '/' or path == '/view' or path == '/ascii':
            # Refresh if stale or forced
            if not state['videos'] or params.get('refresh') or not state['last_fetch']:
                # Try yt-dlp first (more reliable)
                state['videos'] = fetch_trending_yt_dlp()
                if not state['videos']:
                    # Fallback to HTML scraping
                    html = fetch_youtube_page()
                    if html:
                        state['videos'] = extract_videos(html)
                state['last_fetch'] = datetime.now().isoformat()
                state['source'] = "trending"

            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(generate_ascii_feed(state['videos'], state['source']).encode())

        elif path == '/rss' or path == '/feed.xml':
            if not state['videos']:
                html = fetch_youtube_page()
                if html:
                    state['videos'] = extract_videos(html)
                    state['last_fetch'] = datetime.now().isoformat()

            self.send_response(200)
            self.send_header('Content-Type', 'application/rss+xml; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(generate_rss_xml(state['videos']).encode())

        elif path == '/json' or path == '/feed.json':
            if not state['videos']:
                html = fetch_youtube_page()
                if html:
                    state['videos'] = extract_videos(html)
                    state['last_fetch'] = datetime.now().isoformat()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(generate_json_feed(state['videos']), indent=2).encode())

        elif path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "healthy",
                "port": PORT,
                "videos_cached": len(state['videos']),
                "last_fetch": state['last_fetch']
            }).encode())

        elif path == '/search':
            query = params.get('q', '')
            if query:
                search_url = f"https://www.youtube.com/results?search_query={query}"
                html = fetch_youtube_page(search_url)
                if html:
                    state['videos'] = extract_videos(html)
                    state['last_fetch'] = datetime.now().isoformat()
                    state['source'] = f"search: {query}"
                    state['search_query'] = query

            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(generate_ascii_feed(state['videos'], state['source']).encode())

        elif path == '/videos':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(state['videos'], indent=2).encode())

        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        global state

        if self.path == '/control':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                label = data.get('label', '').upper()
            except:
                label = ''

            action = "unknown"

            if label == 'R':
                # Refresh
                html = fetch_youtube_page()
                if html:
                    state['videos'] = extract_videos(html)
                    state['last_fetch'] = datetime.now().isoformat()
                    state['source'] = "trending"
                action = "refresh"

            elif label == 'H':
                # Home/Trending
                html = fetch_youtube_page()
                if html:
                    state['videos'] = extract_videos(html)
                    state['last_fetch'] = datetime.now().isoformat()
                    state['source'] = "trending"
                action = "goto_trending"

            elif label == 'S':
                action = "search_mode"

            elif label in '123456789ABCDEFG':
                # Select video
                index = '123456789ABCDEFG'.index(label)
                if index < len(state['videos']):
                    selected = state['videos'][index]
                    action = f"select_{selected['id']}"

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "action": action,
                "video_count": len(state['videos'])
            }).encode())

        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


if __name__ == '__main__':
    print(f"Starting YouTube Feed Generator on port {PORT}...")
    print(f"  ASCII View: http://localhost:{PORT}/")
    print(f"  RSS Feed:  http://localhost:{PORT}/rss")
    print(f"  JSON Feed: http://localhost:{PORT}/json")
    print(f"  Search:    http://localhost:{PORT}/search?q=query")
    server = HTTPServer(('0.0.0.0', PORT), YouTubeFeedHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
