/** Dagligt overblik: the products behind a row's conversions (conversionBreakdown.ts). */
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from '@/components/icons';
import { getBackend } from '@/bing/backend';
import { Dialog } from '@/components/ui/overlays';
import { fmtMoney, fmtNumber, type DateRange } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { useConnection } from '@/stores/connection';
import { conversionBreakdown } from './conversionBreakdown';

export interface ConversionsTarget {
  range: DateRange;
  /** "23. nov. 2026", "Uge 47" … */
  label: string;
  conversions: number;
}

export function ConversionsDialog({ target, currency, onClose, exclude }: { target: ConversionsTarget | null; currency: string; onClose: () => void; exclude?: string[] }) {
  const accountId = useConnection((s) => s.accountId);
  const q = useQuery({
    queryKey: ['conversion-products', accountId, target?.range.from, target?.range.to, exclude?.join(',') ?? ''],
    enabled: !!target && !!accountId,
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }) => {
      const backend = await getBackend();
      if (!backend.productsInRange) throw new Error('Produktdata findes ikke for denne forbindelse.');
      const [products, campaigns] = await Promise.all([
        backend.productsInRange(accountId!, target!.range, signal),
        backend.runReport(accountId!, { kind: 'campaign', range: target!.range, aggregation: 'Summary' }, signal),
      ]);
      return conversionBreakdown(products, campaigns, new Set(exclude ?? []));
    },
  });
  const kr = (v: number) => fmtMoney(v, currency, 0);
  const conv = (v: number) => fmtNumber(v, v % 1 ? 2 : 0);
  const b = q.data;

  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={target ? `${conv(target.conversions)} konverteringer · ${target.label}` : ''}
      description={`Produktet kunden klikkede på i Shopping eller Performance Max – Microsoft oplyser ikke, hvad der blev købt.${exclude?.length ? ' Brand-kampagner er trukket fra.' : ''}`}
      className="w-[min(680px,calc(100vw-32px))]"
    >
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-[13px] text-muted">
          <Loader2 className="size-4 animate-spin" /> Henter produktrapporten fra Microsoft …
        </div>
      ) : q.error ? (
        <p className="text-[13px] text-negative">{errorMessage(q.error)}</p>
      ) : b ? (
        <div className="grid max-h-[60vh] gap-5 overflow-y-auto pr-1">
          <section>
            <h3 className="mb-2 text-[12.5px] font-semibold text-muted">Produkter · {conv(b.productConversions)} konv.</h3>
            {b.products.length ? (
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-[11.5px] font-semibold text-muted">
                    <th className="border-b border-line py-2 pr-3">Produkt</th>
                    <th className="border-b border-line px-2 py-2 text-right">Konv.</th>
                    <th className="border-b border-line px-2 py-2 text-right">Værdi</th>
                    <th className="border-b border-line py-2 pl-2 text-right">Pris</th>
                  </tr>
                </thead>
                <tbody>
                  {b.products.map((p) => (
                    <tr key={p.id}>
                      <td className="border-b border-line-2 py-2 pr-3">
                        <div className="font-medium text-ink">{p.title}</div>
                        <div className="text-[11.5px] text-muted">
                          {p.id}
                          {p.where[0] && ` · ${p.where[0]}${p.where.length > 1 ? ` (+${p.where.length - 1})` : ''}`}
                        </div>
                      </td>
                      <td className="border-b border-line-2 px-2 py-2 text-right tabular text-ink">{conv(p.conversions)}</td>
                      <td className="border-b border-line-2 px-2 py-2 text-right tabular text-ink-2">{kr(p.revenue)}</td>
                      <td className="border-b border-line-2 py-2 pl-2 text-right tabular text-ink-2">{kr(p.spend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[13px] text-muted">Ingen konverteringer fra Shopping eller Performance Max i perioden.</p>
            )}
          </section>
          {b.rest.length > 0 && (
            <section>
              <h3 className="mb-2 text-[12.5px] font-semibold text-muted">Uden produkt (søgeannoncer o.l.) · {conv(b.restConversions)} konv.</h3>
              <ul className="grid gap-1">
                {b.rest.map((r) => (
                  <li key={r.campaignId} className="flex items-center gap-3 border-b border-line-2 py-1.5 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-ink">{r.campaignName}</span>
                    <span className="tabular text-ink">{conv(r.conversions)} konv.</span>
                    <span className="w-24 text-right tabular text-ink-2">{kr(r.revenue)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {Math.abs(b.productConversions + b.restConversions - target!.conversions) >= 0.5 && (
            <p className="text-[12px] text-muted">
              Rapporterne giver {conv(b.productConversions + b.restConversions)} konverteringer mod {conv(target!.conversions)} i tabellen – de seneste dage får stadig konverteringer, og tabellen hentes ikke lige så tit.
            </p>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
