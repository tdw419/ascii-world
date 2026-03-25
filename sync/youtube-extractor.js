// sync/youtube-extractor.js
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';

export class YouTubeExtractor {
  constructor() {
    this.ytDlpPath = 'yt-dlp';
    this.cookieFile = './.youtube-cookies.txt';
  }

  /**
   * Check if yt-dlp is installed and available
   */
  async isAvailable() {
    return new Promise((resolve) => {
      const proc = spawn(this.ytDlpPath, ['--version']);
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  isValidVideoURL(url) {
    try {
      const parsed = new URL(url);
      const validHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
      return validHosts.includes(parsed.hostname);
    } catch {
      return false;
    }
  }

  extractVideoId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.searchParams.has('v')) return parsed.searchParams.get('v');
      if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get direct stream URL (audio or video)
   */
  async getStreamUrl(videoUrl, format = 'bestaudio') {
    if (!this.isValidVideoURL(videoUrl)) {
      throw new Error('Invalid YouTube URL');
    }

    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error('Could not extract video ID');
    }

    return new Promise((resolve, reject) => {
      const args = ['-g', '-f', format, '--no-playlist', videoUrl];
      
      // Use cookies if available
      if (existsSync(this.cookieFile)) {
        args.push('--cookies', this.cookieFile);
      }

      const proc = spawn(this.ytDlpPath, args);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp failed: ${stderr || `exit code ${code}`}`));
          return;
        }

        const url = stdout.trim().split('\n')[0];
        if (!url) {
          reject(new Error('No URL returned'));
          return;
        }

        resolve({ url, videoId });
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

  async getAudioUrl(videoUrl) {
    return this.getStreamUrl(videoUrl, 'bestaudio[ext=m4a]/bestaudio');
  }

  async getVideoUrl(videoUrl) {
    // We prefer MP4 for widest browser compatibility without needing specialized players
    return this.getStreamUrl(videoUrl, 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
  }
}
