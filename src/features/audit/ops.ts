/**
 * Changes to one campaign's audit, as small operations: checked (`parseOp`) and applied
 * (`applyOp`) by the workspace (cloudflare/src/audit.ts), and applied the same way in the
 * app at once, before the workspace has answered. No imports from the app's alias.
 */
import { STEP_IDS, type CampaignAudit, type StepId, type StepStatus } from './steps';

export type AuditOp =
  | { type: 'match'; bingId: string; googleId: string | null }
  | { type: 'unmatch'; bingId: string }
  | { type: 'step'; bingId: string; step: StepId; status: StepStatus | null }
  | { type: 'note'; bingId: string; text: string };

const ID = /^\d{1,20}$/;
export const MAX_NOTE = 4000;
export const auditKey = (bingId: string) => `audit:c:${bingId}`;

/** The operation, checked – or the reason it is refused. */
export function parseOp(raw: unknown): AuditOp | string {
  const o = (raw ?? {}) as Record<string, unknown>;
  const bingId = String(o.bingId ?? '');
  if (!ID.test(bingId)) return 'Ugyldigt kampagne-id.';
  switch (o.type) {
    case 'match': {
      const googleId = o.googleId === null ? null : String(o.googleId ?? '');
      if (googleId !== null && !ID.test(googleId)) return 'Ugyldigt Google-kampagne-id.';
      return { type: 'match', bingId, googleId };
    }
    case 'unmatch':
      return { type: 'unmatch', bingId };
    case 'step': {
      const step = String(o.step ?? '');
      if (!STEP_IDS.has(step)) return 'Ukendt trin.';
      const status = o.status === null ? null : o.status === 'done' || o.status === 'na' ? o.status : undefined;
      if (status === undefined) return 'Ugyldig status.';
      return { type: 'step', bingId, step: step as StepId, status };
    }
    case 'note': {
      if (typeof o.text !== 'string') return 'Kommentaren mangler.';
      if (o.text.length > MAX_NOTE) return `Kommentaren må højst være ${MAX_NOTE} tegn.`;
      return { type: 'note', bingId, text: o.text };
    }
    default:
      return 'Ukendt ændring.';
  }
}

/** The campaign's audit after the operation (a new object; the old one is not touched). */
export function applyOp(current: CampaignAudit | undefined, op: AuditOp, by: string, at: number): CampaignAudit {
  const next: CampaignAudit = { ...(current ?? { bingId: op.bingId, steps: {} }), steps: { ...(current?.steps ?? {}) } };
  switch (op.type) {
    case 'match':
      next.googleId = op.googleId;
      next.matchedBy = by;
      next.matchedAt = at;
      // Deciding the match – also "no counterpart" – is the first step.
      next.steps.match = { status: 'done', by, at };
      break;
    case 'unmatch':
      delete next.googleId;
      delete next.matchedBy;
      delete next.matchedAt;
      delete next.steps.match;
      break;
    case 'step':
      if (op.status) next.steps[op.step] = { status: op.status, by, at };
      else delete next.steps[op.step];
      break;
    case 'note': {
      const text = op.text.trim();
      if (text) next.note = { text, by, at };
      else delete next.note;
      break;
    }
  }
  return next;
}
