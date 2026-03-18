// src/renderer/hooks/__tests__/useAsciiState.test.ts

import '../../test-setup';
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { useAsciiState } from '../useAsciiState';

describe('useAsciiState', () => {
  const mockApiUrl = 'http://localhost:3421';
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches initial state on mount', async () => {
    const mockState = { state: 'HOME', tasks: [] };
    const mockView = 'ASCII content here';

    let callCount = 0;
    global.fetch = (async (url: string | URL | Request) => {
      callCount++;
      const urlStr = url.toString();
      if (urlStr.includes('/state')) {
        return new Response(JSON.stringify(mockState), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/view')) {
        return new Response(mockView, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAsciiState(mockApiUrl, 0)); // Disable polling

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.state).toEqual(mockState);
    expect(result.current.view).toBe(mockView);
  });

  it('sends control command and refreshes state', async () => {
    const mockState = { state: 'HOME', tasks: [] };
    const mockNextState = { state: 'TASKS', tasks: [] };
    const mockView = 'ASCII content';

    let callCount = 0;
    global.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
      callCount++;
      const urlStr = url.toString();

      if (urlStr.includes('/control')) {
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // First fetch returns HOME, second returns TASKS
      const isFirstFetch = callCount <= 2;
      const state = isFirstFetch ? mockState : mockNextState;
      const view = isFirstFetch ? mockView : 'New ASCII';

      if (urlStr.includes('/state')) {
        return new Response(JSON.stringify(state), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/view')) {
        return new Response(view, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAsciiState(mockApiUrl, 0)); // Disable polling

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.sendControl('A');

    await waitFor(() => expect(result.current.state).toEqual(mockNextState));
  });
});
