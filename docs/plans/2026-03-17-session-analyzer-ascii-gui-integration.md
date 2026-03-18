# Session-Analyzer ASCII GUI Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the ASCII-first interface by adding visual labels to GUI elements, an ASCII panel for live preview, integration tests, and documentation.

**Architecture:** The GUI will display [A-Z] labels matching the ASCII bindings, enabling users and AI to use the same control vocabulary. A split-view layout shows the GUI alongside the live ASCII view, demonstrating perfect symmetry between interfaces.

**Tech Stack:** Electrobun, TypeScript, CSS Flexbox, Bun HTTP server, Bun test framework

---

## Task 1: Add Visual Labels to GUI Tab Buttons

**Files:**
- Modify: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/mainview/index.html:25-32`
- Modify: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/mainview/index.css:95-115`

**Context:** The ASCII templates use labels [A]-[D] for tab navigation. The GUI tabs must show these same labels so users understand the correlation.

**Step 1: Add data-label attributes to main tabs in index.html**

Find the nav.tabs section (around line 25) and add data-label attributes:

```html
<nav class="tabs">
  <button class="tab active" data-tab="dashboard" data-label="[A]">📊 Dashboard</button>
  <button class="tab" data-tab="projects" data-label="">📁 Projects</button>
  <button class="tab" data-tab="sources" data-label="[B]">🎯 Sources</button>
  <button class="tab" data-tab="config" data-label="[C]">⚙️ Config</button>
  <button class="tab" data-tab="history" data-label="[D]">📜 History</button>
  <button class="tab" data-tab="export" data-label="">📤 Export</button>
</nav>
```

Note: Projects and Export tabs don't have ASCII labels (not in the 4 core states), so they get empty data-label.

**Step 2: Add CSS to display labels before tab text**

Add to index.css after the .tab.active rule (around line 115):

```css
/* ASCII Label styling */
.tab[data-label]:not([data-label=""])::before {
  content: attr(data-label) " ";
  font-family: monospace;
  font-weight: bold;
  opacity: 0.7;
  font-size: 11px;
  margin-right: 2px;
}

.tab[data-label]:not([data-label=""]):hover::before {
  opacity: 1;
}
```

**Step 3: Test in browser**

Run: Start the app and verify tabs show labels: `[A] 📊 Dashboard`, `[B] 🎯 Sources`, etc.

**Step 4: Commit**

```bash
cd /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app
git add src/mainview/index.html src/mainview/index.css
git commit -m "feat(ascii): add [A-D] visual labels to main navigation tabs"
```

---

## Task 2: Add Visual Labels to Config Sub-tabs

**Files:**
- Modify: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/mainview/index.html:140-146`
- Modify: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/mainview/index.css:355-376`

**Context:** The ASCII config template uses labels [1]-[5] for config sections. These must appear in the GUI.

**Step 1: Add data-label attributes to config nav buttons**

Find the nav.config-nav section (around line 140) and update:

```html
<nav class="config-nav">
  <button class="config-tab active" data-config="project" data-label="[1]">📁 Project</button>
  <button class="config-tab" data-config="schedule" data-label="[2]">⏰ Schedule</button>
  <button class="config-tab" data-config="model" data-label="[3]">🤖 Model</button>
  <button class="config-tab" data-config="prompts" data-label="[4]">📝 Prompts</button>
  <button class="config-tab" data-config="notifications" data-label="[5]">🔔 Notifications</button>
</nav>
```

**Step 2: Add CSS for config tab labels**

Add after the .config-tab.active rule (around line 376):

```css
/* ASCII Label styling for config tabs */
.config-tab[data-label]:not([data-label=""])::before {
  content: attr(data-label) " ";
  font-family: monospace;
  font-weight: bold;
  opacity: 0.6;
  font-size: 10px;
  margin-right: 4px;
}

.config-tab[data-label]:not([data-label=""]):hover::before {
  opacity: 1;
}
```

**Step 3: Test in browser**

Run: Navigate to Config tab and verify sub-tabs show `[1] 📁 Project`, `[2] ⏰ Schedule`, etc.

**Step 4: Commit**

```bash
git add src/mainview/index.html src/mainview/index.css
git commit -m "feat(ascii): add [1-5] visual labels to config sub-tabs"
```

---

