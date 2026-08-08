/** Shared helpers for research HTTP providers. */

/** Detect fetch abort / response timeouts (not connect failures). */
export function isAbortTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "TimeoutError" || err.name === "AbortError") return true;
  const cause = (err as Error & { cause?: { code?: string } }).cause;
  const code = cause?.code || (err as Error & { code?: string }).code;
  return (
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT"
  );
}

/** TCP/DNS connect failures — distinct from request abort timeouts. */
export function isConnectNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as Error & { cause?: { code?: string } }).cause;
  const code = cause?.code || (err as Error & { code?: string }).code;
  return (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN" ||
    code === "ENETUNREACH" ||
    code === "EHOSTUNREACH" ||
    code === "ETIMEDOUT" ||
    code === "ESOCKETTIMEDOUT"
  );
}

/** Strip accidental surrounding quotes from env values. */
export function normalizeSecret(raw?: string): string | undefined {
  if (!raw) return undefined;
  let v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v || undefined;
}
