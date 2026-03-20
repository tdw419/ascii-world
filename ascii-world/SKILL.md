---
name: ascii-world
description: Software development, control, and rendering via the ASCII-First paradigm. Use when you need to scaffold, manage, or remotely control applications through spatial ASCII interfaces, or when integrating with the ASCII World Manager API.
---

# ASCII World

This skill empowers you to build, control, and render software using the "ASCII-First" paradigm. In this model, the user interface is a token-efficient 80x24 ASCII grid that acts as both a visual dashboard and a machine-readable control surface.

## Core Concepts

1. **ASCII-First:** Software is designed as a series of ASCII states. The UI *is* the API.
2. **Spatial Navigation:** Interactive elements are defined by labels like `[A]` or `[1]`.
3. **Manager API:** The central orchestrator (default: `localhost:3422`) that manages multiple ASCII projects.
4. **HTML-First Rendering:** ASCII templates are automatically upgraded to high-fidelity React GUIs for human users, while remaining raw ASCII for AI agents.

## Workflow

To work with ASCII World, follow the procedures in [references/workflow.md](references/workflow.md).

### 1. Scaffolding
When asked to create a new ASCII project, use the scaffold utility or call `POST /projects` on the manager. Ensure the `renderer/` directory is present for the high-fidelity GUI.

### 2. Monitoring & Control
Use the `mcp_manager_bridge` or direct HTTP calls to interact with projects.
- **View:** `GET /view` returns the current ASCII grid.
- **Control:** `POST /control` executes an action by label.

### 3. WordPress Integration
Use the `wp-ascii-bridge` project to manage WordPress sites through the ASCII paradigm. This skill provides the mental model for mapping WP REST API actions to ASCII spatial labels.

## Procedural Guardrails

- **Grid Integrity:** Always maintain the 80x24 grid format in `.ascii` templates.
- **Label Uniqueness:** Ensure labels `[A-Z0-9]` are unique within a single state.
- **CORS Support:** When modifying servers, always ensure `OPTIONS` and CORS headers are present to support the HTML renderer.
