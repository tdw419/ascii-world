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
   * @returns {Promise<{audioUrl: string, videoId: string}>}
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
