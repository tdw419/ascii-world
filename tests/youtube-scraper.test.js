// tests/youtube-scraper.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { YouTubeScraper } from '../sync/youtube-scraper.js';

describe('YouTubeScraper', () => {
  it('should extract video ID and title from HTML', async () => {
    const scraper = new YouTubeScraper();
       const html = `
      <script>var ytInitialData = {"contents":{"twoColumnBrowseResultsRenderer":{"tabs":[{"tabRenderer":{"content":{"richGridRenderer":{"contents":[{"richItemRenderer":{"content":{"videoRenderer":{"videoId":"abc123","title":{"runs":[{"text":"Test Video Title"}]}}}}}]}}}}]}}};</script>
    `;
    const videos = scraper.parseChannelHTML(html, '@testchannel');
    assert.strictEqual(videos.length, 1);
    assert.deepStrictEqual(videos[0], {
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
    assert.deepStrictEqual(videos, []);
  });

  it('should validate YouTube URLs', () => {
    const scraper = new YouTubeScraper();
    assert.strictEqual(scraper.isValidYouTubeURL('https://youtube.com/@channel'), true);
    assert.strictEqual(scraper.isValidYouTubeURL('https://www.youtube.com/@channel'), true);
    assert.strictEqual(scraper.isValidYouTubeURL('https://evil.com/@channel'), false);
  });
});
