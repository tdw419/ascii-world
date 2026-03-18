import { BrowserWindow } from "electrobun/bun";
import { StateManager } from "./state-manager";
import { AsciiGenerator } from "./ascii-generator";
import { startControlApi } from "./control-api";
import { join } from "path";

// Initialize core components
const stateManager = new StateManager();
const asciiGenerator = new AsciiGenerator();

// Start the Control API for AI interaction
startControlApi(stateManager, asciiGenerator);

// Create the main application window
const mainWindow = new BrowserWindow({
	title: "ASCII Reference App",
	url: "views://mainview/index.html",
	frame: {
		width: 1024,
		height: 768,
		x: 100,
		y: 100,
	},
});

// Sync state with the GUI (Phase 3 will expand this)
// For now, we just pass the current state to the webview
mainWindow.on('ready', () => {
    console.log("Main window is ready.");
    updateGui();
});

function updateGui() {
    const data = stateManager.getData();
    const ascii = asciiGenerator.render(stateManager);
    
    // Send data to the webview
    // We use Electrobun's RPC or a simple executeJavaScript
    mainWindow.webview.executeJavaScript(`
        if (window.updateState) {
            window.updateState(${JSON.stringify(data)}, \`${ascii}\`);
        }
    `);
}

// In a real app, we'd listen for state changes and update the GUI
// For this demo, we can just poll or update after each action
setInterval(updateGui, 1000);

console.log("ASCII Reference App initialized with Control API.");
