import { create } from 'zustand';

export type View = 'chat' | 'campaigns' | 'activity' | 'settings';
export type SettingsTab = 'connections' | 'spend' | 'ai' | 'business' | 'appearance' | 'data';

interface UiState {
  view: View;
  settingsTab: SettingsTab;
  /** Text to put into the composer (e.g. "Spørg om denne kampagne"). */
  draft: string | null;
  go: (view: View, tab?: SettingsTab) => void;
  setDraft: (draft: string | null) => void;
}

export const useUi = create<UiState>()((set) => ({
  view: 'chat',
  settingsTab: 'connections',
  draft: null,
  go: (view, tab) => set((s) => ({ view, settingsTab: tab ?? s.settingsTab })),
  setDraft: (draft) => set({ draft }),
}));
