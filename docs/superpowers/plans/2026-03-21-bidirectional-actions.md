# Bidirectional Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable GUI button clicks to update the ASCII file, creating a true bidirectional AI ↔ Human loop.

**Architecture:** When a button is clicked in the GUI, it sends an action to the sync server. The server processes the action, updates the ASCII file (with new hash), and broadcasts the change to all clients. The AI can then see what the human did.

**Tech Stack:** Node.js, WebSocket (ws), file system operations

---

## File Structure

```
ascii_world/
├── sync/
│   ├── sync-server.js      # MODIFY: Add action handlers
│   └── action-handlers.js  # CREATE: Action processing logic
├── data/
│   └── *.ascii             # Modified by actions
└── ascii_world_template.html  # MODIFY: Send actions on click
```

---

## Task 1: Create Action Handlers Module

**Files:**
- Create: `sync/action-handlers.js`

- [ ] **Step 1: Create action-handlers.js with button click handler**

```javascript
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

    // TODO: Add action-specific logic here
    // For now, just update a "last action" indicator

    // Check for specific actions
    if (action.label.toLowerCase().includes('start')) {
        newContent = toggleStatus(newContent, action.key, '●', 'running');
        changes.push(`Started service associated with [${action.key}]`);
    } else if (action.label.toLowerCase().includes('stop')) {
        newContent = toggleStatus(newContent, action.key, '○', 'stopped');
        changes.push(`Stopped service associated with [${action.key}]`);
    } else if (action.label.toLowerCase().includes('refresh')) {
        changes.push(`Refresh requested - no state change`);
    } else if (action.label.toLowerCase().includes('exit')) {
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
    // Simple implementation: update status indicators
    // In a real implementation, this would be more sophisticated
    return content;
}

/**
 * Available action handlers
 */
export const actionHandlers = {
    click: handleButtonClick,
    // Future: 'input', 'select', 'toggle', etc.
};
```

- [ ] **Step 2: Verify file syntax**

Run: `cd /home/jericho/zion/projects/ascii_world/ascii_world/sync && node -e "import('./action-handlers.js').then(() => console.log('✓ Syntax OK'))"`
Expected: `✓ Syntax OK`

- [ ] **Step 3: Commit**

```bash
cd /home/jericho/zion/projects/ascii_world/ascii_world
git add sync/action-handlers.js
git commit -m "feat: add action handlers module for bidirectional sync"
```

---

## Task 2: Integrate Action Handlers into Sync Server

**Files:**
- Modify: `sync/sync-server.js`

- [ ] **Step 1: Import action handlers**

Add at top of sync-server.js:
```javascript
import { actionHandlers } from './action-handlers.js';
```

- [ ] **Step 2: Update handleGuiAction to process actions**

Replace the existing handleGuiAction method:
```javascript
async handleGuiAction(ws, msg) {
    console.log(`GUI Action: ${msg.action} on [${msg.key}] ${msg.label}`);

    // Find the file this action applies to
    const filepath = this.findFileForAction(msg);
    if (!filepath) {
        ws.send(JSON.stringify({
            type: 'action_error',
            error: 'No matching file found',
            action: msg
        }));
        return;
    }

    // Get current content
    const content = this.fileContents.get(filepath);
    if (!content) {
        ws.send(JSON.stringify({
            type: 'action_error',
            error: 'File not loaded',
            action: msg
        }));
        return;
    }

    // Process the action
    const handler = actionHandlers[msg.action];
    if (!handler) {
        ws.send(JSON.stringify({
            type: 'action_error',
            error: `Unknown action type: ${msg.action}`,
            action: msg
        }));
        return;
    }

    const result = handler(content, msg);

    // Write updated content
    const fs = await import('fs/promises');
    await fs.writeFile(filepath, result.content, 'utf-8');

    // Broadcast action result
    this.broadcast({
        type: 'action_processed',
        action: msg,
        changes: result.changes,
        newHash: result.newHash,
        timestamp: Date.now()
    });

    console.log(`Action processed: ${result.changes.join(', ')}`);
}

findFileForAction(msg) {
    // For now, return the first .ascii file
    // In production, this would use msg.context or active file tracking
    for (const filepath of this.fileContents.keys()) {
        if (filepath.endsWith('.ascii')) {
            return filepath;
        }
    }
    return null;
}
```

- [ ] **Step 3: Test action handler integration**

Run: `cd /home/jericho/zion/projects/ascii_world/ascii_world/sync && node -e "
import('./sync-server.js').catch(e => {
    if (e.message.includes('EADDRINUSE')) {
        console.log('✓ Server code loads (port in use is OK for test)');
    } else {
        console.log('✗ Error:', e.message);
    }
});"`
Expected: Server loads without syntax errors

- [ ] **Step 4: Commit**

```bash
cd /home/jericho/zion/projects/ascii_world/ascii_world
git add sync/sync-server.js
git commit -m "feat: integrate action handlers into sync server"
```

---

## Task 3: Update GUI to Send Actions with Context

**Files:**
- Modify: `ascii_world_template.html`

- [ ] **Step 1: Update button click handler**

