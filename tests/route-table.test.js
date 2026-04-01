// tests/route-table.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { RouteTable } from '../sync/route-table.js';

describe('RouteTable', () => {
    let table;

    beforeEach(() => {
        table = new RouteTable();
    });

    // ── Registration ──────────────────────────────────────────

    describe('register', () => {
        it('registers a route entry with method, pattern, and handler', () => {
            const handler = () => {};
            table.register('GET', '/api/agents', handler);
            assert.strictEqual(table.entries.length, 1);
            assert.deepStrictEqual(table.entries[0], {
                method: 'GET',
                pattern: '/api/agents',
                handler,
            });
        });

        it('registers multiple routes', () => {
            table.register('GET', '/a', () => {});
            table.register('POST', '/b', () => {});
            assert.strictEqual(table.entries.length, 2);
        });

        it('normalizes leading slash on patterns', () => {
            table.register('GET', 'api/agents', () => {});
            assert.strictEqual(table.entries[0].pattern, '/api/agents');
        });

        it('normalizes trailing slash on patterns', () => {
            table.register('GET', '/api/agents/', () => {});
            assert.strictEqual(table.entries[0].pattern, '/api/agents');
        });

        it('normalizes both leading and trailing slashes', () => {
            table.register('GET', 'api/agents/', () => {});
            assert.strictEqual(table.entries[0].pattern, '/api/agents');
        });

        it('keeps root path as /', () => {
            table.register('GET', '/', () => {});
            assert.strictEqual(table.entries[0].pattern, '/');
        });
    });

    // ── Exact Match ───────────────────────────────────────────

    describe('exact match', () => {
        it('matches an exact static path', () => {
            const handler = () => 'ok';
            table.register('GET', '/api/agents', handler);
            const result = table.match('/api/agents', 'GET');
            assert.strictEqual(result.handler, handler);
            assert.deepStrictEqual(result.params, {});
        });

        it('returns null when no route matches', () => {
            table.register('GET', '/api/agents', () => {});
            const result = table.match('/api/tasks', 'GET');
            assert.strictEqual(result, null);
        });

        it('matches root path /', () => {
            const handler = () => 'root';
            table.register('GET', '/', handler);
            const result = table.match('/', 'GET');
            assert.strictEqual(result.handler, handler);
        });

        it('does not partial-match static routes', () => {
            table.register('GET', '/api', () => {});
            const result = table.match('/api/agents', 'GET');
            assert.strictEqual(result, null);
        });
    });

    // ── Param Extraction ──────────────────────────────────────

    describe('param extraction', () => {
        it('extracts a single param', () => {
            table.register('GET', '/api/agents/:agentId', () => {});
            const result = table.match('/api/agents/abc123', 'GET');
            assert.ok(result);
            assert.strictEqual(result.params.agentId, 'abc123');
        });

        it('extracts multiple params', () => {
            table.register('GET', '/api/agents/:agentId/logs/:logId', () => {});
            const result = table.match('/api/agents/abc/logs/42', 'GET');
            assert.ok(result);
            assert.strictEqual(result.params.agentId, 'abc');
            assert.strictEqual(result.params.logId, '42');
        });

        it('extracts param from trailing segment', () => {
            table.register('POST', '/api/tasks/:id/claim', () => {});
            const result = table.match('/api/tasks/99/claim', 'POST');
            assert.ok(result);
            assert.strictEqual(result.params.id, '99');
        });

        it('does not match param segment across slashes', () => {
            table.register('GET', '/api/agents/:agentId', () => {});
            const result = table.match('/api/agents/a/b', 'GET');
            assert.strictEqual(result, null);
        });
    });

    // ── Method Filtering ──────────────────────────────────────

    describe('method filtering', () => {
        it('does not match if method differs', () => {
            table.register('GET', '/api/agents', () => {});
            const result = table.match('/api/agents', 'POST');
            assert.strictEqual(result, null);
        });

        it('matches different methods on same path to different handlers', () => {
            const getHandler = () => 'get';
            const postHandler = () => 'post';
            table.register('GET', '/api/agents', getHandler);
            table.register('POST', '/api/agents', postHandler);

            const getResult = table.match('/api/agents', 'GET');
            const postResult = table.match('/api/agents', 'POST');

            assert.strictEqual(getResult.handler, getHandler);
            assert.strictEqual(postResult.handler, postHandler);
        });

        it('is case-sensitive on method', () => {
            table.register('GET', '/api/test', () => {});
            const result = table.match('/api/test', 'get');
            assert.strictEqual(result, null);
        });
    });

    // ── 404 Fallback ──────────────────────────────────────────

    describe('404 fallback', () => {
        it('returns null for unknown path with empty table', () => {
            const result = table.match('/anything', 'GET');
            assert.strictEqual(result, null);
        });

        it('returns null for known path but wrong method', () => {
            table.register('DELETE', '/api/agents/:id', () => {});
            const result = table.match('/api/agents/1', 'GET');
            assert.strictEqual(result, null);
        });
    });

    // ── Precedence ────────────────────────────────────────────

    describe('precedence', () => {
        it('exact match takes precedence over parametric', () => {
            const exactHandler = () => 'exact';
            const paramHandler = () => 'param';
            // Register parametric first
            table.register('GET', '/api/agents/:agentId', paramHandler);
            // Register exact after
            table.register('GET', '/api/agents/me', exactHandler);

            const result = table.match('/api/agents/me', 'GET');
            assert.strictEqual(result.handler, exactHandler);
        });

        it('parametric match used when no exact match exists', () => {
            const paramHandler = () => 'param';
            table.register('GET', '/api/agents/:agentId', paramHandler);

            const result = table.match('/api/agents/someone', 'GET');
            assert.strictEqual(result.handler, paramHandler);
            assert.strictEqual(result.params.agentId, 'someone');
        });

        it('first exact match wins among multiple exact matches', () => {
            const first = () => 'first';
            const second = () => 'second';
            table.register('GET', '/api/test', first);
            table.register('GET', '/api/test', second);

            const result = table.match('/api/test', 'GET');
            assert.strictEqual(result.handler, first);
        });
    });

    // ── Edge Cases ────────────────────────────────────────────

    describe('edge cases', () => {
        it('matches path with numeric param values', () => {
            table.register('GET', '/api/metrics/:name/history', () => {});
            const result = table.match('/api/metrics/cpu/history', 'GET');
            assert.ok(result);
            assert.strictEqual(result.params.name, 'cpu');
        });

        it('matches path with hyphenated param values', () => {
            table.register('GET', '/api/agents/:agentId', () => {});
            const result = table.match('/api/agents/my-agent-1', 'GET');
            assert.ok(result);
            assert.strictEqual(result.params.agentId, 'my-agent-1');
        });

        it('handles multiple parametric routes with different patterns', () => {
            const h1 = () => '1';
            const h2 = () => '2';
            table.register('GET', '/api/agents/:agentId/logs', h1);
            table.register('GET', '/api/agents/:agentId/metrics/:name/history', h2);

            const r1 = table.match('/api/agents/a1/logs', 'GET');
            const r2 = table.match('/api/agents/a1/metrics/cpu/history', 'GET');

            assert.strictEqual(r1.handler, h1);
            assert.strictEqual(r1.params.agentId, 'a1');
            assert.strictEqual(r2.handler, h2);
            assert.strictEqual(r2.params.agentId, 'a1');
            assert.strictEqual(r2.params.name, 'cpu');
        });

        it('matches path with trailing slash normalized', () => {
            const handler = () => 'ok';
            table.register('GET', '/api/agents', handler);
            const result = table.match('/api/agents/', 'GET');
            assert.strictEqual(result.handler, handler);
        });
    });
});
