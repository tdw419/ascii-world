// tests/agent-observability-docs.test.js
// Verify AGENT-OBSERVABILITY.md documentation accuracy

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOC_PATH = join(__dirname, '..', 'docs', 'AGENT-OBSERVABILITY.md');

describe('Agent Observability Documentation', () => {
    it('should exist at docs/AGENT-OBSERVABILITY.md', () => {
        assert.ok(existsSync(DOC_PATH), 'docs/AGENT-OBSERVABILITY.md must exist');
    });

    const content = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, 'utf-8') : '';

    it('should document the Agent Registry API endpoints', () => {
        assert.ok(content.includes('POST /api/v1/agents'), 'documents POST /api/v1/agents');
        assert.ok(content.includes('GET /api/v1/agents'), 'documents GET /api/v1/agents');
        assert.ok(content.includes('DELETE /api/v1/agents'), 'documents DELETE /api/v1/agents');
        assert.ok(content.includes('/heartbeat'), 'documents heartbeat endpoint');
    });

    it('should document the Agent Logs API endpoints', () => {
        assert.ok(content.includes('/logs') && content.includes('POST'), 'documents POST logs');
        assert.ok(content.includes('/logs') && content.includes('GET'), 'documents GET logs');
    });

    it('should document the Agent Metrics API endpoints', () => {
        assert.ok(content.includes('/metrics') && content.includes('POST'), 'documents POST metrics');
        assert.ok(content.includes('/metrics') && content.includes('GET'), 'documents GET metrics');
        assert.ok(content.includes('/history'), 'documents metric history endpoint');
    });

    it('should document the Task Assignment API', () => {
        assert.ok(content.includes('/tasks'), 'documents task assignment');
    });

    it('should document all four built-in alert rules', () => {
        assert.ok(content.includes('agent-down'), 'documents agent-down rule');
        assert.ok(content.includes('agent-heartbeat-miss'), 'documents agent-heartbeat-miss rule');
        assert.ok(content.includes('agent-error-spike'), 'documents agent-error-spike rule');
        assert.ok(content.includes('agent-timeout'), 'documents agent-timeout rule');
    });

    it('should document alert rule severity levels', () => {
        assert.ok(content.includes('critical'), 'documents critical severity');
        assert.ok(content.includes('warning'), 'documents warning severity');
    });

    it('should document alert rule configuration options', () => {
        assert.ok(content.includes('heartbeatThresholdMs'), 'documents heartbeat threshold config');
        assert.ok(content.includes('errorSpikeWindowMs'), 'documents error spike window config');
        assert.ok(content.includes('errorSpikeThreshold'), 'documents error spike threshold config');
        assert.ok(content.includes('taskTimeoutMs'), 'documents task timeout config');
    });

    it('should document the Audit Trail API endpoint', () => {
        assert.ok(content.includes('GET /api/v1/audit'), 'documents GET /api/v1/audit');
        assert.ok(content.includes('agentId'), 'documents agentId filter parameter');
        assert.ok(content.includes('limit'), 'documents limit parameter');
    });

    it('should document audit event types', () => {
        assert.ok(content.includes('agent.registered'), 'documents agent.registered event');
        assert.ok(content.includes('agent.status-change'), 'documents agent.status-change event');
        assert.ok(content.includes('agent.heartbeat-lost'), 'documents agent.heartbeat-lost event');
        assert.ok(content.includes('agent.task-assigned'), 'documents agent.task-assigned event');
    });

    it('should document the JSONL storage format', () => {
        assert.ok(content.includes('JSONL') || content.includes('jsonl'), 'documents JSONL format');
        assert.ok(content.includes('audit.jsonl'), 'documents audit file path');
    });

    it('should document programmatic usage examples', () => {
        assert.ok(content.includes('AgentLogStore'), 'documents AgentLogStore usage');
        assert.ok(content.includes('AlertEngine'), 'documents AlertEngine usage');
        assert.ok(content.includes('AuditTrail'), 'documents AuditTrail usage');
        assert.ok(content.includes('AgentRegistry'), 'documents AgentRegistry usage');
    });

    it('should document custom alert rules', () => {
        assert.ok(content.includes('Custom Rules'), 'documents custom rules section');
        assert.ok(content.includes('webhook'), 'documents webhook configuration');
        assert.ok(content.includes('cooldown'), 'documents cooldown configuration');
    });

    it('should document liveness checking behavior', () => {
        assert.ok(content.includes('Liveness'), 'documents liveness checking section');
        assert.ok(content.includes('offline') && content.includes('60'), 'documents 60s offline threshold');
        assert.ok(content.includes('error') && content.includes('120'), 'documents 120s error threshold');
    });

    it('should include a file reference table', () => {
        assert.ok(content.includes('agent-registry.js'), 'references agent-registry.js');
        assert.ok(content.includes('agent-log-store.js'), 'references agent-log-store.js');
        assert.ok(content.includes('alert-engine.js'), 'references alert-engine.js');
        assert.ok(content.includes('audit-trail.js'), 'references audit-trail.js');
    });

    it('should document Alert Engine API endpoints', () => {
        assert.ok(content.includes('GET /api/v1/alerts'), 'documents GET /api/v1/alerts');
        assert.ok(content.includes('POST /api/v1/alerts'), 'documents POST /api/v1/alerts');
        assert.ok(content.includes('/alerts/history'), 'documents alerts/history endpoint');
    });
});
