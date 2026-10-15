import { create } from 'zustand';

export type View = 'chat' | 'campaigns' | 'activity' | 'settings';
export type SettingsTab = 'connections' | 'spend' | 'ai' | 'business' | 'appearance' | 'data';

/** One step in the back/forward history of the top bar. */
export interface NavEntry {
  view: View;
  conversationId: string | null;
}

interface UiState {
  view: View;
  settingsTab: SettingsTab;
  /** Text to put into the composer (e.g. "Spørg om denne kampagne"). */
  draft: string | null;
  history: NavEntry[];
  historyIndex: number;
  go: (view: View, tab?: SettingsTab) => void;
  setDraft: (draft: string | null) => void;
  /** Records a navigation step (called by useNavigationHistory). */
  record: (entry: NavEntry) => void;
  move: (delta: -1 | 1) => NavEntry | null;
}

export const useUi = create<UiState>()((set, get) => ({
  view: 'chat',
  settingsTab: 'connections',
  draft: null,
  history: [],
  historyIndex: -1,
  go: (view, tab) => set((s) => ({ view, settingsTab: tab ?? s.settingsTab })),
  setDraft: (draft) => set({ draft }),
  record: (entry) =>
    set((s) => {
      const current = s.history[s.historyIndex];
      if (current && current.view === entry.view && current.conversationId === entry.conversationId) return s;
      const history = [...s.history.slice(0, s.historyIndex + 1), entry].slice(-50);
      return { history, historyIndex: history.length - 1 };
    }),
  move: (delta) => {
    const { history, historyIndex } = get();
    const next = historyIndex + delta;
    const entry = history[next];
    if (!entry) return null;
    set({ historyIndex: next, view: entry.view });
    return entry;
  },
}));
