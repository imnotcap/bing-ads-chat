import { motion } from 'motion/react';
import { AlertTriangle, ArrowRight, Info, RefreshCw, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { ChartBlock } from '@/components/blocks/ChartBlock';
import { ChangeBadge } from '@/components/blocks/ChangeBadge';
import { CountUp } from '@/components/reactbits';
import { EASE, fadeUp, stagger } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { change } from '@/bing/metrics';
import { useAccountTrend, useCampaigns, useSelectedRange, useSpendStatus } from '@/hooks/useAdsData';
import { queryClient } from '@/lib/queryClient';
import { DATE_PRESET_LABELS, fmtMoney, fmtNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCurrentAccount } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { startChat } from '../chat/ChatView';
import { computeAlerts } from './alerts';

function Section({ title, icon: Icon, children, action }: { title: string; icon: typeof Wallet; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.section variants={fadeUp} className="rounded-2xl border border-black/[0.05] bg-white/80 p-4 shadow-[0_1px_2px_rgb(16_24_64/0.04)] backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-muted" />
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </motion.section>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-line-2', className)} />;
}

export function InsightsPanel() {
  const account = useCurrentAccount();
  const currency = account?.currency ?? 'DKK';
  const range = useSelectedRange();
  const trend = useAccountTrend(range);
  const campaigns = useCampaigns(range);
  const spend = useSpendStatus();
  const monthlyBudget = useSettings((s) => s.spend.monthlyBudget);
  const warnAt = useSettings((s) => s.spend.warnAtPct);
  const go = useUi((s) => s.go);
  const alerts = useMemo(() => (campaigns.data ? computeAlerts(campaigns.data, range, currency) : []), [campaigns.data, range, currency]);

  const t = trend.data?.totals;
  const p = trend.data?.previous;
  const kpis = t
    ? [
        { label: 'Forbrug', value: t.spend, fmt: (v: number | null) => fmtMoney(v, currency, 0), change: change(t.spend, p?.spend ?? null), invert: true },
        { label: 'Konverteringer', value: t.conversions, fmt: (v: number | null) => fmtNumber(v, 0), change: change(t.conversions, p?.conversions ?? null) },
        { label: 'CPA', value: t.cpa, fmt: (v: number | null) => fmtMoney(v, currency), change: change(t.cpa, p?.cpa ?? null), invert: true },
        { label: 'ROAS', value: t.roas, fmt: (v: number | null) => (v === null ? '–' : `${fmtNumber(v, 2)}x`), change: change(t.roas, p?.roas ?? null) },
      ]
    : null;

  const s = spend.data;
  const share = s && monthlyBudget ? s.monthToDateSpend / monthlyBudget : null;
  const forecastShare = s && monthlyBudget ? s.forecastByRunRate / monthlyBudget : null;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="relative z-10 flex h-full w-[340px] shrink-0 flex-col border-l border-black/[0.05] bg-[#f9fafd]/80 backdrop-blur-xl"
    >
      <div className="flex h-16 shrink-0 items-center gap-2 px-5">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink">Indsigt</div>
          <div className="truncate text-[11.5px] text-muted">{DATE_PRESET_LABELS[range.preset]} · sammenlignet med perioden før</div>
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          className="ml-auto"
          aria-label="Opdatér"
          onClick={() => void queryClient.invalidateQueries()}
        >
          <RefreshCw className={cn((trend.isFetching || campaigns.isFetching) && 'animate-spin')} />
        </Button>
      </div>

      <motion.div variants={stagger(0.06, 0.1)} initial="hidden" animate="show" className="grid flex-1 content-start gap-3 overflow-y-auto px-4 pb-6">
        <Section title="Nøgletal" icon={TrendingUp}>
          {trend.error ? (
            <p className="text-[12.5px] text-negative">{String((trend.error as Error).message)}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
                {kpis
                  ? kpis.map((k) => (
                      <div key={k.label}>
                        <div className="text-[11.5px] text-muted">{k.label}</div>
                        <CountUp value={k.value} format={k.fmt} className="block text-[17px] font-semibold tracking-[-0.02em] text-ink tabular" />
                        <ChangeBadge change={k.change} invert={k.invert} className="mt-0.5" />
                      </div>
                    ))
                  : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
              <div className="-mx-2 mt-3">
                {trend.data ? (
                  <ChartBlock
                    chart="area"
                    data={trend.data.daily.map((d) => ({ date: d.date ?? '', spend: d.spend ?? 0, revenue: d.revenue ?? 0 }))}
                    xKey="date"
                    series={[{ key: 'spend', label: 'Forbrug', format: 'money' }]}
                    currency={currency}
                    height={110}
                  />
                ) : (
                  <Skeleton className="mx-2 h-[110px]" />
                )}
              </div>
            </>
          )}
        </Section>

        <Section
          title="Månedsbudget"
          icon={Wallet}
          action={
            <button type="button" className="text-[12px] font-medium text-brand hover:underline" onClick={() => go('settings', 'spend')}>
              Forbrugsregler
            </button>
          }
        >
          {!s ? (
            <Skeleton className="h-16" />
          ) : (
            <div>
              <div className="flex items-baseline justify-between">
                <CountUp value={s.monthToDateSpend} format={(v) => fmtMoney(v, currency, 0)} className="text-[20px] font-semibold tracking-[-0.02em] text-ink tabular" />
                <span className="text-[12px] text-muted">{monthlyBudget ? `af ${fmtMoney(monthlyBudget, currency, 0)}` : 'brugt denne måned'}</span>
              </div>
              {monthlyBudget ? (
                <>
                  <div className="relative mt-2.5 h-2.5 overflow-hidden rounded-full bg-line">
                    <motion.div
                      className={cn('absolute inset-y-0 left-0 rounded-full', (share ?? 0) >= 1 ? 'bg-negative' : (share ?? 0) * 100 >= warnAt ? 'bg-warning' : 'bg-gradient-to-r from-brand to-violet')}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (share ?? 0) * 100)}%` }}
                      transition={{ duration: 1, ease: EASE }}
                    />
                    {forecastShare !== null && forecastShare < 1.4 && (
                      <div className="absolute inset-y-0 w-0.5 bg-ink/40" style={{ left: `${Math.min(99.5, forecastShare * 100)}%` }} title="Prognose" />
                    )}
                  </div>
                  <div className="mt-2 flex justify-between text-[11.5px] text-muted">
                    <span>{Math.round((share ?? 0) * 100)} % brugt · dag {s.daysElapsed}</span>
                    <span className={cn((forecastShare ?? 0) > 1 && 'font-semibold text-warning')}>Prognose {fmtMoney(s.forecastByRunRate, currency, 0)}</span>
                  </div>
                </>
              ) : (
                <div className="mt-2 text-[12px] text-muted">
                  Prognose for måneden: <span className="font-medium text-ink-2">{fmtMoney(s.forecastByRunRate, currency, 0)}</span>.{' '}
                  <button type="button" className="font-medium text-brand hover:underline" onClick={() => go('settings', 'spend')}>
                    Sæt et månedsbudget
                  </button>{' '}
                  for advarsler og budgetvagt.
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="Opmærksomhedspunkter" icon={Sparkles}>
          {!campaigns.data ? (
            <div className="grid gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-[12.5px] text-muted">Ingen åbenlyse problemer i perioden. Spørg assistenten om en dybere analyse.</p>
          ) : (
            <div className="grid gap-2">
              {alerts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => startChat(a.prompt)}
                  className="group flex items-start gap-2.5 rounded-xl border border-transparent p-2 text-left transition-colors hover:border-line hover:bg-white"
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg',
                      a.tone === 'opportunity' ? 'bg-positive-bg text-positive' : a.tone === 'warning' ? 'bg-warning-bg text-warning' : 'bg-brand-50 text-brand',
                    )}
                  >
                    {a.tone === 'opportunity' ? <TrendingUp className="size-3.5" /> : a.tone === 'warning' ? <AlertTriangle className="size-3.5" /> : <Info className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold leading-snug text-ink">{a.title}</span>
                    <span className="block text-[11.5px] leading-snug text-muted">{a.detail}</span>
                  </span>
                  <ArrowRight className="mt-1 size-3.5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Kampagner"
          icon={TrendingUp}
          action={
            <button type="button" className="text-[12px] font-medium text-brand hover:underline" onClick={() => go('campaigns')}>
              Se alle
            </button>
          }
        >
          {!campaigns.data ? (
            <Skeleton className="h-28" />
          ) : (
            <div className="grid gap-1">
              {campaigns.data.slice(0, 6).map((c) => {
                const max = campaigns.data[0]?.metrics?.spend || 1;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => startChat(`Hvordan klarer kampagnen "${c.name}" (id ${c.id}) sig, og hvad kan forbedres?`)}
                    className="group rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-white"
                  >
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <span className={cn('size-1.5 shrink-0 rounded-full', c.status === 'Active' ? 'bg-positive' : 'bg-subtle')} />
                      <span className="truncate font-medium text-ink-2 group-hover:text-ink">{c.name}</span>
                      <span className="ml-auto shrink-0 tabular text-muted">{fmtMoney(c.metrics?.spend ?? 0, currency, 0)}</span>
                    </div>
                    <div className="ml-3.5 mt-1 h-1 overflow-hidden rounded-full bg-line-2">
                      <motion.div
                        className="h-full rounded-full bg-brand/60"
                        initial={{ width: 0 }}
                        animate={{ width: `${((c.metrics?.spend ?? 0) / max) * 100}%` }}
                        transition={{ duration: 0.8, ease: EASE }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>
      </motion.div>
    </motion.aside>
  );
}
