import { config } from "./config";

/**
 * Upstream access: a small token-bucket style queue (Jolpica allows ~4 req/s bursts),
 * retry on 429/5xx, and a TTL cache with in-flight de-duplication and
 * stale-if-error so that a provider hiccup never blanks the UI.
 */

const MIN_GAP_MS = 260;
let chain: Promise<unknown> = Promise.resolve();
let lastStart = 0;

function schedule<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastStart + MIN_GAP_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastStart = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

export class UpstreamError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function fetchJson<T>(url: string, init: RequestInit = {}, attempts = 3, throttle = true): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const doFetch = () =>
        fetch(url, { ...init, signal: AbortSignal.timeout(15000), cache: "no-store", headers: { accept: "application/json", ...(init.headers || {}) } });
      const res = await (throttle ? schedule(doFetch) : doFetch());
      if (res.status === 429 || res.status >= 500) {
        lastErr = new UpstreamError(`${res.status} from upstream`, res.status);
        await new Promise((r) => setTimeout(r, 600 * (i + 1) ** 2));
        continue;
      }
      if (!res.ok) throw new UpstreamError(`${res.status} from upstream`, res.status);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (e instanceof UpstreamError && e.status && e.status < 500 && e.status !== 429) throw e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new UpstreamError("Upstream unreachable");
}

export const jolpicaFetch = <T>(path: string) => fetchJson<T>(`${config.jolpica}${path}`);

export function openf1Fetch<T>(endpoint: string, query: Record<string, string | number> | string = {}): Promise<T> {
  const qs = typeof query === "string" ? query : Object.entries(query).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
  const headers: Record<string, string> = config.openf1Token ? { authorization: `Bearer ${config.openf1Token}` } : {};
  return fetchJson<T>(`${config.openf1}/${endpoint}${qs ? `?${qs}` : ""}`, { headers }, 2, false);
}

interface Entry<T> {
  value?: T;
  at: number;
  inflight?: Promise<T>;
}
const store = new Map<string, Entry<unknown>>();

/** Resolve `fn` at most once per `ttlMs`. On failure serve the last good value flagged stale. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<{ value: T; stale: boolean; asOf: number }> {
  const e = (store.get(key) as Entry<T> | undefined) ?? { at: 0 };
  store.set(key, e);
  if (e.value !== undefined && Date.now() - e.at < ttlMs) return { value: e.value, stale: false, asOf: e.at };
  if (!e.inflight) {
    e.inflight = fn().then(
      (v) => {
        e.value = v;
        e.at = Date.now();
        e.inflight = undefined;
        return v;
      },
      (err) => {
        e.inflight = undefined;
        throw err;
      },
    );
  }
  try {
    const v = await e.inflight;
    return { value: v, stale: false, asOf: e.at };
  } catch (err) {
    if (e.value !== undefined) return { value: e.value, stale: true, asOf: e.at };
    throw err;
  }
}
