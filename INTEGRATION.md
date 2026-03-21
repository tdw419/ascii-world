# pxOS Integration Guide

## OpenClaw Integration

### Quick Start

1. Start pxOS server:
```bash
cd pxos
npm start
```

2. In your OpenClaw Gateway, import the publisher:

```javascript
import { OpenClawPublisher } from './pxos/integrations/openclaw/publisher.js';

const pxos = new OpenClawPublisher('http://localhost:3839');

// Set template on startup
await pxos.setTemplate();

// Publish state periodically
setInterval(async () => {
    await pxos.publish({
        agents: getActiveAgents(),
        messageQueue: getMessageQueue(),
        toolCalls: getToolCalls(),
        memoryUsage: process.memoryUsage().heapUsed,
        uptime: process.uptime(),
    });
}, 1000);
```

3. Open viewer:
```bash
open pxos/viewer/viewer.html
```

### Configuration

Add to `openclaw.json`:

```json
{
  "pxos": {
    "enabled": true,
    "url": "http://localhost:3839",
    "publishInterval": 1000
  }
}
```

### Displayed Metrics

| Metric | Cell | Description |
|--------|------|-------------|
| Agents | `oc_agents` | Active agent count |
| Messages | `oc_messages` | Queue depth |
| Tools | `oc_tools` | Calls per minute |
| Memory | `oc_memory` | Heap usage (MB) |
| Uptime | `oc_uptime` | Gateway uptime |

---

## Custom Integration

### Basic Usage

```javascript
// 1. Set template
await fetch('http://localhost:3839/api/v1/template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
        { fn: 'BAR', args: [0, 0, 'cpu', 40] },
        { fn: 'TEXT', args: [42, 0, 'cpu'] },
    ]),
});

// 2. Publish data
await fetch('http://localhost:3839/api/v1/cells', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpu: 0.75 }),
});

// 3. Get rendered PNG
const res = await fetch('http://localhost:3839/api/v1/render');
const png = await res.arrayBuffer();
```

### WebSocket Updates

```javascript
const ws = new WebSocket('ws://localhost:3839');
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'cells') {
        console.log('Updated cells:', msg.changes);
    }
    if (msg.type === 'alert') {
        console.log('Alert:', msg.alert.message);
    }
};
```

---

## Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3839
CMD ["node", "bin/pxos-server.js"]
```

```bash
docker build -t pxos .
docker run -p 3839:3839 -v $(pwd)/data:/app/data pxos
```

---

## Systemd Service

```ini
[Unit]
Description=pxOS Server
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/pxos
ExecStart=/usr/bin/node bin/pxos-server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable pxos
sudo systemctl start pxos
```
