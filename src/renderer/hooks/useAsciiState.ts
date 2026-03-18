// src/renderer/hooks/useAsciiState.ts

import { useState, useEffect, useCallback } from 'react';
import type { AsciiState } from '../types';

export interface UseAsciiStateResult {
  state: AsciiState | null;
  view: string;
  loading: boolean;
  error: string | null;
  sendControl: (label: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAsciiState(apiUrl: string, pollInterval = 1000): UseAsciiStateResult {
  const [state, setState] = useState<AsciiState | null>(null);
  const [view, setView] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const [stateRes, viewRes] = await Promise.all([
        fetch(`${apiUrl}/state`),
        fetch(`${apiUrl}/view`),
      ]);

      if (!stateRes.ok || !viewRes.ok) {
        throw new Error('Failed to fetch state');
      }

      const stateData = await stateRes.json();
      const viewData = await viewRes.text();

      setState(stateData);
      setView(viewData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  const sendControl = useCallback(async (label: string) => {
    try {
      const res = await fetch(`${apiUrl}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });

      if (!res.ok) {
        throw new Error(`Control failed: ${res.status}`);
      }

      // Refresh state after control
      await fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Control error');
    }
  }, [apiUrl, fetchState]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchState();
  }, [fetchState]);

  useEffect(() => {
    fetchState();

    if (pollInterval > 0) {
      const interval = setInterval(fetchState, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchState, pollInterval]);

  return { state, view, loading, error, sendControl, refresh };
}
