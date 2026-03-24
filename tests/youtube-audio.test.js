// tests/youtube-audio.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { YouTubeAudio } from '../sync/youtube-audio.js';

describe('YouTubeAudio', () => {
  it('should check if yt-dlp is available', async () => {
    const audio = new YouTubeAudio();
    // This test depends on yt-dlp being installed
    const available = await audio.isAvailable();
    assert.strictEqual(typeof available, 'boolean');
  });

  it('should validate YouTube video URLs', () => {
    const audio = new YouTubeAudio();
    assert.strictEqual(audio.isValidVideoURL('https://youtube.com/watch?v=abc123'), true);
    assert.strictEqual(audio.isValidVideoURL('https://youtu.be/abc123'), true);
    assert.strictEqual(audio.isValidVideoURL('https://evil.com/watch?v=abc'), false);
  });

  it('should extract video ID from URL', () => {
    const audio = new YouTubeAudio();
    assert.strictEqual(audio.extractVideoId('https://youtube.com/watch?v=abc123'), 'abc123');
    assert.strictEqual(audio.extractVideoId('https://youtu.be/xyz789'), 'xyz789');
    assert.strictEqual(audio.extractVideoId('invalid'), null);
  });
});
