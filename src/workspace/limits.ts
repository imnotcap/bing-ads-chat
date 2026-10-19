/**
 * Budget and limits per branch (src/ai/branchLimits.ts), shared in the workspace on
 * Cloudflare. Microsoft Advertising's limits are mirrored into the local spending rules
 * (useSettings.spend), which the guardrails, the budget watch and the insights read.
 */
import { create } from 'zustand';
import { DEFAULT_LIMITS, cleanLimits, effectiveLimits, type BranchLimits, type LimitBranchId, type StoredLimits } from '@/ai/branchLimits';
import { useSettings } from '@/stores/settings';
import { api } from './api';

interface LimitsState {
  /** null until loaded. A branch nobody has changed is null (= the defaults). */
  stored: Partial<Record<LimitBranchId, StoredLimits | null>> | null;
  loadedAt: number;
  error: string | null;
  set: (patch: Partial<Omit<LimitsState, 'set'>>) => void;
}

export const useLimits = create<LimitsState>((set) => ({ stored: null, loadedAt: 0, error: null, set: (patch) => set(patch) }));

/** The fields where this PC's spending rules differ from the defaults. */
function localChanges(): Partial<BranchLimits> {
  const local = useSettings.getState().spend;
  return cleanLimits(Object.fromEntries(Object.entries(local).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(DEFAULT_LIMITS[k as keyof BranchLimits]))));
}

function mirror(stored: StoredLimits | null | undefined) {
  useSettings.getState().setSpend(effectiveLimits(stored));
}

export async function loadLimits() {
  try {
    const { limits } = await api<{ limits: Record<LimitBranchId, StoredLimits | null> }>('/limits');
    // Before the limits were shared, Microsoft's were kept on each PC: the first PC
    // to connect brings its own up to the workspace.
    if (!limits.microsoft_ads && Object.keys(localChanges()).length) {
      limits.microsoft_ads = (await api<{ limits: StoredLimits }>('/limits/microsoft_ads', { method: 'PUT', body: JSON.stringify({ values: localChanges() }) })).limits;
    }
    useLimits.getState().set({ stored: limits, loadedAt: Date.now(), error: null });
    mirror(limits.microsoft_ads);
  } catch (e) {
    useLimits.getState().set({ error: e instanceof Error ? e.message : String(e) });
  }
}

/** All branches' limits for the assistant (reloaded when older than a minute; offline: what we have). */
export async function allLimits() {
  const s = useLimits.getState();
  if (!s.stored || Date.now() - s.loadedAt > 60_000) await loadLimits();
  return useLimits.getState().stored ?? {};
}

/** Saves the changed fields for a branch, shared with everyone. */
export async function saveLimits(id: LimitBranchId, values: Partial<BranchLimits>) {
  const { stored, set } = useLimits.getState();
  const before = stored?.[id] ?? null;
  // Show the change at once; roll back if the workspace refuses it.
  const optimistic: StoredLimits = { values: { ...(before?.values ?? {}), ...values }, updatedBy: before?.updatedBy ?? null, updatedAt: before?.updatedAt ?? null };
  set({ stored: { ...(stored ?? {}), [id]: optimistic } });
  if (id === 'microsoft_ads') mirror(optimistic);
  try {
    const { limits } = await api<{ limits: StoredLimits }>(`/limits/${id}`, { method: 'PUT', body: JSON.stringify({ values }) });
    set({ stored: { ...(useLimits.getState().stored ?? {}), [id]: limits } });
    if (id === 'microsoft_ads') mirror(limits);
    return limits;
  } catch (e) {
    set({ stored: { ...(useLimits.getState().stored ?? {}), [id]: before } });
    if (id === 'microsoft_ads') mirror(before);
    throw e;
  }
}

let queued: Partial<BranchLimits> = {};
let queueTimer: ReturnType<typeof setTimeout> | null = null;

/** For inputs that change on every keystroke (onboarding): shows it at once, saves shortly after. */
export function queueMicrosoftLimits(values: Partial<BranchLimits>) {
  useSettings.getState().setSpend(values);
  queued = { ...queued, ...values };
  if (queueTimer) clearTimeout(queueTimer);
  queueTimer = setTimeout(() => {
    const send = queued;
    queued = {};
    void saveLimits('microsoft_ads', send).catch(() => {});
  }, 700);
}
