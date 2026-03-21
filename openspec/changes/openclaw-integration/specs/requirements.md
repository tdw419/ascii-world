# Requirements: OpenClaw Integration

## Functional Requirements

### FR1: Publisher
- MUST publish OpenClaw state to pxOS
- MUST rate-limit to 1Hz
- MUST handle connection errors

### FR2: Template
- MUST show agent count
- MUST show message queue
- MUST show tool calls
- MUST show memory usage

## Test Criteria

Manual testing:
```bash
# Start pxOS
npm start

# Import publisher and test
node -e "
import { OpenClawPublisher } from './integrations/openclaw/publisher.js';
const p = new OpenClawPublisher();
await p.setTemplate();
await p.publish({ agents: [{}, {}], messageQueue: 5, toolCalls: 12, memoryUsage: 45e6, uptime: 3600 });
console.log('Published');
"
```

## Acceptance Criteria

- [x] Publisher module works
- [x] Template configured
- [x] Documentation complete
