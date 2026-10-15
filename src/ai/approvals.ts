/**
 * Bridges the agent loop and the approval cards in the chat: the agent waits on
 * `request(id)` until the user clicks Godkend/Afvis (or the run is stopped).
 */
export interface ApprovalAnswer {
  approved: boolean;
  note?: string;
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
