/**
 * The audit's progress, kept in the workspace so the whole team sees the same checklist:
 * one stored entry per Microsoft Advertising campaign (`audit:c:<id>`) – its Google Ads
 * match, the steps marked done or not relevant, and the campaign comment.
 *
 * Changes come in as small operations applied here one at a time (the Durable Object runs
 * one request at a time), so two people ticking steps at once never overwrite each other.
 */
import type { CampaignAudit } from '../../src/features/audit/steps';
import { applyOp, auditKey, type AuditOp } from '../../src/features/audit/ops';

export { parseOp } from '../../src/features/audit/ops';

export interface AuditStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  list<T>(options: { prefix: string }): Promise<Map<string, T>>;
}

export async function readAudits(storage: AuditStorage): Promise<CampaignAudit[]> {
  return [...(await storage.list<CampaignAudit>({ prefix: 'audit:c:' })).values()];
}

export async function changeAudit(storage: AuditStorage, op: AuditOp, by: string, at: number): Promise<CampaignAudit> {
  const next = applyOp(await storage.get<CampaignAudit>(auditKey(op.bingId)), op, by, at);
  await storage.put(auditKey(op.bingId), next);
  return next;
}
