/**
 * Collapsible insights window next to the chat. The whole panel slides in/out,
 * and each section (Nøgletal, Månedsbudget, …) can be folded on its own.
 */
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowRight, CalendarDays, ChevronDown, Info, LayoutGrid, PanelRightClose, RefreshCw, Sparkles, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { ChartBlock } from '@/components/blocks/ChartBlock';
import { ChangeBadge } from '@/components/blocks/ChangeBadge';
import { CountUp, MiniOrb } from '@/components/reactbits';
import { EASE } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Select, Tooltip } from '@/components/ui/overlays';
import { change } from '@/bing/metrics';
import { useAccountTrend, useCampaigns, useSelectedRange, useSpendStatus } from '@/hooks/useAdsData';
import { queryClient } from '@/lib/queryClient';
import { DATE_PRESET_LABELS, fmtMoney, fmtNumber, type DatePreset } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { startChat } from '../chat/ChatView';
import { computeAlerts } from './alerts';

const WIDTH = 340;

function Section({ id, title, icon: Icon, summary, children, action }: { id: string; title: string; icon: LucideIcon; summary?: ReactNode; children: ReactNode; action?: ReactNode }) {
  const open = useSettings((s) => s.appearance.insightSections[id] ?? true);
  const setAppearance = useSettings((s) => s.setAppearance);
  const toggle = () => {
    const sections = useSettings.getState().appearance.insightSections;
    setAppearance({ insightSections: { ...sections, [id]: !open } });
  };
  return (
    <section className="border-b border-line last:border-0">
      <button type="button" onClick={toggle} aria-expanded={open} className="group flex w-full items-center gap-2.5 px-5 py-3.5 text-left">
        <Icon className="size-4 text-muted" />
        <span className="text-[13.5px] font-medium text-ink">{title}</span>
        <span className="ml-auto flex items-center gap-2">
          {!open && summary && <span className="text-[12.5px] tabular text-muted">{summary}</span>}
          <ChevronDown className={cn('size-4 text-subtle transition-transform duration-200 group-hover:text-ink', open && 'rotate-180')} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4">
              {children}
              {action && <div className="mt-3">{action}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-line-2', className)} />;
}

function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
      {children} <ArrowRight className="size-3" />
    </button>
  );
}

