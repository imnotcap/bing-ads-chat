/**
 * Runs the agents (run.ts) once a weekday, from 07:00, while the app is open (it keeps
 * running in the tray). Only on the real account and when signed in to the workspace.
 * Each app remembers what it ran today; the team-wide agents also claim their run with the
 * Worker, so only one app in the team makes each card.
 */
import { useEffect } from 'react';
import { getBackend } from '@/bing/backend';
import { toast } from '@/components/notifications/toast';
import { today } from '@/lib/format';
import { useAccount } from '@/stores/account';
import { useConnection } from '@/stores/connection';
import { useSettings, type AgentSettings } from '@/stores/settings';
import { claimAgentRun } from '@/workspace/shared';
import { runFollowUp, runPeriods, runRejections, runSearchTerms, type AgentEnv } from './run';

type AgentId = keyof AgentSettings;

const AGENTS: { id: AgentId; name: string; run: (env: AgentEnv) => Promise<number>; weekly?: boolean }[] = [
  { id: 'followUp', name: 'Opfølgning', run: runFollowUp },
  { id: 'periods', name: 'Periode-vagt', run: runPeriods },
  { id: 'rejections', name: 'Afvisninger', run: runRejections },
  { id: 'searchTerms', name: 'Søgetermer', run: runSearchTerms, weekly: true },
];

const CHECK_MS = 10 * 60_000;
const KEY = 'bac.agents.ran';

/** Monday of the week, as YYYY-MM-DD – the weekly agents run once in it. */
function weekOf(d = new Date()): string {
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}

function ranMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function markRan(key: string, when: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...ranMap(), [key]: when }));
  } catch {
    /* private window – the Worker claim still keeps it to once */
  }
}

let running = false;

export async function runDueAgents(force = false) {
  const now = new Date();
  if (!force && (now.getDay() === 0 || now.getDay() === 6 || now.getHours() < 7)) return;
  const { accountId, mode, accounts } = useConnection.getState();
  if (running || !accountId || mode !== 'live' || !useAccount.getState().workspace) return;
  const enabled = useSettings.getState().agents;
  running = true;
  try {
    const settings = useSettings.getState();
    const backend = await getBackend();
    const currency = accounts.find((a) => a.id === accountId)?.currency ?? 'DKK';
    const env: AgentEnv = {
      backend,
      accountId,
      currency,
      claim: (key) => claimAgentRun(`${accountId}:${key}`),
      tool: { backend, accountId, currency, rules: settings.spend, defaultPreset: settings.datePreset, memo: new Map() },
    };
    for (const a of AGENTS) {
      if (!enabled[a.id]) continue;
      const stamp = a.weekly ? weekOf(now) : today();
      const key = `${a.id}.${accountId}`;
      if (!force && ranMap()[key] === stamp) continue;
      markRan(key, stamp);
      try {
        const made = await a.run(env);
        if (made) toast.info(`${a.name}-agenten har lagt ${made === 1 ? 'et kort' : `${made} kort`} på planlægningen`);
      } catch (e) {
        console.warn(`Agent ${a.id} fejlede`, e);
      }
    }
  } finally {
    running = false;
  }
}

export function useAgents() {
  const accountId = useConnection((s) => s.accountId);
  const mode = useConnection((s) => s.mode);
  const anyOn = useSettings((s) => Object.values(s.agents).some(Boolean));
  useEffect(() => {
    if (!accountId || mode !== 'live' || !anyOn) return;
    const run = () => void runDueAgents().catch(() => undefined);
    const first = setTimeout(run, 45_000);
    const t = setInterval(run, CHECK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [accountId, mode, anyOn]);
}
