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
  /**
   * A position the text is pinned to (responsive search ads), changeable on the card:
   * "" = any position. `locked`: shown but fixed, with the reason.
   */
  pin?: { path?: (string | number)[]; value: string; options: string[]; locked?: string };
  /** A language correction from the proofreader (ai/proofread.ts), applied with one click. */
  suggestion?: { value: string; reason: string };
  /** Extra columns when the plan is shown as a pick table (ChangePlan.pick). */
  cells?: Record<string, string | number | null>;
  /** Pick table with ChangePlan.pick.skipPath: what the row is remembered by when ticked off. */
  pickKey?: string;
  /** Pick table: the row starts unticked (e.g. a removal the user must choose). */
  pickOff?: boolean;
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
