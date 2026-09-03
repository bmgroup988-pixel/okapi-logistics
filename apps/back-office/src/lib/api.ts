/** Client API — jeton d'accès en mémoire, refresh rotatif en localStorage. */

const BASE = (import.meta.env.VITE_API_BASE as string) ?? '/api/v1';
const REFRESH_KEY = 'okapi.refresh';

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  try {
    localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    /* ignore */
  }
}

export function clearTokens() {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

export function hasRefreshToken(): boolean {
  try {
    return !!localStorage.getItem(REFRESH_KEY);
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown[],
  ) {
    super(message);
  }
}

async function refresh(): Promise<boolean> {
  const token = localStorage.getItem(REFRESH_KEY);
  if (!token) return false;
  try {
    const res = await fetch(`${BASE}/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const json = (await res.json()) as { accessToken: string; refreshToken: string };
    setTokens(json.accessToken, json.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  idempotencyKey?: string;
  _retry?: boolean;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;

  const res = await fetch(url.toString().replace(window.location.origin, ''), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && !opts._retry) {
    refreshPromise ??= refresh().finally(() => {
      refreshPromise = null;
    });
    const ok = await refreshPromise;
    if (ok) return api<T>(path, { ...opts, _retry: true });
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText, err.details);
  }
  return json as T;
}

export function uuid(): string {
  return crypto.randomUUID();
}
