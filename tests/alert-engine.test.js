// tests/alert-engine.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { AlertEngine, builtinAgentRules } from '../sync/alert-engine.js';
import { AgentLogStore } from '../sync/agent-log-store.js';

describe('AlertEngine', () => {
    let engine;
    let alerts;

    beforeEach(() => {
        engine = new AlertEngine();
        alerts = [];
        engine.addNotifier((alert) => alerts.push(alert));
    });

    it('starts with no rules', () => {
        assert.deepStrictEqual(engine.getRules(), []);
    });

    it('setRules stores rules', () => {
        const rules = [{ name: 'high_cpu', cell: 'cpu', operator: '>', threshold: 0.8 }];
        engine.setRules(rules);
        assert.strictEqual(engine.getRules().length, 1);
        assert.strictEqual(engine.getRules()[0].name, 'high_cpu');
    });

    it('check returns empty array when no rules match', () => {
        engine.setRules([{ cell: 'cpu', operator: '>', threshold: 0.9 }]);
        const triggered = engine.check({ cpu: 0.5 });
        assert.deepStrictEqual(triggered, []);
    });

    it('check triggers alert when rule matches', () => {
        engine.setRules([{ name: 'high_cpu', cell: 'cpu', operator: '>', threshold: 0.8 }]);
        const triggered = engine.check({ cpu: 0.9 });
        assert.strictEqual(triggered.length, 1);
        assert.strictEqual(triggered[0].rule, 'high_cpu');
    });

    it('check respects cooldown', () => {
        engine.setRules([{ name: 'high_cpu', cell: 'cpu', operator: '>', threshold: 0.8, cooldown: 60 }]);
        
        // First check triggers
        const t1 = engine.check({ cpu: 0.9 });
        assert.strictEqual(t1.length, 1);
        
        // Second check (same rule, in cooldown) doesn't trigger
        const t2 = engine.check({ cpu: 0.9 });
        assert.strictEqual(t2.length, 0);
    });

    it('check supports different operators', () => {
        engine.setRules([
            { name: 'gt', cell: 'val', operator: '>', threshold: 5 },
            { name: 'lt', cell: 'val', operator: '<', threshold: 5 },
            { name: 'eq', cell: 'val', operator: '==', threshold: 5 },
        ]);

        const triggered = engine.check({ val: 5 });
        assert.strictEqual(triggered.length, 1); // only eq
        assert.strictEqual(triggered[0].rule, 'eq');
    });

    it('notifiers receive alerts', () => {
        engine.setRules([{ name: 'high_cpu', cell: 'cpu', operator: '>', threshold: 0.8 }]);
        engine.check({ cpu: 0.9 });
        assert.strictEqual(alerts.length, 1);
        assert.strictEqual(alerts[0].rule, 'high_cpu');
    });

    it('getHistory returns alert history', () => {
        engine.setRules([{ name: 'high_cpu', cell: 'cpu', operator: '>', threshold: 0.8 }]);
        engine.check({ cpu: 0.9 });
        const history = engine.getHistory();
        assert.strictEqual(history.length, 1);
    });

    it('clearCooldown resets cooldown', () => {
        engine.setRules([{ name: 'high_cpu', cell: 'cpu', operator: '>', threshold: 0.8, cooldown: 60 }]);
        engine.check({ cpu: 0.9 });
        engine.clearCooldown('high_cpu');
        const t2 = engine.check({ cpu: 0.9 });
        assert.strictEqual(t2.length, 1);
    });

    it('disabled rules are skipped', () => {
        engine.setRules([{ name: 'high_cpu', cell: 'cpu', operator: '>', threshold: 0.8, enabled: false }]);
        const triggered = engine.check({ cpu: 0.9 });
        assert.strictEqual(triggered.length, 0);
    });

    it('sendWebhook is called for rules with webhook', async () => {
        let webhookCalled = false;
        let webhookPayload = null;

        // Mock fetch
        const originalFetch = global.fetch;
        global.fetch = async (url, options) => {
            webhookCalled = true;
            webhookPayload = JSON.parse(options.body);
            return { ok: true, status: 200 };
        };

        engine.setRules([{
            name: 'high_cpu',
            cell: 'cpu',
            operator: '>',
            threshold: 0.8,
            webhook: 'https://example.com/webhook'
        }]);

        engine.check({ cpu: 0.9 });

        // Wait for async webhook
        await new Promise(r => setTimeout(r, 100));

        global.fetch = originalFetch;

        assert.ok(webhookCalled, 'Webhook should be called');
        assert.strictEqual(webhookPayload.rule, 'high_cpu');
        assert.strictEqual(webhookPayload.value, 0.9);
    });
});