## Task 3: Add Visual Labels to Dashboard Action Buttons

**Files:**
- Modify: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/mainview/index.html:100-105`

**Context:** The ASCII dashboard has [E] for primary action (Run Analysis) and [F] for export. The GUI should show these.

**Step 1: Add data-label to dashboard buttons**

Find the dashboard controls section (around line 100):

```html
<div class="controls">
  <input type="text" id="projectDir" placeholder="/path/to/project" />
  <button id="setProjectBtn">Set Project</button>
  <button id="runBtn" class="primary" data-label="[E]">Run Now</button>
</div>
```

**Step 2: Add CSS for action button labels**

Add to index.css:

```css
/* ASCII Label styling for action buttons */
button[data-label]:not([data-label=""])::before {
  content: attr(data-label) " ";
  font-family: monospace;
  font-weight: bold;
  opacity: 0.6;
  font-size: 10px;
  margin-right: 4px;
}

button[data-label]:not([data-label=""]):hover::before {
  opacity: 1;
}
```

**Step 3: Commit**

```bash
git add src/mainview/index.html src/mainview/index.css
git commit -m "feat(ascii): add [E] label to Run Analysis button"
```

---

## Task 4: Add Visual Labels to Config Action Buttons

**Files:**
- Modify: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/mainview/index.html:307-316`

**Context:** Config panel has Save [W], Reset [Z], and profile actions. Add labels to match ASCII.

**Step 1: Add data-label to config action buttons**

Find the config-actions section (around line 307):

```html
<div class="config-actions">
  <button id="saveConfigBtn" class="primary" data-label="[W]">Save Config</button>
  <button id="resetConfigBtn" data-label="[Z]">Reset to Defaults</button>
  <div class="profile-actions">
    <select id="profileSelect">
      <option value="">-- Load Profile --</option>
    </select>
    <button id="saveProfileBtn" data-label="[Y]">Save As...</button>
  </div>
</div>
```

**Step 2: Commit**

```bash
git add src/mainview/index.html
git commit -m "feat(ascii): add [W][Y][Z] labels to config action buttons"
```

---

## Task 5: Add ASCII Panel to GUI (Split View)

**Files:**
- Modify: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/mainview/index.html:10`
- Modify: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/mainview/index.css`
- Modify: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/mainview/index.ts`

**Context:** Add a side panel showing the live ASCII view, demonstrating GUI-ASCII symmetry.

**Step 1: Wrap existing content in split-view layout**

In index.html, wrap the .container div with a split-view structure:

```html
<body>
  <div class="split-view">
    <div class="gui-panel">
      <div class="container">
        <!-- All existing content stays here -->
      </div>
    </div>
    <div class="ascii-panel">
      <div class="ascii-header">
        <span>ASCII View</span>
        <button id="toggleAsciiPanel" title="Toggle ASCII Panel">◀</button>
      </div>
      <pre id="asciiView">Loading...</pre>
    </div>
  </div>
  <script type="module" src="views://mainview/index.js"></script>
</body>
```

**Step 2: Add split-view CSS styles**

Add to index.css at the end:

```css
/* ASCII Panel Split View */
.split-view {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.gui-panel {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.ascii-panel {
  width: 420px;
  min-width: 300px;
  max-width: 600px;
  background: #0a0a0a;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s;
}

.ascii-panel.collapsed {
  width: 0;
  min-width: 0;
  overflow: hidden;
}

.ascii-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-dim);
}

.ascii-header button {
  padding: 2px 8px;
  font-size: 12px;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
}

.ascii-header button:hover {
  color: var(--text);
}

#asciiView {
  flex: 1;
  margin: 0;
  padding: 8px;
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  font-size: 11px;
  line-height: 1.2;
  color: #00ff88;
  background: transparent;
  overflow: auto;
  white-space: pre;
}

/* When ASCII panel is collapsed */
.split-view.collapsed .gui-panel {
  flex: 1;
}
```

**Step 3: Add ASCII view update logic to index.ts**

Add to index.ts after the existing imports:

```typescript
// ==================== ASCII View Sync ====================

let asciiUpdateInterval: number | null = null;
let asciiPanelCollapsed = false;

