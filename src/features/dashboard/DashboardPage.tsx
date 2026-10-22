/**
 * Dashboard → Overblik: the period at a glance, laid out like a "weekly pulse" – week or
 * month with arrows, an insight box that reads the numbers out, four KPI cards, the
 * period against the one before day by day, where the results come from, and the top
 * campaigns. Every campaign row has a right-click menu.
 */
import { ArrowDownUp, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Filter, RefreshCw } from '@/components/icons';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { change, derive } from '@/bing/metrics';
import type { DerivedMetrics } from '@/bing/types';
import { BrandIcon, type Brand } from '@/components/brand/BrandIcon';
import { ChangeBadge } from '@/components/blocks/ChangeBadge';
import { EASE, fadeUp, pageTransition, stagger } from '@/components/motion';
import { toast } from '@/components/notifications/toast';
import { CountUp, SpotlightCard } from '@/components/reactbits';
import { Button } from '@/components/ui/button';
import { ContextMenu } from '@/components/ui/contextMenu';
import { Badge } from '@/components/ui/controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, Select, Tooltip } from '@/components/ui/overlays';
import { campaignMenuItems } from '@/features/campaigns/campaignMenu';
import { startChat } from '@/features/chat/startChat';
import { computeAlerts } from '@/features/insights/alerts';
import { useCampaigns, usePeriodTrend, type CampaignRow } from '@/hooks/useAdsData';
import { fmtCompact, fmtDate, fmtMoney, fmtNumber, fmtPercent } from '@/lib/format';
import { saveExport } from '@/lib/platform';
import { queryClient } from '@/lib/queryClient';
import { cn, errorMessage } from '@/lib/utils';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useUi } from '@/stores/ui';
import { InsightBox } from './InsightBox';
import { buildInsights, type InsightPage } from './insights';
import { axisLabels, periodOf, type Granularity, type Period } from './period';

const COLORS = ['#6d5cf6', '#14b8a6', '#8b5cf6', '#f59e0b', '#c4c4d0'];

const CHANNELS: { id: string; label: string; brand: Brand; live: boolean }[] = [
  { id: 'microsoft_ads', label: 'Microsoft Ads', brand: 'microsoft_ads', live: true },
  { id: 'google_ads', label: 'Google Ads', brand: 'google_ads', live: false },
  { id: 'meta', label: 'Meta Ads', brand: 'meta', live: false },
  { id: 'linkedin', label: 'LinkedIn Ads', brand: 'linkedin', live: false },
];

const TYPE_LABEL: Record<string, string> = { Search: 'Søgning', Shopping: 'Shopping', Audience: 'Audience', PerformanceMax: 'Performance Max' };

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-line-2', className)} />;
}

function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <motion.section variants={fadeUp} className={cn('card flex flex-col p-5', className)}>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <div className="ml-auto flex items-center gap-2">{action}</div>
      </div>
      {children}
    </motion.section>
  );
}

/* --------------------------------- controls --------------------------------- */

function ChannelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = CHANNELS.find((c) => c.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-line-2 data-[state=open]:bg-line-2">
          {current ? (
            <BrandIcon brand={current.brand} className="size-4" />
          ) : (
            <span className="flex -space-x-1.5">
              {CHANNELS.map((c) => (
                <span key={c.id} className="grid size-5 place-items-center rounded-full bg-white ring-2 ring-white">
                  <BrandIcon brand={c.brand} className="size-3.5" />
                </span>
              ))}
            </span>
          )}
          {current?.label ?? 'Alle kanaler'}
          <ChevronDown className="size-3.5 text-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[230px]">
        <DropdownMenuLabel>Kanaler</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onChange('all')}>
          <span className="flex-1">Alle kanaler</span>
          {value === 'all' && <Check className="!text-brand" />}
        </DropdownMenuItem>
        {CHANNELS.map((c) => (
          <DropdownMenuItem key={c.id} disabled={!c.live} onSelect={() => onChange(c.id)}>
            <BrandIcon brand={c.brand} className="size-4" />
            <span className="flex-1">{c.label}</span>
            {!c.live ? <span className="text-[11px] text-subtle">Snart</span> : value === c.id && <Check className="!text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PeriodPicker({ period, granularity, onGranularity, onStep }: { period: Period; granularity: Granularity; onGranularity: (g: Granularity) => void; onStep: (d: number) => void }) {
  return (
    <>
      <Select<Granularity>
        triggerVariant="pill"
        value={granularity}
        onChange={onGranularity}
        aria-label="Periodetype"
        className="h-8 border border-line bg-surface text-ink-2"
        options={[
          { value: 'week', label: 'Ugentlig' },
          { value: 'month', label: 'Månedlig' },
        ]}
      />
      <div className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface pl-2.5 pr-1 text-[12.5px] font-medium text-ink-2">
        <CalendarDays className="size-3.5 text-muted" />
        <span className="min-w-[150px] text-center tabular">{period.label}</span>
        <button type="button" aria-label="Forrige periode" onClick={() => onStep(1)} className="grid size-6 place-items-center rounded-md text-muted hover:bg-line-2 hover:text-ink">
          <ChevronLeft className="size-3.5" />
        </button>
        <button type="button" aria-label="Næste periode" disabled={period.current} onClick={() => onStep(-1)} className="grid size-6 place-items-center rounded-md text-muted hover:bg-line-2 hover:text-ink disabled:opacity-30">
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </>
  );
}

/* --------------------------------- KPI cards --------------------------------- */

interface Kpi {
  label: string;
  value: number | null;
  previous: number | null;
  format: (v: number | null) => string;
  invert?: boolean;
}

/** Last period and this one as two small bars (this one in the brand colour). */
function MiniBars({ now, before }: { now: number | null; before: number | null }) {
  const max = Math.max(now ?? 0, before ?? 0, 1);
  const h = (v: number | null) => `${Math.max(14, ((v ?? 0) / max) * 100)}%`;
  return (
    <div className="flex h-9 items-end gap-1" aria-hidden>
      <motion.span initial={{ height: 0 }} animate={{ height: h(before) }} transition={{ duration: 0.7, ease: EASE }} className="w-3 rounded-[4px] bg-line" />
      <motion.span initial={{ height: 0 }} animate={{ height: h(now) }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }} className="w-3 rounded-[4px] bg-gradient-to-t from-brand to-[#9d90fa]" />
      <span className="h-[30%] w-3 rounded-[4px] bg-line-2" />
    </div>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: EASE }}>
      <SpotlightCard className="card h-full p-4" spotlightColor="rgba(109, 92, 246, 0.10)">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-muted">{kpi.label}</span>
          <ChangeBadge change={change(kpi.value, kpi.previous)} invert={kpi.invert} />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <CountUp value={kpi.value} format={kpi.format} className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-ink tabular" />
          <MiniBars now={kpi.value} before={kpi.previous} />
        </div>
        <div className="mt-2 text-[11.5px] text-subtle">forrige periode {kpi.format(kpi.previous)}</div>
      </SpotlightCard>
    </motion.div>
  );
}

/* ------------------------------- the trend chart ------------------------------- */

type Metric = 'revenue' | 'spend' | 'clicks' | 'conversions';
const METRICS: Record<Metric, { label: string; money: boolean }> = {
  revenue: { label: 'Konv.værdi', money: true },
  spend: { label: 'Forbrug', money: true },
  clicks: { label: 'Klik', money: false },
  conversions: { label: 'Konverteringer', money: false },
};

interface Point {
  x: string;
  now: number | null;
  before: number | null;
  date: string | null;
  beforeDate: string | null;
}

