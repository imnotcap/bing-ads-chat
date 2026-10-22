/**
 * Produkter: the Shopping / Performance Max products that earned something, with their
 * status in Merchant Center, the campaigns they show in and how they develop. Products
 * that never sold are left out (bing/products.ts). Search, filters, sorting and the
 * columns (Kolonner) work on the list already loaded – no new report per click.
 */
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, CalendarDays, Columns3, Package, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { KpiGrid } from '@/components/blocks/KpiGrid';
import { pageTransition } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/overlays';
import { change, derive, sumMetrics } from '@/bing/metrics';
import { refreshProducts, useProducts, useSelectedRange } from '@/hooks/useAdsData';
import { DATE_PRESET_LABELS, fmtNumber, type DatePreset } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { useCurrentAccount } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { startChat } from '../chat/ChatView';
import { COLUMN_BY_ID, toRow, type ProductRow } from './columns';
import { ColumnsMenu } from './ColumnsMenu';
import { DEFAULT_PRODUCT_COLUMNS } from './defaults';
import { ProductDialog } from './ProductDialog';

const PAGE = 50;

type StatusFilter = 'all' | 'ok' | 'problems' | 'disapproved' | 'outofstock';
type TrendFilter = 'all' | 'up' | 'down' | 'new' | 'stopped';
type ProfitFilter = 'all' | 'profitable' | 'losing';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Alle statusser' },
  { value: 'ok', label: 'Godkendt' },
  { value: 'problems', label: 'Med problemer' },
  { value: 'disapproved', label: 'Afvist' },
  { value: 'outofstock', label: 'Udsolgt / ikke i katalog' },
];
const TREND_OPTIONS: { value: TrendFilter; label: string }[] = [
  { value: 'all', label: 'Al udvikling' },
  { value: 'up', label: 'Vokser' },
  { value: 'down', label: 'Falder' },
  { value: 'new', label: 'Nye sælgere' },
  { value: 'stopped', label: 'Stoppet med at sælge' },
];
const PROFIT_OPTIONS: { value: ProfitFilter; label: string }[] = [
  { value: 'all', label: 'Alle ROAS' },
  { value: 'profitable', label: 'ROAS over 1' },
  { value: 'losing', label: 'ROAS under 1' },
];

function matchesStatus(r: ProductRow, f: StatusFilter) {
  const s = r.status?.status;
  if (f === 'all') return true;
  if (f === 'ok') return s === 'ok';
  if (f === 'problems') return s === 'warning' || s === 'disapproved' || !!r.status?.issues.length;
  if (f === 'disapproved') return s === 'disapproved';
  return s === 'outofstock' || s === 'notincatalog';
}

function matchesTrend(r: ProductRow, f: TrendFilter) {
  if (f === 'all') return true;
  if (f === 'new') return r.d.revenue > 0 && r.p.revenue === 0;
  if (f === 'stopped') return r.d.revenue === 0 && r.p.revenue > 0;
  const c = change(r.d.revenue, r.p.revenue);
  return c !== null && (f === 'up' ? c > 0.05 : c < -0.05);
}

