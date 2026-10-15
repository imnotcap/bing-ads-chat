/**
 * Dashboard – the account at a glance (Inventarland's layout in this app's theme):
 * greeting + controls, KPI cards with sparklines, development over time, spend
 * distribution, campaigns, monthly budget pace, attention points and devices.
 */
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Monitor, RefreshCw, Smartphone, Sparkles, Tablet, TrendingUp, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { getBackend } from '@/bing/backend';
import { change, derive } from '@/bing/metrics';
import { ChangeBadge } from '@/components/blocks/ChangeBadge';
import { EASE, fadeUp, pageTransition, stagger } from '@/components/motion';
import { CountUp, SpotlightCard } from '@/components/reactbits';
import { Button } from '@/components/ui/button';
import { Badge, Segmented } from '@/components/ui/controls';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { Select } from '@/components/ui/overlays';
import { computeAlerts } from '@/features/insights/alerts';
import { startChat } from '@/features/chat/startChat';
import { useAccountTrend, useCampaigns, useSelectedRange, useSpendStatus, type CampaignRow } from '@/hooks/useAdsData';
import { DATE_PRESET_LABELS, fmtCompact, fmtDate, fmtMoney, fmtNumber, fmtPercent, type DatePreset } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';

const PALETTE = ['#6d5cf6', '#2bb3a3', '#f59e0b', '#ec4899', '#3b82f6', '#b4b4c4'];

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'God nat' : h < 10 ? 'God morgen' : h < 13 ? 'God formiddag' : h < 18 ? 'God eftermiddag' : 'God aften';
}

function Card({ className, children, title, action, icon: Icon }: { className?: string; children: React.ReactNode; title?: string; action?: React.ReactNode; icon?: typeof Wallet }) {
  return (
    <motion.section variants={fadeUp} className={cn('card flex flex-col p-5', className)}>
      {title && (
        <div className="mb-4 flex items-center gap-2">
          {Icon && <Icon className="size-4 text-brand" />}
          <h2 className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          <div className="ml-auto">{action}</div>
        </div>
      )}
      {children}
    </motion.section>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-line-2', className)} />;
}

/* ------------------------------- KPI cards ------------------------------- */

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((v, i) => ({ i, v }));
  const id = `spark-${color.slice(1)}`;
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive animationDuration={900} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface Kpi {
  label: string;
  value: number | null;
  previous: number | null;
  format: (v: number | null) => string;
  series: number[];
  invert?: boolean;
  color: string;
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -3 }} transition={{ duration: 0.2, ease: EASE }}>
      <SpotlightCard className="card h-full overflow-hidden p-4 pb-0" spotlightColor="rgba(109, 92, 246, 0.10)">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-medium text-muted">{kpi.label}</span>
          <ChangeBadge change={change(kpi.value, kpi.previous)} invert={kpi.invert} />
        </div>
        <CountUp value={kpi.value} format={kpi.format} className="mt-1.5 block text-[24px] font-semibold tracking-[-0.025em] text-ink tabular" />
        <div className="text-[11.5px] text-subtle">forrige periode {kpi.format(kpi.previous)}</div>
        <div className="-mx-4 mt-2">
          <Sparkline data={kpi.series} color={kpi.color} />
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

/* ------------------------------ charts / cards ------------------------------ */

type TrendMetric = 'spendRevenue' | 'clicks' | 'conversions';

