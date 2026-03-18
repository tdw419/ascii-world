# Session-Analyzer ASCII Instrumentation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ASCII-first interface to session-analyzer-app so AI agents can control it via text-based commands.

**Architecture:** Add an ASCII view layer that mirrors the existing GUI state. The existing HTTP API (port 3421) will be extended with `/view` and `/control` endpoints. GUI and ASCII views will be fully symmetric.

**Tech Stack:** Electrobun, TypeScript, Bun HTTP server, Mustache-style templates

---

## Task 1: Create ASCII State Templates

**Files:**
- Create: `src/ascii/states/dashboard.ascii`
- Create: `src/ascii/states/sources.ascii`
- Create: `src/ascii/states/config.ascii`
- Create: `src/ascii/states/history.ascii`

**Step 1: Create the ascii directory structure**

```bash
mkdir -p /home/jericho/zion/projects/ai_auto_development/ai_auto_development/apps/session-analyzer-app/src/ascii/states
```

**Step 2: Create dashboard.ascii template**

Create file with 80x24 grid showing:
- Tab navigation [A] Dashboard [B] Sources [C] Config [D] History
- Status metrics (last_run, test_status, uncommitted files)
- Quick actions [E] Run Analysis [F] Export
- Profile selector [G]

**Step 3: Create sources.ascii template**

Create file showing:
- Provider grid with [1-9] labels for adding sources
- Active sources list with toggle [T] and remove [X] labels
- Custom source input field

**Step 4: Create config.ascii template**

Create file showing:
- Sub-tabs [A] General [B] Schedule [C] Model [D] Prompts
- Settings fields with toggle/edit labels
- Save [S] Reset [R] buttons

**Step 5: Create history.ascii template**

Create file showing:
- Run history list with selectable entries
- Search input
- Export [E] button

**Step 6: Commit**

```bash
git add src/ascii/states/*.ascii
git commit -m "feat(ascii): add ASCII state templates for dashboard, sources, config, history"
```

---

## Task 2: Create Bindings Configuration

**Files:**
- Create: `src/ascii/bindings.json`

**Step 1: Create bindings.json**

Map all labels to existing RPC actions:
```json
{
  "version": "1.0.0",
  "states": {
    "DASHBOARD": {
      "template": "dashboard.ascii",
      "bindings": {
        "A": { "action": "switch_tab", "params": {"tab": "dashboard"} },
        "B": { "action": "switch_tab", "params": {"tab": "sources"} },
        "C": { "action": "switch_tab", "params": {"tab": "config"} },
        "D": { "action": "switch_tab", "params": {"tab": "history"} },
        "E": { "action": "run_analysis", "async": true },
        "F": { "action": "export_state" },
        "G": { "action": "cycle_profile" }
      }
    },
    "SOURCES": { ... },
    "CONFIG": { ... },
    "HISTORY": { ... }
  }
}
```

**Step 2: Verify JSON is valid**

Run: `cat src/ascii/bindings.json | jq .`

**Step 3: Commit**

```bash
git add src/ascii/bindings.json
git commit -m "feat(ascii): add label-to-action bindings configuration"
```

---

## Task 3: Implement ASCII Generator

**Files:**
- Create: `src/bun/ascii-generator.ts`

**Step 1: Write failing test**

Create: `src/bun/ascii-generator.test.ts`
```typescript
import { describe, test, expect } from "bun:test";
import { AsciiGenerator } from "./ascii-generator";

describe("AsciiGenerator", () => {
  test("renders dashboard template with state data", () => {
    const gen = new AsciiGenerator();
    const state = { last_run: "2026-03-17", tests_status: "passed" };
    const result = gen.render("dashboard", state);
    expect(result).toContain("2026-03-17");
    expect(result).toContain("passed");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/bun/ascii-generator.test.ts`
Expected: FAIL - module not found

**Step 3: Implement AsciiGenerator**

Create: `src/bun/ascii-generator.ts`
```typescript
import { readFileSync } from "fs";
import { join } from "path";

export class AsciiGenerator {
  private templatesDir: string;

  constructor() {
    this.templatesDir = join(import.meta.dir, "..", "ascii", "states");
  }

  render(stateName: string, data: Record<string, any>): string {
    const templatePath = join(this.templatesDir, `${stateName.toLowerCase()}.ascii`);
    let template = readFileSync(templatePath, "utf-8");

    // Simple variable replacement: {{key}}
    for (const [key, value] of Object.entries(data)) {
      template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
    }

    return template;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/bun/ascii-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/bun/ascii-generator.ts src/bun/ascii-generator.test.ts
git commit -m "feat(ascii): implement ASCII template generator"
```

---

## Task 4: Extend Control API

**Files:**
- Modify: `src/bun/api.ts`

**Step 1: Add ASCII endpoints to existing API**

Add to the existing `startApiServer` function:
```typescript
// ASCII Interface endpoints
if (url.pathname === "/view") {
  const state = getStateForAscii();
  const ascii = asciiGenerator.render(state.currentTab, state);
  return new Response(ascii, { headers: { "Content-Type": "text/plain" } });
}

if (url.pathname === "/bindings") {
  return Response.json(bindings);
}

if (url.pathname === "/control" && req.method === "POST") {
  const body = await req.json();
  const result = await handleLabelAction(body.label);
  return Response.json(result);
}
```

**Step 2: Test endpoints manually**

