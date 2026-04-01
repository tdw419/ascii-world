// tests/agent-registry.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AgentRegistry } from '../sync/agent-registry.js';
import { Agent } from '../sync/agent-model.js';

const TMP_DIR = join('/tmp', `agent-registry-test-${Date.now()}`);
const TMP_FILE = join(TMP_DIR, 'agents.json');

function createRegistry() {
    return new AgentRegistry({ filePath: TMP_FILE });
}

describe('AgentRegistry', () => {
    beforeEach(() => {
        mkdirSync(TMP_DIR, { recursive: true });
    });

    afterEach(() => {
        rmSync(TMP_DIR, { recursive: true, force: true });
    });

    describe('register()', () => {
        it('creates and stores a valid agent', () => {
            const reg = createRegistry();
            const { agent, errors } = reg.register({ name: 'Alpha' });
            assert.deepStrictEqual(errors, []);
            assert.ok(agent instanceof Agent);
            assert.equal(agent.name, 'Alpha');
            assert.equal(reg.get(agent.id).name, 'Alpha');
        });

        it('rejects invalid data and returns errors', () => {
            const reg = createRegistry();
            const { agent, errors } = reg.register({});
            assert.equal(agent, null);
            assert.ok(errors.length > 0);
        });

        it('persists the agent to disk', () => {
            const reg = createRegistry();
            reg.register({ name: 'Beta', capabilities: ['x'] });
            assert.ok(existsSync(TMP_FILE));
            const arr = JSON.parse(readFileSync(TMP_FILE, 'utf-8'));
            assert.equal(arr.length, 1);
            assert.equal(arr[0].name, 'Beta');
        });

        it('assigns a UUID if no id given', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'Gamma' });
            assert.match(agent.id, /^[0-9a-f-]{36}$/);
        });

        it('uses a provided id', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ id: 'custom-1', name: 'Delta' });
            assert.equal(agent.id, 'custom-1');
        });
    });

    describe('get()', () => {
        it('returns the agent by id', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'Epsilon' });
            assert.equal(reg.get(agent.id), agent);
        });

        it('returns null for unknown id', () => {
            const reg = createRegistry();
            assert.equal(reg.get('nope'), null);
        });
    });

    describe('list()', () => {
        it('returns empty array when no agents', () => {
            const reg = createRegistry();
            assert.deepStrictEqual(reg.list(), []);
        });

        it('returns all registered agents', () => {
            const reg = createRegistry();
            reg.register({ name: 'A' });
            reg.register({ name: 'B' });
            const agents = reg.list();
            assert.equal(agents.length, 2);
            const names = agents.map(a => a.name).sort();
            assert.deepStrictEqual(names, ['A', 'B']);
        });
    });

    describe('heartbeat()', () => {
        it('updates lastHeartbeat and sets status to online', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'HBeat' });
            const before = agent.lastHeartbeat;
            // Small delay so timestamp differs
            const result = reg.heartbeat(agent.id);
            assert.equal(result, true);
            assert.equal(agent.status, 'online');
            assert.ok(agent.lastHeartbeat !== before);
        });

        it('returns false for unknown id', () => {
            const reg = createRegistry();
            assert.equal(reg.heartbeat('missing'), false);
        });
    });

    describe('update()', () => {
        it('patches individual fields', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'Original' });
            const updated = reg.update(agent.id, { name: 'Patched', status: 'error' });
            assert.equal(updated.name, 'Patched');
            assert.equal(updated.status, 'error');
        });

        it('returns null for unknown id', () => {
            const reg = createRegistry();
            assert.equal(reg.update('missing', { name: 'X' }), null);
        });

        it('deep-copies capabilities and config', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'Copy' });
            const caps = ['a'];
            const cfg = { k: 1 };
            reg.update(agent.id, { capabilities: caps, config: cfg });
            caps.push('b');
            cfg.k = 99;
            assert.deepStrictEqual(agent.capabilities, ['a']);
            assert.deepStrictEqual(agent.config, { k: 1 });
        });

        it('ignores unknown fields', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'Stable' });
            reg.update(agent.id, { bogus: 42 });
            assert.equal(agent.bogus, undefined);
        });
    });

    describe('remove()', () => {
        it('deletes an agent and returns true', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'Bye' });
            assert.equal(reg.remove(agent.id), true);
            assert.equal(reg.get(agent.id), null);
            assert.equal(reg.list().length, 0);
        });

        it('returns false for unknown id', () => {
            const reg = createRegistry();
            assert.equal(reg.remove('ghost'), false);
        });

        it('persists removal to disk', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'DiskBye' });
            reg.remove(agent.id);
            const arr = JSON.parse(readFileSync(TMP_FILE, 'utf-8'));
            assert.equal(arr.length, 0);
        });
    });

    describe('load()', () => {
        it('loads agents from the JSON file', () => {
            // Write a file manually
            mkdirSync(TMP_DIR, { recursive: true });
            const agent = new Agent({ name: 'Loaded', status: 'online' });
            writeFileSync(TMP_FILE, JSON.stringify([agent.toJSON()]));

            const reg = createRegistry();
            reg.load();
            assert.equal(reg.list().length, 1);
            assert.equal(reg.list()[0].name, 'Loaded');
        });

        it('handles missing file gracefully', () => {
            const reg = new AgentRegistry({ filePath: '/tmp/no-such-dir/agents.json' });
            reg.load(); // should not throw
            assert.equal(reg.list().length, 0);
        });

        it('handles corrupt JSON gracefully', () => {
            mkdirSync(TMP_DIR, { recursive: true });
            writeFileSync(TMP_FILE, 'not json {{{');
            const reg = createRegistry();
            reg.load(); // should not throw
            assert.equal(reg.list().length, 0);
        });

        it('handles non-array JSON gracefully', () => {
            mkdirSync(TMP_DIR, { recursive: true });
            writeFileSync(TMP_FILE, '{"not":"array"}');
            const reg = createRegistry();
            reg.load();
            assert.equal(reg.list().length, 0);
        });
    });

    describe('round-trip (register -> persist -> load)', () => {
        it('survives a full round-trip', () => {
            const reg1 = createRegistry();
            const { agent: a1 } = reg1.register({
                name: 'RoundTrip',
                capabilities: ['fly'],
                config: { speed: 5 },
            });
            reg1.heartbeat(a1.id);

            // New registry instance loads from same file
            const reg2 = createRegistry();
            reg2.load();
            const loaded = reg2.get(a1.id);
            assert.ok(loaded);
            assert.equal(loaded.name, 'RoundTrip');
            assert.deepStrictEqual(loaded.capabilities, ['fly']);
            assert.deepStrictEqual(loaded.config, { speed: 5 });
            assert.equal(loaded.status, 'online');
        });
    });

    describe('liveness check', () => {
        it('marks online agent as offline when heartbeat >60s old', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'Stale' });
            // Set heartbeat to 61s ago
            agent.lastHeartbeat = new Date(Date.now() - 61_000).toISOString();
            agent.status = 'online';

            reg._checkLiveness();

            assert.equal(agent.status, 'offline');
        });

        it('marks agent as error when heartbeat >120s old', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'Dead' });
            // Set heartbeat to 121s ago
            agent.lastHeartbeat = new Date(Date.now() - 121_000).toISOString();
            agent.status = 'online';

            reg._checkLiveness();

            assert.equal(agent.status, 'error');
        });

        it('does not downgrade error to offline', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'AlreadyErr' });
            agent.lastHeartbeat = new Date(Date.now() - 90_000).toISOString();
            agent.status = 'error';

            reg._checkLiveness();

            // 90s is >60s but <120s — should stay error, not go to offline
            assert.equal(agent.status, 'error');
        });

        it('does not touch agents with no heartbeat', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'Fresh' });
            assert.equal(agent.lastHeartbeat, null);
            assert.equal(agent.status, 'offline'); // default status

            reg._checkLiveness();

            assert.equal(agent.status, 'offline');
        });

        it('does not touch agents with fresh heartbeat', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'Alive' });
            reg.heartbeat(agent.id);

            reg._checkLiveness();

            assert.equal(agent.status, 'online');
        });

        it('emits agent:offline event on transition', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'GoingOff' });
            agent.lastHeartbeat = new Date(Date.now() - 61_000).toISOString();
            agent.status = 'online';

            let fired = false;
            let detail = null;
            reg.addEventListener('agent:offline', (e) => {
                fired = true;
                detail = e.detail;
            });

            reg._checkLiveness();

            assert.equal(fired, true);
            assert.equal(detail.agent.id, agent.id);
            assert.equal(detail.agent.status, 'offline');
        });

        it('emits agent:error event on transition', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'GoingErr' });
            agent.lastHeartbeat = new Date(Date.now() - 121_000).toISOString();
            agent.status = 'online';

            let fired = false;
            let detail = null;
            reg.addEventListener('agent:error', (e) => {
                fired = true;
                detail = e.detail;
            });

            reg._checkLiveness();

            assert.equal(fired, true);
            assert.equal(detail.agent.id, agent.id);
            assert.equal(detail.agent.status, 'error');
        });

        it('does not emit if status has not changed', () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'AlreadyOff' });
            agent.lastHeartbeat = new Date(Date.now() - 61_000).toISOString();
            agent.status = 'offline'; // already offline

            let offlineFired = false;
            reg.addEventListener('agent:offline', () => { offlineFired = true; });

            reg._checkLiveness();

            assert.equal(offlineFired, false);
        });

        it('startLivenessCheck runs periodically', async () => {
            const reg = createRegistry();
            const { agent } = reg.register({ name: 'Timer' });
            agent.lastHeartbeat = new Date(Date.now() - 61_000).toISOString();
            agent.status = 'online';

            // Use a very short interval for testing
            reg.startLivenessCheck(50);

            await new Promise(r => setTimeout(r, 120));
            assert.equal(agent.status, 'offline');
            reg.stopLivenessCheck();
        });

        it('stopLivenessCheck stops the timer', () => {
            const reg = createRegistry();
            reg.startLivenessCheck(50);
            assert.ok(reg._livenessTimer !== null);
            reg.stopLivenessCheck();
            assert.equal(reg._livenessTimer, null);
        });

        it('startLivenessCheck replaces existing timer', () => {
            const reg = createRegistry();
            reg.startLivenessCheck(1000);
            const firstTimer = reg._livenessTimer;
            reg.startLivenessCheck(500);
            assert.notEqual(reg._livenessTimer, firstTimer);
            reg.stopLivenessCheck();
        });
    });
});