function PanelContent() {
  const account = useCurrentAccount();
  const mode = useConnection((s) => s.mode);
  const currency = account?.currency ?? 'DKK';
  const range = useSelectedRange();
  const trend = useAccountTrend(range);
  const campaigns = useCampaigns(range);
  const spend = useSpendStatus();
  const monthlyBudget = useSettings((s) => s.spend.monthlyBudget);
  const warnAt = useSettings((s) => s.spend.warnAtPct);
  const setAppearance = useSettings((s) => s.setAppearance);
  const setDatePreset = useSettings((s) => s.setDatePreset);
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
    <div className="flex h-full flex-col" style={{ width: WIDTH }}>
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-line/70 px-4">
        <span className="pl-1 text-[14px] font-medium text-ink">Indsigt</span>
        <Tooltip content="Opdatér">
          <Button size="icon-xs" variant="ghost" className="ml-auto" aria-label="Opdatér" onClick={() => void queryClient.invalidateQueries()}>
            <RefreshCw className={cn((trend.isFetching || campaigns.isFetching) && 'animate-spin')} />
          </Button>
        </Tooltip>
        <Tooltip content="Skjul indsigt">
          <Button size="icon-xs" variant="ghost" aria-label="Skjul indsigt" onClick={() => setAppearance({ insightsPanel: false })}>
            <PanelRightClose />
          </Button>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Header card */}
        <div className="p-4 pb-2">
          <div className="relative overflow-hidden rounded-2xl border border-brand/15 bg-[linear-gradient(135deg,#f4f2ff,#ffffff_70%)] p-4">
            <div aria-hidden className="absolute -right-6 -top-8 size-28 rounded-full bg-[radial-gradient(circle,rgb(139_123_255/0.35),transparent_70%)]" />
            <div className="relative flex items-center gap-3">
              <MiniOrb size={34} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-ink">{account?.name ?? 'Ingen konto'}</div>
                <div className="text-[12px] text-muted">{mode === 'demo' ? 'Demo-konto' : 'Microsoft Advertising'}</div>
              </div>
            </div>
            <div className="relative mt-3 flex items-center justify-between gap-2 border-t border-brand/10 pt-2.5">
              <span className="text-[12px] text-muted">Periode</span>
              <Select<DatePreset>
                triggerVariant="pill"
                align="end"
                aria-label="Periode"
                value={range.preset}
                onChange={setDatePreset}
                options={(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => ({ value: p, label: DATE_PRESET_LABELS[p], icon: <CalendarDays className="size-3.5 text-muted" /> }))}
              />
            </div>
          </div>
        </div>

        <Section id="kpis" title="Nøgletal" icon={TrendingUp} summary={t ? fmtMoney(t.spend, currency, 0) : undefined}>
          {trend.error ? (
            <p className="text-[12.5px] text-negative">{String((trend.error as Error).message)}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
                {kpis
                  ? kpis.map((k) => (
                      <div key={k.label}>
                        <div className="text-[12px] text-muted">{k.label}</div>
                        <CountUp value={k.value} format={k.fmt} className="block text-[18px] font-medium tracking-[-0.02em] text-ink tabular" />
                        <ChangeBadge change={k.change} invert={k.invert} className="mt-0.5" />
                      </div>
                    ))
                  : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
              <div className="-mx-2 mt-3">
                {trend.data ? (
                  <ChartBlock
                    chart="area"
                    data={trend.data.daily.map((d) => ({ date: d.date ?? '', spend: d.spend ?? 0 }))}
                    xKey="date"
                    series={[{ key: 'spend', label: 'Forbrug', format: 'money' }]}
                    currency={currency}
                    height={100}
                  />
                ) : (
                  <Skeleton className="mx-2 h-[100px]" />
                )}
              </div>
            </>
          )}
        </Section>

        <Section
          id="budget"
          title="Månedsbudget"
          icon={Wallet}
          summary={share !== null ? `${Math.round(share * 100)} %` : s ? fmtMoney(s.monthToDateSpend, currency, 0) : undefined}
          action={<LinkButton onClick={() => go('settings', 'spend')}>Budget og grænser</LinkButton>}
        >
          {!s ? (
            <Skeleton className="h-16" />
          ) : (
            <div>
              <div className="flex items-baseline justify-between">
                <CountUp value={s.monthToDateSpend} format={(v) => fmtMoney(v, currency, 0)} className="text-[20px] font-medium tracking-[-0.02em] text-ink tabular" />
                <span className="text-[12px] text-muted">{monthlyBudget ? `af ${fmtMoney(monthlyBudget, currency, 0)}` : 'brugt denne måned'}</span>
              </div>
              {monthlyBudget ? (
                <>
                  <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-line-2">
                    <motion.div
                      className={cn('absolute inset-y-0 left-0 rounded-full', (share ?? 0) >= 1 ? 'bg-negative' : (share ?? 0) * 100 >= warnAt ? 'bg-warning' : 'bg-brand')}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (share ?? 0) * 100)}%` }}
                      transition={{ duration: 0.9, ease: EASE }}
                    />
                    {forecastShare !== null && forecastShare < 1.4 && (
                      <div className="absolute inset-y-0 w-0.5 bg-ink/40" style={{ left: `${Math.min(99.5, forecastShare * 100)}%` }} title="Prognose" />
                    )}
                  </div>
                  <div className="mt-2 flex justify-between text-[12px] text-muted">
                    <span>Dag {s.daysElapsed}</span>
                    <span className={cn((forecastShare ?? 0) > 1 && 'font-medium text-warning')}>Prognose {fmtMoney(s.forecastByRunRate, currency, 0)}</span>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  Prognose for måneden er <span className="text-ink-2">{fmtMoney(s.forecastByRunRate, currency, 0)}</span> – sæt et månedsbudget for advarsler og budgetvagt.
                </p>
              )}
            </div>
          )}
        </Section>

        <Section id="alerts" title="Opmærksomhedspunkter" icon={Sparkles} summary={campaigns.data ? String(alerts.length) : undefined}>
          {!campaigns.data ? (
            <div className="grid gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-[12.5px] text-muted">Ingen åbenlyse problemer i perioden.</p>
          ) : (
            <div className="-mx-2 grid gap-0.5">
              {alerts.map((a) => (
                <button key={a.id} type="button" onClick={() => startChat(a.prompt)} className="group flex items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-line-2">
                  <span
                    className={cn(
                      'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md',
                      a.tone === 'opportunity' ? 'bg-positive-bg text-positive' : a.tone === 'warning' ? 'bg-warning-bg text-warning' : 'bg-brand-50 text-brand',
                    )}
                  >
                    {a.tone === 'opportunity' ? <TrendingUp className="size-3.5" /> : a.tone === 'warning' ? <AlertTriangle className="size-3.5" /> : <Info className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium leading-snug text-ink">{a.title}</span>
                    <span className="block text-[12px] leading-snug text-muted">{a.detail}</span>
                  </span>
                  <ArrowRight className="mt-1 size-3.5 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section
          id="campaigns"
          title="Kampagner"
          icon={LayoutGrid}
          summary={campaigns.data ? String(campaigns.data.length) : undefined}
          action={<LinkButton onClick={() => go('campaigns')}>Se alle kampagner</LinkButton>}
        >
          {!campaigns.data ? (
            <Skeleton className="h-28" />
          ) : (
            <div className="-mx-1.5 grid gap-0.5">
              {campaigns.data.slice(0, 6).map((c) => {
                const max = campaigns.data[0]?.metrics?.spend || 1;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => startChat(`Hvordan klarer kampagnen "${c.name}" (id ${c.id}) sig, og hvad kan forbedres?`)}
                    className="group rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-line-2"
                  >
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <span className={cn('size-1.5 shrink-0 rounded-full', c.status === 'Active' ? 'bg-positive' : 'bg-subtle')} />
                      <span className="truncate text-ink-2 group-hover:text-ink">{c.name}</span>
                      <span className="ml-auto shrink-0 tabular text-muted">{fmtMoney(c.metrics?.spend ?? 0, currency, 0)}</span>
                    </div>
                    <div className="ml-3.5 mt-1 h-1 overflow-hidden rounded-full bg-line-2">
                      <motion.div className="h-full rounded-full bg-brand/50" initial={{ width: 0 }} animate={{ width: `${((c.metrics?.spend ?? 0) / max) * 100}%` }} transition={{ duration: 0.7, ease: EASE }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

export function InsightsPanel({ open }: { open: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="insights"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="relative z-10 h-full shrink-0 overflow-hidden border-l border-line bg-surface"
          aria-label="Indsigt"
        >
          <PanelContent />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