export function ProductsPage() {
  const range = useSelectedRange();
  const setDatePreset = useSettings((s) => s.setDatePreset);
  const account = useCurrentAccount();
  const currency = account?.currency ?? 'DKK';
  const { data, isLoading, error } = useProducts(range);
  const columns = useSettings((s) => s.appearance.productColumns ?? DEFAULT_PRODUCT_COLUMNS);
  const go = useUi((s) => s.go);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [trend, setTrend] = useState<TrendFilter>('all');
  const [profit, setProfit] = useState<ProfitFilter>('all');
  const [campaign, setCampaign] = useState<string>('all');
  const [brand, setBrand] = useState<string>('all');
  const [sort, setSort] = useState<{ id: string; desc: boolean }>({ id: 'revenue', desc: true });
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<ProductRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const all = useMemo(() => (data?.products ?? []).map(toRow), [data]);
  const campaigns = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of all) for (const p of r.placements) m.set(p.campaignId, p.campaignName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'da'));
  }, [all]);
  const brands = useMemo(() => [...new Set(all.map((r) => r.brand).filter((b): b is string => !!b))].sort((a, b) => a.localeCompare(b, 'da')), [all]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = all.filter(
      (r) =>
        (!q || r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || (r.brand ?? '').toLowerCase().includes(q) || (r.category ?? '').toLowerCase().includes(q)) &&
        matchesStatus(r, status) &&
        matchesTrend(r, trend) &&
        (profit === 'all' || (profit === 'profitable' ? (r.d.roas ?? 0) >= 1 : r.d.spend > 0 && (r.d.roas ?? 0) < 1)) &&
        (campaign === 'all' || r.placements.some((p) => p.campaignId === campaign)) &&
        (brand === 'all' || r.brand === brand),
    );
    const col = COLUMN_BY_ID.get(sort.id);
    if (!col?.sort) return filtered;
    const key = col.sort;
    return [...filtered].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const d = typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y), 'da') : x - y;
      return sort.desc ? -d : d;
    });
  }, [all, query, status, trend, profit, campaign, brand, sort]);

  const totals = derive(sumMetrics(rows.map((r) => r.metrics)));
  const prevTotals = derive(sumMetrics(rows.map((r) => r.previous)));
  const filtersOn = !!query || status !== 'all' || trend !== 'all' || profit !== 'all' || campaign !== 'all' || brand !== 'all';
  const visible = columns.map((id) => COLUMN_BY_ID.get(id)).filter((c): c is NonNullable<typeof c> => !!c);

  const clear = () => {
    setQuery('');
    setStatus('all');
    setTrend('all');
    setProfit('all');
    setCampaign('all');
    setBrand('all');
  };
  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshProducts(range);
    } catch (e) {
      setRefreshError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  };
  const ask = (prompt: string) => {
    go('chat');
    startChat(prompt);
  };
  const sortBy = (id: string) => {
    // Numbers start with the largest first, text from A.
    setSort((s) => (s.id === id ? { id, desc: !s.desc } : { id, desc: !!COLUMN_BY_ID.get(id)?.numeric }));
    setShown(PAGE);
  };

  return (
    <motion.div {...pageTransition} className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-8 pb-4 pt-7">
        <div className="mr-auto">
          <h1 className="text-[26px] font-medium tracking-[-0.03em] text-ink">Produkter</h1>
          <p className="text-[13px] text-muted">
            {account?.name} · {DATE_PRESET_LABELS[range.preset]} · Shopping og Performance Max
          </p>
        </div>
        <Select<DatePreset>
          triggerVariant="pill"
          value={range.preset}
          onChange={setDatePreset}
          aria-label="Periode"
          options={(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => ({ value: p, label: DATE_PRESET_LABELS[p], icon: <CalendarDays className="size-3.5 text-muted" /> }))}
        />
        <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={refreshing || isLoading}>
          <RefreshCw className={cn((refreshing || isLoading) && 'animate-spin')} /> Opdatér
        </Button>
        <Button
          variant="gradient"
          size="sm"
          onClick={() =>
            ask(
              'Gennemgå produkterne i Shopping og Performance Max i den valgte periode: hvilke produkter tjener pengene, hvilke koster mere end de giver, hvilke er i fremgang eller tilbagegang, og hvilke har problemer i Merchant Center? Giv mig konkrete forslag.',
            )
          }
        >
          <Sparkles /> Analysér med AI
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 pb-10">
        {data && (
          <KpiGrid
            className="mb-5 lg:grid-cols-6"
            currency={currency}
            items={[
              { label: 'Produkter med salg', value: rows.length, format: 'number' },
              { label: 'Forbrug', value: totals.spend, format: 'money', change: change(totals.spend, prevTotals.spend), invert: true },
              { label: 'Klik', value: totals.clicks, format: 'number', change: change(totals.clicks, prevTotals.clicks) },
              { label: 'Konverteringer', value: totals.conversions, format: 'decimal', change: change(totals.conversions, prevTotals.conversions) },
              { label: 'Konv.værdi', value: totals.revenue, format: 'money', change: change(totals.revenue, prevTotals.revenue) },
              { label: 'ROAS', value: totals.roas, format: 'ratio', change: change(totals.roas, prevTotals.roas) },
            ]}
          />
        )}

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(PAGE);
                }}
                placeholder="Søg efter titel, produkt-id, mærke …"
                aria-label="Søg i produkter"
                className="h-8 w-full rounded-lg bg-line-2 pl-8 pr-2 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <Select<StatusFilter> triggerVariant="pill" value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Status" />
            <Select<TrendFilter> triggerVariant="pill" value={trend} onChange={setTrend} options={TREND_OPTIONS} aria-label="Udvikling" />
            <Select<ProfitFilter> triggerVariant="pill" value={profit} onChange={setProfit} options={PROFIT_OPTIONS} aria-label="ROAS" />
            {campaigns.length > 1 && (
              <Select<string>
                triggerVariant="pill"
                value={campaign}
                onChange={setCampaign}
                aria-label="Kampagne"
                contentClassName="max-w-[340px]"
                options={[{ value: 'all', label: 'Alle kampagner' }, ...campaigns.map(([id, name]) => ({ value: id, label: name }))]}
              />
            )}
            {brands.length > 1 && (
              <Select<string>
                triggerVariant="pill"
                value={brand}
                onChange={setBrand}
                aria-label="Mærke"
                options={[{ value: 'all', label: 'Alle mærker' }, ...brands.map((b) => ({ value: b, label: b }))]}
              />
            )}
            {filtersOn && (
              <Button variant="ghost" size="xs" onClick={clear}>
                <X /> Nulstil
              </Button>
            )}
            <div className="ml-auto">
              <ColumnsMenu>
                <Button variant="secondary" size="sm">
                  <Columns3 /> Kolonner
                </Button>
              </ColumnsMenu>
            </div>
          </div>

          {error ? (
            <p className="p-6 text-[13px] text-negative">{errorMessage(error)}</p>
          ) : isLoading ? (
            <div className="grid gap-2 p-4">
              <p className="mb-1 text-[13px] text-muted">Henter produkterne fra Microsoft Advertising … Med tusindvis af produkter kan det tage et par minutter første gang – derefter deles de via Cloudflare.</p>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-line-2" />
              ))}
            </div>
          ) : !rows.length ? (
            <div className="grid place-items-center gap-2 px-6 py-14 text-center">
              <Package className="size-6 text-subtle" />
              <p className="text-[14px] font-medium text-ink">{filtersOn ? 'Ingen produkter passer til filtrene' : 'Ingen produkter med salg i perioden'}</p>
              <p className="max-w-md text-[13px] text-muted">
                {filtersOn ? 'Prøv at fjerne et filter.' : 'Kun produkter, der har solgt i perioden eller perioden før, vises. Produkter i Shopping- og Performance Max-kampagner dukker op her.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 whitespace-nowrap text-[13px]">
                <thead>
                  <tr className="text-left text-[11.5px] font-semibold text-muted">
                    {visible.map((c) => (
                      <th key={c.id} className={cn('border-b border-line bg-[#fafafb] px-3 py-2.5 first:pl-4', c.numeric && 'text-right', c.width)}>
                        {c.sort ? (
                          <button
                            type="button"
                            onClick={() => sortBy(c.id)}
                            title={c.description}
                            className={cn('inline-flex items-center gap-1 hover:text-ink', sort.id === c.id && 'text-ink')}
                          >
                            {sort.id === c.id && (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                            {c.label}
                          </button>
                        ) : (
                          c.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, shown).map((r) => (
                    <tr key={r.id} onClick={() => setOpen(r)} className="group cursor-pointer transition-colors hover:bg-brand-50/30">
                      {visible.map((c) => (
                        <td key={c.id} className={cn('border-b border-line-2 px-3 py-2 first:pl-4', c.numeric && 'text-right tabular', c.width)}>
                          {c.cell(r, currency)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!!rows.length && (
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 text-[12.5px] text-muted">
              <span>
                Viser {fmtNumber(Math.min(shown, rows.length))} af {fmtNumber(rows.length)} produkter
                {data && data.scanned > all.length && ` · ${fmtNumber(data.scanned - all.length)} produkter med aktivitet men uden salg er udeladt`}
              </span>
              {data && <span>· hentet kl. {new Date(data.fetchedAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}</span>}
              {rows.length > shown && (
                <Button variant="secondary" size="xs" className="ml-auto" onClick={() => setShown((n) => n + PAGE * 2)}>
                  Vis {fmtNumber(Math.min(PAGE * 2, rows.length - shown))} mere
                </Button>
              )}
            </div>
          )}
        </div>
        {refreshError && <p className="mt-3 text-[12.5px] text-negative">{refreshError}</p>}
      </div>

      <ProductDialog product={open} currency={currency} onClose={() => setOpen(null)} onAsk={ask} />
    </motion.div>
  );
}
