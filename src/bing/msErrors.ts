/**
 * Reading Microsoft Advertising's error payloads – shared by the app's client and the
 * Cloudflare Worker (which syncs reports on its own), so both recognise throttling and
 * rejected credentials the same way. No imports: the Worker is bundled without the
 * app's `@/` path alias.
 */

/** Collects human readable messages from Microsoft's (nested) error payloads. */
export function extractErrorMessages(payload: unknown, out: string[] = [], depth = 0): string[] {
  if (!payload || depth > 6 || out.length >= 8) return out;
  if (Array.isArray(payload)) {
    for (const p of payload) extractErrorMessages(p, out, depth + 1);
    return out;
  }
  if (typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    const msg = typeof o.Message === 'string' ? o.Message : typeof o.message === 'string' ? o.message : null;
    const code = o.ErrorCode ?? o.Code ?? o.code;
    if (msg) {
      const line = code !== undefined && code !== null ? `${msg} (${String(code)})` : msg;
      if (!out.includes(line)) out.push(line);
    }
    for (const [k, v] of Object.entries(o)) {
      if (k !== 'Message' && k !== 'message' && v && typeof v === 'object') extractErrorMessages(v, out, depth + 1);
    }
  }
  return out;
}

/**
 * How long to wait before asking again when Microsoft says "too many calls", or null when
 * waiting won't help (Services protocol and Operation error codes):
 * - 117 CallRateExceeded (and HTTP 429): "resubmit the request … after waiting 60 seconds".
 * - 207 in the Reporting service: too many reports running – wait for them. In Customer
 *   Management the same number means an invalid address line, so it is not retried there.
 * - 4204 is a Bulk-service limit; the app does not use Bulk.
 */
export function retryAfterMs(status: number, messages: string[], reporting = false): number | null {
  // Messages end in the symbolic code (ErrorCode, e.g. "CallRateExceeded") or, without one, the number.
  if (status === 429 || messages.some((m) => /\((117|CallRateExceeded)\)$/.test(m))) return 60_000;
  if (messages.some((m) => /\(ConcurrentRequestOverLimit\)$/.test(m) || (reporting && /\(207\)$/.test(m)))) return 30_000;
  return null;
}

/** Microsoft asking us to slow down (see retryAfterMs). */
export function isThrottled(status: number, messages: string[], reporting = false): boolean {
  return retryAfterMs(status, messages, reporting) !== null;
}

/** The developer token or the signed-in user was refused (105 InvalidCredentials / 106 UserIsNotAuthorized) – retrying will not help. */
export function isCredentialRejection(status: number, messages: string[]): boolean {
  return status === 401 || messages.some((m) => /\((105|106|InvalidCredentials|UserIsNotAuthorized)\)$/.test(m));
}
