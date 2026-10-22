import { create } from 'zustand';

export type View = 'chat' | 'dashboard' | 'campaigns' | 'products' | 'activity' | 'board';

/** Views of the dashboard workspace (its own sidebar). */
export const DASHBOARD_VIEWS: View[] = ['dashboard', 'campaigns', 'products', 'activity', 'board'];
export const isDashboardView = (v: View) => DASHBOARD_VIEWS.includes(v);
export type SettingsTab = 'connections' | 'users' | 'spend' | 'training' | 'ai' | 'business' | 'appearance' | 'data' | 'about' | 'models';

/** One step in the back/forward history of the top bar. */
export interface NavEntry {
  view: View;
  conversationId: string | null;
  boardId?: string | null;
}

interface UiState {
  view: View;
  /** The open planning board (view 'board'). */
  boardId: string | null;
  /** Where the Dashboard switch in the top bar returns to. */
  lastDashView: View;
  settingsTab: SettingsTab;
  /** Settings open as a dialog on top of the current view. */
  settingsOpen: boolean;
  /** Text to put into the composer (e.g. "Spørg om denne kampagne"). */
  draft: string | null;
  /** The top bar's conversation title is being edited inline. */
  renaming: boolean;
  /** The "Slet samtalen?" dialog is open. */
  confirmDelete: boolean;
  /** The "Log ind med Microsoft" dialog is open. */
  signInOpen: boolean;
  history: NavEntry[];
  historyIndex: number;
  /** Navigate to a view – 'settings' opens the settings dialog (optionally on a tab). */
  go: (view: View | 'settings', tab?: SettingsTab) => void;
  openBoard: (boardId: string) => void;
  closeSettings: () => void;
  setDraft: (draft: string | null) => void;
  setRenaming: (renaming: boolean) => void;
  setConfirmDelete: (confirmDelete: boolean) => void;
  setSignInOpen: (signInOpen: boolean) => void;
  /** Records a navigation step (called by useNavigationHistory). */
  record: (entry: NavEntry) => void;
  move: (delta: -1 | 1) => NavEntry | null;
}

export const useUi = create<UiState>()((set, get) => ({
  view: 'chat',
  boardId: null,
  lastDashView: 'dashboard',
  settingsTab: 'connections',
  settingsOpen: false,
  draft: null,
  renaming: false,
  confirmDelete: false,
  signInOpen: false,
  history: [],
  historyIndex: -1,
  go: (view, tab) =>
    set((s) =>
      view === 'settings'
        ? { settingsOpen: true, settingsTab: tab ?? s.settingsTab }
        : { view, settingsOpen: false, ...(isDashboardView(view) && (view !== 'board' || s.boardId) ? { lastDashView: view } : {}) },
    ),
  openBoard: (boardId) => set({ view: 'board', boardId, lastDashView: 'board', settingsOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),
  setDraft: (draft) => set({ draft }),
  setRenaming: (renaming) => set({ renaming }),
  setConfirmDelete: (confirmDelete) => set({ confirmDelete }),
  setSignInOpen: (signInOpen) => set({ signInOpen }),
  record: (entry) =>
    set((s) => {
      const current = s.history[s.historyIndex];
      if (current && current.view === entry.view && current.conversationId === entry.conversationId && (current.boardId ?? null) === (entry.boardId ?? null)) return s;
      const history = [...s.history.slice(0, s.historyIndex + 1), entry].slice(-50);
      return { history, historyIndex: history.length - 1 };
    }),
  move: (delta) => {
    const { history, historyIndex } = get();
    const next = historyIndex + delta;
    const entry = history[next];
    if (!entry) return null;
    set({ historyIndex: next, view: entry.view, ...(entry.boardId ? { boardId: entry.boardId } : {}) });
    return entry;
  },
}));
