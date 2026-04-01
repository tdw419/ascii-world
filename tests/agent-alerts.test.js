// tests/agent-alerts.test.js
// Tests for agent-down, heartbeat-miss, and error-spike alert rules

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AlertEngine, builtinAgentRules } from '../sync/alert-engine.js';
import { AgentLogStore } from '../sync/agent-log-store.js';

describe('Agent Alert Rules', () => {
    let engine;
    let alerts;

    beforeEach(() => {
        engine = new AlertEngine();
        alerts = [];
        engine.addNotifier((alert) => alerts.push(alert));
    });

    describe('agent-down rule', () => {
        it('triggers for agent with offline status', () => {
            engine.setRules(builtinAgentRules());
            const triggered = engine.checkAgents([
                { id: 'a1', name: 'OffBot', status: 'offline' },
            ]);
            assert.equal(triggered.length, 1);
            assert.equal(triggered[0].rule, 'agent-down');
            assert.equal(triggered[0].agentId, 'a1');
            assert.equal(triggered[0].severity, 'critical');
        });

        it('triggers for agent with error status', () => {
            engine.setRules(builtinAgentRules());
            const triggered = engine.checkAgents([
                { id: 'a2', name: 'ErrBot', status: 'error' },
            ]);
            assert.equal(triggered.length, 1);
            assert.equal(triggered[0].rule, 'agent-down');
        });

        it('does not trigger for online agent', () => {
            engine.setRules(builtinAgentRules());
            const triggered = engine.checkAgents([
                { id: 'a3', name: 'OkBot', status: 'online' },
            ]);
            const down = triggered.filter(a => a.rule === 'agent-down');
            assert.equal(down.length, 0);
        });

        it('does not trigger for idle agent', () => {
            engine.setRules(builtinAgentRules());
            const triggered = engine.checkAgents([
                { id: 'a4', name: 'IdleBot', status: 'idle' },
            ]);
            const down = triggered.filter(a => a.rule === 'agent-down');
            assert.equal(down.length, 0);
        });

        it('notifier receives the alert', () => {
            engine.setRules(builtinAgentRules());
            engine.checkAgents([{ id: 'n1', name: 'NotifBot', status: 'offline' }]);
            assert.equal(alerts.length, 1);
            assert.equal(alerts[0].rule, 'agent-down');
            assert.equal(alerts[0].scope, 'agent');
        });

        it('respects per-agent cooldown', () => {
            engine.setRules(builtinAgentRules());
            const agent = { id: 'cd1', name: 'CoolBot', status: 'offline' };
            const t1 = engine.checkAgents([agent]);
            assert.equal(t1.length, 1);
            const t2 = engine.checkAgents([agent]);
            assert.equal(t2.length, 0);
        });

        it('different agents can trigger independently', () => {
            engine.setRules(builtinAgentRules());
            const a1 = { id: 'ind1', name: 'A', status: 'offline' };
            const a2 = { id: 'ind2', name: 'B', status: 'error' };
            const t1 = engine.checkAgents([a1]);
            assert.equal(t1.length, 1);
            // a2 should still trigger even though a1 is in cooldown
            const t2 = engine.checkAgents([a2]);
            assert.equal(t2.length, 1);
        });

        it('alert includes agentName', () => {
            engine.setRules(builtinAgentRules());
            const triggered = engine.checkAgents([
                { id: 'named', name: 'ImportantAgent', status: 'error' },
            ]);
            assert.equal(triggered[0].agentName, 'ImportantAgent');
        });

        it('does not trigger when disabled', () => {
            const rules = builtinAgentRules();
            rules.find(r => r.name === 'agent-down').enabled = false;
            engine.setRules(rules);
            const triggered = engine.checkAgents([
                { id: 'dis1', name: 'DisabledBot', status: 'offline' },
            ]);
            assert.equal(triggered.length, 0);
        });

        it('alert appears in engine history', () => {
            engine.setRules(builtinAgentRules());
            engine.checkAgents([{ id: 'hist1', name: 'HistBot', status: 'offline' }]);
            const history = engine.getHistory();
            const down = history.find(h => h.rule === 'agent-down');
            assert.ok(down);
            assert.equal(down.agentId, 'hist1');
        });
    });

    describe('agent-heartbeat-miss rule', () => {
        it('triggers when heartbeat exceeds threshold', () => {
            engine.setRules(builtinAgentRules({ heartbeatThresholdMs: 5000 }));
            const triggered = engine.checkAgents([{
                id: 'h1',
                name: 'StaleBot',
                status: 'online',
                lastHeartbeat: new Date(Date.now() - 10000).toISOString(),
            }]);
            const hb = triggered.filter(a => a.rule === 'agent-heartbeat-miss');
            assert.equal(hb.length, 1);
            assert.equal(hb[0].severity, 'warning');
        });

        it('does not trigger for fresh heartbeat', () => {
            engine.setRules(builtinAgentRules({ heartbeatThresholdMs: 60000 }));
            const triggered = engine.checkAgents([{
                id: 'h2',
                name: 'FreshBot',
                status: 'online',
                lastHeartbeat: new Date().toISOString(),
            }]);
            const hb = triggered.filter(a => a.rule === 'agent-heartbeat-miss');
            assert.equal(hb.length, 0);
        });

        it('does not trigger when lastHeartbeat is null', () => {
            engine.setRules(builtinAgentRules());
            const triggered = engine.checkAgents([{
                id: 'h3', name: 'NoHBBot', status: 'online', lastHeartbeat: null,
            }]);
            const hb = triggered.filter(a => a.rule === 'agent-heartbeat-miss');
            assert.equal(hb.length, 0);
        });

        it('does not trigger when lastHeartbeat is undefined', () => {
            engine.setRules(builtinAgentRules());
            const triggered = engine.checkAgents([{
                id: 'h4', name: 'UndefinedHBBot', status: 'online',
            }]);
            const hb = triggered.filter(a => a.rule === 'agent-heartbeat-miss');
            assert.equal(hb.length, 0);
        });

        it('uses custom threshold from config', () => {
            engine.setRules(builtinAgentRules({ heartbeatThresholdMs: 100 }));
            const triggered = engine.checkAgents([{
                id: 'h5',
                name: 'QuickBot',
                status: 'online',
                lastHeartbeat: new Date(Date.now() - 200).toISOString(),
            }]);
            const hb = triggered.filter(a => a.rule === 'agent-heartbeat-miss');
            assert.equal(hb.length, 1);
        });

        it('respects per-agent cooldown', () => {
            engine.setRules(builtinAgentRules({ heartbeatThresholdMs: 100 }));
            const agent = {
                id: 'hc1',
                name: 'CoolHBBot',
                status: 'online',
                lastHeartbeat: new Date(Date.now() - 500).toISOString(),
            };
            const t1 = engine.checkAgents([agent]);
            const hb1 = t1.filter(a => a.rule === 'agent-heartbeat-miss');
            assert.equal(hb1.length, 1);
            const t2 = engine.checkAgents([agent]);
            const hb2 = t2.filter(a => a.rule === 'agent-heartbeat-miss');
            assert.equal(hb2.length, 0);
        });
    });

    describe('agent-error-spike rule', () => {
        it('triggers when error count exceeds threshold in window', () => {
            engine.setRules(builtinAgentRules({ errorSpikeThreshold: 3, errorSpikeWindowMs: 60000 }));
            const logStore = new AgentLogStore();
            for (let i = 0; i < 5; i++) {
                logStore.append('sp1', { level: 'error', message: `err-${i}` });
            }
            const triggered = engine.checkAgents(
                [{ id: 'sp1', name: 'SpikeBot', status: 'online' }],
                logStore,
            );
            const spike = triggered.filter(a => a.rule === 'agent-error-spike');
            assert.equal(spike.length, 1);
            assert.equal(spike[0].severity, 'critical');
        });

        it('does not trigger when errors are below threshold', () => {
            engine.setRules(builtinAgentRules({ errorSpikeThreshold: 10, errorSpikeWindowMs: 60000 }));
            const logStore = new AgentLogStore();
            for (let i = 0; i < 3; i++) {
                logStore.append('sp2', { level: 'error', message: `err-${i}` });
            }
            const triggered = engine.checkAgents(
                [{ id: 'sp2', name: 'LowErrBot', status: 'online' }],
                logStore,
            );
            const spike = triggered.filter(a => a.rule === 'agent-error-spike');
            assert.equal(spike.length, 0);
        });

        it('does not trigger without a log store', () => {
            engine.setRules(builtinAgentRules());
            const triggered = engine.checkAgents([
                { id: 'sp3', name: 'NoLogBot', status: 'online' },
            ]);
            const spike = triggered.filter(a => a.rule === 'agent-error-spike');
            assert.equal(spike.length, 0);
        });

        it('ignores errors outside the time window', () => {
            engine.setRules(builtinAgentRules({ errorSpikeThreshold: 2, errorSpikeWindowMs: 1000 }));
            const logStore = new AgentLogStore();
            // Manually inject old errors
            logStore._buffers.set('sp4', [
                { timestamp: Date.now() - 10000, level: 'error', message: 'old1' },
                { timestamp: Date.now() - 10000, level: 'error', message: 'old2' },
                { timestamp: Date.now() - 10000, level: 'error', message: 'old3' },
            ]);
            const triggered = engine.checkAgents(
                [{ id: 'sp4', name: 'WindowBot', status: 'online' }],
                logStore,
            );
            const spike = triggered.filter(a => a.rule === 'agent-error-spike');
            assert.equal(spike.length, 0);
        });

        it('only counts error-level entries, not info or warn', () => {
            engine.setRules(builtinAgentRules({ errorSpikeThreshold: 2, errorSpikeWindowMs: 60000 }));
            const logStore = new AgentLogStore();
            logStore.append('sp5', { level: 'info', message: 'info1' });
            logStore.append('sp5', { level: 'warn', message: 'warn1' });
            logStore.append('sp5', { level: 'info', message: 'info2' });
            const triggered = engine.checkAgents(
                [{ id: 'sp5', name: 'MixedBot', status: 'online' }],
                logStore,
            );
            const spike = triggered.filter(a => a.rule === 'agent-error-spike');
            assert.equal(spike.length, 0);
        });

        it('counts only errors for the specific agent', () => {
            engine.setRules(builtinAgentRules({ errorSpikeThreshold: 2, errorSpikeWindowMs: 60000 }));
            const logStore = new AgentLogStore();
            // Errors for different agent
            logStore.append('other', { level: 'error', message: 'other err' });
            logStore.append('other', { level: 'error', message: 'other err 2' });
            logStore.append('other', { level: 'error', message: 'other err 3' });
            // Few errors for target agent
            logStore.append('sp6', { level: 'error', message: 'my err' });

            const triggered = engine.checkAgents(
                [{ id: 'sp6', name: 'TargetBot', status: 'online' }],
                logStore,
            );
            const spike = triggered.filter(a => a.rule === 'agent-error-spike');
            assert.equal(spike.length, 0);
        });

        it('notifier receives error-spike alert', () => {
            engine.setRules(builtinAgentRules({ errorSpikeThreshold: 2, errorSpikeWindowMs: 60000 }));
            const logStore = new AgentLogStore();
            logStore.append('sp7', { level: 'error', message: 'e1' });
            logStore.append('sp7', { level: 'error', message: 'e2' });
            logStore.append('sp7', { level: 'error', message: 'e3' });
            engine.checkAgents([{ id: 'sp7', name: 'NotifyBot', status: 'online' }], logStore);
            const spikeAlerts = alerts.filter(a => a.rule === 'agent-error-spike');
            assert.equal(spikeAlerts.length, 1);
        });
    });

    describe('multiple rules triggering together', () => {
        it('agent-down and heartbeat-miss can both trigger', () => {
            engine.setRules(builtinAgentRules({ heartbeatThresholdMs: 1000 }));
            const triggered = engine.checkAgents([{
                id: 'multi1',
                name: 'MultiBot',
                status: 'offline',
                lastHeartbeat: new Date(Date.now() - 5000).toISOString(),
            }]);
            const names = triggered.map(a => a.rule);
            assert.ok(names.includes('agent-down'));
            assert.ok(names.includes('agent-heartbeat-miss'));
        });

        it('agent-down and error-spike can both trigger', () => {
            engine.setRules(builtinAgentRules({ errorSpikeThreshold: 2, errorSpikeWindowMs: 60000 }));
            const logStore = new AgentLogStore();
            logStore.append('multi2', { level: 'error', message: 'e1' });
            logStore.append('multi2', { level: 'error', message: 'e2' });
            logStore.append('multi2', { level: 'error', message: 'e3' });
            const triggered = engine.checkAgents(
                [{ id: 'multi2', name: 'MultiErrBot', status: 'error' }],
                logStore,
            );
            const names = triggered.map(a => a.rule);
            assert.ok(names.includes('agent-down'));
            assert.ok(names.includes('agent-error-spike'));
        });
    });
});