function TrendTooltip({ active, payload, metric, currency, names }: { active?: boolean; payload?: { payload: Point }[]; metric: Metric; currency: string; names: [string, string] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const fmt = (v: number | null) => (v === null ? '–' : METRICS[metric].money ? fmtMoney(v, currency, 0) : fmtNumber(v, metric === 'conversions' ? 1 : 0));
  const diff = p.now !== null && p.before !== null ? p.now - p.before : null;
  const rate = change(p.now, p.before);
  return (
    <div className="min-w-[190px] rounded-xl border border-line bg-white/95 p-3 text-[12.5px] shadow-pop backdrop-blur">
      <div className="mb-2 font-medium text-muted">{p.date ? fmtDate(p.date) : p.x}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="size-1.5 rounded-full bg-brand" /> {names[0]}
        </span>
        <span className="font-semibold tabular text-ink">{fmt(p.now)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="size-1.5 rounded-full bg-subtle" /> {names[1]}
        </span>
        <span className="font-semibold tabular text-ink">{fmt(p.before)}</span>
      </div>
      {diff !== null && (
        <div className="mt-2 grid gap-0.5 border-t border-line pt-2">
          <div className="flex justify-between text-muted">
            Ændring <span className={cn('font-medium tabular', diff >= 0 ? 'text-positive' : 'text-negative')}>{`${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))}`}</span>
          </div>
          {rate !== null && (
            <div className="flex justify-between text-muted">
              Ændringsrate <span className={cn('font-medium tabular', rate >= 0 ? 'text-positive' : 'text-negative')}>{`${rate >= 0 ? '+' : '−'}${fmtPercent(Math.abs(rate))}`}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrendPanel({ points, currency, granularity }: { points: (Omit<Point, 'now' | 'before'> & { now: DerivedMetrics | null; before: DerivedMetrics | null })[]; currency: string; granularity: Granularity }) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const names: [string, string] = granularity === 'week' ? ['Denne uge', 'Ugen før'] : ['Denne måned', 'Måneden før'];
  const data: Point[] = points.map((p) => ({ ...p, now: p.now ? p.now[metric] : null, before: p.before ? p.before[metric] : null }));
  return (
    <Panel
      title="Udvikling"
      className="min-h-[360px]"
      action={<Select<Metric> triggerVariant="pill" value={metric} onChange={setMetric} aria-label="Nøgletal" align="end" options={(Object.keys(METRICS) as Metric[]).map((m) => ({ value: m, label: METRICS[m].label }))} />}
    >
      <div className="mb-3 flex items-center gap-4 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brand" /> {names[0]}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-subtle" /> {names[1]}
        </span>
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart key={metric} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="dash-now" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6d5cf6" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#6d5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#ececf1" />
            <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: '#a4a4b0' }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11.5, fill: '#a4a4b0' }} tickFormatter={(v: number) => fmtCompact(v)} />
            <ChartTooltip cursor={{ stroke: '#d4d0fb', strokeWidth: 1 }} content={<TrendTooltip metric={metric} currency={currency} names={names} />} />
            <Line type="monotone" dataKey="before" stroke="#b9b9c6" strokeWidth={1.6} dot={false} activeDot={{ r: 3.5, fill: '#fff', stroke: '#b9b9c6' }} connectNulls={false} animationDuration={900} />
            <Area type="monotone" dataKey="now" stroke="#6d5cf6" strokeWidth={2.2} fill="url(#dash-now)" dot={false} activeDot={{ r: 4.5, fill: '#fff', stroke: '#6d5cf6', strokeWidth: 2 }} connectNulls={false} animationDuration={1100} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

/* --------------------------- where the results come from --------------------------- */

function SharePanel({ campaigns, currency }: { campaigns: CampaignRow[]; currency: string }) {
  const go = useUi((s) => s.go);
  const total = campaigns.reduce((s, c) => s + (c.metrics?.revenue ?? 0), 0);
  const top = [...campaigns].filter((c) => (c.metrics?.revenue ?? 0) > 0).sort((a, b) => (b.metrics?.revenue ?? 0) - (a.metrics?.revenue ?? 0));
  const shown = top.slice(0, 4);
  const rest = top.slice(4).reduce((s, c) => s + (c.metrics?.revenue ?? 0), 0);
  const segments = [...shown.map((c) => c.metrics?.revenue ?? 0), rest].filter((v) => v > 0);
  return (
    <Panel
      title="Konv.værdi pr. kampagne"
      action={
        <button type="button" onClick={() => go('campaigns')} className="text-[12.5px] font-medium text-brand hover:underline">
          Vis alle
        </button>
      }
    >
      {!total ? (
        <p className="text-[13px] text-muted">Ingen konverteringsværdi i perioden.</p>
      ) : (
        <>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            {segments.map((v, i) => (
              <motion.span key={i} initial={{ width: 0 }} animate={{ width: `${(v / total) * 100}%` }} transition={{ duration: 0.8, ease: EASE, delay: i * 0.06 }} style={{ background: COLORS[Math.min(i, COLORS.length - 1)] }} className="h-full first:rounded-l-full last:rounded-r-full" />
            ))}
          </div>
          <ul className="mt-4 grid gap-1">
            {shown.map((c, i) => (
              <ContextMenu key={c.id} label={c.name} items={campaignMenuItems(c, campaigns, { openList: true })}>
                <motion.li initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE, delay: 0.1 + i * 0.06 }} className="flex items-center gap-3 rounded-xl px-1.5 py-2 hover:bg-line-2/60">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-white">
                    <BrandIcon brand="microsoft_ads" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{c.name}</span>
                    <span className="block text-[12px] text-muted">
                      {fmtNumber(c.metrics?.clicks ?? 0)} klik · {fmtNumber(c.metrics?.conversions ?? 0, 1)} konv.
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: COLORS[i] }} />
                    <span className="text-[13px] font-semibold tabular text-ink">{fmtPercent((c.metrics?.revenue ?? 0) / total)}</span>
                  </span>
                </motion.li>
              </ContextMenu>
            ))}
          </ul>
          <p className="mt-auto pt-3 text-[12px] text-subtle">I alt {fmtMoney(total, currency, 0)}</p>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------- top campaigns ------------------------------- */

type SortKey = 'revenue' | 'spend' | 'roas' | 'change';
type StatusFilter = 'all' | 'active' | 'paused';

function TopCampaigns({ campaigns, previous, currency, granularity, current }: { campaigns: CampaignRow[]; previous: CampaignRow[]; currency: string; granularity: Granularity; current: boolean }) {
  const [sort, setSort] = useState<SortKey>('revenue');
  const [status, setStatus] = useState<StatusFilter>('all');
  const prev = useMemo(() => new Map(previous.map((c) => [c.id, c.metrics?.revenue ?? 0])), [previous]);
  const rows = campaigns
    .filter((c) => (c.metrics?.spend ?? 0) > 0 || (c.metrics?.revenue ?? 0) > 0)
    .filter((c) => status === 'all' || (status === 'active' ? c.status === 'Active' : c.status !== 'Active'))
    .map((c) => ({ c, delta: change(c.metrics?.revenue ?? 0, prev.get(c.id) ?? 0) }))
    .sort((a, b) =>
      sort === 'change' ? (b.delta ?? -Infinity) - (a.delta ?? -Infinity) : sort === 'roas' ? (b.c.metrics?.roas ?? 0) - (a.c.metrics?.roas ?? 0) : (b.c.metrics?.[sort] ?? 0) - (a.c.metrics?.[sort] ?? 0),
    )
    .slice(0, 8);
  const avgRoas = derive(campaigns.reduce((s, c) => ({ impressions: 0, clicks: 0, conversions: 0, spend: s.spend + (c.metrics?.spend ?? 0), revenue: s.revenue + (c.metrics?.revenue ?? 0) }), { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 })).roas ?? 0;

  return (
    <Panel
      title={`Top kampagner ${granularity === 'week' ? (current ? 'denne uge' : 'i ugen') : current ? 'denne måned' : 'i måneden'}`}
      action={
        <>
          <Select<StatusFilter>
            triggerVariant="pill"
            value={status}
            onChange={setStatus}
            aria-label="Filter"
            align="end"
            className="border border-line"
            options={[
              { value: 'all', label: 'Alle', icon: <Filter className="size-3.5 text-muted" /> },
              { value: 'active', label: 'Aktive', icon: <Filter className="size-3.5 text-muted" /> },
              { value: 'paused', label: 'Pausede', icon: <Filter className="size-3.5 text-muted" /> },
            ]}
          />
          <Select<SortKey>
            triggerVariant="pill"
            value={sort}
            onChange={setSort}
            aria-label="Sortér efter"
            align="end"
            className="border border-line"
            options={[
              { value: 'revenue', label: 'Konv.værdi', icon: <ArrowDownUp className="size-3.5 text-muted" /> },
              { value: 'spend', label: 'Forbrug', icon: <ArrowDownUp className="size-3.5 text-muted" /> },
              { value: 'roas', label: 'ROAS', icon: <ArrowDownUp className="size-3.5 text-muted" /> },
              { value: 'change', label: 'Udvikling', icon: <ArrowDownUp className="size-3.5 text-muted" /> },
            ]}
          />
        </>
      }
    >
      <div className="-mx-5 -mb-5 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 whitespace-nowrap text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
              {['Kampagne', 'Kanal', 'Status', 'Forbrug', 'Konv.', 'Konv.værdi', 'ROAS', 'Udvikling'].map((h, i) => (
                <th key={h} className={cn('border-y border-line bg-[#fafafb] px-3 py-2.5 first:pl-5 last:pr-5', i >= 3 && 'text-right')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, delta }, i) => (
              <ContextMenu key={c.id} label={c.name} items={campaignMenuItems(c, campaigns, { openList: true })}>
                <motion.tr initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE, delay: i * 0.03 }} className="transition-colors hover:bg-brand-50/30">
                  <td className="max-w-[300px] truncate border-b border-line-2 px-3 py-2.5 pl-5 font-medium text-ink" title={c.name}>
                    {c.name}
                  </td>
                  <td className="border-b border-line-2 px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2 py-0.5 text-[12px] text-ink-2">
                      <BrandIcon brand="microsoft_ads" className="size-3.5" /> {TYPE_LABEL[c.type] ?? c.type}
                    </span>
                  </td>
                  <td className="border-b border-line-2 px-3 py-2.5">
                    <Badge tone={c.status === 'Active' ? 'positive' : 'neutral'}>{c.status === 'Active' ? 'Aktiv' : 'Pauset'}</Badge>
                  </td>
                  <td className="border-b border-line-2 px-3 py-2.5 text-right tabular">{fmtMoney(c.metrics?.spend ?? 0, currency, 0)}</td>
                  <td className="border-b border-line-2 px-3 py-2.5 text-right tabular">{fmtNumber(c.metrics?.conversions ?? 0, 1)}</td>
                  <td className="border-b border-line-2 px-3 py-2.5 text-right tabular text-ink">{fmtMoney(c.metrics?.revenue ?? 0, currency, 0)}</td>
                  <td className={cn('border-b border-line-2 px-3 py-2.5 text-right font-medium tabular', (c.metrics?.roas ?? 0) >= avgRoas ? 'text-positive' : 'text-ink-2')}>
                    {c.metrics?.roas ? `${fmtNumber(c.metrics.roas, 2)}x` : '–'}
                  </td>
                  <td className="border-b border-line-2 px-3 py-2.5 pr-5 text-right">
                    <ChangeBadge change={delta} />
                  </td>
                </motion.tr>
              </ContextMenu>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="px-5 py-6 text-[13px] text-muted">Ingen kampagner med forbrug i perioden.</p>}
      </div>
    </Panel>
  );
}

/* ----------------------------------- page ----------------------------------- */

function summaryMarkdown(period: Period, kpis: Kpi[], insights: InsightPage[], campaigns: CampaignRow[], currency: string, accountName: string) {
  const lines = [
    `# Overblik – ${accountName}`,
    `${period.label} (${period.range.from} – ${period.range.to}), sammenlignet med ${period.previous.from} – ${period.previous.to}.`,
    '',
    '## Nøgletal',
    '| Nøgletal | Perioden | Forrige periode | Udvikling |',
    '|---|---|---|---|',
    ...kpis.map((k) => {
      const c = change(k.value, k.previous);
      return `| ${k.label} | ${k.format(k.value)} | ${k.format(k.previous)} | ${c === null ? '–' : `${c >= 0 ? '+' : '−'}${fmtPercent(Math.abs(c))}`} |`;
    }),
    '',
    '## Indsigt',
    ...insights.map((p) => `- ${p.text}`),
    '',
    '## Top kampagner',
    '| Kampagne | Forbrug | Konv. | Konv.værdi | ROAS |',
    '|---|---|---|---|---|',
    ...[...campaigns]
      .sort((a, b) => (b.metrics?.revenue ?? 0) - (a.metrics?.revenue ?? 0))
      .slice(0, 10)
      .map((c) => `| ${c.name} | ${fmtMoney(c.metrics?.spend ?? 0, currency, 0)} | ${fmtNumber(c.metrics?.conversions ?? 0, 1)} | ${fmtMoney(c.metrics?.revenue ?? 0, currency, 0)} | ${c.metrics?.roas ? `${fmtNumber(c.metrics.roas, 2)}x` : '–'} |`),
  ];
  return `${lines.join('\n')}\n`;
}

export function DashboardPage() {
  const account = useCurrentAccount();
  const mode = useConnection((s) => s.mode);
  const currency = account?.currency ?? 'DKK';
  const go = useUi((s) => s.go);
  const [granularity, setGranularity] = useState<Granularity>('week');
  const [offset, setOffset] = useState(0);
  const [channel, setChannel] = useState('all');
  const period = useMemo(() => periodOf(granularity, offset), [granularity, offset]);
  const trend = usePeriodTrend(period.range, period.previous, period.previousFull);
  const campaigns = useCampaigns(period.range);
  const previousCampaigns = useCampaigns(period.previous);

  const t = trend.data;
  const kpis: Kpi[] | null = t
    ? [
        { label: 'Forbrug', value: t.totals.spend, previous: t.previous.spend, format: (v) => fmtMoney(v, currency, 0), invert: true },
        { label: 'Konverteringer', value: t.totals.conversions, previous: t.previous.conversions, format: (v) => fmtNumber(v, 1) },
        { label: 'Konv.værdi', value: t.totals.revenue, previous: t.previous.revenue, format: (v) => fmtMoney(v, currency, 0) },
        { label: 'ROAS', value: t.totals.roas, previous: t.previous.roas, format: (v) => (v === null ? '–' : `${fmtNumber(v, 2)}x`) },
      ]
    : null;

  const points = useMemo(() => {
    if (!t) return [];
    const labels = axisLabels(granularity, period.length);
    const byIndex = (rows: typeof t.daily) => rows.map((r) => ({ date: r.date ?? null, m: derive({ impressions: r.impressions ?? 0, clicks: r.clicks ?? 0, spend: r.spend ?? 0, conversions: r.conversions ?? 0, revenue: r.revenue ?? 0 }) }));
    const now = byIndex(t.daily);
    const before = byIndex(t.previousDaily);
    return labels.map((x, i) => ({ x, now: now[i]?.m ?? null, before: before[i]?.m ?? null, date: now[i]?.date ?? null, beforeDate: before[i]?.date ?? null }));
  }, [t, granularity, period.length]);

  const insights = useMemo(() => {
    if (!t || !campaigns.data) return [];
    return buildInsights({
      totals: t.totals,
      previous: t.previous,
      daily: t.daily.map((d) => ({ date: d.date ?? '', revenue: d.revenue ?? 0 })),
      campaigns: campaigns.data,
      previousCampaigns: previousCampaigns.data ?? [],
      alerts: computeAlerts(campaigns.data, period.range, currency),
      currency,
      granularity,
      current: period.current,
    });
  }, [t, campaigns.data, previousCampaigns.data, period.range, period.current, currency, granularity]);

  const ask = (prompt: string) => {
    go('chat');
    startChat(prompt);
  };
  const exportSummary = async () => {
    if (!kpis || !campaigns.data) return;
    try {
      const name = `XavierOS-overblik-${period.range.from}-${period.range.to}.md`;
      const path = await saveExport(name, summaryMarkdown(period, kpis, insights, campaigns.data, currency, account?.name ?? 'Kontoen'));
      toast.success('Opsummeringen er gemt', { description: path ?? name });
    } catch (e) {
      toast.error('Opsummeringen kunne ikke gemmes', { description: errorMessage(e) });
    }
  };
  const fetching = trend.isFetching || campaigns.isFetching;
  const error = trend.error ?? campaigns.error;

  return (
    <motion.div {...pageTransition} className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-8 pb-12 pt-7">
        <header>
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-ink">Overblik</h1>
              <p className="mt-1 text-[14px] text-muted">Et samlet blik på jeres annoncering på tværs af kanaler – med tendenser og afvigelser fundet automatisk.</p>
            </div>
            {mode === 'demo' && <Badge tone="brand">Demo-data</Badge>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PeriodPicker
              period={period}
              granularity={granularity}
              onGranularity={(g) => {
                setGranularity(g);
                setOffset(0);
              }}
              onStep={(d) => setOffset((o) => Math.max(0, o + d))}
            />
            <ChannelPicker value={channel} onChange={setChannel} />
            <div className="ml-auto flex items-center gap-2">
              <Tooltip content="Hent tallene igen">
                <Button variant="secondary" size="icon-sm" aria-label="Opdatér" onClick={() => void queryClient.invalidateQueries()}>
                  <RefreshCw className={cn(fetching && 'animate-spin')} />
                </Button>
              </Tooltip>
              <Button variant="gradient" size="sm" disabled={!kpis || !campaigns.data} onClick={() => void exportSummary()}>
                <Download /> Eksportér opsummering
              </Button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="card mt-6 p-6 text-[13px] text-negative">{errorMessage(error)}</div>
        ) : (
          <motion.div variants={stagger(0.06, 0.05)} initial="hidden" animate="show" className="mt-5 grid gap-4">
            <motion.div variants={fadeUp}>
              <InsightBox title={granularity === 'week' ? 'Ugens indsigt' : 'Månedens indsigt'} pages={insights} loading={!t || !campaigns.data} onAsk={ask} />
            </motion.div>

            <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {kpis ? kpis.map((k) => <KpiCard key={k.label} kpi={k} />) : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[118px]" />)}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
              {t ? <TrendPanel points={points} currency={currency} granularity={granularity} /> : <Skeleton className="h-[360px]" />}
              {campaigns.data ? <SharePanel campaigns={campaigns.data} currency={currency} /> : <Skeleton className="h-[360px]" />}
            </section>

            {campaigns.data ? (
              <TopCampaigns campaigns={campaigns.data} previous={previousCampaigns.data ?? []} currency={currency} granularity={granularity} current={period.current} />
            ) : (
              <Skeleton className="h-[320px]" />
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
