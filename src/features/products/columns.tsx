/**
 * The columns of the Produkter table. Which ones are shown, and in which order, is
 * chosen in the Kolonner menu (saved per PC in appearance.productColumns).
 */
import { AlertTriangle, CheckCircle2, CircleSlash, ImageOff, PackageX } from 'lucide-react';
import type { ReactNode } from 'react';
import { ChangeBadge } from '@/components/blocks/ChangeBadge';
import { change, derive } from '@/bing/metrics';
import { campaignsLabel, statusLabel } from '@/bing/products';
import type { DerivedMetrics, ProductPerformance } from '@/bing/types';
import { fmtMoney, fmtNumber, fmtPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface ProductRow extends ProductPerformance {
  d: DerivedMetrics;
  p: DerivedMetrics;
}

export const toRow = (p: ProductPerformance): ProductRow => ({ ...p, d: derive(p.metrics), p: derive(p.previous) });

export interface ColumnDef {
  id: string;
  label: string;
  /** Shown in the Kolonner menu. */
  description: string;
  group: 'Produkt' | 'Resultater' | 'Udvikling';
  numeric?: boolean;
  width?: string;
  /** Value to sort by (null sorts last). */
  sort?: (r: ProductRow) => number | string | null;
  cell: (r: ProductRow, currency: string) => ReactNode;
}

const money = (v: number | null, currency: string, digits?: number) => (v === null ? '–' : fmtMoney(v, currency, digits));

export function StatusIcon({ status }: { status: string | undefined }) {
  if (status === 'ok') return <CheckCircle2 className="size-4 shrink-0 text-positive" />;
  if (status === 'disapproved') return <CircleSlash className="size-4 shrink-0 text-negative" />;
  if (status === 'warning') return <AlertTriangle className="size-4 shrink-0 text-warning" />;
  if (status === 'outofstock' || status === 'notincatalog') return <PackageX className="size-4 shrink-0 text-warning" />;
  return <span className="size-4 shrink-0 rounded-full border border-dashed border-subtle" />;
}

export function ProductImage({ url, className }: { url: string | null; className?: string }) {
  return (
    <span className={cn('grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-white', className)}>
      {url ? <img src={url} alt="" loading="lazy" className="size-full object-contain" referrerPolicy="no-referrer" /> : <ImageOff className="size-4 text-subtle" />}
    </span>
  );
}

export const COLUMNS: ColumnDef[] = [
  { id: 'image', label: 'Billede', description: 'Produktbilledet fra Merchant Center', group: 'Produkt', width: 'w-[64px]', cell: (r) => <ProductImage url={r.imageUrl} /> },
  {
    id: 'title',
    label: 'Titel',
    description: 'Produktets navn',
    group: 'Produkt',
    width: 'min-w-[220px] max-w-[280px]',
    sort: (r) => r.title.toLowerCase(),
    cell: (r) => (
      <span className="line-clamp-3 whitespace-normal font-medium text-brand-600" title={r.title}>
        {r.title}
      </span>
    ),
  },
  { id: 'id', label: 'Produkt-id', description: 'Varenummeret (offer id) i feedet', group: 'Produkt', sort: (r) => r.id, cell: (r) => <span className="tabular text-ink-2">{r.id}</span> },
  {
    id: 'status',
    label: 'Status',
    description: 'Godkendelse i Merchant Center og hvor mange af de aktive produktkampagner produktet blev vist i',
    group: 'Produkt',
    sort: (r) => r.status?.servingCampaigns ?? -1,
    cell: (r) => (
      <span className="grid gap-0.5 whitespace-normal">
        <span className="flex items-center gap-1.5 text-ink">
          <StatusIcon status={r.status?.status} />
          {statusLabel(r.status)}
        </span>
        {campaignsLabel(r.status) && <span className="text-[11.5px] text-muted">{campaignsLabel(r.status)}</span>}
      </span>
    ),
  },
  {
    id: 'issues',
    label: 'Problemer',
    description: 'Advarsler og afvisninger fra Merchant Center',
    group: 'Produkt',
    sort: (r) => r.status?.issues.length ?? 0,
    cell: (r) =>
      r.status?.issues.length ? (
        <span className="line-clamp-2 max-w-[260px] whitespace-normal text-[12.5px] text-warning" title={r.status.issues.join('\n')}>
          {r.status.issues.join(' · ')}
        </span>
      ) : (
        <span className="text-[12.5px] text-muted">{r.status && r.status.status !== 'unknown' ? 'Ingen problemer' : '–'}</span>
      ),
  },
  { id: 'brand', label: 'Mærke', description: 'Mærket i feedet', group: 'Produkt', sort: (r) => r.brand ?? '', cell: (r) => <span className="text-ink-2">{r.brand ?? '–'}</span> },
  { id: 'category', label: 'Kategori', description: 'Produktkategori 1–2', group: 'Produkt', sort: (r) => r.category ?? '', cell: (r) => <span className="text-ink-2">{r.category ?? '–'}</span> },
  { id: 'productType', label: 'Produkttype', description: 'Produkttype 1 fra feedet', group: 'Produkt', sort: (r) => r.productType ?? '', cell: (r) => <span className="text-ink-2">{r.productType ?? '–'}</span> },
  {
    id: 'campaigns',
    label: 'Kampagner',
    description: 'De kampagner og annoncegrupper produktet blev vist i',
    group: 'Produkt',
    sort: (r) => r.placements.length,
    cell: (r) => (
      <span className="block max-w-[220px] truncate text-ink-2" title={r.placements.map((p) => `${p.campaignName}${p.adGroupName ? ` › ${p.adGroupName}` : ''}`).join('\n')}>
        {r.placements.length ? (r.placements.length === 1 ? r.placements[0]!.campaignName : `${r.placements.length} placeringer`) : '–'}
      </span>
    ),
  },
  { id: 'price', label: 'Pris', description: 'Prisen i feedet', group: 'Produkt', numeric: true, sort: (r) => r.price, cell: (r, c) => money(r.price, c, 2) },
  { id: 'impressions', label: 'Eksp.', description: 'Eksponeringer', group: 'Resultater', numeric: true, sort: (r) => r.d.impressions, cell: (r) => fmtNumber(r.d.impressions) },
  { id: 'clicks', label: 'Klik', description: 'Klik', group: 'Resultater', numeric: true, sort: (r) => r.d.clicks, cell: (r) => fmtNumber(r.d.clicks) },
  { id: 'ctr', label: 'CTR', description: 'Klikrate', group: 'Resultater', numeric: true, sort: (r) => r.d.ctr, cell: (r) => fmtPercent(r.d.ctr) },
  { id: 'spend', label: 'Forbrug', description: 'Annonceforbrug', group: 'Resultater', numeric: true, sort: (r) => r.d.spend, cell: (r, c) => money(r.d.spend, c, 2) },
  { id: 'cpc', label: 'Gns. CPC', description: 'Gennemsnitlig pris pr. klik', group: 'Resultater', numeric: true, sort: (r) => r.d.cpc, cell: (r, c) => money(r.d.cpc, c, 2) },
  { id: 'conversions', label: 'Konv.', description: 'Konverteringer', group: 'Resultater', numeric: true, sort: (r) => r.d.conversions, cell: (r) => fmtNumber(r.d.conversions, 2) },
  { id: 'convRate', label: 'Konv.rate', description: 'Konverteringer pr. klik', group: 'Resultater', numeric: true, sort: (r) => r.d.convRate, cell: (r) => fmtPercent(r.d.convRate) },
  { id: 'cpa', label: 'CPA', description: 'Pris pr. konvertering', group: 'Resultater', numeric: true, sort: (r) => r.d.cpa, cell: (r, c) => money(r.d.cpa, c, 2) },
  { id: 'revenue', label: 'Konv.værdi', description: 'Omsætning fra annoncerne (konverteringsværdi)', group: 'Resultater', numeric: true, sort: (r) => r.d.revenue, cell: (r, c) => money(r.d.revenue, c, 2) },
  {
    id: 'roas',
    label: 'ROAS',
    description: 'Konverteringsværdi pr. krone brugt',
    group: 'Resultater',
    numeric: true,
    sort: (r) => r.d.roas,
    cell: (r) => (r.d.roas === null ? '–' : `${fmtNumber(r.d.roas, 2)}x`),
  },
  {
    id: 'profit',
    label: 'Værdi − forbrug',
    description: 'Konverteringsværdi minus annonceforbrug',
    group: 'Resultater',
    numeric: true,
    sort: (r) => r.d.revenue - r.d.spend,
    cell: (r, c) => <span className={r.d.revenue - r.d.spend < 0 ? 'text-negative' : 'text-ink'}>{money(r.d.revenue - r.d.spend, c, 0)}</span>,
  },
  {
    id: 'revenueChange',
    label: 'Udv. værdi',
    description: 'Konverteringsværdi mod forrige periode',
    group: 'Udvikling',
    numeric: true,
    sort: (r) => change(r.d.revenue, r.p.revenue),
    cell: (r) => (r.p.revenue ? <ChangeBadge change={change(r.d.revenue, r.p.revenue)} /> : r.d.revenue ? <span className="text-[12px] font-medium text-positive">Ny</span> : '–'),
  },
  {
    id: 'spendChange',
    label: 'Udv. forbrug',
    description: 'Forbrug mod forrige periode',
    group: 'Udvikling',
    numeric: true,
    sort: (r) => change(r.d.spend, r.p.spend),
    cell: (r) => <ChangeBadge change={change(r.d.spend, r.p.spend)} invert />,
  },
  {
    id: 'clicksChange',
    label: 'Udv. klik',
    description: 'Klik mod forrige periode',
    group: 'Udvikling',
    numeric: true,
    sort: (r) => change(r.d.clicks, r.p.clicks),
    cell: (r) => <ChangeBadge change={change(r.d.clicks, r.p.clicks)} />,
  },
  {
    id: 'roasChange',
    label: 'Udv. ROAS',
    description: 'ROAS mod forrige periode',
    group: 'Udvikling',
    numeric: true,
    sort: (r) => change(r.d.roas, r.p.roas),
    cell: (r) => <ChangeBadge change={change(r.d.roas, r.p.roas)} />,
  },
  { id: 'prevRevenue', label: 'Forrige værdi', description: 'Konverteringsværdi i forrige periode', group: 'Udvikling', numeric: true, sort: (r) => r.p.revenue, cell: (r, c) => money(r.p.revenue, c, 2) },
  { id: 'prevSpend', label: 'Forrige forbrug', description: 'Forbrug i forrige periode', group: 'Udvikling', numeric: true, sort: (r) => r.p.spend, cell: (r, c) => money(r.p.spend, c, 2) },
];

export const COLUMN_BY_ID = new Map(COLUMNS.map((c) => [c.id, c]));
