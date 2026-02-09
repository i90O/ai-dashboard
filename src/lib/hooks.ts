'use client';

import { useState, useEffect, useCallback } from 'react';

// Generic fetch hook with auto-refresh
export function useFetch<T>(
  url: string,
  options?: {
    refreshInterval?: number;
    initialData?: T;
  }
) {
  const [data, setData] = useState<T | undefined>(options?.initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();

    if (options?.refreshInterval) {
      const interval = setInterval(fetchData, options.refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, options?.refreshInterval]);

  return { data, loading, error, refetch: fetchData };
}

// Activities hook with real-time updates
export function useActivities(source?: string) {
  const url = source ? `/api/activities?source=${source}` : '/api/activities';
  return useFetch<Array<Record<string, unknown>>>(url, { refreshInterval: 5000 });
}

// Tasks hook
export function useTasks(status?: string) {
  const url = status ? `/api/tasks?status=${status}` : '/api/tasks';
  return useFetch<Array<Record<string, unknown>>>(url, { refreshInterval: 10000 });
}

// Bots hook
export function useBots() {
  return useFetch<Array<Record<string, unknown>>>('/api/bots', { refreshInterval: 30000 });
}

// Auth check hook
export function useAuth() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth')
      .then((res) => setAuthenticated(res.ok))
      .catch(() => setAuthenticated(false));
  }, []);

  const logout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setAuthenticated(false);
  };

  return { authenticated, logout };
}