describe('Agent Alert Rules', () => {
    let engine;
    let alerts;

    beforeEach(() => {
        engine = new AlertEngine();
        alerts = [];
        engine.addNotifier((alert) => alerts.push(alert));
    });

    describe('builtinAgentRules', () => {
        it('returns 4 built-in rules', () => {
            const rules = builtinAgentRules();
            assert.strictEqual(rules.length, 4);
            const names = rules.map(r => r.name);
            assert.ok(names.includes('agent-down'));
            assert.ok(names.includes('agent-heartbeat-miss'));
            assert.ok(names.includes('agent-error-spike'));
            assert.ok(names.includes('agent-timeout'));
        });

        it('all built-in rules have agent scope', () => {
            const rules = builtinAgentRules();
            for (const r of rules) {
                assert.strictEqual(r.scope, 'agent', `${r.name} should have agent scope`);
            }
        });

        it('accepts custom config thresholds', () => {
            const rules = builtinAgentRules({
                heartbeatThresholdMs: 10_000,
                errorSpikeThreshold: 5,
                taskTimeoutMs: 60_000,
            });
            assert.strictEqual(rules[1].heartbeatThresholdMs, 10_000);
            assert.strictEqual(rules[2].errorSpikeThreshold, 5);
            assert.strictEqual(rules[3].taskTimeoutMs, 60_000);
        });
    });

    describe('agent-down rule', () => {
        it('triggers for offline agent', () => {
            engine.setRules(builtinAgentRules());
            const agent = { id: 'a1', name: 'TestBot', status: 'offline' };
            const triggered = engine.checkAgents([agent]);
            assert.strictEqual(triggered.length, 1);
            assert.strictEqual(triggered[0].rule, 'agent-down');
            assert.strictEqual(triggered[0].agentId, 'a1');
        });

        it('triggers for error agent', () => {
            engine.setRules(builtinAgentRules());
            const agent = { id: 'a2', name: 'ErrBot', status: 'error' };
            const triggered = engine.checkAgents([agent]);
            assert.strictEqual(triggered.length, 1);
            assert.strictEqual(triggered[0].rule, 'agent-down');
        });

        it('does not trigger for online agent', () => {
            engine.setRules(builtinAgentRules());
            const agent = { id: 'a3', name: 'OkBot', status: 'online' };
            const triggered = engine.checkAgents([agent]);
            const down = triggered.filter(a => a.rule === 'agent-down');
            assert.strictEqual(down.length, 0);
        });

        it('cooldown is per agent', () => {
            engine.setRules(builtinAgentRules());
            const a1 = { id: 'x', name: 'A', status: 'offline' };
            const a2 = { id: 'y', name: 'B', status: 'error' };
            const t1 = engine.checkAgents([a1, a2]);
            assert.strictEqual(t1.length, 2);
            // Second check same agents — both in cooldown
            const t2 = engine.checkAgents([a1, a2]);
            assert.strictEqual(t2.length, 0);
        });
    });

    describe('agent-heartbeat-miss rule', () => {
        it('triggers when heartbeat is stale', () => {
            const rules = builtinAgentRules({ heartbeatThresholdMs: 1000 });
            engine.setRules(rules);
            const agent = {
                id: 'h1',
                name: 'LateBot',
                status: 'online',
                lastHeartbeat: new Date(Date.now() - 5000).toISOString(),
            };
            const triggered = engine.checkAgents([agent]);
            const hb = triggered.filter(a => a.rule === 'agent-heartbeat-miss');
            assert.strictEqual(hb.length, 1);
        });

        it('does not trigger for fresh heartbeat', () => {
            const rules = builtinAgentRules({ heartbeatThresholdMs: 60_000 });
            engine.setRules(rules);
            const agent = {
                id: 'h2',
                name: 'FreshBot',
                status: 'online',
                lastHeartbeat: new Date().toISOString(),
            };
            const triggered = engine.checkAgents([agent]);
            const hb = triggered.filter(a => a.rule === 'agent-heartbeat-miss');
            assert.strictEqual(hb.length, 0);
        });

        it('does not trigger when no heartbeat exists', () => {
            engine.setRules(builtinAgentRules());
            const agent = { id: 'h3', name: 'NoHB', status: 'online', lastHeartbeat: null };
            const triggered = engine.checkAgents([agent]);
            const hb = triggered.filter(a => a.rule === 'agent-heartbeat-miss');
            assert.strictEqual(hb.length, 0);
        });
    });

    describe('agent-error-spike rule', () => {
        it('triggers when error count exceeds threshold', () => {
            const rules = builtinAgentRules({ errorSpikeThreshold: 3, errorSpikeWindowMs: 60_000 });
            engine.setRules(rules);
            const logStore = new AgentLogStore();
            for (let i = 0; i < 5; i++) {
                logStore.append('sp1', { level: 'error', message: `err-${i}` });
            }
            const agent = { id: 'sp1', name: 'SpikeBot', status: 'online' };
            const triggered = engine.checkAgents([agent], logStore);
            const spike = triggered.filter(a => a.rule === 'agent-error-spike');
            assert.strictEqual(spike.length, 1);
        });

        it('does not trigger when error count is below threshold', () => {
            const rules = builtinAgentRules({ errorSpikeThreshold: 10, errorSpikeWindowMs: 300_000 });
            engine.setRules(rules);
            const logStore = new AgentLogStore();
            for (let i = 0; i < 3; i++) {
                logStore.append('sp2', { level: 'error', message: `err-${i}` });
            }
            const agent = { id: 'sp2', name: 'LowErrBot', status: 'online' };
            const triggered = engine.checkAgents([agent], logStore);
            const spike = triggered.filter(a => a.rule === 'agent-error-spike');
            assert.strictEqual(spike.length, 0);
        });

        it('does not trigger without logStore', () => {
            engine.setRules(builtinAgentRules());
            const agent = { id: 'sp3', name: 'NoLogBot', status: 'online' };
            const triggered = engine.checkAgents([agent]);
            const spike = triggered.filter(a => a.rule === 'agent-error-spike');
            assert.strictEqual(spike.length, 0);
        });

        it('only counts errors within the time window', () => {
            const rules = builtinAgentRules({ errorSpikeThreshold: 2, errorSpikeWindowMs: 1000 });
            engine.setRules(rules);
            const logStore = new AgentLogStore();
            // Old errors (outside window) — inject with past timestamps
            const oldBuf = logStore._buffers;
            oldBuf.set('sp4', [
                { timestamp: Date.now() - 10_000, level: 'error', message: 'old1' },
                { timestamp: Date.now() - 10_000, level: 'error', message: 'old2' },
                { timestamp: Date.now() - 10_000, level: 'error', message: 'old3' },
            ]);
            const agent = { id: 'sp4', name: 'WindowBot', status: 'online' };
            const triggered = engine.checkAgents([agent], logStore);
            const spike = triggered.filter(a => a.rule === 'agent-error-spike');
            assert.strictEqual(spike.length, 0);
        });
    });

    describe('agent-timeout rule', () => {
        it('triggers when task exceeds max duration', () => {
            const rules = builtinAgentRules({ taskTimeoutMs: 1000 });
            engine.setRules(rules);
            const agent = {
                id: 't1',
                name: 'SlowBot',
                status: 'online',
                taskStartedAt: new Date(Date.now() - 5000).toISOString(),
            };
            const triggered = engine.checkAgents([agent]);
            const timeout = triggered.filter(a => a.rule === 'agent-timeout');
            assert.strictEqual(timeout.length, 1);
        });

        it('does not trigger for tasks within duration', () => {
            const rules = builtinAgentRules({ taskTimeoutMs: 60_000 });
            engine.setRules(rules);
            const agent = {
                id: 't2',
                name: 'FastBot',
                status: 'online',
                taskStartedAt: new Date().toISOString(),
            };
            const triggered = engine.checkAgents([agent]);
            const timeout = triggered.filter(a => a.rule === 'agent-timeout');
            assert.strictEqual(timeout.length, 0);
        });

        it('does not trigger for offline agent with taskStartedAt', () => {
            engine.setRules(builtinAgentRules());
            const agent = {
                id: 't3',
                name: 'DoneBot',
                status: 'offline',
                taskStartedAt: new Date(Date.now() - 999_999).toISOString(),
            };
            const triggered = engine.checkAgents([agent]);
            const timeout = triggered.filter(a => a.rule === 'agent-timeout');
            assert.strictEqual(timeout.length, 0);
        });

        it('does not trigger when taskStartedAt is missing', () => {
            engine.setRules(builtinAgentRules());
            const agent = { id: 't4', name: 'NoTaskBot', status: 'online' };
            const triggered = engine.checkAgents([agent]);
            const timeout = triggered.filter(a => a.rule === 'agent-timeout');
            assert.strictEqual(timeout.length, 0);
        });
    });

    describe('checkAgents integration', () => {
        it('agent-scoped rules are skipped in cell check', () => {
            engine.setRules(builtinAgentRules());
            const triggered = engine.check({ cpu: 0.9 });
            assert.strictEqual(triggered.length, 0);
        });

        it('cell-scoped rules are skipped in checkAgents', () => {
            engine.setRules([
                { name: 'high_cpu', cell: 'cpu', operator: '>', threshold: 0.8 },
                ...builtinAgentRules(),
            ]);
            const agent = { id: 'a1', name: 'Bot', status: 'online' };
            const triggered = engine.checkAgents([agent]);
            const cpu = triggered.filter(a => a.rule === 'high_cpu');
            assert.strictEqual(cpu.length, 0);
        });

        it('alerts include agentName', () => {
            engine.setRules(builtinAgentRules());
            const agent = { id: 'named', name: 'ImportantBot', status: 'offline' };
            const triggered = engine.checkAgents([agent]);
            assert.strictEqual(triggered[0].agentName, 'ImportantBot');
        });

        it('alerts include scope field', () => {
            engine.setRules(builtinAgentRules());
            const agent = { id: 's1', name: 'Bot', status: 'error' };
            const triggered = engine.checkAgents([agent]);
            assert.strictEqual(triggered[0].scope, 'agent');
        });

        it('disabled agent rules are skipped', () => {
            const rules = builtinAgentRules();
            // Disable agent-down
            rules[0].enabled = false;
            engine.setRules(rules);
            const agent = { id: 'd1', name: 'DownBot', status: 'offline' };
            const triggered = engine.checkAgents([agent]);
            assert.strictEqual(triggered.length, 0);
        });

        it('agent alerts appear in history', () => {
            engine.setRules(builtinAgentRules());
            const agent = { id: 'h1', name: 'HistBot', status: 'offline' };
            engine.checkAgents([agent]);
            const history = engine.getHistory();
            assert.strictEqual(history.length, 1);
            assert.strictEqual(history[0].rule, 'agent-down');
        });

        it('multiple rules can trigger for same agent', () => {
            const rules = builtinAgentRules({ heartbeatThresholdMs: 1000 });
            engine.setRules(rules);
            const agent = {
                id: 'multi',
                name: 'MultiBot',
                status: 'offline',
                lastHeartbeat: new Date(Date.now() - 5000).toISOString(),
            };
            const triggered = engine.checkAgents([agent]);
            const names = triggered.map(a => a.rule);
            assert.ok(names.includes('agent-down'));
            assert.ok(names.includes('agent-heartbeat-miss'));
        });
    });
});
