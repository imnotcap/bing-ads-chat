/**
 * The department's data sources (src/workspace/connectors.ts), stored and tested in
 * the workspace on Cloudflare. Secrets are sent once when saved and never come back.
 */
import { create } from 'zustand';
import { api } from './api';
import type { ConnectorId, ConnectorSaveResult, ConnectorSummary } from './connectors';

interface SourcesState {
  list: ConnectorSummary[] | null;
  error: string | null;
  set: (patch: Partial<Omit<SourcesState, 'set'>>) => void;
}

export const useSources = create<SourcesState>((set) => ({ list: null, error: null, set: (patch) => set(patch) }));

function keep(result: ConnectorSaveResult) {
  const { list, set } = useSources.getState();
  set({ list: (list ?? []).some((c) => c.id === result.connector.id) ? list!.map((c) => (c.id === result.connector.id ? result.connector : c)) : [...(list ?? []), result.connector] });
  return result;
}

export async function loadSources() {
  try {
    const { connectors } = await api<{ connectors: ConnectorSummary[] }>('/connections');
    useSources.getState().set({ list: connectors, error: null });
  } catch (e) {
    useSources.getState().set({ error: e instanceof Error ? e.message : String(e) });
  }
}

/** Saves the values (empty secrets keep the stored ones) and tests the connection. */
export async function saveSource(id: ConnectorId, config: Record<string, string>, secrets: Record<string, string>) {
  return keep(await api<ConnectorSaveResult>(`/connections/${id}`, { method: 'PUT', body: JSON.stringify({ config, secrets }) }));
}

export async function testSource(id: ConnectorId) {
  return keep(await api<ConnectorSaveResult>(`/connections/${id}/test`, { method: 'POST' }));
}

export async function disconnectSource(id: ConnectorId) {
  return keep(await api<ConnectorSaveResult>(`/connections/${id}`, { method: 'DELETE' }));
}

/** Daisycon: the login page to open in the browser. */
export async function startSourceLogin(id: ConnectorId) {
  return api<{ url: string }>(`/connections/${id}/login/start`, { method: 'POST' });
}

/** Daisycon: the code shown after logging in → connected. */
export async function completeSourceLogin(id: ConnectorId, code: string) {
  return keep(await api<ConnectorSaveResult>(`/connections/${id}/login/complete`, { method: 'POST', body: JSON.stringify({ code }) }));
}
