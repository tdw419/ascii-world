// tests/agent-model.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from '../sync/agent-model.js';

describe('Agent Model', () => {
    describe('constructor', () => {
        it('creates an agent with defaults', () => {
            const agent = new Agent();
            assert.ok(agent.id, 'id should be generated');
            assert.match(agent.id, /^[0-9a-f-]{36}$/, 'id should be a UUID');
            assert.equal(agent.name, '');
            assert.equal(agent.status, 'offline');
            assert.deepStrictEqual(agent.capabilities, []);
            assert.equal(agent.lastHeartbeat, null);
            assert.deepStrictEqual(agent.config, {});
            assert.ok(agent.createdAt, 'createdAt should be set');
        });

        it('accepts all fields from data', () => {
            const ts = new Date().toISOString();
            const agent = new Agent({
                id: 'test-id-123',
                name: 'Alpha',
                status: 'online',
                capabilities: ['render', 'compile'],
                lastHeartbeat: ts,
                config: { priority: 1 },
                createdAt: ts,
            });
            assert.equal(agent.id, 'test-id-123');
            assert.equal(agent.name, 'Alpha');
            assert.equal(agent.status, 'online');
            assert.deepStrictEqual(agent.capabilities, ['render', 'compile']);
            assert.equal(agent.lastHeartbeat, ts);
            assert.deepStrictEqual(agent.config, { priority: 1 });
            assert.equal(agent.createdAt, ts);
        });

        it('copies arrays and objects (no shared references)', () => {
            const caps = ['a'];
            const cfg = { k: 1 };
            const agent = new Agent({ capabilities: caps, config: cfg });
            caps.push('b');
            cfg.k = 2;
            assert.deepStrictEqual(agent.capabilities, ['a']);
            assert.deepStrictEqual(agent.config, { k: 1 });
        });
    });

    describe('validate()', () => {
        it('returns empty array for valid data', () => {
            const errors = Agent.validate({ name: 'Bot' });
            assert.deepStrictEqual(errors, []);
        });

        it('returns error for missing name', () => {
            const errors = Agent.validate({});
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('name'));
        });

        it('returns error for empty name', () => {
            const errors = Agent.validate({ name: '   ' });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('name'));
        });

        it('returns error for invalid status', () => {
            const errors = Agent.validate({ name: 'X', status: 'flying' });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('status'));
        });

        it('accepts all valid statuses', () => {
            for (const s of ['online', 'offline', 'error']) {
                assert.deepStrictEqual(Agent.validate({ name: 'X', status: s }), []);
            }
        });

        it('returns error when capabilities is not an array', () => {
            const errors = Agent.validate({ name: 'X', capabilities: 'nope' });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('capabilities'));
        });

        it('returns error when config is not an object', () => {
            const errors = Agent.validate({ name: 'X', config: 'nope' });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('config'));
        });

        it('returns error for null input', () => {
            const errors = Agent.validate(null);
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('required'));
        });

        it('returns multiple errors at once', () => {
            const errors = Agent.validate({ status: 'bad', capabilities: 5, config: true });
            assert.ok(errors.length >= 3);
        });
    });

    describe('toJSON()', () => {
        it('serializes to a plain object with all fields', () => {
            const agent = new Agent({ name: 'Beta', status: 'online', capabilities: ['x'] });
            const json = agent.toJSON();
            assert.equal(typeof json, 'object');
            assert.equal(json.name, 'Beta');
            assert.equal(json.status, 'online');
            assert.deepStrictEqual(json.capabilities, ['x']);
            assert.ok('id' in json);
            assert.ok('lastHeartbeat' in json);
            assert.ok('config' in json);
            assert.ok('createdAt' in json);
        });

        it('returns a copy (no shared references)', () => {
            const agent = new Agent({ capabilities: ['a'], config: { b: 1 } });
            const json = agent.toJSON();
            json.capabilities.push('z');
            json.config.b = 99;
            assert.deepStrictEqual(agent.capabilities, ['a']);
            assert.deepStrictEqual(agent.config, { b: 1 });
        });
    });

    describe('fromJSON()', () => {
        it('reconstructs an Agent from a plain object', () => {
            const original = new Agent({ name: 'Gamma', status: 'error', capabilities: ['y'] });
            const json = original.toJSON();
            const restored = Agent.fromJSON(json);
            assert.ok(restored instanceof Agent);
            assert.equal(restored.id, original.id);
            assert.equal(restored.name, original.name);
            assert.equal(restored.status, original.status);
            assert.deepStrictEqual(restored.capabilities, original.capabilities);
        });

        it('returns null for null/undefined input', () => {
            assert.equal(Agent.fromJSON(null), null);
            assert.equal(Agent.fromJSON(undefined), null);
        });

        it('round-trips cleanly', () => {
            const agent = new Agent({ name: 'Delta', config: { x: 1 } });
            const round = Agent.fromJSON(agent.toJSON());
            assert.deepStrictEqual(round.toJSON(), agent.toJSON());
        });

        it('handles empty object input', () => {
            const restored = Agent.fromJSON({});
            assert.ok(restored instanceof Agent);
            assert.equal(restored.name, '');
            assert.equal(restored.status, 'offline');
            assert.deepStrictEqual(restored.capabilities, []);
        });
    });

    describe('validate() edge cases', () => {
        it('returns error for non-string name (number)', () => {
            const errors = Agent.validate({ name: 42 });
            assert.ok(errors.length >= 1);
            assert.ok(errors[0].includes('name'));
        });

        it('returns error for config as array', () => {
            const errors = Agent.validate({ name: 'X', config: [1, 2] });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('config'));
        });

        it('returns error for config as null', () => {
            const errors = Agent.validate({ name: 'X', config: null });
            assert.equal(errors.length, 1);
            assert.ok(errors[0].includes('config'));
        });

        it('accepts empty capabilities array', () => {
            const errors = Agent.validate({ name: 'X', capabilities: [] });
            assert.deepStrictEqual(errors, []);
        });

        it('accepts empty config object', () => {
            const errors = Agent.validate({ name: 'X', config: {} });
            assert.deepStrictEqual(errors, []);
        });

        it('returns error for undefined input', () => {
            const errors = Agent.validate(undefined);
            assert.ok(errors.length >= 1);
            assert.ok(errors[0].includes('required'));
        });

        it('ignores unknown fields without error', () => {
            const errors = Agent.validate({ name: 'X', extra: 'ignored', meta: true });
            assert.deepStrictEqual(errors, []);
        });
    });
});
