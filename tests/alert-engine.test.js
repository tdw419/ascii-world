// tests/alert-engine.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { AlertEngine } from '../sync/alert-engine.js';

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
});
