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
   * Parse YouTube homepage HTML and extract video entries
   * @param {string} html - Raw HTML from YouTube homepage
   * @returns {Array<{id: string, title: string, url: string, channel: string}>}
   */
  parseHomepageHTML(html) {
    const videos = [];

    // Extract ytInitialData JSON blob
    const match = html.match(/var ytInitialData = (\{[\s\S]*?\});\s*<\/script>/);
    if (!match) {
      return [];
    }

    try {
      const data = JSON.parse(match[1]);

      // Navigate to homepage video items
      const contents = this.extractHomepageVideoContents(data);
      if (!contents) {
        return [];
      }

      for (const item of contents) {
        const video = this.extractHomepageVideoFromItem(item);
        if (video) {
          videos.push(video);
        }
      }

      return videos;
    } catch (err) {
      console.error('Failed to parse homepage ytInitialData:', err.message);
      return [];
    }
  }

  extractHomepageVideoContents(data) {
    // Homepage uses different structure than channel pages
    const paths = [
      // Main homepage rich grid
      data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.richGridRenderer?.contents,
      // Alternative homepage structure
      data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.richGridRenderer?.contents,
    ];

    for (const path of paths) {
      if (Array.isArray(path)) {
        return path;
      }
    }
    return null;
  }

  extractHomepageVideoFromItem(item) {
    // Homepage can have different renderer types
    const renderer = item?.richItemRenderer?.content?.videoRenderer ||
                     item?.richItemRenderer?.content?.gridVideoRenderer;

    if (!renderer || !renderer.videoId) {
      return null;
    }

    // Extract title
    const title = renderer.title?.runs?.[0]?.text ||
                  renderer.title?.simpleText ||
                  'Untitled';

    // Extract channel name
    const channelName = renderer.shortBylineText?.runs?.[0]?.text ||
                        renderer.longBylineText?.runs?.[0]?.text ||
                        'Unknown Channel';

    return {
      id: renderer.videoId,
      title,
      url: `https://youtube.com/watch?v=${renderer.videoId}`,
      channel: channelName
    };
  }

  /**
   * Fetch and scrape YouTube homepage for discover/trending videos
   * @returns {Promise<Array<{id: string, title: string, url: string, channel: string}>>}
   */
  async fetchHomepage() {
    try {
      const response = await fetch('https://www.youtube.com/', {
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
      return this.parseHomepageHTML(html);
    } catch (err) {
      console.error('Failed to fetch YouTube homepage:', err.message);
      throw err;
    }
  }
}
