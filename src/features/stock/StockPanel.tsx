/**
 * Overblik → Til i dag → Lager: what the sold-out sheet asks for (stockPlan.ts → stockTodo) –
 * items back in stock to re-activate, items expected back within a few days, and items sold
 * out or removed that are not excluded yet. The buttons hand it to the assistant, which shows
 * every change on an approval card (apply_stock_sheet).
 */
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, Sparkles } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { startChat } from '@/features/chat/startChat';
import { today as localToday } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { useUi } from '@/stores/ui';
import { getStockSheet } from '@/workspace/shared';
import type { StockRow } from '@/workspace/types';
import { SOON_DAYS, stockAsk, stockTodo, type StockTodo } from './stockPlan';

export function useStockTodo() {
  const connected = useAccount((s) => !!s.workspace?.stocksheet?.connected);
  const q = useQuery({
    queryKey: ['stocksheet'],
    enabled: connected,
    queryFn: () => getStockSheet(),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
  const todo = q.data ? stockTodo(q.data.rows, q.data.done, localToday()) : null;
  return { connected, query: q, todo, count: todo ? todo.reactivate.length + todo.soon.length : 0 };
}

const dayMs = 86_400_000;
function when(date: string, today: string): { text: string; late: boolean } {
  const d = Math.round((Date.parse(date) - Date.parse(today)) / dayMs);
  const short = new Date(`${date}T12:00:00`).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  if (d === 0) return { text: `i dag (${short})`, late: false };
  if (d === 1) return { text: `i morgen (${short})`, late: false };
  if (d > 1) return { text: `om ${d} dage (${short})`, late: false };
  return { text: `${short} – ${-d} ${d === -1 ? 'dag' : 'dage'} siden`, late: true };
}

function Rows({ rows, right }: { rows: StockRow[]; right: (r: StockRow) => React.ReactNode }) {
  return (
    <ul className="grid gap-1">
      {rows.slice(0, 6).map((r) => (
        <li key={`${r.row}:${r.itemId}`} className="flex min-w-0 items-center gap-3 rounded-lg border border-line px-3 py-1.5 text-[13px]">
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-ink">{r.title}</span> <span className="text-[12px] text-muted">{r.itemId !== r.title ? r.itemId : ''}</span>
          </span>
          <span className="shrink-0 text-[12px]">{right(r)}</span>
        </li>
      ))}
      {rows.length > 6 && <li className="px-1 text-[12px] text-muted">… og {rows.length - 6} mere</li>}
    </ul>
  );
}

export function StockPanel() {
  const { query, todo } = useStockTodo();
  const go = useUi((s) => s.go);
  const today = localToday();
  const ask = (t: StockTodo, which: 'reactivate' | 'exclude' | 'both') => {
    go('chat');
    startChat(stockAsk(t, which), [], { fresh: true });
  };
  if (query.isLoading) return <p className="flex items-center gap-2 py-4 text-[13px] text-muted"><Loader2 className="size-4 animate-spin" /> Læser udsolgt-arket …</p>;
  if (query.error)
    return (
      <div className="flex items-center gap-3 rounded-xl bg-warning-bg px-3.5 py-2.5 text-[13px] text-warning">
        <span className="flex-1">{errorMessage(query.error)}</span>
        <Button size="xs" variant="ghost" onClick={() => void query.refetch()}>
          <RefreshCw /> Prøv igen
        </Button>
      </div>
    );
  if (!todo) return null;
  const empty = !todo.reactivate.length && !todo.soon.length && !todo.exclude.length;
  return (
    <div className="grid gap-4">
      {todo.reactivate.length > 0 && (
        <section className="grid gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-ink">Skal genaktiveres · {todo.reactivate.length}</h3>
            <span className="text-[12px] text-muted">På lager i arket – ikke genaktiveret af appen endnu</span>
            <Button size="xs" variant="gradient" className="ml-auto" onClick={() => ask(todo, 'reactivate')}>
              <Sparkles /> Genaktivér
            </Button>
          </div>
          <Rows rows={todo.reactivate} right={(r) => <span className="font-medium text-positive">{r.statusText}</span>} />
        </section>
      )}
      {todo.soon.length > 0 && (
        <section className="grid gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-ink">Ventes på lager snart · {todo.soon.length}</h3>
            <span className="text-[12px] text-muted">Datoen i arket er inden for {SOON_DAYS} dage – sæt status til "På lager", når de er hjemme</span>
          </div>
          <Rows
            rows={todo.soon}
            right={(r) => {
              const w = when(r.date!, today);
              return <span className={cn('font-medium', w.late ? 'text-negative' : 'text-ink-2')}>{w.text}</span>;
            }}
          />
        </section>
      )}
      {todo.exclude.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-line px-3.5 py-2.5 text-[13px] text-ink-2">
          <span className="flex-1">
            <b>{todo.exclude.length}</b> {todo.exclude.length === 1 ? 'vare er' : 'varer er'} udsolgt eller fjernet i arket og ikke udelukket af appen endnu.
          </span>
          <Button size="xs" variant="secondary" onClick={() => ask(todo, 'exclude')}>
            <Sparkles /> Udeluk
          </Button>
        </div>
      )}
      {todo.unknown.length > 0 && (
        <p className="text-[12px] text-muted">
          {todo.unknown.length} {todo.unknown.length === 1 ? 'række' : 'rækker'} har en ukendt status i kolonne D ({todo.unknown.slice(0, 3).map((r) => `række ${r.row}: "${r.statusText}"`).join(', ')}) – brug Udsolgt, Fjernet eller På lager.
        </p>
      )}
      {empty && <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">Intet at gøre i udsolgt-arket lige nu.</p>}
    </div>
  );
}
