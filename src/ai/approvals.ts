/**
 * Bridges the agent loop and the approval cards in the chat: the agent waits on
 * `request(id)` until the user clicks Godkend/Afvis (or the run is stopped).
 */
export interface ApprovalEdit {
  /** Path into the tool input, e.g. ['changes', 0, 'name']. */
  path: (string | number)[];
  value: string;
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
  for (const { path, value } of edits) {
    let node: Record<string | number, unknown> | undefined = copy;
    path.slice(0, -1).forEach((key, i) => {
      // A list the model left out (e.g. pins on an ad) is created when the user sets a value in it.
      if (node && node[key] === undefined) node[key] = typeof path[i + 1] === 'number' ? [] : {};
      node = node?.[key] as Record<string | number, unknown> | undefined;
    });
    const last = path[path.length - 1];
    if (!node || last === undefined) continue;
    node[last] = value.trim();
    // Gaps in a list of texts become empty texts.
    if (Array.isArray(node)) for (let i = 0; i < node.length; i++) if (node[i] === undefined) node[i] = '';
  }
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
