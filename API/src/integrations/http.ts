/** Small fetch wrapper for provider APIs: JSON in/out, timeout, readable errors. */
export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(`[${provider}] ${message}`);
  }
}

export async function providerFetch<T>(
  provider: string,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    });
  } catch (e) {
    throw new ProviderError(provider, `request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  if (!res.ok) throw new ProviderError(provider, `HTTP ${res.status}`, res.status, body);
  return body as T;
}
