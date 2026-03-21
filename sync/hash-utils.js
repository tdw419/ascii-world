// hash-utils.js - Content hash utilities for ASCII-GUI sync
import crypto from 'crypto';

/**
 * Compute SHA-256 hash of content, returning first 8 hex chars
 * @param {string} content - The ASCII content
 * @returns {string} 8-char hex hash
 */
export function contentHash(content) {
    return crypto.createHash('sha256')
        .update(content)
        .digest('hex')
        .slice(0, 8);
}

/**
 * Extract hash from ASCII content (looks for ver:XXXXXXXX pattern)
 * @param {string} content - The ASCII content
 * @returns {string|null} The hash or null if not found
 */
export function extractHash(content) {
    const match = content.match(/ver:([a-f0-9]{8})/i);
    return match ? match[1].toLowerCase() : null;
}

/**
 * Remove hash line from content for hash computation
 * @param {string} content - The ASCII content with ver: line
 * @returns {string} Content without the hash line
 */
export function stripHashLine(content) {
    return content.replace(/ver:[a-f0-9]{8}/i, 'ver:--------');
}

/**
 * Compute hash of content, excluding the hash line itself
 * The hash is computed on content with ver:-------- (placeholder)
 * @param {string} content - The ASCII content
 * @returns {string} 8-char hex hash
 */
export function computeContentHash(content) {
    // Normalize: replace any ver:XXXXXXXX with ver:-------- before hashing
    const normalized = content.replace(/ver:[a-f0-9]{8}/i, 'ver:--------');
    return contentHash(normalized);
}

/**
 * Update or add hash to ASCII content
 * @param {string} content - The ASCII content
 * @returns {string} Content with updated ver:XXXXXXXX
 */
export function updateHash(content) {
    // First normalize any existing hash to placeholder
    const normalized = content.replace(/ver:[a-f0-9]{8}/i, 'ver:--------');
    // Compute hash of normalized content
    const hash = contentHash(normalized);
    // Replace placeholder with actual hash
    return normalized.replace('ver:--------', `ver:${hash}`);
}

/**
 * Verify content matches its embedded hash
 * @param {string} content - The ASCII content
 * @returns {{ valid: boolean, embedded: string|null, computed: string }}
 */
export function verifyHash(content) {
    const embedded = extractHash(content);
    const computed = computeContentHash(content);
    return {
        valid: embedded === computed,
        embedded,
        computed
    };
}
