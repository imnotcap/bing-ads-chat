/**
 * Dashboard → Microsoft Ads → Dagligt overblik: the account day by day, week by week and
 * month by month in one table – the same columns the team used in its own overview, and
 * a ROAS cell coloured from red to green so the good and the bad days stand out.
 *
 * Everything comes from the days the workspace keeps (workspace/daily.ts): switching
 * between days, weeks and months, or stepping through the months, asks Microsoft for
 * nothing. Only a month further back than the stored 13 is fetched – once.
 */
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBackend } from '@/bing/backend';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, RefreshCw, TriangleAlert } from '@/components/icons';
import { EASE, pageTransition } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { Dialog, Tooltip } from '@/components/ui/overlays';
import { refreshAdsData, useCampaigns, useDailyHistory, useDailyRange } from '@/hooks/useAdsData';
import { fmtMoney, fmtNumber, fmtPercent, fmtRelative, today as localToday } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import type { DerivedMetrics } from '@/bing/types';
import { ConversionsDialog, type ConversionsTarget } from './ConversionsDialog';
import { DEFAULT_ROAS_SCALE, brandCampaignIds, dayRows, daysOf, withoutBrand, monthRows, roasColor, totalOf, validScale, weekRows, type Grain, type PeriodRow, type RoasScale } from './daily';

/** How far back the month arrows go. */
const MAX_MONTHS_BACK = 36;

const monthName = new Intl.DateTimeFormat('da-DK', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

const lastOfMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).toISOString().slice(0, 10);
};

/** Danish decimals as typed ("2,5"). */
const parseDecimal = (v: string) => Number(v.trim().replace(/\./g, '').replace(',', '.'));

const COLUMNS: { label: string; title?: string; cell: (m: DerivedMetrics, currency: string) => string }[] = [
  { label: 'Eksp.', title: 'Eksponeringer (visninger)', cell: (m) => fmtNumber(m.impressions) },
  { label: 'Klik', cell: (m) => fmtNumber(m.clicks) },
  { label: 'CTR', title: 'Klik / eksponeringer', cell: (m) => fmtPercent(m.ctr, 2) },
  { label: 'Gns. CPC', title: 'Pris / klik', cell: (m, c) => fmtMoney(m.cpc, c, 2) },
  { label: 'Pris', title: 'Forbrug', cell: (m, c) => fmtMoney(m.spend, c, 2) },
  { label: 'Konv.værdi', title: 'Omsætning fra konverteringer', cell: (m, c) => fmtMoney(m.revenue, c, 2) },
  { label: 'Konv.', title: 'Konverteringer', cell: (m) => fmtNumber(m.conversions, 2) },
  { label: 'Konv.rate', title: 'Konverteringer / klik', cell: (m) => fmtPercent(m.convRate, 2) },
  { label: 'Pris / konv.', title: 'Forbrug / konverteringer', cell: (m, c) => fmtMoney(m.cpa, c, 2) },
];

const FIRST_COLUMN: Record<Grain, [string, string | null]> = {
  day: ['Dato', 'Ugedag'],
  week: ['Uge', 'Periode'],
  month: ['Måned', null],
};

function RoasCell({ roas, scale, strong }: { roas: number | null; scale: RoasScale; strong?: boolean }) {
  const bg = roasColor(roas, scale);
  return (
    <td className="border-b border-line-2 p-0 text-right">
      <span
        className={cn('block px-3 py-2.5 tabular text-ink', strong && 'font-semibold', !bg && 'text-subtle')}
        style={bg ? { backgroundColor: bg } : undefined}
      >
        {roas === null ? '–' : fmtNumber(roas, 2)}
      </span>
    </td>
  );
}

