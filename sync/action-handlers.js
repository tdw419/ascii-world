// action-handlers.js - Process GUI actions and update ASCII
import { updateHash, extractHash } from './hash-utils.js';

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

    // Update hash
    newContent = updateHash(newContent);
    const newHash = extractHash(newContent);

    return { content: newContent, changes, newHash };
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
