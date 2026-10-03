/**
 * Browser-side helper for `/api/**`. Every error becomes an `ApiClientError` carrying the stable
 * `code` from docs/api.md so screens can map it to a translated message.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function parse(res: Response) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request<T>(method: string, path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    ...init,
  });
  const data = await parse(res);
  if (!res.ok) {
    const err = (
      data as { error?: { code?: string; message?: string; details?: unknown; retryAfter?: number } }
    )?.error;
    throw new ApiClientError(
      res.status,
      err?.code ?? (res.status === 401 ? "unauthorized" : "internal"),
      err?.message ?? res.statusText ?? "Request failed",
      err?.details,
      err?.retryAfter,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>("GET", path, undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>("POST", path, body, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>("PATCH", path, body, init),
  del: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>("DELETE", path, body, init),
};

export function isApiError(e: unknown, code?: string): e is ApiClientError {
  return e instanceof ApiClientError && (code === undefined || e.code === code);
}

export function errorCode(e: unknown) {
  return e instanceof ApiClientError ? e.code : "internal";
}

/** Fire-and-forget analytics (docs/api.md → POST /api/analytics). */
export function track(
  kind:
    | "page_view"
    | "tryon_ar_start"
    | "tryon_ar_capture"
    | "book_click"
    | "share"
    | "qr_scan"
    | "whatsapp_click",
  payload: {
    salonId?: string | null;
    designId?: string | null;
    polishId?: string | null;
    payload?: unknown;
  } = {},
) {
  try {
    const body = JSON.stringify({ kind, ...payload });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/analytics", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    });
  } catch {
    // analytics must never break the UI
  }
}
