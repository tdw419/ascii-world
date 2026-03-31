// sync/gpu-agent-bridge.js
// Bridge between pxOS dashboards and GPU computational universe

import { spawn, exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ASCII glyph → opcode mapping
const GLYPH_TO_OPCODE = {
    '-': 0x01,  // MOVE_RIGHT (horizontal wire)
    '|': 0x02,  // MOVE_DOWN (vertical wire)
    '&': 0x04,  // AND gate
    'X': 0x05,  // XOR gate
    '*': 0x07,  // REPLICATE
    '@': 0x08,  // INFECT
    '+': 0x10,  // EMIT_SIGNAL
    '!': 0x11,  // SLEEP
    '>': 0x12,  // DIODE (one-way right)
    '<': 0x13,  // DIODE (one-way left)
    '^': 0x14,  // DIODE (one-way up)
    'v': 0x15,  // DIODE (one-way down)
    '?': 0x20,  // RANDOM
    'R': 0x03,  // READ_N
    'r': 0x03,  // READ_N (alias)
};

// Opcode → ASCII glyph mapping (reverse)
const OPCODE_TO_GLYPH = Object.fromEntries(
    Object.entries(GLYPH_TO_OPCODE).map(([k, v]) => [v, k])
);

// Opcode colors (for visualization)
const OPCODE_COLORS = {
    0x01: '#00FF00', // wire - green
    0x02: '#00FF00', // wire - green
    0x04: '#00FFFF', // AND - cyan
    0x05: '#FF00FF', // XOR - magenta
    0x07: '#FFFF00', // REPLICATE - yellow
    0x08: '#FF0000', // INFECT - red
    0x10: '#FFFFFF', // SIGNAL - white
    0x11: '#666666', // SLEEP - gray
    0x12: '#00AAFF', // DIODE - blue
    0x20: '#FFAA00', // RANDOM - orange
};

export class GPUAgentBridge {
    constructor(options = {}) {
        this.gpuDir = options.gpuDir || join(__dirname, '../../gpu');
        this.sharedMemPath = options.sharedMemPath || '/tmp/pixel-universe.mem';
        this.width = options.width || 480;
        this.height = options.height || 240;
        this.cellStore = options.cellStore || null;
        
        // State
        this.agentProcess = null;
        this.watcherProcess = null;
        this.isRunning = false;
        this.frameCount = 0;
        this.lastStats = { activePixels: 0, fps: 0 };
        
        // Callbacks
        this.onFrame = options.onFrame || (() => {});
        this.onStats = options.onStats || (() => {});
        this.onError = options.onError || (() => {});
    }

    // ─────────────────────────────────────────────────────
    // Agent Control
    // ─────────────────────────────────────────────────────

    async startAgent() {
        if (this.isRunning) return { alreadyRunning: true };
        
        return new Promise((resolve, reject) => {
            const agentPath = join(this.gpuDir, 'target/release/agent');
            
            this.agentProcess = spawn(agentPath, [], {
                cwd: this.gpuDir,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            this.agentProcess.stdout.on('data', (data) => {
                const output = data.toString();
                // Parse stats from stdout
                const statsMatch = output.match(/Active pixels: (\d+)/);
                if (statsMatch) {
                    this.lastStats.activePixels = parseInt(statsMatch[1]);
                }
                const fpsMatch = output.match(/(\d+) fps/);
                if (fpsMatch) {
                    this.lastStats.fps = parseInt(fpsMatch[1]);
                }
                this.frameCount++;
                this.onStats(this.lastStats);
            });

            this.agentProcess.stderr.on('data', (data) => {
                console.error('[GPU Agent]', data.toString());
            });

            this.agentProcess.on('error', (err) => {
                this.isRunning = false;
                this.onError(err);
                reject(err);
            });

            this.agentProcess.on('close', (code) => {
                this.isRunning = false;
                console.log(`[GPU Agent] Process exited with code ${code}`);
            });

            this.isRunning = true;
            resolve({ started: true, pid: this.agentProcess.pid });
        });
    }

    async stopAgent() {
        if (!this.agentProcess) return { notRunning: true };
        
        return new Promise((resolve) => {
            this.agentProcess.on('close', () => {
                this.agentProcess = null;
                this.isRunning = false;
                resolve({ stopped: true });
            });
            this.agentProcess.kill('SIGTERM');
        });
    }

    // ─────────────────────────────────────────────────────
    // Signal Injection
    // ─────────────────────────────────────────────────────

    async injectSignal(x, y, opcode, r = 255, g = 255, b = 255) {
        const injectorPath = join(this.gpuDir, 'target/release/injector');
        const opcodeNum = typeof opcode === 'string' 
            ? (GLYPH_TO_OPCODE[opcode] || parseInt(opcode) || 0)
            : opcode;

        return new Promise((resolve, reject) => {
            exec(
                `${injectorPath} inject -x ${x} -y ${y} -o ${opcodeNum} -r ${r} -g ${g} -b ${b}`,
                { cwd: this.gpuDir },
                (err, stdout, stderr) => {
                    if (err) reject(err);
                    else resolve({ x, y, opcode: opcodeNum, output: stdout });
                }
            );
        });
    }

    async injectWire(x1, y1, x2, y2, color = '00FF00') {
        const injectorPath = join(this.gpuDir, 'target/release/injector');
        
        return new Promise((resolve, reject) => {
            exec(
                `${injectorPath} wire --x1 ${x1} --y1 ${y1} --x2 ${x2} --y2 ${y2} --color ${color}`,
                { cwd: this.gpuDir },
                (err, stdout, stderr) => {
                    if (err) reject(err);
                    else resolve({ x1, y1, x2, y2, output: stdout });
                }
            );
        });
    }

    async injectGate(type, x, y) {
        const injectorPath = join(this.gpuDir, 'target/release/injector');
        
        return new Promise((resolve, reject) => {
            exec(
                `${injectorPath} ${type}-gate -x ${x} -y ${y}`,
                { cwd: this.gpuDir },
                (err, stdout, stderr) => {
                    if (err) reject(err);
                    else resolve({ type, x, y, output: stdout });
                }
            );
        });
    }

    // ─────────────────────────────────────────────────────
    // Circuit Loading
    // ─────────────────────────────────────────────────────

    async loadCircuit(asciiContent, x = 0, y = 0) {
        // Write ASCII to temp file
        const tempFile = `/tmp/circuit-${Date.now()}.txt`;
        writeFileSync(tempFile, asciiContent);
        
        const scannerPath = join(this.gpuDir, 'target/release/scanner');
        
        return new Promise((resolve, reject) => {
            exec(
                `${scannerPath} load -f ${tempFile} -x ${x} -y ${y}`,
                { cwd: this.gpuDir },
                (err, stdout, stderr) => {
                    // Clean up temp file
                    try { unlinkSync(tempFile); } catch {}
                    
                    if (err) reject(err);
                    else resolve({ loaded: true, x, y, output: stdout });
                }
            );
        });
    }

    async loadCircuitTemplate(templateName, x = 0, y = 0) {
        const templatePath = join(this.gpuDir, `circuits/ascii/${templateName}.txt`);
        
        if (!existsSync(templatePath)) {
            throw new Error(`Template not found: ${templateName}`);
        }
        
        const content = readFileSync(templatePath, 'utf-8');
        return this.loadCircuit(content, x, y);
    }

    // ─────────────────────────────────────────────────────
    // Circuit Scanning
    // ─────────────────────────────────────────────────────

    async scanRegion(x, y, width = 80, height = 24) {
        const scannerPath = join(this.gpuDir, 'target/release/scanner');
        
        return new Promise((resolve, reject) => {
            exec(
                `${scannerPath} scan -x ${x} -y ${y} --width ${width} --height ${height}`,
                { cwd: this.gpuDir },
                (err, stdout, stderr) => {
                    if (err) reject(err);
                    else {
                        // Parse output
                        const lines = stdout.split('\n');
                        const asciiStart = lines.findIndex(l => l.startsWith('┌'));
                        const asciiEnd = lines.findLastIndex(l => l.startsWith('└'));
                        
                        let ascii = '';
                        if (asciiStart >= 0 && asciiEnd > asciiStart) {
                            ascii = lines.slice(asciiStart, asciiEnd + 1).join('\n');
                        }
                        
                        // Parse stats
                        const stats = {};
                        const activeMatch = stdout.match(/Active pixels: (\d+)/);
                        if (activeMatch) stats.activePixels = parseInt(activeMatch[1]);
                        
                        resolve({ ascii, stats, raw: stdout });
                    }
                }
            );
        });
    }

    // ─────────────────────────────────────────────────────
    // Heat-Map Visualization
    // ─────────────────────────────────────────────────────

    async getHeatmap(asciiContent, offsetX = 0, offsetY = 0) {
        // Write ASCII to temp file
        const tempFile = `/tmp/heatmap-${Date.now()}.txt`;
        writeFileSync(tempFile, asciiContent);
        
        const heatmapPath = join(this.gpuDir, 'target/release/heatmap');
        
        return new Promise((resolve, reject) => {
            exec(
                `${heatmapPath} -f ${tempFile} --offset-x ${offsetX} --offset-y ${offsetY} --once`,
                { cwd: this.gpuDir },
                (err, stdout, stderr) => {
                    try { unlinkSync(tempFile); } catch {}
                    
                    if (err) reject(err);
                    else resolve({ heatmap: stdout });
                }
            );
        });
    }

    // ─────────────────────────────────────────────────────
    // Network Bridge
    // ─────────────────────────────────────────────────────

    async startNetworkBridge(port = 7890, offsetX = 0, offsetY = 0) {
        const bridgePath = join(this.gpuDir, 'target/release/bridge');
        
        this.bridgeProcess = spawn(bridgePath, [
            'server',
            '--port', String(port),
            '--offset-x', String(offsetX),
            '--offset-y', String(offsetY)
        ], {
            cwd: this.gpuDir,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        return new Promise((resolve, reject) => {
            this.bridgeProcess.stdout.on('data', (data) => {
                if (data.toString().includes('listening')) {
                    resolve({ started: true, port });
                }
            });

            this.bridgeProcess.stderr.on('data', (data) => {
                console.error('[Network Bridge]', data.toString());
            });

            this.bridgeProcess.on('error', reject);

            // Timeout
            setTimeout(() => resolve({ started: true, port }), 2000);
        });
    }

    async connectToBridge(serverAddr, localX, localY, width, height) {
        const bridgePath = join(this.gpuDir, 'target/release/bridge');
        
        return new Promise((resolve, reject) => {
            exec(
                `${bridgePath} connect --server ${serverAddr} --local-x ${localX} --local-y ${localY} --width ${width} --height ${height}`,
                { cwd: this.gpuDir },
                (err, stdout, stderr) => {
                    if (err) reject(err);
                    else resolve({ connected: true, server: serverAddr });
                }
            );
        });
    }

    // ─────────────────────────────────────────────────────
    // pxOS Cell Integration
    // ─────────────────────────────────────────────────────

    injectFromCell(cellName, value) {
        // Map cell names to GPU coordinates
        // Convention: cell name "gpu_X_Y" → inject at (X, Y)
        const match = cellName.match(/^gpu_(\d+)_(\d+)$/);
        if (!match) return null;
        
        const [, x, y] = match.map(Number);
        
        // Interpret value as opcode or glyph
        const opcode = GLYPH_TO_OPCODE[value] || parseInt(value) || 0x07;
        
        return this.injectSignal(x, y, opcode);
    }

    async syncCellsToGPU(cells) {
        // Find all gpu_* cells and inject them
        const injections = [];
        
        for (const [name, value] of Object.entries(cells)) {
            const match = name.match(/^gpu_(\d+)_(\d+)$/);
            if (match) {
                const [, x, y] = match.map(Number);
                const opcode = GLYPH_TO_OPCODE[value] || parseInt(value) || 0x07;
                injections.push(this.injectSignal(x, y, opcode));
            }
        }
        
        return Promise.all(injections);
    }

    // ─────────────────────────────────────────────────────
    // Dashboard Helpers
    // ─────────────────────────────────────────────────────

    getStats() {
        return {
            isRunning: this.isRunning,
            frameCount: this.frameCount,
            ...this.lastStats
        };
    }

    listCircuitTemplates() {
        const templatesDir = join(this.gpuDir, 'circuits/ascii');
        if (!existsSync(templatesDir)) return [];
        
        const { readdirSync } = require('fs');
        return readdirSync(templatesDir)
            .filter(f => f.endsWith('.txt'))
            .map(f => f.replace('.txt', ''));
    }

    // ─────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────

    async stop() {
        const results = {};
        
        if (this.agentProcess) {
            results.agent = await this.stopAgent();
        }
        
        if (this.bridgeProcess) {
            this.bridgeProcess.kill('SIGTERM');
            results.bridge = { stopped: true };
        }
        
        return results;
    }
}

export { GLYPH_TO_OPCODE, OPCODE_TO_GLYPH, OPCODE_COLORS };
