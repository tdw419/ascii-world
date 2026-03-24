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
}
