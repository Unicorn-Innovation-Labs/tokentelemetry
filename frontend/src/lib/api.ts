"use client";

import { useEffect, useState } from "react";

// Resolve the backend base URL. An explicit NEXT_PUBLIC_API_BASE wins (pin a
// fixed host if you want one). Otherwise derive it from the address the
// dashboard was actually loaded on (window.location) plus the API port — so a
// single build works on localhost, a LAN IP, or a tailnet host without rebaking
// the URL. Falls back to loopback during SSR, where window is unavailable.
export const API_BASE = (() => {
  const explicit = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "");
  if (explicit) return explicit;
  const port = process.env.NEXT_PUBLIC_API_PORT || "8000";
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  return `http://127.0.0.1:${port}`;
})();

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json() as Promise<T>;
}

export interface ResourceState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Lightweight fetch hook. Polls every `pollMs` if provided.
 * Replaces the useEffect+fetch ceremony repeated on every page.
 */
export function useResource<T>(
  path: string | null,
  opts: { pollMs?: number; initial?: T } = {},
): ResourceState<T> {
  const [data, setData] = useState<T | undefined>(opts.initial);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    const run = () => {
      api<T>(path)
        .then((d) => { if (!cancelled) { setData(d); setError(undefined); } })
        .catch((e) => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    run();
    let id: ReturnType<typeof setInterval> | undefined;
    if (opts.pollMs) id = setInterval(run, opts.pollMs);
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [path, opts.pollMs, tick]);

  return { data, loading, error, refetch: () => setTick((t) => t + 1) };
}
