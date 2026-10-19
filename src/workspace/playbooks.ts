/**
 * The branches' playbooks (src/ai/playbooks.ts), shared in the workspace on Cloudflare:
 * everyone trains – and works with – the same guidelines.
 */
import { create } from 'zustand';
import type { BranchId, SectionId, StoredPlaybook } from '@/ai/playbooks';
import { api } from './api';

interface PlaybooksState {
  /** null until loaded. A branch without changes is null (= the default playbook). */
  stored: Partial<Record<BranchId, StoredPlaybook | null>> | null;
  loadedAt: number;
  error: string | null;
  set: (patch: Partial<Omit<PlaybooksState, 'set'>>) => void;
}

export const usePlaybooks = create<PlaybooksState>((set) => ({ stored: null, loadedAt: 0, error: null, set: (patch) => set(patch) }));

export async function loadPlaybooks() {
  try {
    const { playbooks } = await api<{ playbooks: Record<BranchId, StoredPlaybook | null> }>('/playbooks');
    usePlaybooks.getState().set({ stored: playbooks, loadedAt: Date.now(), error: null });
  } catch (e) {
    usePlaybooks.getState().set({ error: e instanceof Error ? e.message : String(e) });
  }
}

/** A branch's stored playbook for the assistant (reloaded when older than a minute). */
export async function playbookFor(id: BranchId): Promise<StoredPlaybook | null> {
  const s = usePlaybooks.getState();
  if (!s.stored || Date.now() - s.loadedAt > 60_000) await loadPlaybooks();
  return usePlaybooks.getState().stored?.[id] ?? null;
}

function keep(id: BranchId, playbook: StoredPlaybook) {
  const { stored, set } = usePlaybooks.getState();
  set({ stored: { ...(stored ?? {}), [id]: playbook } });
  return playbook;
}

/** Saves whole sections (null = back to the default). */
export async function savePlaybook(id: BranchId, sections: Partial<Record<SectionId, string | null>>) {
  const { playbook } = await api<{ playbook: StoredPlaybook }>(`/playbooks/${id}`, { method: 'PUT', body: JSON.stringify({ sections }) });
  return keep(id, playbook);
}

/** Adds one line to a section (what the chat proposes and the user approves). */
export async function appendToPlaybook(id: BranchId, section: SectionId, text: string) {
  const { playbook } = await api<{ playbook: StoredPlaybook }>(`/playbooks/${id}`, { method: 'PUT', body: JSON.stringify({ append: { section, text } }) });
  return keep(id, playbook);
}