async function updateAsciiView(): Promise<void> {
  try {
    const res = await fetch("http://localhost:3421/view");
    if (res.ok) {
      const ascii = await res.text();
      const el = document.getElementById("asciiView");
      if (el) el.textContent = ascii;
    }
  } catch (e) {
    console.error("Failed to update ASCII view:", e);
  }
}

function startAsciiSync(): void {
  if (asciiUpdateInterval) return;
  updateAsciiView();
  asciiUpdateInterval = window.setInterval(updateAsciiView, 1000);
}

function stopAsciiSync(): void {
  if (asciiUpdateInterval) {
    clearInterval(asciiUpdateInterval);
    asciiUpdateInterval = null;
  }
}

function toggleAsciiPanel(): void {
  const panel = document.querySelector(".ascii-panel") as HTMLElement;
  const btn = document.getElementById("toggleAsciiPanel");
  asciiPanelCollapsed = !asciiPanelCollapsed;

  if (asciiPanelCollapsed) {
    panel.classList.add("collapsed");
    if (btn) btn.textContent = "▶";
    stopAsciiSync();
  } else {
    panel.classList.remove("collapsed");
    if (btn) btn.textContent = "◀";
    startAsciiSync();
  }
}

function initAsciiPanel(): void {
  const toggleBtn = document.getElementById("toggleAsciiPanel");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleAsciiPanel);
  }
  startAsciiSync();
}
```

**Step 4: Call initAsciiPanel in the init sequence**

Find the DOMContentLoaded or init function and add:

```typescript
// In the init function (e.g., at the end of DOMContentLoaded handler)
initAsciiPanel();
```

**Step 5: Test the split view**

Run: Start the app and verify:
1. ASCII panel appears on the right side
2. Shows live ASCII view that updates every second
3. Toggle button collapses/expands the panel
4. Navigate tabs and verify ASCII view updates

**Step 6: Commit**

```bash
git add src/mainview/index.html src/mainview/index.css src/mainview/index.ts
git commit -m "feat(ascii): add live ASCII panel with split-view layout"
```

---

## Task 6: Add Integration Tests for ASCII Endpoints

**Files:**
- Create: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/bun/ascii-integration.test.ts`

**Context:** Test the ASCII control API endpoints to ensure they work correctly.

**Step 1: Create the integration test file**

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";

const API_BASE = "http://localhost:3421";

describe("ASCII Interface Integration", () => {
  describe("GET /view", () => {
    test("returns ASCII text content", async () => {
      const res = await fetch(`${API_BASE}/view`);
      expect(res.ok).toBe(true);
      expect(res.headers.get("content-type")).toContain("text/plain");

      const text = await res.text();
      expect(text.length).toBeGreaterThan(0);
    });

    test("contains ASCII box drawing characters", async () => {
      const res = await fetch(`${API_BASE}/view`);
      const text = await res.text();

      // Should have box drawing characters
      expect(text).toMatch(/[╔═╗║╚╝├┤┬┴┼]/);
    });

    test("contains navigation labels", async () => {
      const res = await fetch(`${API_BASE}/view`);
      const text = await res.text();

      // Should have [A], [B], [C], [D] labels for navigation
      expect(text).toContain("[A]");
      expect(text).toContain("[B]");
      expect(text).toContain("[C]");
      expect(text).toContain("[D]");
    });
  });

  describe("GET /metrics", () => {
    test("returns metrics JSON", async () => {
      const res = await fetch(`${API_BASE}/metrics`);
      expect(res.ok).toBe(true);

      const json = await res.json();
      expect(json).toHaveProperty("requests");
      expect(json).toHaveProperty("avgLatencyMs");
    });
  });

  describe("POST /control", () => {
    test("navigates to SOURCES state with label B", async () => {
      const res = await fetch(`${API_BASE}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "B" }),
      });

      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(json.state).toBe("SOURCES");
    });

    test("navigates back to DASHBOARD with label A", async () => {
      const res = await fetch(`${API_BASE}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "A" }),
      });

      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(json.state).toBe("DASHBOARD");
    });

    test("navigates to CONFIG state with label C", async () => {
      const res = await fetch(`${API_BASE}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "C" }),
      });

      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.state).toBe("CONFIG");
    });

    test("navigates to HISTORY state with label D", async () => {
      // First ensure we're not already in HISTORY
      await fetch(`${API_BASE}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "A" }),
      });

      const res = await fetch(`${API_BASE}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "D" }),
      });

      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json.state).toBe("HISTORY");
    });

    test("returns error for invalid label", async () => {
      const res = await fetch(`${API_BASE}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "INVALID" }),
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
    });

    test("returns error when label is missing", async () => {
      const res = await fetch(`${API_BASE}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(400);
    });
  });

  describe("Latency Requirements", () => {
    test("/view responds in under 10ms", async () => {
      const start = performance.now();
      await fetch(`${API_BASE}/view`);
      const latency = performance.now() - start;

      expect(latency).toBeLessThan(10);
    });

    test("/control responds in under 10ms", async () => {
      const start = performance.now();
      await fetch(`${API_BASE}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "A" }),
      });
      const latency = performance.now() - start;

      expect(latency).toBeLessThan(10);
    });
  });
});
```

**Step 2: Run tests (requires app running)**

```bash
cd /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app
bun test src/bun/ascii-integration.test.ts
```

Expected: All tests pass (requires the app to be running on port 3421)

**Step 3: Commit**

```bash
git add src/bun/ascii-integration.test.ts
git commit -m "test(ascii): add integration tests for ASCII control API"
```

---

## Task 7: Update Documentation

**Files:**
- Modify: `/home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/README.md`

**Context:** Document the ASCII interface for users and developers.

**Step 1: Add ASCII Interface section to README**

Find or create a README.md and add this section:

```markdown
## ASCII Interface

