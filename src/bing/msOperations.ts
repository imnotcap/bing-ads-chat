/**
 * Every Microsoft Advertising REST v13 operation (method, path, request and response
 * elements), generated from Microsoft's documentation by scripts/ms-operations.py.
 * Used to check raw API calls before they are sent – a wrong path or method is a 404 –
 * and to let the assistant look operations up instead of guessing.
 */
import data from './msOperations.json';
import type { MsService } from './types';

export interface MsOperationElement {
  name: string;
  type: string;
  optional?: boolean;
  note: string;
}

export interface MsOperation {
  /** The SOAP-style operation name, e.g. GetNegativeKeywordsByEntityIds. */
  op: string;
  service: MsService;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Path after /v13/, e.g. NegativeKeywords/QueryByEntityIds. */
  path: string;
  summary: string;
  request: MsOperationElement[];
  response: string[];
}

export const MS_OPERATIONS = data as MsOperation[];

export function findOperation(service: string, method: string, path: string): MsOperation | undefined {
  const p = path.replace(/^\/+|\/+$/g, '').toLowerCase();
  return MS_OPERATIONS.find((o) => o.service === service && o.method === method && o.path.toLowerCase() === p);
}

/** Operations that only read (or, for reports and bulk downloads, prepare a file to read). */
export function isReadOperation(o: MsOperation): boolean {
  return /^(Get|Search|Find|Poll|Submit|Download|Retrieve|Suggest|Check|Validate)/.test(o.op);
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);

/** Best matches for a free-text query, e.g. "sitelink", "location targeting", "AddAdExtensions". */
export function searchOperations(query: string, limit = 8): MsOperation[] {
  const q = words(query.replace(/([a-z])([A-Z])/g, '$1 $2'));
  if (!q.length) return [];
  const scored = MS_OPERATIONS.map((o) => {
    const name = o.op.toLowerCase();
    const hay = `${o.op.replace(/([a-z])([A-Z])/g, '$1 $2')} ${o.path} ${o.summary}`.toLowerCase();
    let score = name === query.toLowerCase() ? 100 : 0;
    for (const w of q) {
      const stem = w.replace(/s$/, '');
      if (name.includes(stem)) score += 5;
      else if (hay.includes(stem)) score += 1;
    }
    return { o, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.o.op.length - b.o.op.length)
    .slice(0, limit)
    .map((s) => s.o);
}

/** Request elements the documentation marks as required that are missing from a body. */
export function missingRequired(o: MsOperation, body: Record<string, unknown> | undefined): string[] {
  return o.request
    .filter((r) => !r.optional && !/required if|required when|only required|either|one of/i.test(r.note))
    .map((r) => r.name)
    .filter((name) => !body || !(name in body));
}
