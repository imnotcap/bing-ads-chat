import type Anthropic from '@anthropic-ai/sdk';
import { del, get, set as idbSet } from 'idb-keyval';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { ChangePlan, GuardrailDecision } from '@/ai/guardrails';
import type { ToolPreview, VisualSpec } from '@/ai/visuals';
import type { AttachmentMeta } from '@/lib/attachments';
import { uid } from '@/lib/utils';

export type ApiMessage = Anthropic.Beta.BetaMessageParam;

export type ToolStatus = 'streaming' | 'running' | 'awaiting_approval' | 'done' | 'error' | 'rejected' | 'blocked' | 'stopped';

export interface ToolPart {
  type: 'tool';
  id: string;
  name: string;
  label: string;
  input: unknown;
  status: ToolStatus;
  summary?: string;
  preview?: ToolPreview;
  error?: string;
  plan?: ChangePlan;
  decision?: GuardrailDecision;
  activityId?: string;
  startedAt: number;
  endedAt?: number;
}

export interface TextPart {
  type: 'text';
  id: string;
  text: string;
}

export interface ThinkingPart {
  type: 'thinking';
  id: string;
  text: string;
  startedAt: number;
  endedAt?: number;
}

export interface VisualPart {
  type: 'visual';
  id: string;
  visual: VisualSpec;
}

export interface NoticePart {
  type: 'notice';
  id: string;
  tone: 'info' | 'warning' | 'error';
  text: string;
}

export type Part = TextPart | ThinkingPart | ToolPart | VisualPart | NoticePart;

export interface UserItem {
  kind: 'user';
  id: string;
  ts: number;
  text: string;
  attachments?: AttachmentMeta[];
}

export interface AssistantItem {
  kind: 'assistant';
  id: string;
  ts: number;
  model: string;
  parts: Part[];
  status: 'streaming' | 'done' | 'error' | 'stopped';
  error?: string;
  costUsd?: number;
}

export type ChatItem = UserItem | AssistantItem;

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  accountId: string | null;
  mode: 'demo' | 'live';
  items: ChatItem[];
  /** Exact Messages API history – append-only so cached prompts and thinking stay valid. */
  api: ApiMessage[];
  /** Last <context> block sent, so it is only repeated when something changed. */
  lastContext?: string;
}

/** IndexedDB with debounced writes – streaming updates the store many times per second. */
function debouncedIdbStorage(delay = 600): StateStorage {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    getItem: async (name) => (await get<string>(name)) ?? null,
    setItem: (name, value) => {
      clearTimeout(timers.get(name));
      timers.set(
        name,
        setTimeout(() => {
          timers.delete(name);
          void idbSet(name, value);
        }, delay),
      );
    },
    removeItem: async (name) => {
      await del(name);
    },
  };
}

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  /** Conversation ids with a running agent. */
  running: Record<string, boolean>;
  newConversation: (accountId: string | null, mode: 'demo' | 'live') => string;
  select: (id: string | null) => void;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  patch: (id: string, fn: (c: Conversation) => Partial<Conversation>) => void;
  updateItem: (convId: string, itemId: string, fn: (item: AssistantItem) => AssistantItem) => void;
  setRunning: (id: string, running: boolean) => void;
}

export const useChat = create<ChatState>()(
  persist(
    (set) => ({
      conversations: [],
      activeId: null,
      running: {},
      newConversation: (accountId, mode) => {
        const id = uid('c_');
        const now = Date.now();
        set((s) => ({
          conversations: [{ id, title: 'Ny samtale', createdAt: now, updatedAt: now, accountId, mode, items: [], api: [] }, ...s.conversations],
          activeId: id,
        }));
        return id;
      },
      select: (activeId) => set({ activeId }),
      rename: (id, title) => set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)) })),
      remove: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      clearAll: () => set({ conversations: [], activeId: null }),
      patch: (id, fn) =>
        set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, ...fn(c), updatedAt: Date.now() } : c)) })),
      updateItem: (convId, itemId, fn) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, items: c.items.map((it) => (it.id === itemId && it.kind === 'assistant' ? fn(it) : it)) }
              : c,
          ),
        })),
      setRunning: (id, running) => set((s) => ({ running: { ...s.running, [id]: running } })),
    }),
    {
      name: 'bac.chat',
      version: 1,
      storage: createJSONStorage(() => debouncedIdbStorage()),
      partialize: ({ conversations, activeId }) => ({ conversations, activeId }),
      // A run cannot survive a restart: mark anything that was in flight as stopped.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ChatState>;
        return {
          ...current,
          activeId: p.activeId ?? null,
          conversations: (p.conversations ?? []).map(stopInFlight),
        };
      },
    },
  ),
);

function stopInFlight(c: Conversation): Conversation {
  return {
    ...c,
    items: c.items.map((it) =>
      it.kind === 'assistant' && it.status === 'streaming'
        ? {
            ...it,
            status: 'stopped',
            parts: it.parts.map((p) =>
              p.type === 'tool' && (p.status === 'running' || p.status === 'awaiting_approval' || p.status === 'streaming') ? { ...p, status: 'stopped' } : p,
            ),
          }
        : it,
    ),
  };
}

export function useActiveConversation(): Conversation | null {
  return useChat((s) => s.conversations.find((c) => c.id === s.activeId) ?? null);
}
