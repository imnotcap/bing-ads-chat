import { motion } from 'motion/react';
import { CalendarDays, Pencil, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { bidLabel } from '@/ai/tools/write';
import { statusLabel } from '@/ai/tools/context';
import { ChangeBadge } from '@/components/blocks/ChangeBadge';
import { KpiGrid } from '@/components/blocks/KpiGrid';
import { EASE, pageTransition } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Badge, Segmented, Switch } from '@/components/ui/controls';
import { Select, Tooltip } from '@/components/ui/overlays';
import { change, derive, sumMetrics } from '@/bing/metrics';
import { useAccountTrend, useCampaigns, useSelectedRange, type CampaignRow } from '@/hooks/useAdsData';
import { DATE_PRESET_LABELS, fmtMoney, fmtNumber, fmtPercent, type DatePreset } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useCurrentAccount } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { startChat } from '../chat/ChatView';
import { userUpdateCampaigns } from './actions';

const TYPE_LABEL: Record<string, string> = { Search: 'Søgning', Shopping: 'Shopping', Audience: 'Audience', PerformanceMax: 'PMax' };

function BudgetCell({ c, all, currency }: { c: CampaignRow; all: CampaignRow[]; currency: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(c.dailyBudget ?? ''));
  if (c.sharedBudgetId) return <span className="text-muted">Delt budget</span>;
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(String(c.dailyBudget ?? '').replace('.', ','));
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 tabular hover:bg-brand-50"
      >
        {fmtMoney(c.dailyBudget, currency)}
        <Pencil className="size-3 text-subtle opacity-0 group-hover:opacity-100" />
      </button>
    );
  }
  const save = async () => {
    const n = Number(value.replace(/\./g, '').replace(',', '.'));
    setEditing(false);
    if (!Number.isFinite(n) || n <= 0 || n === c.dailyBudget) return;
    await userUpdateCampaigns(all, [{ campaignId: c.id, dailyBudget: n }], `Dagsbudget for ${c.name}: ${fmtMoney(n, currency)}`);
  };
  return (
    <input
      autoFocus
      value={value}
      inputMode="decimal"
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void save();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="h-8 w-24 rounded-lg border border-brand/40 bg-white px-2 text-right text-[13px] tabular outline-none ring-4 ring-brand/10"
    />
  );
}