function ScaleEditor({ scale, onChange }: { scale: RoasScale; onChange: (s: RoasScale | null) => void }) {
  const [red, setRed] = useState(String(scale.red).replace('.', ','));
  const [green, setGreen] = useState(String(scale.green).replace('.', ','));
  const reset = () => {
    setRed(String(scale.red).replace('.', ','));
    setGreen(String(scale.green).replace('.', ','));
  };
  const commit = (field: 'red' | 'green') => {
    let r = parseDecimal(red);
    let g = parseDecimal(green);
    if (!Number.isFinite(r) || !Number.isFinite(g) || r < 0 || g < 0) return reset();
    // Moving one end past the other moves the whole scale, at the width it had – so the
    // scale can be raised by typing red first, or lowered by typing green first.
    const width = scale.green - scale.red;
    const round = (v: number) => Math.round(v * 100) / 100;
    if (field === 'red' && r >= g) g = round(r + width);
    if (field === 'green' && g <= r) r = Math.max(0, round(g - width));
    const ok = validScale({ red: r, green: g });
    if (ok.red !== r || ok.green !== g) return reset();
    if (r !== scale.red || g !== scale.green) onChange({ red: r, green: g });
  };
  const isDefault = scale.red === DEFAULT_ROAS_SCALE.red && scale.green === DEFAULT_ROAS_SCALE.green;
  const field = (value: string, set: (v: string) => void, label: string, which: 'red' | 'green') => (
    <input
      value={value}
      inputMode="decimal"
      aria-label={label}
      onChange={(e) => set(e.target.value)}
      onBlur={() => commit(which)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="h-7 w-14 rounded-lg border border-line bg-surface px-2 text-center text-[12.5px] tabular text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
    />
  );
  // The legend runs over the same points as the cells: red, a third, two thirds, green, a point above green.
  const third = (scale.green - scale.red) / 3;
  const stops = [scale.red, scale.red + third, scale.red + 2 * third, scale.green, scale.green + 1].map((r) => roasColor(r, scale));
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-muted">
      <span className="font-medium text-ink-2">ROAS-farver</span>
      <span aria-hidden="true" className="h-2.5 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} />
      <label className="flex items-center gap-1.5">Rød under {field(red, setRed, 'Rød under ROAS', 'red')}</label>
      <label className="flex items-center gap-1.5">grøn fra {field(green, setGreen, 'Grøn fra ROAS', 'green')}</label>
      {!isDefault && (
        <button
          type="button"
          className="text-brand hover:underline"
          onClick={() => {
            setRed(String(DEFAULT_ROAS_SCALE.red).replace('.', ','));
            setGreen(String(DEFAULT_ROAS_SCALE.green).replace('.', ','));
            onChange(null);
          }}
        >
          Nulstil
        </button>
      )}
    </div>
  );
}

