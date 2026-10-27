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
 * Microsoft asking us to slow down: HTTP 429, or one of its own codes for too many calls
 * (117 CallRateExceeded, 207 and 4204 for concurrent and queued report limits).
 */
export function isThrottled(status: number, messages: string[]): boolean {
  return status === 429 || messages.some((m) => /\((117|207|4204)\)$/.test(m));
}

/** The developer token or the signed-in user was refused (105/106) – retrying will not help. */
export function isCredentialRejection(status: number, messages: string[]): boolean {
  return status === 401 || messages.some((m) => /\((105|106)\)$/.test(m));
}