Session Analyzer exposes an ASCII-first interface that allows AI agents to control the application via simple HTTP requests. This interface mirrors the GUI state and provides label-based navigation.

### Architecture

The ASCII interface follows these principles:
- **Screen as Source of Truth**: The ASCII view represents the complete application state
- **Label-Based Control**: All interactive elements have [A-Z] labels
- **GUI-ASCII Symmetry**: GUI elements display their corresponding ASCII labels

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/view` | GET | Current ASCII representation (80x24 grid) |
| `/control` | POST | Execute action by label |
| `/metrics` | GET | Latency and request statistics |

### Usage Examples

```bash
# Get current ASCII view
curl http://localhost:3421/view

# Navigate to Sources tab
curl -X POST http://localhost:3421/control \
  -H "Content-Type: application/json" \
  -d '{"label":"B"}'

# Navigate to Config tab
curl -X POST http://localhost:3421/control \
  -H "Content-Type: application/json" \
  -d '{"label":"C"}'

# Get performance metrics
curl http://localhost:3421/metrics
```

### Label Reference

#### Navigation (All States)
| Label | Action |
|-------|--------|
| `[A]` | Dashboard |
| `[B]` | Sources |
| `[C]` | Config |
| `[D]` | History |
| `[X]` | Back/Quit |

#### Dashboard Actions
| Label | Action |
|-------|--------|
| `[E]` | Run Analysis |
| `[F]` | Export Report |
| `[G]` | Open Profile |

#### Config Actions
| Label | Action |
|-------|--------|
| `[1]` | Project Section |
| `[2]` | Schedule Section |
| `[3]` | Model Section |
| `[4]` | Prompts Section |
| `[5]` | Notifications Section |
| `[W]` | Save Config |
| `[Y]` | Save Profile As |
| `[Z]` | Reset Defaults |

### Performance

The ASCII interface is designed for sub-10ms latency:
- `/view` endpoint: < 5ms typical
- `/control` endpoint: < 3ms typical

### For AI Agents

AI agents can control this application by:
1. Fetching `/view` to understand current state
2. Parsing labels to discover available actions
3. Sending `{ "label": "X" }` to `/control` to execute actions

The label-to-action mappings are defined in `src/ascii/bindings.json`.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add ASCII interface documentation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Main Tab Labels [A-D] | HTML, CSS |
| 2 | Config Sub-tab Labels [1-5] | HTML, CSS |
| 3 | Dashboard Action Labels [E] | HTML, CSS |
| 4 | Config Action Labels [W,Y,Z] | HTML |
| 5 | ASCII Panel Split View | HTML, CSS, TS |
| 6 | Integration Tests | Test file |
| 7 | Documentation | README.md |

**Total commits:** 7
**Dependencies:** Requires Tasks 1-4 from original plan (Templates, Bindings, Generator, API) to be complete
