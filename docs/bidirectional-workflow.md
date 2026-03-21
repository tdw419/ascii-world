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
