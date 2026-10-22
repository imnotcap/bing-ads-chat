import type Anthropic from '@anthropic-ai/sdk';
import { del, get, set as idbSet } from 'idb-keyval';
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
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
  /** Tokens the model held after the last request in this reply (the session rail's "Kontekst"). */
  contextTokens?: number;
  /** The follow-up offered after changes in this reply (see FollowUpCard). */
  followUp?: FollowUpState;
  /** Made by "/test" in the app – never sent to the AI. Shows a follow-up without real changes. */
  test?: boolean;
}

export type FollowUpState =
  | { status: 'dismissed' }
  | {
      status: 'created';
      boardId: string;
      cardId: string;
      due: string;
      time: string;
      outlookLink?: string | null;
      outlookError?: string;
      /** The address the follow-up was mailed to. */
      mailTo?: string;
      mailError?: string;
    };

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
  /** Gemini thought signatures per tool call id (sent back on the next Gemini request). */
  geminiSignatures?: Record<string, string>;
  /** The campaign (and ad group) the user chose to work on in the chat field. */
  focus?: ChatFocus | null;
}

export interface ChatFocus {
  campaignId: string;
  campaignName: string;
  /** Empty: the whole campaign. */
  adGroupId?: string;
  adGroupName?: string;
}

/**
 * IndexedDB with debounced writes – streaming updates the store many times per second.
 * The state is only turned into JSON when it is written: serializing a long conversation
 * on every update made typing and scrolling stutter while an answer streamed in.
 */
function debouncedIdbStorage<S>(delay = 600): PersistStorage<S> {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    getItem: async (name) => {
      const raw = await get<string>(name);
      return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
    },
    setItem: (name, value) => {
      clearTimeout(timers.get(name));
      timers.set(
        name,
        setTimeout(() => {
          timers.delete(name);
          void idbSet(name, JSON.stringify(value));
        }, delay),
      );
    },
    removeItem: async (name) => {
      clearTimeout(timers.get(name));
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
      storage: debouncedIdbStorage<Pick<ChatState, 'conversations' | 'activeId'>>(),
      partialize: ({ conversations, activeId }) => ({ conversations, activeId }),
      // A run cannot survive a restart: mark anything that was in flight as stopped.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ChatState>;
        const conversations = (p.conversations ?? []).filter(isRecent).map(stopInFlight);
        return {
          ...current,
          activeId: conversations.some((c) => c.id === p.activeId) ? (p.activeId ?? null) : null,
          conversations,
        };
      },
    },
  ),
);

/** Conversations are deleted 14 days after their last message. */
export const KEEP_DAYS = 14;

const isRecent = (c: Conversation) => c.updatedAt >= Date.now() - KEEP_DAYS * 86_400_000;

/** Deletes conversations with no activity for KEEP_DAYS (never one that is running). */
export function deleteOldConversations() {
  const { conversations, running, activeId } = useChat.getState();
  const keep = conversations.filter((c) => isRecent(c) || running[c.id]);
  if (keep.length === conversations.length) return;
  useChat.setState({ conversations: keep, activeId: keep.some((c) => c.id === activeId) ? activeId : null });
}

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

/** The whole open conversation: re-renders on every streamed update – only for the chat itself. */
export function useActiveConversation(): Conversation | null {
  return useChat((s) => s.conversations.find((c) => c.id === s.activeId) ?? null);
}

/** The open conversation right now, for event handlers (no re-renders). */
export function activeConversation(): Conversation | null {
  const s = useChat.getState();
  return s.conversations.find((c) => c.id === s.activeId) ?? null;
}

/** What the sidebar and top bar show of a conversation – unchanged while an answer streams. */
export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  hasItems: boolean;
}

const summaries = new Map<string, ConversationSummary>();
export function summarize(c: Conversation): ConversationSummary {
  const old = summaries.get(c.id);
  const hasItems = c.items.length > 0;
  if (old && old.title === c.title && old.updatedAt === c.updatedAt && old.hasItems === hasItems) return old;
  const next = { id: c.id, title: c.title, updatedAt: c.updatedAt, hasItems };
  summaries.set(c.id, next);
  return next;
}

/** Re-renders only when a title, time or "has messages" changes – not on every streamed token. */
export function useConversationSummaries(): ConversationSummary[] {
  return useChat(useShallow((s) => s.conversations.map(summarize)));
}

export function useActiveSummary(): ConversationSummary | null {
  return useChat((s) => {
    const c = s.conversations.find((x) => x.id === s.activeId);
    return c ? summarize(c) : null;
  });
}
