// integrations/openclaw/publisher.js
// Publish OpenClaw state to pxOS server

const DEFAULT_URL = 'http://localhost:3839';

export class OpenClawPublisher {
    constructor(pxosUrl = DEFAULT_URL) {
        this.pxosUrl = pxosUrl;
        this.lastPublish = 0;
        this.publishInterval = 1000; // 1 second
    }

    /**
     * Publish OpenClaw state to pxOS.
     */
    async publish(state) {
        const now = Date.now();
        if (now - this.lastPublish < this.publishInterval) {
            return; // Rate limited
        }
        this.lastPublish = now;

        const cells = {
            // Labels
            title: 'OpenClaw Monitor',
            agents_label: 'Agents',
            messages_label: 'Messages',
            tools_label: 'Tools',
            memory_label: 'Memory',
            uptime_label: 'Uptime',
            
            // Values
            oc_agents: state.agents?.length || 0,
            oc_messages: state.messageQueue || 0,
            oc_tools: state.toolCalls || 0,
            oc_memory: Math.round((state.memoryUsage || 0) / 1024 / 1024 * 10) / 10,
            oc_uptime: this.formatUptime(state.uptime || 0),
        };

        try {
            const response = await fetch(`${this.pxosUrl}/api/v1/cells`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cells),
            });
            return response.ok;
        } catch (err) {
            console.error('pxOS publish error:', err.message);
            return false;
        }
    }

    /**
     * Set the pxOS template for OpenClaw monitoring.
     */
    async setTemplate() {
        const template = [
            { fn: 'TEXT', args: [0, 0, 'title'] },
            { fn: 'TIME', args: [70, 0, 'HH:mm:ss'] },
            { fn: 'LINE', args: [0, 1, 80, 'h', 'borderHighlight'] },
            { fn: 'TEXT', args: [0, 2, 'agents_label'] },
            { fn: 'NUMBER', args: [12, 2, 'oc_agents', '0'] },
            { fn: 'TEXT', args: [0, 3, 'messages_label'] },
            { fn: 'NUMBER', args: [12, 3, 'oc_messages', '0'] },
            { fn: 'TEXT', args: [0, 4, 'tools_label'] },
            { fn: 'NUMBER', args: [12, 4, 'oc_tools', '0/min'] },
            { fn: 'TEXT', args: [40, 2, 'memory_label'] },
            { fn: 'NUMBER', args: [52, 2, 'oc_memory', '0.0 MB'] },
            { fn: 'TEXT', args: [40, 3, 'uptime_label'] },
            { fn: 'TEXT', args: [52, 3, 'oc_uptime'] },
        ];

        try {
            const response = await fetch(`${this.pxosUrl}/api/v1/template`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(template),
            });
            return response.ok;
        } catch (err) {
            console.error('pxOS template error:', err.message);
            return false;
        }
    }

    /**
     * Format uptime as human readable string.
     */
    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
}

// Example usage:
// import { OpenClawPublisher } from './integrations/openclaw/publisher.js';
// 
// const publisher = new OpenClawPublisher();
// await publisher.setTemplate();
// 
// setInterval(async () => {
//     await publisher.publish({
//         agents: getActiveAgents(),
//         messageQueue: getMessageQueue(),
//         toolCalls: getToolCalls(),
//         memoryUsage: process.memoryUsage().heapUsed,
//         uptime: process.uptime(),
//     });
// }, 1000);
