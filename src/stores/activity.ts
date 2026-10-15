import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '@/lib/utils';

export interface ChangeLine {
  entity: string;
  entityId?: string;
  field: string;
  before?: string | number | null;
  after?: string | number | null;
  /** The value can be corrected by the user on the approval card. */
  edit?: { path: (string | number)[]; maxLength?: number };
}

/** Inverse operation that restores the previous state (when the change is reversible). */
export interface UndoSpec {
  tool: string;
  input: unknown;
}

export interface ActivityEntry {
  id: string;
  ts: number;
  source: 'assistant' | 'user' | 'budgetvagt';
  mode: 'demo' | 'live';
  accountId: string;
  tool: string;
  summary: string;
  changes: ChangeLine[];
  status: 'success' | 'failed' | 'rejected' | 'blocked';
  error?: string;
  conversationId?: string;
  undo?: UndoSpec;
  undone?: boolean;
}

interface ActivityState {
  entries: ActivityEntry[];
  add: (e: Omit<ActivityEntry, 'id' | 'ts'>) => ActivityEntry;
  markUndone: (id: string) => void;
  clear: () => void;
}

export const useActivity = create<ActivityState>()(
  persist(
    (set) => ({
      entries: [],
      add: (e) => {
        const entry: ActivityEntry = { ...e, id: uid('act_'), ts: Date.now() };
        set((s) => ({ entries: [entry, ...s.entries].slice(0, 1000) }));
        return entry;
      },
      markUndone: (id) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, undone: true } : e)) })),
      clear: () => set({ entries: [] }),
    }),
    { name: 'bac.activity', version: 1 },
  ),
);
