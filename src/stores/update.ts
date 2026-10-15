import { create } from 'zustand';
import { errorMessage } from '@/lib/utils';
import { installUpdate, onUpdateProgress } from '@/lib/updater';

export interface AvailableUpdate {
  version: string;
  notes: string | null;
}

export type UpdatePhase = 'idle' | 'downloading' | 'installing' | 'error';

interface UpdateState {
  available: AvailableUpdate | null;
  /** The "Ny version er klar" dialog. */
  promptOpen: boolean;
  phase: UpdatePhase;
  /** 0–1 while downloading, null when the size is unknown. */
  progress: number | null;
  downloaded: number;
  total: number | null;
  error: string | null;
  setAvailable: (update: AvailableUpdate) => void;
  openPrompt: () => void;
  closePrompt: () => void;
  install: () => Promise<void>;
}

export const isBusy = (phase: UpdatePhase) => phase === 'downloading' || phase === 'installing';

/**
 * In-app updates: the signed update is downloaded and installed by the Rust
 * updater and the app restarts itself – nobody has to fetch a new installer.
 */
export const useUpdate = create<UpdateState>()((set, get) => ({
  available: null,
  promptOpen: false,
  phase: 'idle',
  progress: null,
  downloaded: 0,
  total: null,
  error: null,
  setAvailable: (update) => set({ available: update }),
  openPrompt: () => set({ promptOpen: true }),
  closePrompt: () => {
    // The download can't be cancelled – keep the dialog open while it runs.
    if (isBusy(get().phase)) return;
    set({ promptOpen: false, phase: 'idle', error: null });
  },
  install: async () => {
    if (isBusy(get().phase)) return;
    set({ promptOpen: true, phase: 'downloading', progress: null, downloaded: 0, total: null, error: null });
    const unlisten = await onUpdateProgress(({ stage, downloaded, total, finished }) => {
      if (finished || stage === 'install') set({ phase: 'installing', progress: 1 });
      else set({ downloaded, total, progress: total ? Math.min(1, downloaded / total) : null });
    });
    try {
      // On success the installer closes the app and starts the new version.
      await installUpdate();
      set({ phase: 'installing', progress: 1 });
    } catch (err) {
      set({ phase: 'error', error: errorMessage(err) || 'Opdateringen kunne ikke installeres.' });
    } finally {
      unlisten();
    }
  },
}));
