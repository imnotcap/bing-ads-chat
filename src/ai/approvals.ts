/**
 * Bridges the agent loop and the approval cards in the chat: the agent waits on
 * `request(id)` until the user clicks Godkend/Afvis (or the run is stopped).
 */
export interface ApprovalEdit {
  /** Path into the tool input, e.g. ['changes', 0, 'name']. */
  path: (string | number)[];
  value: string;
  /** A bid or amount: stored as a number ("10,05" and "10.05" both work). */
  kind?: 'money';
}

/** A number as typed in Danish or English ("10,05", "10.05", "1.234,5"); NaN when it is none. */
export function parseAmount(text: string): number {
  const t = text.replace(/\s|kr\.?/gi, '');
  if (!t) return NaN;
  const normal = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(',', '.');
  return /^\d*\.?\d+$/.test(normal) ? Number(normal) : NaN;
}

export interface ApprovalAnswer {
  approved: boolean;
  note?: string;
  /** Values the user corrected on the approval card before approving. */
  edits?: ApprovalEdit[];
  /** Rows the user ticked off in a pick table (indices into ChangePlan.pick.path). */
  excluded?: number[];
  /** Items the user added themselves under a pick table (ChangePlan.pick.add). */
  added?: { text: string; matchType: 'Exact' | 'Phrase' }[];
}

const pending = new Map<string, (answer: ApprovalAnswer) => void>();

export function requestApproval(id: string, signal?: AbortSignal): Promise<ApprovalAnswer> {
  return new Promise((resolve) => {
    pending.set(id, resolve);
    signal?.addEventListener('abort', () => answerApproval(id, { approved: false, note: 'stopped' }));
  });
}

export function answerApproval(id: string, answer: ApprovalAnswer) {
  const resolve = pending.get(id);
  if (!resolve) return;
  pending.delete(id);
  resolve(answer);
}

export function hasPendingApproval(id: string) {
  return pending.has(id);
}

/** Returns a copy of a tool input with the user's corrections from the approval card applied. */
export function applyEdits(input: unknown, edits: ApprovalEdit[]): unknown {
  const copy = structuredClone(input) as Record<string | number, unknown>;
  for (const { path, value, kind } of edits) {
    let node: Record<string | number, unknown> | undefined = copy;
    path.slice(0, -1).forEach((key, i) => {
      // A list the model left out (e.g. pins on an ad) is created when the user sets a value in it.
      if (node && node[key] === undefined) node[key] = typeof path[i + 1] === 'number' ? [] : {};
      node = node?.[key] as Record<string | number, unknown> | undefined;
    });
    const last = path[path.length - 1];
    if (!node || last === undefined) continue;
    // An amount that isn't a number stays text, so the tool's own check refuses it.
    node[last] = kind === 'money' && Number.isFinite(parseAmount(value)) ? parseAmount(value) : value.trim();
    // Gaps in a list of texts become empty texts.
    if (Array.isArray(node)) for (let i = 0; i < node.length; i++) if (node[i] === undefined) node[i] = '';
  }
  return copy;
}

/**
 * ChangePlan.pick.skipPath: a copy of the tool input with the keys of the rows the user left
 * unticked added to the array at `path` (the tool leaves those rows out when it plans again).
 */
export function applySkips(input: unknown, path: (string | number)[], keys: string[]): unknown {
  const copy = structuredClone(input) as Record<string | number, unknown>;
  let node: Record<string | number, unknown> = copy;
  for (const key of path.slice(0, -1)) {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key] as Record<string | number, unknown>;
  }
  const last = path[path.length - 1]!;
  const before = Array.isArray(node[last]) ? (node[last] as unknown[]).map(String) : [];
  node[last] = [...new Set([...before, ...keys])];
  return copy;
}

/**
 * Returns a copy of a tool input without the rows the user ticked off and with the items
 * they added themselves (ChangePlan.pick).
 */
export function applyPicks(input: unknown, path: (string | number)[], excluded: number[], added: unknown[] = []): unknown {
  const copy = structuredClone(input) as Record<string | number, unknown>;
  let node: Record<string | number, unknown> | undefined = copy;
  for (const key of path.slice(0, -1)) node = node?.[key] as Record<string | number, unknown> | undefined;
  const last = path[path.length - 1];
  const list = node && last !== undefined ? node[last] : undefined;
  if (node && last !== undefined && Array.isArray(list)) {
    const skip = new Set(excluded);
    node[last] = [...list.filter((_, i) => !skip.has(i)), ...added];
  }
  return copy;
}
