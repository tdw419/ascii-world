// sync/youtube-scraper.js
import { exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';

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
    // Match from var ytInitialData = to the closing script tag, being careful with nested braces
    const match = html.match(/var ytInitialData = (\{[\s\S]*?\});\s*<\/script>/);
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

  /**
   * Deep search for continuation tokens in YouTube data
   */
  findContinuationToken(obj) {
    if (!obj || typeof obj !== 'object') return null;
    
    // Direct check for common InnerTube continuation keys
    if (obj.continuation && typeof obj.continuation === 'string') {
      return obj.continuation;
    }
    
    if (obj.continuationToken && typeof obj.continuationToken === 'string') {
      return obj.continuationToken;
    }

    // Check specific known paths for InnerTube Browse responses
    const nextContinuation = obj.nextContinuationData?.continuation || 
                             obj.reloadContinuationData?.continuation ||
                             obj.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    
    if (nextContinuation) return nextContinuation;

    // Recursively search
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === 'object') {
        const result = this.findContinuationToken(obj[key]);
        if (result) return result;
      }
    }
    return null;
  }

  /**
   * Deep search for all video objects in YouTube data
   * Supports videoRenderer, lockupViewModel, and shortsLockupViewModel
   * @param {object} obj - Parsed ytInitialData object
   * @returns {Array<{id: string, title: string, url: string, channel: string}>}
   */
  findAllVideos(obj) {
    const results = [];
    const seenIds = new Set();

    const search = (current) => {
      if (!current || typeof current !== 'object') return;

      // Handle modern ViewModels directly if encountered
      if (current.lockupViewModel) {
        const vm = current.lockupViewModel;
        const vId = vm.contentId;
        if (vId && !seenIds.has(vId)) {
          const title = vm.metadata?.lockupMetadataViewModel?.title?.content || 'Untitled';
          const channel = vm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content || 'Unknown Channel';
          const logo = vm.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url || null;
          const views = vm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[1]?.metadataParts?.[0]?.text?.content || null;
          const published = vm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[1]?.metadataParts?.[1]?.text?.content || null;

          results.push({
            id: vId,
            title,
            url: `https://youtube.com/watch?v=${vId}`,
            channel,
            channelLogo: logo,
            views,
            published
          });
          seenIds.add(vId);
        }
      }

      if (current.shortsLockupViewModel) {
        const vm = current.shortsLockupViewModel;
        const vId = vm.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId || 
                    (vm.entityId ? vm.entityId.replace('shorts-shelf-item-', '') : null);

        if (vId && !seenIds.has(vId)) {
          let title = vm.accessibilityText || 'Untitled';
          if (title.includes(', ')) title = title.split(', ')[0];

          results.push({
            id: vId,
            title,
            url: `https://youtube.com/shorts/${vId}`,
            channel: 'YouTube Shorts',
            views: vm.accessibilityText?.match(/([\d\.]+[KMB] views)/)?.[1] || null
          });
          seenIds.add(vId);
        }
      }

      // Legacy/Aggressive check: If it has a videoId and we haven't seen it yet
      const vId = current.videoId || current.contentId;
      if (vId && !seenIds.has(vId)) {
        // Try to find a title in this object or immediate metadata
        let title = current.title?.runs?.[0]?.text ||
                    current.title?.simpleText ||
                    current.metadata?.lockupMetadataViewModel?.title?.content ||
                    current.accessibility?.accessibilityData?.label ||
                    current.accessibilityText ||
                    'Untitled';

        if (title !== 'Untitled' || current.title || current.accessibilityText) {
          let channel = current.shortBylineText?.runs?.[0]?.text ||
                        current.longBylineText?.runs?.[0]?.text ||
                        current.ownerText?.runs?.[0]?.text ||
                        'Unknown Channel';

          results.push({
            id: vId,
            title,
            url: vId.length > 15 ? `https://youtube.com/shorts/${vId}` : `https://youtube.com/watch?v=${vId}`,
            channel
          });
          seenIds.add(vId);
        }
      }

      // Recursively search all properties
      for (const key in current) {
        if (current[key] && typeof current[key] === 'object') {
          search(current[key]);
        }
      }
    };

    search(obj);
    return results;
  }

  /**
   * Parse YouTube search results HTML and extract video entries
   * @param {string} html - Raw HTML from YouTube search results
   * @returns {Array<{id: string, title: string, url: string, channel: string}>}
   */
  parseSearchHTML(html) {
    // Extract ytInitialData JSON blob
    const match = html.match(/var ytInitialData = (\{[\s\S]*?\});\s*<\/script>/);
    if (!match) {
      console.error('No ytInitialData found in HTML');
      return [];
    }

    try {
      const data = JSON.parse(match[1]);
      return this.findAllVideos(data);
    } catch (err) {
      console.error('Failed to parse search ytInitialData:', err.message);
      return [];
    }
  }

  /**
   * Fetch personalized homepage using yt-dlp and browser cookies
   * @returns {Promise<Array<{id: string, title: string, url: string, channel: string}>>}
   */
  /**
   * Helper to convert Netscape cookies to Header string
   */
  netscapeToCookieHeader(content) {
    return content.split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => {
        const parts = line.split('\t');
        if (parts.length < 7) return null;
        return `${parts[5]}=${parts[6]}`;
      }).filter(Boolean).join('; ');
  }

  /**
   * Fetch personalized homepage using yt-dlp and browser cookies
   * @returns {Promise<Array<{id: string, title: string, url: string, channel: string}>>}
   */
  async fetchPersonalizedHomepage() {
    return this.fetchFromYoutube('https://www.youtube.com/');
  }

  /**
   * Fetch user's subscription feed using cookies
   */
  async fetchSubscriptions() {
    return this.fetchFromYoutube('https://www.youtube.com/feed/subscriptions');
  }

  /**
   * Internal helper to fetch and parse any YouTube URL
   * Now uses InnerTube API for stable structured data
   */
  async fetchFromYoutube(targetUrl, continuationToken = null) {
    const cookieFile = './.youtube-cookies.txt';
    console.log(`[SCRAPER] API Fetch: ${targetUrl} ${continuationToken ? '(Continuation)' : ''}`);

    // Map common URLs to InnerTube Browse IDs
    const browseMap = {
      'https://www.youtube.com/': 'FEwhat_to_watch',
      'https://www.youtube.com/feed/subscriptions': 'FEsubscriptions',
      'https://www.youtube.com/feed/trending': 'FEtrending'
    };

    const browseId = browseMap[targetUrl.split('?')[0]];

    if (browseId && existsSync(cookieFile)) {
      try {
        const cookieContent = readFileSync(cookieFile, 'utf8');
        const cookieHeader = this.netscapeToCookieHeader(cookieContent);

        if (!this.innertubeApiKey) {
          const homeRes = await fetch('https://www.youtube.com/', { headers: { 'Cookie': cookieHeader } });
          const html = await homeRes.text();
          this.innertubeApiKey = html.match(/"innertubeApiKey":"([^"]+)"/)?.[1];
        }

        if (this.innertubeApiKey) {
          const body = {
            context: {
              client: { clientName: "WEB", clientVersion: "2.20240320.00.00" }
            }
          };

          // Use continuation token if provided, otherwise use browseId
          if (continuationToken) {
            body.continuation = continuationToken;
          } else {
            body.browseId = browseId;
          }
          
          const apiResponse = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${this.innertubeApiKey}`, {
            method: 'POST',
            headers: {
              'Cookie': cookieHeader,
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            body: JSON.stringify(body)
          });

          if (apiResponse.ok) {
            const data = await apiResponse.json();
            const videos = this.findAllVideos(data);
            const continuation = this.findContinuationToken(data);
            
            console.log(`[SCRAPER] API returned ${videos.length} videos. Token: ${continuation ? 'Yes' : 'No'}`);
            
            // If API returned videos, return them
            if (videos.length > 0) {
              return { videos, continuation };
            }
            
            console.warn('[SCRAPER] API returned 0 videos, falling back to HTML fetch...');
          }
        }
      } catch (err) {
        console.error(`[SCRAPER] InnerTube API failed:`, err.message);
      }
    }

    // Fallback to legacy scraping if API fails or returns nothing
    console.log(`[SCRAPER] Falling back to HTML scraping...`);
    const separator = targetUrl.includes('?') ? '&' : '?';
    const freshUrl = `${targetUrl}${separator}nocache=${Date.now()}`;
    
    try {
      const cookieContent = existsSync(cookieFile) ? readFileSync(cookieFile, 'utf8') : '';
      const cookieHeader = cookieContent ? this.netscapeToCookieHeader(cookieContent) : '';
      
      const response = await fetch(freshUrl, {
        headers: {
          'Cookie': cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const html = await response.text();
        const videos = this.parseSearchHTML(html);
        console.log(`[SCRAPER] HTML fallback found ${videos.length} videos`);
        if (videos.length > 0) return { videos, continuation: null };
      }
    } catch (err) {
      console.error('[SCRAPER] HTML fallback failed:', err.message);
    }

    // Last resort: yt-dlp
    console.log(`[SCRAPER] Falling back to yt-dlp...`);
    
    // ... (rest of fallback logic) ...

    // Fallback to yt-dlp
    const tryFetch = (flag, url) => {
      return new Promise((resolve) => {
        // --no-cache-dir prevents yt-dlp from reusing old page data
        const cmd = `yt-dlp ${flag} --no-cache-dir --flat-playlist --playlist-end 30 --print "%(id)s|%(title)s|%(uploader)s" "${url}"`;
        console.log(`[SCRAPER] Executing: ${cmd}`);
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.warn(`[SCRAPER] yt-dlp error: ${stderr}`);
            resolve(null);
          } else if (!stdout.trim()) {
            console.warn(`[SCRAPER] yt-dlp returned no output`);
            resolve(null);
          } else {
            console.log(`[SCRAPER] yt-dlp success`);
            resolve(stdout);
          }
        });
      });
    };

    let flag = existsSync(cookieFile) ? `--cookies ${cookieFile}` : `--cookies-from-browser chromium`;
    let stdout = await tryFetch(flag, targetUrl);

    if (!stdout && !existsSync(cookieFile)) {
      flag = `--cookies-from-browser chrome`;
      stdout = await tryFetch(flag, targetUrl);
    }

    // Fallback 3: Try Mobile YouTube (often easier to scrape)
    if (!stdout && targetUrl.includes('youtube.com')) {
      const mobileUrl = targetUrl.replace('www.youtube.com', 'm.youtube.com');
      console.log(`[SCRAPER] Trying mobile fallback: ${mobileUrl}`);
      stdout = await tryFetch(flag, mobileUrl);
    }

    if (!stdout) {
      throw new Error('No videos found. Ensure you are logged in and provide manual cookies if needed.');
    }

    const lines = stdout.trim().split('\n');
    return lines.map(line => {
      const [id, title, channel] = line.split('|');
      if (!id) return null;
      return {
        id,
        title: title || 'Untitled',
        url: `https://youtube.com/watch?v=${id}`,
        channel: channel || 'Unknown Channel'
      };
    }).filter(v => v !== null);
  }

  /**
   * Fetch a URL using the standard fetch API with cookies
   * This is more reliable for the homepage than headless Chromium
   */
  async fetchWithCookies(url) {
    const cookieFile = './.youtube-cookies.txt';
    let cookieHeader = '';
    
    if (existsSync(cookieFile)) {
      const content = readFileSync(cookieFile, 'utf8');
      cookieHeader = this.netscapeToCookieHeader(content);
    }

    console.log(`[SCRAPER] Fetching with cookies: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookieHeader,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * Fetch a URL using headless Chromium
   * This is useful for getting the homepage exactly as a browser sees it
   */
  async fetchWithChromium(url) {
    return new Promise((resolve, reject) => {
      // Use chromium-browser or chromium (snap version usually is 'chromium')
      const cmd = `chromium --headless --disable-gpu --dump-dom --no-sandbox --window-size=1920,1080 "${url}"`;
      console.log(`[SCRAPER] Executing headless fetch: ${cmd}`);
      
      exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[SCRAPER] Chromium error: ${error.message}`);
          return reject(error);
        }
        resolve(stdout);
      });
    });
  }

  /**
   * Fetch YouTube search results for discovery
   * Uses popular search terms to get varied content
   * @param {string} query - Search query (optional)
   * @returns {Promise<Array<{id: string, title: string, url: string, channel: string}>>}
   */
  async fetchHomepage(query = 'music') {
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseSearchHTML(html);
    } catch (err) {
      console.error('Failed to fetch YouTube search:', err.message);
      throw err;
    }
  }
}
