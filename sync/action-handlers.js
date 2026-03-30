// action-handlers.js - Process GUI actions and update ASCII
import { updateHash, extractHash } from './hash-utils.js';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(import.meta.dirname, '../data');
const AIPM_CMD_FILE = process.env.AIPM_CMD_FILE || '/home/jericho/zion/projects/aipm/data/aipm-web-cmd.json';

/**
 * Process a button click action
 * @param {string} content - Current ASCII content
 * @param {object} action - { key, label, timestamp }
 * @returns {object} { content, changes, newHash }
 */
export function handleButtonClick(content, action) {
    const changes = [];
    let newContent = content;

    // Log the action
    changes.push(`Button [${action.key}] "${action.label}" clicked at ${new Date(action.timestamp).toISOString()}`);

    // Check for specific labels
    const label = (action.label || '').toLowerCase();

    if (label.includes('start all')) {
        newContent = setAllStatuses(newContent, '●', 'running');
        changes.push('Started all services');
    } else if (label.includes('stop all')) {
        newContent = setAllStatuses(newContent, '○', 'stopped');
        changes.push('Stopped all services');
    } else if (label.includes('start')) {
        newContent = toggleStatus(newContent, action.key, '●', 'running');
        changes.push(`Started service associated with [${action.key}]`);
    } else if (label.includes('stop')) {
        newContent = toggleStatus(newContent, action.key, '○', 'stopped');
        changes.push(`Stopped service associated with [${action.key}]`);
    } else if (label.includes('refresh')) {
        changes.push(`Refresh requested - no state change`);
    } else if (label.includes('exit')) {
        changes.push(`Exit requested - no state change`);
    }

    // AIPM-specific actions
    const key = action.key.toUpperCase();
    if (['P', 'R', 'I', 'S'].includes(key)) {
        handleAipmAction(key, changes);
    }

    // Update hash
    newContent = updateHash(newContent);
    const newHash = extractHash(newContent);

    return { content: newContent, changes, newHash };
}

/**
 * Handle AIPM-specific button actions
 */
async function handleAipmAction(key, changes) {
    try {
        const timestamp = Date.now();
        let cmd = null;

        switch (key) {
            case 'P':
                cmd = { action: 'pause', reason: 'via web UI', timestamp };
                changes.push('AIPM: Pausing autonomous processing');
                break;
            case 'R':
                cmd = { action: 'resume', reason: 'via web UI', timestamp };
                changes.push('AIPM: Resuming autonomous processing');
                break;
            case 'I':
                cmd = { action: 'inject', title: 'Injected from web UI', timestamp };
                changes.push('AIPM: Inject command triggered');
                break;
            case 'S':
                changes.push('AIPM: Status refresh - no action needed');
                return;
        }

        if (cmd) {
            await fs.writeFile(AIPM_CMD_FILE, JSON.stringify(cmd, null, 2));
            console.log(`AIPM command written: ${cmd.action}`);
        }
    } catch (err) {
        console.error('Failed to write AIPM command:', err);
        changes.push(`AIPM command failed: ${err.message}`);
    }
}

/**
 * Toggle status indicators in ASCII content
 */
function toggleStatus(content, key, symbol, state) {
    // Map keys to service names (convention-based)
    const keyToService = {
        '1': 'web-app',
        '2': 'api-server',
        '3': 'worker',
        '4': 'cache',
        '5': 'database'
    };

    const serviceName = keyToService[key];
    if (!serviceName) return content;

    // Find and update the status in table rows
    const lines = content.split('\n');
    const newLines = lines.map(line => {
        if (line.includes(serviceName) && line.includes('│')) {
            // Update status indicator and text
            return line
                .replace(/[●○◐◑◉]/, symbol)
                .replace(/(running|stopped|warning|paused|error)/, state);
        }
        return line;
    });

    return newLines.join('\n');
}

/**
 * Set all statuses in the content
 */
function setAllStatuses(content, symbol, state) {
    const lines = content.split('\n');
    const newLines = lines.map(line => {
        if (line.includes('│') && /[●○◐◑◉]/.test(line)) {
            return line
                .replace(/[●○◐◑◉]/, symbol)
                .replace(/(running|stopped|warning|paused|error)/, state);
        }
        return line;
    });
    return newLines.join('\n');
}

/**
 * Available action handlers
 */
export const actionHandlers = {
    click: handleButtonClick,
};
