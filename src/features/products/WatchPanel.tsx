/**
 * Overvågede produkter: the products the team picked (Black Week, a campaign …) with their
 * numbers for today, yesterday, 7 days or since a date – read again every 5 minutes.
 * Microsoft's numbers trail by a few hours; the shop's sales (Inventarland) by up to half an hour.
 */
import { useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Sparkles, StarFilled, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { toast } from '@/components/notifications/toast';
import { fmtMoney, fmtNumber, fmtTime, today } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { useUi } from '@/stores/ui';
import { startChat } from '../chat/startChat';
import { liveRows, periodRange, useLiveMicrosoft, useLiveShop, useWatchChange, useWatchlist, type LivePeriod } from './watch';

const SINCE_KEY = 'bac.watch.since';

function readSince(): string {
  try {
    return localStorage.getItem(SINCE_KEY) || today();
  } catch {
    return today();
  }
}

export function WatchPanel({ currency }: { currency: string }) {
  const list = useWatchlist();
  const items = list.data ?? [];
  const [period, setPeriod] = useState<LivePeriod>('today');
  const [since, setSince] = useState(readSince);
  const range = periodRange(period, since);
  const ms = useLiveMicrosoft(range, items.length > 0);
  const shop = useLiveShop(range, items.length > 0);
  const change = useWatchChange();
  const [adding, setAdding] = useState('');
  const go = useUi((s) => s.go);
  const rows = useMemo(() => liveRows(items, ms.data ?? null, shop.data ?? null), [items, ms.data, shop.data]);
  const total = rows.reduce(
    (t, r) => ({
      spend: t.spend + (r.ms?.spend ?? 0),
      clicks: t.clicks + (r.ms?.clicks ?? 0),
      conversions: t.conversions + (r.ms?.conversions ?? 0),
      revenue: t.revenue + (r.ms?.revenue ?? 0),
      units: t.units + (r.shop?.units ?? 0),
      shopRevenue: t.shopRevenue + (r.shop?.revenue ?? 0),
    }),
    { spend: 0, clicks: 0, conversions: 0, revenue: 0, units: 0, shopRevenue: 0 },
  );
  const updated = Math.max(ms.dataUpdatedAt || 0, shop.dataUpdatedAt || 0);
  const busy = ms.isFetching || shop.isFetching;
  const kr = (v: number) => fmtMoney(v, currency);
  const roas = (rev: number, spend: number) => (spend > 0 ? `${fmtNumber(rev / spend, 2)}x` : '–');

  if (list.isPending) return null;
  if (!items.length)
    return (
      <div className="card mb-5 flex flex-wrap items-center gap-3 px-4 py-3 text-[13px] text-muted">
        <StarFilled className="size-4 text-warning" />
        <span>
          <span className="font-medium text-ink">Overvåg udvalgte produkter live</span> – klik på stjernen ved et produkt (fx til Black Week), eller tilføj et produkt-id. Holdet deler listen.
        </span>
        <AddById value={adding} onChange={setAdding} busy={change.isPending} onAdd={(id) => change.mutate({ add: [{ id, title: '' }] }, { onSuccess: () => setAdding(''), onError: (e) => toast.error('Kunne ikke tilføje', { description: errorMessage(e) }) })} />
      </div>
    );

  return (
    <div className="card mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <span className="relative mr-1 flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive/60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-positive" />
        </span>
        <h2 className="text-[14px] font-semibold text-ink">Overvågede produkter</h2>
        <span className="text-[12px] text-subtle">
          {busy ? 'Opdaterer …' : updated ? `Opdateret ${fmtTime(updated)} · igen om 5 min.` : ''}
        </span>
        <span className="flex-1" />
        <Segmented<LivePeriod>
          layoutId="watch-period"
          size="sm"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'today', label: 'I dag' },
            { value: 'yesterday', label: 'I går' },
            { value: 'last7', label: '7 dage' },
            { value: 'since', label: 'Siden', title: 'Fra en dato til i dag – fx kampagnens start' },
          ]}
        />
        {period === 'since' && (
          <input
            type="date"
            value={since}
            max={today()}
            onChange={(e) => {
              setSince(e.target.value);
              try {
                localStorage.setItem(SINCE_KEY, e.target.value);
              } catch {
                /* only a convenience */
              }
            }}
            aria-label="Fra dato"
            className="h-7 rounded-md border border-line px-2 text-[12.5px]"
          />
        )}
        <Button variant="ghost" size="xs" disabled={busy} onClick={() => void Promise.all([ms.refetch(), shop.refetch()])}>
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Opdatér
        </Button>
        <Button
          variant="secondary"
          size="xs"
          onClick={() => {
            go('chat');
            startChat(
              [
                `Hvordan klarer de overvågede produkter sig ${period === 'today' ? 'i dag' : period === 'yesterday' ? 'i går' : period === 'last7' ? 'de seneste 7 dage' : `siden ${since}`}? Tallene lige nu (Microsoft, og webshoppens eget salg):`,
                ...rows.map((r) => `- ${r.title} (${r.item.id}): Microsoft ${r.ms ? `${fmtNumber(r.ms.clicks)} klik, ${kr(r.ms.spend)}, ${fmtNumber(r.ms.conversions, 1)} konv., ${kr(r.ms.revenue)}, ROAS ${roas(r.ms.revenue, r.ms.spend)}` : 'ukendt'}; shop ${r.shop ? `${fmtNumber(r.shop.units)} stk., ${kr(r.shop.revenue)}` : 'ukendt'}`),
                'Hvilke skal have mere eller mindre tryk – og hvorfor? Husk at Microsofts tal for i dag er nogle timer bagud.',
              ].join('\n'),
              [],
              { fresh: true },
            );
          }}
        >
          <Sparkles /> Spørg assistenten
        </Button>
      </div>
      {(ms.error || shop.error) && (
        <p className="border-b border-line-2 px-4 py-2 text-[12px] text-negative">
          {ms.error ? `Microsoft: ${errorMessage(ms.error)}. ` : ''}
          {shop.error ? `Webshop: ${errorMessage(shop.error)}.` : ''}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 whitespace-nowrap text-[13px]">
          <thead>
            <tr className="text-left text-[11.5px] font-semibold text-muted">
              <th className="border-b border-line bg-[#fafafb] px-4 py-2">Produkt</th>
              <th className="border-b border-line bg-[#fafafb] px-3 py-2 text-right">Klik</th>
              <th className="border-b border-line bg-[#fafafb] px-3 py-2 text-right">Forbrug</th>
              <th className="border-b border-line bg-[#fafafb] px-3 py-2 text-right">Konv.</th>
              <th className="border-b border-line bg-[#fafafb] px-3 py-2 text-right">Konv.værdi</th>
              <th className="border-b border-line bg-[#fafafb] px-3 py-2 text-right">ROAS</th>
              <th className="border-b border-l border-line bg-[#fafafb] px-3 py-2 text-right" title="Webshoppens eget salg (alle kanaler)">
                Solgt i shop
              </th>
              <th className="border-b border-line bg-[#fafafb] px-3 py-2 text-right">Shop-omsætning</th>
              <th className="w-8 border-b border-line bg-[#fafafb]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item.id} className="group">
                <td className="max-w-[340px] border-b border-line-2 px-4 py-2">
                  <div className="truncate font-medium text-ink">{r.title}</div>
                  <div className="text-[11.5px] text-subtle">
                    {r.item.id} · tilføjet af {r.item.addedBy}
                  </div>
                </td>
                <Num v={r.ms?.clicks} f={(v) => fmtNumber(v)} pending={ms.isPending} />
                <Num v={r.ms?.spend} f={kr} pending={ms.isPending} />
                <Num v={r.ms?.conversions} f={(v) => fmtNumber(v, 1)} pending={ms.isPending} />
                <Num v={r.ms?.revenue} f={kr} pending={ms.isPending} />
                <td className={cn('border-b border-line-2 px-3 py-2 text-right tabular', r.ms && r.ms.spend > 0 && (r.ms.revenue / r.ms.spend >= 1 ? 'text-positive' : 'text-negative'))}>
                  {ms.isPending ? '…' : r.ms ? roas(r.ms.revenue, r.ms.spend) : '–'}
                </td>
                <Num v={r.shop?.units} f={(v) => `${fmtNumber(v)} stk.`} pending={shop.isPending} border />
                <Num v={r.shop?.revenue} f={kr} pending={shop.isPending} />
                <td className="border-b border-line-2 pr-3 text-right">
                  <button
                    type="button"
                    aria-label={`Stop med at overvåge ${r.title}`}
                    title="Fjern fra overvågning"
                    onClick={() => change.mutate({ remove: [r.item.id] })}
                    className="grid size-6 place-items-center rounded-md text-subtle opacity-0 transition-opacity hover:bg-line-2 hover:text-ink group-hover:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-[#fafafb] font-semibold text-ink">
              <td className="px-4 py-2">I alt ({rows.length})</td>
              <td className="px-3 py-2 text-right tabular">{fmtNumber(total.clicks)}</td>
              <td className="px-3 py-2 text-right tabular">{kr(total.spend)}</td>
              <td className="px-3 py-2 text-right tabular">{fmtNumber(total.conversions, 1)}</td>
              <td className="px-3 py-2 text-right tabular">{kr(total.revenue)}</td>
              <td className="px-3 py-2 text-right tabular">{roas(total.revenue, total.spend)}</td>
              <td className="border-l border-line px-3 py-2 text-right tabular">{fmtNumber(total.units)} stk.</td>
              <td className="px-3 py-2 text-right tabular">{kr(total.shopRevenue)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <AddById value={adding} onChange={setAdding} busy={change.isPending} onAdd={(id) => change.mutate({ add: [{ id, title: '' }] }, { onSuccess: () => setAdding(''), onError: (e) => toast.error('Kunne ikke tilføje', { description: errorMessage(e) }) })} />
        <span className="text-[11.5px] text-subtle">Microsofts tal for i dag er typisk et par timer bagud; webshoppens salg op til en halv time. Shoppens salg er fra alle kanaler.</span>
      </div>
    </div>
  );
}

function Num({ v, f, pending, border }: { v: number | undefined; f: (v: number) => string; pending: boolean; border?: boolean }) {
  return <td className={cn('border-b border-line-2 px-3 py-2 text-right tabular', border && 'border-l border-l-line', !v && 'text-subtle')}>{pending ? '…' : v === undefined ? '–' : f(v)}</td>;
}

function AddById({ value, onChange, onAdd, busy }: { value: string; onChange: (v: string) => void; onAdd: (id: string) => void; busy: boolean }) {
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const id = value.trim();
        if (id) onAdd(id);
      }}
    >
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Produkt-id / varenummer" aria-label="Tilføj produkt-id" className="h-7 w-48 rounded-md border border-line px-2 text-[12.5px] outline-none focus:border-brand/50" />
      <Button type="submit" variant="ghost" size="xs" disabled={busy || !value.trim()}>
        <Plus /> Overvåg
      </Button>
    </form>
  );
}