Find the `handleButtonClick` function and update it:
```javascript
function handleButtonClick(key, label) {
    console.log(`Button clicked: [${key}] ${label}`);

    // Show visual feedback
    const btn = event.target.closest('.ascii-button');
    if (btn) {
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => btn.style.transform = '', 100);
    }

    // Send to sync server
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'gui_action',
            action: 'click',
            key,
            label,
            hash: parser.hash,
            timestamp: Date.now()
        }));
    } else {
        // Not connected - show message
        console.warn('Not connected to sync server');
    }
}
```

- [ ] **Step 2: Add action feedback display**

Add after the gui-output div in HTML:
```html
<div id="actionFeedback" class="action-feedback" style="display:none;">
    <span id="actionText"></span>
</div>
```

Add CSS:
```css
.action-feedback {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #238636;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
}

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
```

- [ ] **Step 3: Handle action_processed messages**

Add to handleSyncMessage:
```javascript
case 'action_processed':
    // Show feedback
    const feedback = document.getElementById('actionFeedback');
    const actionText = document.getElementById('actionText');
    actionText.textContent = `Action processed: ${msg.changes.join(', ')}`;
    feedback.style.display = 'block';
    setTimeout(() => feedback.style.display = 'none', 3000);
    break;
```

- [ ] **Step 4: Test in browser**

Manual test: Open the HTML file, click a button, verify feedback appears

- [ ] **Step 5: Commit**

```bash
cd /home/jericho/zion/projects/ascii_world/ascii_world
git add ascii_world_template.html
git commit -m "feat: add action sending and feedback to GUI"
```

---

## Task 4: Add State-Changing Actions

**Files:**
- Modify: `sync/action-handlers.js`

- [ ] **Step 1: Implement status toggle logic**

Update the `toggleStatus` function:
```javascript
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
    // Pattern: │  service-name   PORT    STATUS   UPTIME  │
    const lines = content.split('\n');
    const newLines = lines.map(line => {
        if (line.includes(serviceName) && line.includes('│')) {
            // Update status indicator
            return line
                .replace(/[●○◐◑◉]/, symbol)
                .replace(/(running|stopped|warning|paused|error)/, state);
        }
        return line;
    });

    return newLines.join('\n');
}
```

- [ ] **Step 2: Implement "Start All" and "Stop All" logic**

Add to handleButtonClick:
```javascript
// Handle "Start All" / "Stop All"
if (action.label.toLowerCase().includes('start all')) {
    newContent = setAllStatuses(newContent, '●', 'running');
    changes.push('Started all services');
} else if (action.label.toLowerCase().includes('stop all')) {
    newContent = setAllStatuses(newContent, '○', 'stopped');
    changes.push('Stopped all services');
}

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
```

- [ ] **Step 3: Test status changes**

Manual test: Click "Start All" button, verify all statuses change to ● running

- [ ] **Step 4: Commit**

```bash
cd /home/jericho/zion/projects/ascii_world/ascii_world
git add sync/action-handlers.js
git commit -m "feat: implement status toggle and start/stop all actions"
```

---

## Task 5: End-to-End Verification

**Files:**
- No new files (verification task)

- [ ] **Step 1: Kill any existing sync server**

Run: `pkill -f "sync-server.js"`

- [ ] **Step 2: Start sync server**

Run: `cd /home/jericho/zion/projects/ascii_world/ascii_world/sync && node sync-server.js &`
Expected: Server starts on port 3839

- [ ] **Step 3: Open browser and test**

1. Open `ascii_world_template.html`
2. Verify connection (green dot)
3. Click "Start All" button
4. Verify:
   - Feedback appears
   - Statuses change to ● running
   - Hash updates
   - Parse report shows new state

- [ ] **Step 4: Verify AI can see the change**

Run: `cat /home/jericho/zion/projects/ascii_world/ascii_world/data/service_manager.ascii | grep "●"`
Expected: Multiple lines with ● running

- [ ] **Step 5: Document the workflow**

Create `docs/bidirectional-workflow.md`:
```markdown
# Bidirectional Workflow

## AI → Human
1. AI writes ASCII file with actions
2. Sync server broadcasts to GUI
3. Human sees updated interface

## Human → AI
1. Human clicks button in GUI
2. GUI sends action to sync server
3. Server processes action, updates ASCII
4. AI reads file, sees what human did

## Verification
- Both sides see same hash
- Parse report confirms GUI matches file
```

- [ ] **Step 6: Final commit**

```bash
cd /home/jericho/zion/projects/ascii_world/ascii_world
git add docs/bidirectional-workflow.md
git commit -m "docs: add bidirectional workflow documentation"
```

---

## Success Criteria

- [ ] GUI button clicks send actions to sync server
- [ ] Sync server processes actions and updates ASCII file
- [ ] Hash is recalculated after changes
- [ ] All connected clients see the update
- [ ] AI can read the file and see what the human did
- [ ] Parse reports verify GUI matches file

## Estimated Time

2-3 hours total

## Dependencies

- Existing sync server (✓ built)
- Hash utilities (✓ built)
- GUI renderer (✓ built)
