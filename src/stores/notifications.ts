/** Notification history (the bell in the top bar). The last 60 are kept. */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '@/lib/utils';

export type NotificationTone = 'success' | 'error' | 'warning' | 'info' | 'update' | 'sync';

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  tone: NotificationTone;
  ts: number;
  read: boolean;
}

interface NotificationState {
  items: AppNotification[];
  push: (n: Omit<AppNotification, 'id' | 'ts' | 'read'>) => AppNotification;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotifications = create<NotificationState>()(
  persist(
    (set) => ({
      items: [],
      push: (n) => {
        const item: AppNotification = { ...n, id: uid('n_'), ts: Date.now(), read: false };
        set((s) => ({ items: [item, ...s.items].slice(0, 60) }));
        return item;
      },
      markAllRead: () => set((s) => ({ items: s.items.map((i) => (i.read ? i : { ...i, read: true })) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'bac.notifications', version: 1 },
  ),
);