function TrendCard({ daily, currency }: { daily: { date: string; spend: number; revenue: number; clicks: number; conversions: number }[]; currency: string }) {
  const [metric, setMetric] = useState<TrendMetric>('spendRevenue');
  const series =
    metric === 'spendRevenue'
      ? [
          { key: 'revenue', label: 'Omsætning', color: PALETTE[1]! },
          { key: 'spend', label: 'Forbrug', color: PALETTE[0]! },
        ]
      : metric === 'clicks'
        ? [{ key: 'clicks', label: 'Klik', color: PALETTE[0]! }]
        : [{ key: 'conversions', label: 'Konverteringer', color: PALETTE[0]! }];
  const money = metric === 'spendRevenue';
  return (
    <Card
      title="Udvikling over tid"
      icon={TrendingUp}
      action={
        <Segmented<TrendMetric>
          layoutId="dash-trend"
          size="sm"
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'spendRevenue', label: 'Forbrug & omsætning' },
            { value: 'clicks', label: 'Klik' },
            { value: 'conversions', label: 'Konverteringer' },
          ]}
        />
      }
    >
      <div className="h-[290px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart key={metric} data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 4" />
            <XAxis dataKey="date" tickFormatter={(d: string) => fmtDate(d)} tick={{ fontSize: 11, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis width={52} tickFormatter={(v: number) => (money ? fmtCompact(v) : fmtNumber(v))} tick={{ fontSize: 11, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} />
            <ChartTooltip
              cursor={{ stroke: 'var(--color-brand)', strokeOpacity: 0.25 }}
              contentStyle={{ borderRadius: 12, border: '1px solid var(--color-line)', boxShadow: '0 12px 32px -12px rgb(16 24 40 / 0.2)', fontSize: 12.5 }}
              labelFormatter={(d) => fmtDate(String(d))}
              formatter={(v, name) => [money ? fmtMoney(Number(v), currency, 0) : fmtNumber(Number(v), metric === 'conversions' ? 1 : 0), series.find((s) => s.key === name)?.label ?? name]}
            />
            {series.map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2.2} fill={`url(#trend-${s.key})`} animationDuration={1100} animationEasing="ease-out" />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            <span className="size-2 rounded-full" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

function DistributionCard({ campaigns, currency }: { campaigns: CampaignRow[]; currency: string }) {
  const rows = campaigns.filter((c) => (c.metrics?.spend ?? 0) > 0);
  const top = rows.slice(0, 5).map((c) => ({ name: c.name, value: c.metrics!.spend ?? 0 }));
  const rest = rows.slice(5).reduce((s, c) => s + (c.metrics?.spend ?? 0), 0);
  const data = rest > 0 ? [...top, { name: 'Øvrige', value: rest }] : top;
  const total = data.reduce((s, d) => s + d.value, 0);
  const [hover, setHover] = useState<number | null>(null);
  const focus = hover !== null ? data[hover] : null;
  return (
    <Card title="Fordeling af forbrug" icon={Wallet}>
      <div className="relative mx-auto h-[190px] w-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={2}
              stroke="none"
              animationDuration={900}
              onMouseEnter={(_, i) => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} opacity={hover === null || hover === i ? 1 : 0.35} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[11.5px] text-muted">{focus ? focus.name : 'I alt'}</div>
            <div className="text-[17px] font-semibold tracking-[-0.02em] text-ink tabular">{fmtMoney(focus ? focus.value : total, currency, 0)}</div>
            {focus && <div className="text-[11.5px] text-muted">{fmtPercent(focus.value / total, 0)}</div>}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2.5 text-[12.5px]" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{d.name}</span>
            <span className="tabular text-muted">{fmtPercent(d.value / total, 0)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CampaignsCard({ campaigns, currency, days }: { campaigns: CampaignRow[]; currency: string; days: number }) {
  const go = useUi((s) => s.go);
  const rows = campaigns.slice(0, 7);
  return (
    <Card
      title="Kampagner"
      action={
        <button type="button" onClick={() => go('campaigns')} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
          Alle kampagner <ArrowRight className="size-3.5" />
        </button>
      }
    >
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11.5px] text-subtle">
              <th className="px-2 pb-2 font-medium">Kampagne</th>
              <th className="px-2 pb-2 text-right font-medium">Forbrug</th>
              <th className="px-2 pb-2 text-right font-medium">Konv.</th>
              <th className="px-2 pb-2 text-right font-medium">CPA</th>
              <th className="px-2 pb-2 text-right font-medium">ROAS</th>
              <th className="w-[120px] px-2 pb-2 font-medium">Budgetudnyttelse</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const m = c.metrics ? derive({ impressions: c.metrics.impressions ?? 0, clicks: c.metrics.clicks ?? 0, spend: c.metrics.spend ?? 0, conversions: c.metrics.conversions ?? 0, revenue: c.metrics.revenue ?? 0 }) : null;
              const use = c.dailyBudget && m ? Math.min(1.2, m.spend / days / c.dailyBudget) : null;
              return (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: 0.25 + i * 0.04, duration: 0.35, ease: EASE } }}
                  onClick={() => go('campaigns')}
                  className="cursor-pointer border-t border-line transition-colors hover:bg-brand-50/40"
                >
                  <td className="max-w-[240px] px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn('size-1.5 shrink-0 rounded-full', c.status === 'Active' ? 'bg-positive' : 'bg-subtle')} />
                      <span className="truncate font-medium text-ink">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular text-ink-2">{fmtMoney(m?.spend ?? 0, currency, 0)}</td>
                  <td className="px-2 py-2.5 text-right tabular text-ink-2">{fmtNumber(m?.conversions ?? 0, 1)}</td>
                  <td className="px-2 py-2.5 text-right tabular text-ink-2">{fmtMoney(m?.cpa ?? null, currency, 0)}</td>
                  <td className="px-2 py-2.5 text-right tabular font-medium text-ink">{m?.roas ? `${fmtNumber(m.roas, 1)}x` : '–'}</td>
                  <td className="px-2 py-2.5">
                    {use !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-2">
                          <motion.div
                            className={cn('h-full rounded-full', use >= 0.95 ? 'bg-warning' : 'bg-brand')}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, use * 100)}%` }}
                            transition={{ delay: 0.35 + i * 0.04, duration: 0.8, ease: EASE }}
                          />
                        </div>
                        <span className="w-8 text-right text-[11px] tabular text-muted">{Math.round(use * 100)}%</span>
                      </div>
                    ) : (
                      <span className="text-[11.5px] text-subtle">{c.sharedBudgetId ? 'Delt budget' : '–'}</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BudgetCard({ currency }: { currency: string }) {
  const { data: s } = useSpendStatus();
  const go = useUi((s2) => s2.go);
  if (!s) return <Skeleton className="h-[300px]" />;
  const target = s.monthlyBudget ?? s.forecastByBudgets;
  const share = target ? Math.min(1, s.monthToDateSpend / target) : 0;
  const forecastShare = target ? s.forecastByRunRate / target : 0;
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <Card title="Månedens budget-tempo" icon={Wallet} action={<Badge tone={forecastShare > 1.02 ? 'warning' : 'positive'}>{forecastShare > 1.02 ? 'Over plan' : 'På plan'}</Badge>}>
      <div className="flex items-center gap-5">
        <div className="relative size-[132px] shrink-0">
          <svg viewBox="0 0 132 132" className="size-full -rotate-90">
            <circle cx="66" cy="66" r={r} fill="none" stroke="var(--color-line-2)" strokeWidth="12" />
            <motion.circle
              cx="66"
              cy="66"
              r={r}
              fill="none"
              stroke="url(#budget-grad)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={c}
              initial={{ strokeDashoffset: c }}
              animate={{ strokeDashoffset: c * (1 - share) }}
              transition={{ duration: 1.2, ease: EASE, delay: 0.2 }}
            />
            <defs>
              <linearGradient id="budget-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a99dff" />
                <stop offset="100%" stopColor="#6d5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <CountUp value={share * 100} format={(v) => `${Math.round(v ?? 0)} %`} className="text-[22px] font-semibold tracking-[-0.02em] text-ink tabular" />
              <div className="text-[11px] text-muted">{s.monthlyBudget ? 'af budget' : 'af maks.'}</div>
            </div>
          </div>
        </div>
        <div className="grid flex-1 gap-2.5 text-[12.5px]">
          <div>
            <div className="text-muted">Brugt denne måned</div>
            <div className="text-[16px] font-semibold text-ink tabular">{fmtMoney(s.monthToDateSpend, currency, 0)}</div>
          </div>
          <div>
            <div className="text-muted">Prognose ved nuværende tempo</div>
            <div className="text-[14px] font-medium text-ink-2 tabular">{fmtMoney(s.forecastByRunRate, currency, 0)}</div>
          </div>
          <div className="text-muted">
            {Math.ceil(s.daysLeftInMonth)} dage tilbage · {s.activeCampaigns} aktive kampagner
          </div>
        </div>
      </div>
      {!s.monthlyBudget && (
        <button type="button" onClick={() => go('settings', 'spend')} className="mt-4 text-left text-[12.5px] font-medium text-brand hover:underline">
          Sæt et månedsbudget for at følge tempoet præcist
        </button>
      )}
    </Card>
  );
}

function AlertsCard({ campaigns, currency }: { campaigns: CampaignRow[]; currency: string }) {
  const range = useSelectedRange();
  const go = useUi((s) => s.go);
  const alerts = useMemo(() => computeAlerts(campaigns, range, currency), [campaigns, range, currency]);
  const tone = { opportunity: 'bg-positive-bg text-positive', warning: 'bg-warning-bg text-warning', info: 'bg-brand-50 text-brand' } as const;
  return (
    <Card title="Opmærksomhedspunkter" icon={Sparkles}>
      {alerts.length === 0 ? (
        <p className="text-[13px] text-muted">Ingen opmærksomhedspunkter lige nu – kontoen ser sund ud.</p>
      ) : (
        <div className="grid gap-2">
          {alerts.slice(0, 4).map((a, i) => (
            <motion.button
              key={a.id}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.3 + i * 0.06, duration: 0.35, ease: EASE } }}
              onClick={() => {
                go('chat');
                startChat(a.prompt);
              }}
              className="group flex items-start gap-3 rounded-xl border border-line p-3 text-left transition-[border-color,box-shadow] hover:border-brand/30 hover:shadow-glow"
            >
              <span className={cn('mt-0.5 size-2 shrink-0 rounded-full', tone[a.tone].split(' ')[0])} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-ink">{a.title}</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{a.detail}</span>
              </span>
              <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
            </motion.button>
          ))}
        </div>
      )}
    </Card>
  );
}

function DevicesCard({ currency }: { currency: string }) {
  const range = useSelectedRange();
  const { accountId, mode, revision } = useConnection();
  const { data } = useQuery({
    queryKey: ['devices', mode, accountId, revision, range.from, range.to],
    enabled: !!accountId,
    queryFn: async () => (await getBackend()).runReport(accountId!, { kind: 'device', range, aggregation: 'Summary' }),
  });
  const rows = (data ?? []).filter((r) => (r.spend ?? 0) > 0).sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  const total = rows.reduce((s, r) => s + (r.spend ?? 0), 0);
  const icon = (d?: string) => (/phone|smart|mobil/i.test(d ?? '') ? Smartphone : /tablet/i.test(d ?? '') ? Tablet : Monitor);
  const label = (d?: string) => (/phone|smart|mobil/i.test(d ?? '') ? 'Mobil' : /tablet/i.test(d ?? '') ? 'Tablet' : /computer|desktop|pc/i.test(d ?? '') ? 'Computer' : (d ?? 'Andet'));
  return (
    <Card title="Enheder" icon={Monitor}>
      {!data ? (
        <Skeleton className="h-[120px]" />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-muted">Ingen enhedsdata i perioden.</p>
      ) : (
        <div className="grid gap-3.5">
          {rows.map((r, i) => {
            const Icon = icon(r.device);
            const share = total ? (r.spend ?? 0) / total : 0;
            return (
              <div key={r.device ?? i}>
                <div className="mb-1.5 flex items-center gap-2 text-[12.5px]">
                  <Icon className="size-3.5 text-muted" />
                  <span className="font-medium text-ink">{label(r.device)}</span>
                  <span className="ml-auto tabular text-muted">
                    {fmtMoney(r.spend ?? 0, currency, 0)} · ROAS {r.spend ? fmtNumber((r.revenue ?? 0) / r.spend, 1) : '–'}x
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line-2">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${share * 100}%` }}
                    transition={{ duration: 0.9, delay: 0.3 + i * 0.08, ease: EASE }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* --------------------------------- page --------------------------------- */

export function DashboardPage() {
  const account = useCurrentAccount();
  const mode = useConnection((s) => s.mode);
  const currency = account?.currency ?? 'DKK';
  const range = useSelectedRange();
  const datePreset = useSettings((s) => s.datePreset);
  const setDatePreset = useSettings((s) => s.setDatePreset);
  const trend = useAccountTrend(range);
  const campaigns = useCampaigns(range);
  const go = useUi((s) => s.go);
  const days = Math.max(1, trend.data?.daily.length ?? 1);

  const daily = useMemo(
    () => (trend.data?.daily ?? []).map((d) => ({ date: d.date ?? '', spend: d.spend ?? 0, revenue: d.revenue ?? 0, clicks: d.clicks ?? 0, conversions: d.conversions ?? 0 })),
    [trend.data],
  );
  const kpis: Kpi[] | null = trend.data
    ? (() => {
        const t = trend.data.totals;
        const p = trend.data.previous;
        const money = (v: number | null) => fmtMoney(v, currency, 0);
        const series = (fn: (d: (typeof daily)[number]) => number) => daily.map(fn);
        return [
          { label: 'Forbrug', value: t.spend, previous: p.spend, format: money, series: series((d) => d.spend), invert: true, color: PALETTE[0]! },
          { label: 'Omsætning', value: t.revenue, previous: p.revenue, format: money, series: series((d) => d.revenue), color: PALETTE[1]! },
          { label: 'ROAS', value: t.roas, previous: p.roas, format: (v) => (v === null ? '–' : `${fmtNumber(v, 2)}x`), series: series((d) => (d.spend ? d.revenue / d.spend : 0)), color: PALETTE[4]! },
          { label: 'Konverteringer', value: t.conversions, previous: p.conversions, format: (v) => fmtNumber(v, 1), series: series((d) => d.conversions), color: PALETTE[3]! },
          { label: 'CPA', value: t.cpa, previous: p.cpa, format: money, series: series((d) => (d.conversions ? d.spend / d.conversions : 0)), invert: true, color: PALETTE[2]! },
          { label: 'Klik', value: t.clicks, previous: p.clicks, format: (v) => fmtNumber(v), series: series((d) => d.clicks), color: PALETTE[0]! },
        ];
      })()
    : null;

  return (
    <motion.div {...pageTransition} className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[1480px] px-8 pb-12 pt-7">
        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] font-medium text-brand">
              {greeting()} 👋
            </motion.div>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-ink">Performance-overblik</h1>
            <p className="mt-1 flex items-center gap-1.5 text-[14px] text-muted">
              <BrandIcon brand="microsoft_ads" />
              {account?.name ?? 'Kontoen'} · {DATE_PRESET_LABELS[datePreset]} sammenlignet med perioden før
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'demo' && <Badge tone="brand">Demo-data</Badge>}
            <Select<DatePreset>
              value={datePreset}
              onChange={setDatePreset}
              triggerVariant="pill"
              align="end"
              options={(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => ({ value: p, label: DATE_PRESET_LABELS[p] }))}
              aria-label="Periode"
            />
            <Button variant="secondary" size="sm" onClick={() => void queryClient.invalidateQueries()} aria-label="Opdatér">
              <RefreshCw className={cn((trend.isFetching || campaigns.isFetching) && 'animate-spin')} />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                go('chat');
                startChat(`Giv mig et kort overblik over kontoen for ${DATE_PRESET_LABELS[datePreset].toLowerCase()} og de 3 vigtigste ting, jeg bør gøre nu.`);
              }}
            >
              <Sparkles /> Spørg assistenten
            </Button>
          </div>
        </header>

        {trend.error || campaigns.error ? (
          <div className="card mt-6 p-6 text-[13px] text-negative">{((trend.error ?? campaigns.error) as Error).message}</div>
        ) : (
          <motion.div variants={stagger(0.06, 0.05)} initial="hidden" animate="show" className="mt-6 grid gap-5">
            <section className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
              {kpis ? kpis.map((k) => <KpiCard key={k.label} kpi={k} />) : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[158px]" />)}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.75fr_1fr]">
              {trend.data ? <TrendCard daily={daily} currency={currency} /> : <Skeleton className="h-[380px]" />}
              {campaigns.data ? <DistributionCard campaigns={campaigns.data} currency={currency} /> : <Skeleton className="h-[380px]" />}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.75fr_1fr]">
              {campaigns.data ? <CampaignsCard campaigns={campaigns.data} currency={currency} days={days} /> : <Skeleton className="h-[360px]" />}
              <BudgetCard currency={currency} />
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              {campaigns.data ? <AlertsCard campaigns={campaigns.data} currency={currency} /> : <Skeleton className="h-[260px]" />}
              <DevicesCard currency={currency} />
            </section>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