export function CampaignsPage() {
  const range = useSelectedRange();
  const setDatePreset = useSettings((s) => s.setDatePreset);
  const account = useCurrentAccount();
  const currency = account?.currency ?? 'DKK';
  const { data, isLoading, isFetching, error } = useCampaigns(range);
  const trend = useAccountTrend(range);
  const go = useUi((s) => s.go);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (c) =>
          (filter === 'all' || (filter === 'active' ? c.status === 'Active' : c.status !== 'Active')) &&
          c.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [data, filter, query],
  );
  const totals = derive(sumMetrics(rows.map((r) => r.metrics ?? {})));
  const t = trend.data;

  const ask = (prompt: string) => {
    go('chat');
    startChat(prompt);
  };

  return (
    <motion.div {...pageTransition} className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-8 pb-4 pt-7">
        <div className="mr-auto">
          <h1 className="text-[26px] font-medium tracking-[-0.03em] text-ink">Kampagner</h1>
          <p className="text-[13px] text-muted">
            {account?.name} · {DATE_PRESET_LABELS[range.preset]}
          </p>
        </div>
        <Select<DatePreset>
          triggerVariant="pill"
          value={range.preset}
          onChange={setDatePreset}
          aria-label="Periode"
          options={(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => ({ value: p, label: DATE_PRESET_LABELS[p], icon: <CalendarDays className="size-3.5 text-muted" /> }))}
        />
        <Button variant="secondary" size="sm" onClick={() => void queryClient.invalidateQueries()}>
          <RefreshCw className={cn(isFetching && 'animate-spin')} /> Opdatér
        </Button>
        <Button variant="gradient" size="sm" onClick={() => ask('Gennemgå alle kampagner i den valgte periode og giv mig en prioriteret liste med de vigtigste forbedringer.')}>
          <Sparkles /> Analysér med AI
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 pb-10">
        {t && (
          <KpiGrid
            className="mb-5 lg:grid-cols-6"
            currency={currency}
            items={[
              { label: 'Forbrug', value: t.totals.spend, format: 'money', change: change(t.totals.spend, t.previous.spend), invert: true },
              { label: 'Klik', value: t.totals.clicks, format: 'number', change: change(t.totals.clicks, t.previous.clicks) },
              { label: 'CTR', value: t.totals.ctr, format: 'percent', change: change(t.totals.ctr, t.previous.ctr) },
              { label: 'Konverteringer', value: t.totals.conversions, format: 'decimal', change: change(t.totals.conversions, t.previous.conversions) },
              { label: 'CPA', value: t.totals.cpa, format: 'money', change: change(t.totals.cpa, t.previous.cpa), invert: true },
              { label: 'ROAS', value: t.totals.roas, format: 'ratio', change: change(t.totals.roas, t.previous.roas) },
            ]}
          />
        )}

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
            <Segmented
              layoutId="campaign-filter"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'active', label: 'Aktive' },
                { value: 'paused', label: 'Pausede' },
              ]}
            />
            <div className="relative ml-auto w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Søg efter kampagne"
                className="h-8 w-full rounded-lg bg-line-2 pl-8 pr-2 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>
          {error ? (
            <p className="p-6 text-[13px] text-negative">{(error as Error).message}</p>
          ) : isLoading ? (
            <div className="grid gap-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-xl bg-line-2" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 whitespace-nowrap text-[13px]">
                <thead>
                  <tr className="text-left text-[11.5px] font-semibold text-muted">
                    {['Kampagne', 'Aktiv', 'Dagsbudget', 'Budstrategi', 'Forbrug', 'Klik', 'CTR', 'Konv.', 'CPA', 'ROAS', ''].map((h, i) => (
                      <th key={h || i} className={cn('whitespace-nowrap border-b border-line bg-[#fafafb] px-3 py-2.5 first:pl-4', i >= 4 && i <= 9 && 'text-right')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c, i) => {
                    const m = c.metrics;
                    const roasGood = (m?.roas ?? 0) >= (totals.roas ?? 0);
                    return (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 12) * 0.02 }}
                        className="group transition-colors hover:bg-brand-50/30"
                      >
                        <td className="border-b border-line-2 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="max-w-[230px] truncate font-medium text-ink" title={c.name}>
                              {c.name}
                            </span>
                            <Badge>{TYPE_LABEL[c.type] ?? c.type}</Badge>
                          </div>
                          {c.status !== 'Active' && c.status !== 'Paused' && <div className="text-[11.5px] text-muted">{statusLabel(c.status)}</div>}
                        </td>
                        <td className="border-b border-line-2 px-3 py-2.5">
                          <Switch
                            checked={c.status === 'Active'}
                            aria-label={`${c.name} aktiv`}
                            onCheckedChange={(on) =>
                              void userUpdateCampaigns(data ?? [], [{ campaignId: c.id, status: on ? 'Active' : 'Paused' }], `${c.name} ${on ? 'aktiveret' : 'sat på pause'}`)
                            }
                          />
                        </td>
                        <td className="border-b border-line-2 px-3 py-2.5">
                          <BudgetCell c={c} all={data ?? []} currency={currency} />
                        </td>
                        <td className="max-w-[170px] truncate border-b border-line-2 px-3 py-2.5 text-ink-2" title={bidLabel(c.bidStrategy)}>{bidLabel(c.bidStrategy)}</td>
                        <td className="border-b border-line-2 px-3 py-2.5 text-right tabular text-ink">{fmtMoney(m?.spend ?? 0, currency)}</td>
                        <td className="border-b border-line-2 px-3 py-2.5 text-right tabular">{fmtNumber(m?.clicks ?? 0)}</td>
                        <td className="border-b border-line-2 px-3 py-2.5 text-right tabular">{fmtPercent(m?.ctr ?? null)}</td>
                        <td className="border-b border-line-2 px-3 py-2.5 text-right tabular">{fmtNumber(m?.conversions ?? 0, 1)}</td>
                        <td className="border-b border-line-2 px-3 py-2.5 text-right tabular">{fmtMoney(m?.cpa ?? null, currency)}</td>
                        <td className="border-b border-line-2 px-3 py-2.5 text-right">
                          <span className={cn('tabular font-medium', m?.roas ? (roasGood ? 'text-positive' : 'text-ink-2') : 'text-subtle')}>
                            {m?.roas ? `${fmtNumber(m.roas, 2)}x` : '–'}
                          </span>
                        </td>
                        <td className="border-b border-line-2 px-3 py-2.5 text-right">
                          <Tooltip content="Spørg assistenten om denne kampagne">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              aria-label={`Spørg om ${c.name}`}
                              className="opacity-60 group-hover:opacity-100"
                              onClick={() => ask(`Analysér kampagnen "${c.name}" (id ${c.id}) i den valgte periode: hvad går godt, hvad bør forbedres, og hvilke konkrete ændringer foreslår du?`)}
                            >
                              <Sparkles className="text-violet" />
                            </Button>
                          </Tooltip>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="text-[12.5px] font-semibold text-ink">
                    <td className="bg-[#fafafb] px-3 py-2.5" colSpan={4}>
                      I alt · {rows.length} kampagner
                    </td>
                    <td className="bg-[#fafafb] px-3 py-2.5 text-right tabular">{fmtMoney(totals.spend, currency)}</td>
                    <td className="bg-[#fafafb] px-3 py-2.5 text-right tabular">{fmtNumber(totals.clicks)}</td>
                    <td className="bg-[#fafafb] px-3 py-2.5 text-right tabular">{fmtPercent(totals.ctr)}</td>
                    <td className="bg-[#fafafb] px-3 py-2.5 text-right tabular">{fmtNumber(totals.conversions, 1)}</td>
                    <td className="bg-[#fafafb] px-3 py-2.5 text-right tabular">{fmtMoney(totals.cpa, currency)}</td>
                    <td className="bg-[#fafafb] px-3 py-2.5 text-right tabular">{totals.roas ? `${fmtNumber(totals.roas, 2)}x` : '–'}</td>
                    <td className="bg-[#fafafb]" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        {t && (
          <p className="mt-3 flex items-center gap-2 text-[12px] text-muted">
            Konverteringer vs. forrige periode <ChangeBadge change={change(t.totals.conversions, t.previous.conversions)} />
          </p>
        )}
      </div>
    </motion.div>
  );
}
