/**
 * The company's subscription and shared AI-usage pool (cloudflare/src/billing.ts): how
 * much of the month's included use and bought credits is left, and buying an extra-usage
 * pack (admins). The cost of every AI request is reported here.
 */
import { create } from 'zustand';
import { fmtUsd } from '@/lib/format';
import { api } from './api';
import type { BillingPurchase, BillingState } from './types';

interface BillingStore {
  state: BillingState | null;
  /** Cost reported but not yet confirmed by Cloudflare. */
  pending: number;
}

export const useBilling = create<BillingStore>(() => ({ state: null, pending: 0 }));

export async function refreshBilling(): Promise<BillingState | null> {
  try {
    const state = await api<BillingState>('/billing');
    useBilling.setState({ state });
    return state;
  } catch {
    return useBilling.getState().state;
  }
}

/** Counts one AI request against the user's subscription. */
export function reportUsage(costUsd: number) {
  if (!(costUsd > 0)) return;
  useBilling.setState((s) => ({ pending: s.pending + costUsd }));
  void api<BillingState>('/billing/usage', { method: 'POST', body: JSON.stringify({ costUsd }) })
    .then((state) => useBilling.setState((s) => ({ state, pending: Math.max(0, s.pending - costUsd) })))
    .catch(() => {
      /* counted again from the local number on the next refresh */
    });
}

/** What is left this month (included use + credits), minus requests not confirmed yet. */
export function remainingUsd(): number | null {
  const { state, pending } = useBilling.getState();
  if (!state || typeof state.remainingUsd !== 'number' || !Number.isFinite(state.remainingUsd)) return null;
  return state.remainingUsd - pending;
}

/**
 * Null when the assistant may run; otherwise the message to show.
 *
 * Only a number we can trust blocks the chat. Anything else – an older Worker, a reply
 * that did not carry the pool, a request that never arrived – lets the assistant run:
 * being unable to read the usage pool must never be the reason nobody can write.
 */
export function usageBlocked(): string | null {
  const left = remainingUsd();
  const state = useBilling.getState().state;
  if (left === null || !state || left > 0) return null;
  // Only a real YYYY-MM is named. Date() accepts enough nonsense to turn a broken value
  // into a confident, wrong month ("nonsense-01" parses as January).
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(state.month ?? '') ? new Date(`${state.month}-01`) : null;
  const monthName = month ? month.toLocaleDateString('da-DK', { month: 'long' }) : 'denne måned';
  const extra = state.purchases?.length ? ' + ekstra credits' : '';
  const pack = state.pack
    ? ` En administrator kan købe ekstra forbrug i Brug-ringen nederst til højre i chatfeltet: ${fmtUsd(state.pack.priceUsd)} giver ${fmtUsd(state.pack.creditUsd)} ekstra.`
    : ' En administrator kan købe ekstra forbrug i Brug-ringen nederst til højre i chatfeltet.';
  return `Virksomhedens AI-forbrug for ${monthName} er brugt (${fmtUsd(state.includedUsd)} inkluderet${extra}).${pack}`;
}

export async function buyExtraUsage(): Promise<BillingState> {
  const state = await api<BillingState>('/billing/packs', { method: 'POST' });
  useBilling.setState({ state });
  return state;
}

/** Every purchase (admins) – also shown on the website. */
export async function billingPurchases(): Promise<(BillingPurchase & { month: string })[]> {
  return (await api<{ purchases: (BillingPurchase & { month: string })[] }>('/billing/purchases')).purchases;
}
