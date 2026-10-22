/**
 * One product: its status and issues in Merchant Center, the period against the one
 * before, and every campaign / ad group it showed in.
 */
import { ExternalLink, Sparkles } from 'lucide-react';
import { ChangeBadge } from '@/components/blocks/ChangeBadge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/overlays';
import { change, derive } from '@/bing/metrics';
import { campaignsLabel, statusLabel } from '@/bing/products';
import type { DerivedMetrics } from '@/bing/types';
import { fmtMoney, fmtNumber, fmtPercent } from '@/lib/format';
import { openExternal } from '@/lib/platform';
import { cn } from '@/lib/utils';
import { ProductImage, StatusIcon, type ProductRow } from './columns';

const METRICS: { key: keyof DerivedMetrics; label: string; kind: 'money' | 'number' | 'decimal' | 'percent' | 'ratio'; invert?: boolean }[] = [
  { key: 'impressions', label: 'Eksponeringer', kind: 'number' },
  { key: 'clicks', label: 'Klik', kind: 'number' },
  { key: 'ctr', label: 'CTR', kind: 'percent' },
  { key: 'spend', label: 'Forbrug', kind: 'money', invert: true },
  { key: 'cpc', label: 'Gns. CPC', kind: 'money', invert: true },
  { key: 'conversions', label: 'Konverteringer', kind: 'decimal' },
  { key: 'cpa', label: 'CPA', kind: 'money', invert: true },
  { key: 'revenue', label: 'Konv.værdi', kind: 'money' },
  { key: 'roas', label: 'ROAS', kind: 'ratio' },
];

function fmt(v: number | null, kind: (typeof METRICS)[number]['kind'], currency: string) {
  if (v === null) return '–';
  if (kind === 'money') return fmtMoney(v, currency, 2);
  if (kind === 'percent') return fmtPercent(v);
  if (kind === 'ratio') return `${fmtNumber(v, 2)}x`;
  return fmtNumber(v, kind === 'decimal' ? 2 : 0);
}

export function ProductDialog({ product: r, currency, onClose, onAsk }: { product: ProductRow | null; currency: string; onClose: () => void; onAsk: (prompt: string) => void }) {
  return (
    <Dialog open={!!r} onOpenChange={(o) => !o && onClose()} title={r?.title ?? ''} description={r ? `Produkt-id ${r.id}${r.brand ? ` · ${r.brand}` : ''}${r.category ? ` · ${r.category}` : ''}` : undefined} className="w-[min(860px,calc(100vw-32px))]">
      {r && (
        <div className="grid max-h-[68vh] gap-5 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-start gap-4">
            <ProductImage url={r.imageUrl} className="size-24 rounded-xl" />
            <div className="grid min-w-0 flex-1 gap-1.5 text-[13px]">
              <div className="flex items-center gap-2 text-[14px] font-medium text-ink">
                <StatusIcon status={r.status?.status} />
                {statusLabel(r.status)}
                {campaignsLabel(r.status) && <span className="font-normal text-muted">· {campaignsLabel(r.status)}</span>}
              </div>
              {r.status?.issues.length ? (
                <ul className="grid gap-1 rounded-xl bg-warning-bg px-3 py-2 text-[12.5px] text-warning">
                  {r.status.issues.map((i) => (
                    <li key={i}>• {i}</li>
                  ))}
                </ul>
              ) : r.status && r.status.status !== 'unknown' ? (
                <span className="text-muted">Merchant Center melder ingen problemer.</span>
              ) : (
                <span className="text-muted">Status fra Merchant Center er ikke tilgængelig for denne konto.</span>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
                {r.price !== null && <span>Pris {fmtMoney(r.price, currency, 2)}</span>}
                {r.productType && <span>Produkttype {r.productType}</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                variant="gradient"
                onClick={() => {
                  onClose();
                  onAsk(
                    `Analysér produktet "${r.title}" (produkt-id ${r.id}) i Shopping/Performance Max i den valgte periode: hvordan klarer det sig mod perioden før, i hvilke kampagner tjener det penge, og hvad bør jeg gøre (bud, budget, feed, Merchant Center-problemer)?`,
                  );
                }}
              >
                <Sparkles /> Spørg assistenten
              </Button>
              {r.link && (
                <Button size="sm" variant="secondary" onClick={() => void openExternal(r.link!)}>
                  <ExternalLink /> Åbn produktsiden
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#fafafb] text-left text-[11.5px] font-semibold text-muted">
                  <th className="px-3 py-2">Nøgletal</th>
                  <th className="px-3 py-2 text-right">Perioden</th>
                  <th className="px-3 py-2 text-right">Forrige periode</th>
                  <th className="px-3 py-2 text-right">Udvikling</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => {
                  const now = r.d[m.key] as number | null;
                  const before = r.p[m.key] as number | null;
                  return (
                    <tr key={m.key} className="border-t border-line-2">
                      <td className="px-3 py-1.5 text-ink-2">{m.label}</td>
                      <td className="px-3 py-1.5 text-right font-medium tabular text-ink">{fmt(now, m.kind, currency)}</td>
                      <td className="px-3 py-1.5 text-right tabular text-muted">{fmt(before, m.kind, currency)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <ChangeBadge change={change(now, before)} invert={m.invert} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">Kampagner og annoncegrupper</p>
            {r.placements.length ? (
              <div className="overflow-hidden rounded-2xl border border-line">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#fafafb] text-left text-[11.5px] font-semibold text-muted">
                      <th className="px-3 py-2">Kampagne</th>
                      <th className="px-3 py-2">Annoncegruppe</th>
                      <th className="px-3 py-2 text-right">Klik</th>
                      <th className="px-3 py-2 text-right">Forbrug</th>
                      <th className="px-3 py-2 text-right">Konv.</th>
                      <th className="px-3 py-2 text-right">Konv.værdi</th>
                      <th className="px-3 py-2 text-right">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.placements.map((p) => {
                      const d = derive(p.metrics);
                      return (
                        <tr key={`${p.campaignId}|${p.adGroupId}`} className="border-t border-line-2">
                          <td className="max-w-[240px] truncate px-3 py-1.5 text-ink" title={p.campaignName}>
                            {p.campaignName}
                          </td>
                          <td className="max-w-[200px] truncate px-3 py-1.5 text-ink-2" title={p.adGroupName ?? ''}>
                            {p.adGroupName ?? '–'}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular">{fmtNumber(d.clicks)}</td>
                          <td className="px-3 py-1.5 text-right tabular">{fmtMoney(d.spend, currency, 2)}</td>
                          <td className="px-3 py-1.5 text-right tabular">{fmtNumber(d.conversions, 2)}</td>
                          <td className="px-3 py-1.5 text-right tabular">{fmtMoney(d.revenue, currency, 2)}</td>
                          <td className={cn('px-3 py-1.5 text-right tabular', (d.roas ?? 0) < 1 && d.spend > 0 ? 'text-negative' : 'text-ink')}>{d.roas === null ? '–' : `${fmtNumber(d.roas, 2)}x`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-muted">Produktet havde ingen visninger i perioden – salget er fra perioden før.</p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
