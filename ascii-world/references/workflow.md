# ASCII-First Development Workflow

This reference provides the procedural steps for building and managing software using the ASCII-First paradigm.

## 1. Project Scaffolding
Always start by scaffolding a new project via the manager. This ensures the project has the correct directory structure and the high-fidelity HTML renderer.

**Steps:**
1. Call the manager's register endpoint or use the scaffold utility.
2. Verify `src/ascii/states/` contains the initial `.ascii` templates.
3. Verify `renderer/` contains the React/Vite GUI setup.

## 2. Defining State Transitions
State transitions are defined in `src/ascii/bindings.json`.

**Pattern:**
```json
{
  "bindings": [
    { "label": "A", "action": "goto_dashboard", "target": "DASHBOARD" },
    { "label": "B", "action": "goto_settings", "target": "SETTINGS" }
  ],
  "stateTransitions": {
    "DASHBOARD": { "B": "SETTINGS" },
    "SETTINGS": { "A": "DASHBOARD" }
  }
}
```

## 3. Creating Spatial Templates
ASCII templates should be 80x24 and use `[Label]` syntax for interactive elements.

**Best Practices:**
- Use `╔══╗` double-line borders for headers.
- Use `┌──┐` single-line borders for content containers.
- Place labels in predictable spatial locations (e.g., a top navigation bar).
- Use `{{variable}}` for dynamic content.

## 4. Control Loop
To interact with a running project:
1. `GET /view` to receive the current ASCII grid.
2. Parse the grid to find relevant `[Label]` triggers.
3. `POST /control` with the chosen `label` to execute the action.
4. `GET /view` again to see the updated state.
