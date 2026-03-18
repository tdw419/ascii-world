# ASCII-First Reference Application Plan

## Objective
Create a reference Electrobun application designed with an "ASCII-First" architecture. This means the application's state and interaction model are first defined as a text-based ASCII interface, which is then mirrored by a graphical user interface (GUI). This approach ensures the application is natively controllable by AI agents with high efficiency and low token cost.

## Key Files & Context
- **Project Root**: `apps/ascii-ref-app/` (to be created)
- **ASCII States**: `apps/ascii-ref-app/src/ascii/states/` (ASCII templates for each view)
- **Bindings**: `apps/ascii-ref-app/src/ascii/bindings.json` (Label to Action mapping)
- **App Logic**: `apps/ascii-ref-app/src/bun/index.ts` (Electrobun main process with state machine)
- **GUI View**: `apps/ascii-ref-app/src/mainview/` (HTML/TS/CSS mirroring ASCII state)

## Implementation Steps

### Phase 1: Foundation & ASCII Definition
1. **Initialize Project**: Create `apps/ascii-ref-app` using the `hello-world` template as a base.
2. **Define State Machine**: Identify the core states of the reference app:
    - `HOME`: Main menu with basic actions.
    - `TASKS`: List of items that can be toggled/removed.
    - `SETTINGS`: Configuration panel.
3. **Draft ASCII Mockups**: Create `.ascii` files for each state in `src/ascii/states/`.
    - Use labels like `[A]`, `[B]`, `[C]` for interactive elements.
    - Define a standard 80x24 grid or similar consistent layout.
4. **Define Bindings**: Create `src/ascii/bindings.json` to map labels to semantic actions (e.g., `[A] -> "goto_tasks"`, `[B] -> "toggle_item_1"`).

### Phase 2: Core Logic & ASCII Server
1. **Implement State Manager**: Create a robust state manager in the Bun process (`src/bun/state-manager.ts`).
2. **ASCII Generator**: Build a service that reads current state and populates the ASCII template.
3. **Control API**: Expose an HTTP/RPC endpoint that accepts label-based commands (e.g., `POST /control { "label": "A" }`).
4. **Validation**: Ensure that every action in the ASCII interface correctly updates the application state.

### Phase 3: GUI Synchronization
1. **Responsive GUI**: Develop the Electrobun GUI in `src/mainview/`.
2. **State Mirroring**: Ensure the GUI reflects the same state as the ASCII interface.
3. **Visual Labeling**: Add optional "AI Labels" (the same `[A]`, `[B]` tags) to the GUI to help human observers correlate the two views.
4. **Coordinate Mapping**: If external control is needed, ensure the GUI can report exact element coordinates for the bindings map.

### Phase 4: AI Integration & Testing
1. **Agent Prototype**: Create a small script/tool that uses `mcp2cli` or direct API calls to control the app via the ASCII interface.
2. **Verification**: Confirm the AI can navigate the app and perform tasks using only the ASCII representation.

## Verification & Testing
- **Visual Check**: Side-by-side comparison of the ASCII output and the GUI.
- **Action Log**: Verify that clicking a GUI button has the same effect as sending the corresponding ASCII label command.
- **Latency Test**: Measure the time from ASCII command to state update vs traditional GUI automation.
