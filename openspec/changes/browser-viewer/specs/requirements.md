# Requirements: Browser Viewer

## Functional Requirements

### FR1: Canvas Rendering
- MUST display 480×240 pixel canvas
- MUST render PNG from server
- MUST refresh when cells change

### FR2: WebSocket Connection
- MUST connect to ws://localhost:3839
- MUST handle incoming cell updates
- MUST auto-reconnect on disconnect

### FR3: Status Display
- MUST show connection state
- MUST show last update timestamp
- MUST show current cell values

### FR4: No Build Step
- MUST work as single HTML file
- MUST work from file:// URL
- MUST have no external dependencies

## Non-Functional Requirements

### NFR1: Performance
- MUST render PNG in <100ms
- MUST handle rapid updates (10/sec)

### NFR2: Usability
- MUST be visually clear
- MUST have readable fonts
- MUST have responsive layout

## Test Criteria

Manual testing:
1. Start server: `npm start`
2. Open viewer.html in browser
3. Verify "Connected" status shows
4. Post cells: `curl -X POST http://localhost:3839/api/v1/cells -d '{"cpu":0.5}'`
5. Verify canvas updates
6. Stop server, verify "Disconnected" shows
7. Restart server, verify auto-reconnect

## Acceptance Criteria

- [ ] Single HTML file with no dependencies
- [ ] Canvas renders PNG from server
- [ ] WebSocket shows live updates
- [ ] Status bar shows connection state
- [ ] Cell inspector shows values
- [ ] Auto-reconnects on disconnect