```bash
# Start the app first
# Then test:
curl http://localhost:3421/view
curl http://localhost:3421/bindings
curl -X POST http://localhost:3421/control -d '{"label":"B"}'
```

**Step 3: Commit**

```bash
git add src/bun/api.ts
git commit -m "feat(ascii): add /view, /bindings, /control endpoints to API"
```

---

## Task 5: Add Visual Labels to GUI

**Files:**
- Modify: `src/mainview/index.html`
- Modify: `src/mainview/index.css`

**Step 1: Add label spans to tab buttons**

In index.html, add `[A]`, `[B]`, etc. to buttons:
```html
<button class="tab" data-tab="dashboard">[A] Dashboard</button>
<button class="tab" data-tab="sources">[B] Sources</button>
<button class="tab" data-tab="config">[C] Config</button>
<button class="tab" data-tab="history">[D] History</button>
```

**Step 2: Style the labels**

In index.css:
```css
.tab::before {
  content: attr(data-label);
  opacity: 0.6;
  margin-right: 4px;
  font-family: monospace;
}
```

**Step 3: Commit**

```bash
git add src/mainview/index.html src/mainview/index.css
git commit -m "feat(ascii): add visual [A-Z] labels to GUI elements"
```

---

## Task 6: Add ASCII Panel to GUI

**Files:**
- Modify: `src/mainview/index.html`
- Modify: `src/mainview/index.ts`

**Step 1: Add split-view layout**

In index.html, add:
```html
<div class="split-view">
  <div class="gui-panel" id="guiPanel">
    <!-- Existing GUI content -->
  </div>
  <div class="ascii-panel" id="asciiPanel">
    <pre id="asciiView"></pre>
  </div>
</div>
```

**Step 2: Style the split view**

In index.css:
```css
.split-view {
  display: flex;
  height: 100%;
}
.gui-panel { flex: 2; overflow: auto; }
.ascii-panel {
  flex: 1;
  background: #1a1a1a;
  color: #0f0;
  font-family: monospace;
  font-size: 12px;
  overflow: auto;
  border-left: 1px solid #333;
}
.ascii-panel pre {
  margin: 8px;
  white-space: pre;
}
```

**Step 3: Update index.ts to sync ASCII view**

Add to the existing state update logic:
```typescript
async function updateAsciiView() {
  try {
    const res = await fetch("/view");
    const ascii = await res.text();
    const el = document.getElementById("asciiView");
    if (el) el.textContent = ascii;
  } catch (e) {
    console.error("Failed to update ASCII view:", e);
  }
}
```

**Step 4: Commit**

```bash
git add src/mainview/index.html src/mainview/index.css src/mainview/index.ts
git commit -m "feat(ascii): add live ASCII panel to GUI"
```

---

## Task 7: Integration Testing

**Files:**
- Create: `tests/ascii-integration.test.ts`

**Step 1: Write integration test**

```typescript
import { describe, test, expect, beforeAll } from "bun:test";

describe("ASCII Interface Integration", () => {
  const API = "http://localhost:3421";

  test("GET /view returns ASCII art", async () => {
    const res = await fetch(`${API}/view`);
    expect(res.ok).toBe(true);
    const text = await res.text();
    expect(text).toContain("[");  // Has labels
  });

  test("GET /bindings returns valid JSON", async () => {
    const res = await fetch(`${API}/bindings`);
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.states).toBeDefined();
  });

  test("POST /control navigates between tabs", async () => {
    // Navigate to Sources
    let res = await fetch(`${API}/control`, {
      method: "POST",
      body: JSON.stringify({ label: "B" })
    });
    expect(res.ok).toBe(true);

    // Verify state changed
    const state = await fetch(`${API}/state`).then(r => r.json());
    expect(state.currentTab).toBe("sources");
  });
});
```

**Step 2: Run tests**

Run: `bun test tests/ascii-integration.test.ts`
Expected: PASS (requires app running)

**Step 3: Commit**

```bash
git add tests/ascii-integration.test.ts
git commit -m "test(ascii): add integration tests for ASCII interface"
```

---

## Task 8: Update Documentation

**Files:**
- Modify: `README.md`

**Step 1: Add ASCII Interface section to README**

```markdown
## ASCII Interface

The app exposes a text-based interface for AI agent control.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/view` | GET | Current ASCII representation |
| `/bindings` | GET | Label → action mappings |
| `/control` | POST | Execute action by label |
| `/state` | GET | Raw JSON state |

### Usage Example

```bash
# Get current view
curl http://localhost:3421/view

# Navigate to Sources tab
curl -X POST http://localhost:3421/control -d '{"label":"B"}'

# Run analysis
curl -X POST http://localhost:3421/control -d '{"label":"E"}'
```

### Label Reference

| State | Label | Action |
|-------|-------|--------|
| Dashboard | [A] | Switch to Dashboard |
| Dashboard | [B] | Switch to Sources |
| Dashboard | [E] | Run Analysis |
| Sources | [1-9] | Add provider |
| Config | [S] | Save settings |
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
| 1 | ASCII State Templates | 4 new `.ascii` files |
| 2 | Bindings Configuration | `bindings.json` |
| 3 | ASCII Generator | `ascii-generator.ts` + test |
| 4 | Control API Extension | Modify `api.ts` |
| 5 | Visual Labels | Modify HTML/CSS |
| 6 | ASCII Panel | Modify HTML/CSS/TS |
| 7 | Integration Tests | New test file |
| 8 | Documentation | Update README |

**Total commits:** 8
**Estimated time:** 2-3 hours
