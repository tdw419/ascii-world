#!/usr/bin/env bun

const CONTROL_API = 'http://localhost:3421';

interface ActionResult {
    label: string;
    action: string;
    success: boolean;
    latencyMs: number;
    state: string;
}

class AIController {
    private history: ActionResult[] = [];

    async getView(): Promise<string> {
        const start = performance.now();
        const res = await fetch(`${CONTROL_API}/view`);
        const text = await res.text();
        const latency = performance.now() - start;
        return text;
    }

    async getState(): Promise<any> {
        const res = await fetch(`${CONTROL_API}/state`);
        return res.json();
    }

    async sendAction(label: string, action: string): Promise<ActionResult> {
        const start = performance.now();
        const res = await fetch(`${CONTROL_API}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label })
        });
        const latency = performance.now() - start;
        
        const result: ActionResult = {
            label,
            action,
            success: res.ok,
            latencyMs: Math.round(latency * 100) / 100,
            state: (await res.json()).newState || 'unknown'
        };
        
        this.history.push(result);
        return result;
    }

    extractLabels(ascii: string): { label: string; text: string }[] {
        const labels: { label: string; text: string }[] = [];
        const regex = /\[([A-Z])\]\s+([^\n\r]+)/g;
        let match;
        
        while ((match = regex.exec(ascii)) !== null) {
            labels.push({
                label: match[1],
                text: match[2].trim()
            });
        }
        
        return labels;
    }

    async explore(maxSteps: number = 10): Promise<void> {
        console.log('\n🤖 AI Controller - Starting Exploration\n');
        console.log('='.repeat(60));

        for (let step = 0; step < maxSteps; step++) {
            const ascii = await this.getView();
            const state = await this.getState();
            
            console.log(`\n📍 Step ${step + 1}: Current State = ${state.state}`);
            
            const labels = this.extractLabels(ascii);
            
            if (labels.length === 0) {
                console.log('No interactive labels found.');
                break;
            }

            // Simple AI: pick a random available action
            const choice = labels[Math.floor(Math.random() * labels.length)];
            console.log(`🎯 Selected: [${choice.label}] ${choice.text}`);

            const result = await this.sendAction(choice.label, choice.text);
            console.log(`⏱️  Latency: ${result.latencyMs}ms | New State: ${result.state}`);
            
            // Small delay between actions
            await new Promise(r => setTimeout(r, 100));
        }

        console.log('\n' + '='.repeat(60));
        console.log('\n📊 Session Summary:\n');
        console.log(`Total Actions: ${this.history.length}`);
        
        if (this.history.length > 0) {
            const avgLatency = this.history.reduce((a, b) => a + b.latencyMs, 0) / this.history.length;
            const minLatency = Math.min(...this.history.map(h => h.latencyMs));
            const maxLatency = Math.max(...this.history.map(h => h.latencyMs));
            
            console.log(`Avg Latency:  ${avgLatency.toFixed(2)}ms`);
            console.log(`Min Latency:  ${minLatency.toFixed(2)}ms`);
            console.log(`Max Latency:  ${maxLatency.toFixed(2)}ms`);
        }

        console.log('\n🗺️  State Transitions:\n');
        this.history.forEach((h, i) => {
            console.log(`  ${i + 1}. [${h.label}] → ${h.state} (${h.latencyMs}ms)`);
        });
    }

    async measureLatency(iterations: number = 20): Promise<void> {
        console.log(`\n📈 Latency Test (${iterations} iterations)...\n`);
        
        const latencies: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await this.getState();
            latencies.push(performance.now() - start);
        }

        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const sorted = latencies.sort((a, b) => a - b);
        const p50 = sorted[Math.floor(sorted.length * 0.5)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];

        console.log('┌─────────────┬────────────┐');
        console.log('│ Metric      │ Value      │');
        console.log('├─────────────┼────────────┤');
        console.log(`│ Average     │ ${avg.toFixed(2).padStart(8)}ms │`);
        console.log(`│ P50         │ ${p50.toFixed(2).padStart(8)}ms │`);
        console.log(`│ P95         │ ${p95.toFixed(2).padStart(8)}ms │`);
        console.log(`│ P99         │ ${p99.toFixed(2).padStart(8)}ms │`);
        console.log('└─────────────┴────────────┘');
    }
}

const controller = new AIController();

const args = process.argv.slice(2);
const command = args[0] || 'explore';

if (command === 'explore') {
    controller.explore(10);
} else if (command === 'latency') {
    controller.measureLatency(20);
} else if (command === 'both') {
    controller.explore(5).then(() => controller.measureLatency(20));
} else {
    console.log('Usage:');
    console.log('  bun run ai-controller.ts explore   # Run exploration demo');
    console.log('  bun run ai-controller.ts latency   # Measure API latency');
    console.log('  bun run ai-controller.ts both      # Run both tests');
}