export function DailyPage() {
  const account = useCurrentAccount();
  const accountId = useConnection((s) => s.accountId);
  const currency = account?.currency ?? 'DKK';
  const saved = useSettings((s) => (accountId ? s.roasScales[accountId] : undefined));
  const setRoasScale = useSettings((s) => s.setRoasScale);
  const scale = validScale(saved ?? DEFAULT_ROAS_SCALE);
  const [conversions, setConversions] = useState<ConversionsTarget | null>(null);

  const history = useDailyHistory();
  const view = history.data;
  const today = view?.today ?? localToday();
  const thisMonth = today.slice(0, 7);

  const [grain, setGrain] = useState<Grain>('day');
  const [month, setMonth] = useState(thisMonth);
  const [refreshing, setRefreshing] = useState(false);

  // A month that starts before the stored 13 is fetched on its own (once, by the Worker).
  const monthRange = { from: `${month}-01`, to: lastOfMonth(month) };
  const beforeHistory = grain === 'day' && !!view?.coverage && monthRange.from < view.coverage.from;
  const older = useDailyRange(monthRange, beforeHistory);
  const source = beforeHistory ? older.data : view;

  // "Ekskl. brand": the brand campaigns' own days (one campaign report) taken off the account's, day by day.
  const [scope, setScope] = useState<'all' | 'nobrand'>('all');
  const [pickBrand, setPickBrand] = useState(false);
  const campaignList = useCampaigns(useMemo(() => ({ from: addDaysIso(today, -30), to: today }), [today]));
  const chosen = useSettings((s) => (accountId ? s.brandCampaigns[accountId] : undefined));
  const brandIds = useMemo(() => brandCampaignIds(campaignList.data ?? [], chosen), [campaignList.data, chosen]);
  const span = source?.days.length ? { from: source.days[0]!.day, to: source.days[source.days.length - 1]!.day } : null;
  const noBrand = scope === 'nobrand' && brandIds.length > 0;
  const brand = useQuery({
    queryKey: ['daily-brand', accountId, brandIds.join(','), span?.from, span?.to, source?.fetchedAt],
    enabled: noBrand && !!span && !!accountId,
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }) => daysOf(await (await getBackend()).runReport(accountId!, { kind: 'campaign', range: span!, aggregation: 'Daily', campaignIds: brandIds }, signal)),
  });

  const rows: PeriodRow[] = useMemo(() => {
    const all = source?.days ?? [];
    const days = noBrand && brand.data ? withoutBrand(all, brand.data) : all;
    return grain === 'day' ? dayRows(days, month, today) : grain === 'week' ? weekRows(days, today) : monthRows(days, today);
  }, [source, grain, month, today, noBrand, brand.data]);
  const total = totalOf(rows);

  const loading = (beforeHistory ? older.isPending : history.isPending) || (noBrand && brand.isPending);
  const syncing = !!source?.syncing;
  const error = (beforeHistory ? older.error : history.error) as Error | null;
  const firstFetch = syncing && !source?.coverage;
  const [head, detail] = FIRST_COLUMN[grain];

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshAdsData();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <motion.div {...pageTransition} className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-8 pb-4 pt-7">
        <div className="mr-auto">
          <h1 className="text-[26px] font-medium tracking-[-0.03em] text-ink">Dagligt overblik</h1>
          <p className="flex items-center gap-1.5 text-[13px] text-muted">
            {account?.name ?? 'Microsoft Ads'}
            {view?.fetchedAt && <span>· Opdateret {fmtRelative(view.fetchedAt)}</span>}
            {syncing && !firstFetch && (
              <span className="inline-flex items-center gap-1 text-brand">
                <Loader2 className="size-3 animate-spin" /> henter nyt
              </span>
            )}
          </p>
        </div>
        <Segmented
          layoutId="daily-scope"
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'Alle kampagner' },
            { value: 'nobrand', label: 'Ekskl. brand', title: brandIds.length ? `Uden ${brandIds.length} brand-kampagne${brandIds.length === 1 ? '' : 'r'}` : 'Ingen brand-kampagner fundet – vælg dem' },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={() => setPickBrand(true)}>
          Brand ({brandIds.length})
        </Button>
        <Segmented
          layoutId="daily-grain"
          size="sm"
          value={grain}
          onChange={setGrain}
          options={[
            { value: 'day', label: 'Dag' },
            { value: 'week', label: 'Uge' },
            { value: 'month', label: 'Måned' },
          ]}
        />
        <Tooltip content={view && !view.office ? 'Uden for hverdage 8–16 hentes der kun nyt, når du trykker her.' : 'Hent dagens tal igen'}>
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className={cn((refreshing || syncing) && 'animate-spin')} /> Opdatér
          </Button>
        </Tooltip>
      </header>

      <div className="flex-1 overflow-y-auto px-8 pb-10">
        {scope === 'nobrand' && (
          <p className="mb-3 text-[12.5px] text-muted">
            {brandIds.length
              ? `Ekskl. brand: ${(campaignList.data ?? []).filter((c) => brandIds.includes(c.id)).map((c) => c.name).join(', ')} er trukket fra dag for dag.`
              : 'Ingen brand-kampagner fundet (ingen kampagne har "brand" i navnet) – vælg dem under Brand.'}
            {brand.error ? <span className="text-negative"> Brand-tallene kunne ikke hentes: {errorMessage(brand.error)}</span> : null}
          </p>
        )}
        <div className="card overflow-hidden">
          <div className="flex min-h-[52px] flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
            {grain === 'day' ? (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Forrige måned" disabled={month <= shiftMonth(thisMonth, -MAX_MONTHS_BACK)} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
                  <ChevronLeft />
                </Button>
                <span className="flex min-w-[150px] items-center justify-center gap-1.5 text-[13.5px] font-medium text-ink">
                  <CalendarDays className="size-3.5 text-muted" />
                  {(() => {
                    const label = monthName.format(new Date(`${month}-01T00:00:00Z`));
                    return label.charAt(0).toUpperCase() + label.slice(1);
                  })()}
                </span>
                <Button variant="ghost" size="icon-sm" aria-label="Næste måned" disabled={month >= thisMonth} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
                  <ChevronRight />
                </Button>
              </div>
            ) : (
              <span className="text-[13px] text-muted">{grain === 'week' ? 'De seneste 13 uger' : 'De seneste 13 måneder · klik på en måned for at se dens dage'}</span>
            )}
            <div className="ml-auto">
              <ScaleEditor key={`${accountId}:${scale.red}:${scale.green}`} scale={scale} onChange={(s) => accountId && setRoasScale(accountId, s)} />
            </div>
          </div>

          {error ? (
            <p className="flex items-center gap-2 p-6 text-[13px] text-negative">
              <TriangleAlert className="size-4" /> {errorMessage(error)}
            </p>
          ) : loading || firstFetch ? (
            <div className="grid gap-2 p-4">
              {firstFetch && (
                <p className="flex items-center gap-2 px-1 pb-2 text-[13px] text-muted">
                  <Loader2 className="size-3.5 animate-spin text-brand" />
                  {beforeHistory ? 'Henter månedens dage fra Microsoft – det sker kun denne ene gang.' : 'Henter 13 måneders dagstal fra Microsoft – det sker kun første gang, derefter ligger de klar.'}
                </p>
              )}
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-line-2" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-[13px] text-muted">Ingen tal for perioden endnu.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 whitespace-nowrap text-[13px]">
                <thead>
                  <tr className="text-left text-[11.5px] font-semibold text-muted">
                    <th className="border-b border-line bg-[#fafafb] px-3 py-2.5 pl-4">{head}</th>
                    {detail && <th className="border-b border-line bg-[#fafafb] px-3 py-2.5">{detail}</th>}
                    {COLUMNS.map((c) => (
                      <th key={c.label} title={c.title} className="border-b border-line bg-[#fafafb] px-3 py-2.5 text-right">
                        {c.label}
                      </th>
                    ))}
                    <th title="Konv.værdi / pris" className="border-b border-line bg-[#fafafb] px-3 py-2.5 text-right">
                      ROAS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const clickable = grain === 'month';
                    return (
                      <motion.tr
                        key={`${grain}:${r.key}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: EASE, delay: Math.min(i, 14) * 0.015 }}
                        onClick={
                          clickable
                            ? () => {
                                setMonth(r.key);
                                setGrain('day');
                              }
                            : undefined
                        }
                        className={cn('transition-colors hover:bg-brand-50/30', clickable && 'cursor-pointer')}
                      >
                        <td className="border-b border-line-2 px-3 py-2.5 pl-4 font-medium text-ink">
                          {r.label}
                          {r.partial && (
                            <Tooltip content={r.to >= today ? 'Perioden er ikke slut – tallene ændrer sig endnu.' : 'Kun en del af perioden er hentet.'}>
                              <span className="ml-2 rounded-full bg-line-2 px-1.5 py-px text-[10.5px] font-medium text-subtle">foreløbig</span>
                            </Tooltip>
                          )}
                        </td>
                        {detail && <td className="border-b border-line-2 px-3 py-2.5 text-ink-2">{r.detail}</td>}
                        {COLUMNS.map((c) => (
                          <td key={c.label} className="border-b border-line-2 px-3 py-2.5 text-right tabular text-ink-2">
                            {c.label === 'Konv.' && r.metrics.conversions > 0 ? (
                              <Tooltip content="Se hvilke produkter der konverterede">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConversions({ range: { from: r.from, to: r.to }, label: r.label, conversions: r.metrics.conversions });
                                  }}
                                  className="-mx-1.5 rounded-md px-1.5 py-0.5 font-medium text-brand underline decoration-brand/30 underline-offset-2 transition-colors hover:bg-brand-50 hover:decoration-brand"
                                >
                                  {c.cell(r.metrics, currency)}
                                </button>
                              </Tooltip>
                            ) : (
                              c.cell(r.metrics, currency)
                            )}
                          </td>
                        ))}
                        <RoasCell roas={r.metrics.roas} scale={scale} />
                      </motion.tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="text-[12.5px] font-semibold text-ink">
                    <td className="bg-[#fafafb] px-3 py-2.5 pl-4" colSpan={detail ? 2 : 1}>
                      Total
                    </td>
                    {COLUMNS.map((c) => (
                      <td key={c.label} className="bg-[#fafafb] px-3 py-2.5 text-right tabular">
                        {c.cell(total, currency)}
                      </td>
                    ))}
                    <RoasCell roas={total.roas} scale={scale} strong />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <p className="mt-3 text-[12px] text-muted">
          Uger og måneder er summer af dagene, og alle forhold (CTR, CPC, ROAS …) regnes af summerne. De seneste 30 dage hentes igen hver morgen, fordi
          konverteringer kommer til i dagene efter klikket.
          {view && !view.office && ' Uden for hverdage 8–16 hentes der kun nyt, når du trykker Opdatér.'}
          {view?.error && <span className="text-negative"> Seneste hentning fejlede: {view.error}</span>} Klik på antallet af konverteringer for at se, hvilke produkter de kom fra.
        </p>
        <ConversionsDialog target={conversions} currency={currency} onClose={() => setConversions(null)} exclude={noBrand ? brandIds : undefined} />
        <BrandPicker open={pickBrand} onClose={() => setPickBrand(false)} accountId={accountId} campaigns={campaignList.data ?? []} chosen={chosen} current={brandIds} />
      </div>
    </motion.div>
  );
}

const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Which campaigns count as brand for the account – remembered per account (default: "brand" in the name). */
function BrandPicker({
  open,
  onClose,
  accountId,
  campaigns,
  chosen,
  current,
}: {
  open: boolean;
  onClose: () => void;
  accountId: string | null;
  campaigns: { id: string; name: string; status: string }[];
  chosen: string[] | undefined;
  current: string[];
}) {
  const setBrandCampaigns = useSettings((s) => s.setBrandCampaigns);
  const [picked, setPicked] = useState<Set<string>>(new Set(current));
  const [q, setQ] = useState('');
  // Opens with what counts as brand right now.
  useEffect(() => {
    if (open) setPicked(new Set(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const list = campaigns.filter((c) => c.status !== 'Deleted' && c.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Hvilke kampagner er brand?"
      description={chosen ? 'Valgt af jer for denne konto.' : 'Lige nu: kampagner med "brand" i navnet. Vælg selv, hvis det ikke passer.'}
      footer={
        <>
          {chosen && (
            <Button
              variant="ghost"
              onClick={() => {
                if (accountId) setBrandCampaigns(accountId, null);
                onClose();
              }}
            >
              Brug navnet igen
            </Button>
          )}
          <Button
            variant="positive"
            onClick={() => {
              if (accountId) setBrandCampaigns(accountId, [...picked]);
              onClose();
            }}
          >
            Gem ({picked.size})
          </Button>
        </>
      }
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Søg kampagne …"
        className="mb-2 h-9 w-full rounded-xl border border-line px-3 text-[13px] outline-none focus:border-brand/50"
      />
      <ul className="grid max-h-[50vh] gap-0.5 overflow-y-auto">
        {list.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-line-2/60">
              <input
                type="checkbox"
                checked={picked.has(c.id)}
                onChange={() => setPicked((p) => (p.has(c.id) ? new Set([...p].filter((x) => x !== c.id)) : new Set(p).add(c.id)))}
                className="size-4 accent-[var(--color-brand,#6d5cf6)]"
              />
              <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
              {c.status !== 'Active' && <span className="text-[11.5px] text-subtle">{c.status === 'Paused' ? 'Pauset' : c.status}</span>}
            </label>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
