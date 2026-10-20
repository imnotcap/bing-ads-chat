import { Check, Plus, Receipt, Sparkles, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { PLANS, billedSeats, includedUsage, monthlyPrice, type PlanId } from '@/workspace/plans';
import type { BillingPurchase, BillingState, CompanyInfo } from '@/workspace/types';
import { api } from '@site/lib/api';
import { Button, cn, ease, usd } from '@site/lib/ui';
import { Notice, PageTitle, Panel, fmtDate, monthName, useAccount } from './AccountLayout';
import { PoolMeter } from './Overview';

export function Subscription() {
  const { company, billing, isAdmin, setBilling, setCompany } = useAccount();
  return (
    <>
      <PageTitle title="Abonnement" lead={`${PLANS[company.plan].name} · ${usd(billing.priceMonthlyUsd)} om måneden for ${billing.seats} ${billing.seats === 1 ? 'plads' : 'pladser'}`} />
      <div className="grid gap-5">
        <Panel title={`Fælles pulje i ${monthName(billing.month)}`} description="Alle i virksomheden bruger af den samme pulje. Bliver den tom, bruges ekstra kredit.">
          <PoolMeter billing={billing} />
          {billing.byPerson.length > 0 && (
            <table className="mt-7 w-full text-[14px]">
              <thead>
                <tr className="text-left text-[12.5px] uppercase tracking-[0.06em] text-subtle">
                  <th className="pb-2 font-semibold">Person</th>
                  <th className="pb-2 text-right font-semibold">Brugt</th>
                  <th className="hidden pb-2 pl-6 font-semibold sm:table-cell">Andel</th>
                </tr>
              </thead>
              <tbody>
                {billing.byPerson.map((p, i) => {
                  const share = billing.usedUsd > 0 ? p.usedUsd / billing.usedUsd : 0;
                  return (
                    <tr key={i} className="border-t border-line-2">
                      <td className="py-2.5 font-medium text-ink-2">{p.name}</td>
                      <td className="py-2.5 text-right font-semibold text-ink tabular">{usd(p.usedUsd, 2)}</td>
                      <td className="hidden w-[35%] py-2.5 pl-6 sm:table-cell">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-line-2">
                          <span className="block h-full rounded-full bg-brand/70" style={{ width: `${Math.round(share * 100)}%` }} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
        <BuyPack billing={billing} isAdmin={isAdmin} onBought={setBilling} />
        <PlanPicker
          company={company}
          billing={billing}
          isAdmin={isAdmin}
          onChanged={async (c) => {
            setCompany(c);
            setBilling(await api<BillingState>('/billing'));
          }}
        />
        {isAdmin && <Purchases key={billing.purchases.length} />}
      </div>
    </>
  );
}

function BuyPack({ billing, isAdmin, onBought }: { billing: BillingState; isAdmin: boolean; onBought: (b: BillingState) => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const buy = async () => {
    setBusy(true);
    setMsg(null);
    try {
      onBought(await api<BillingState>('/billing/packs', { method: 'POST' }));
      setMsg({ tone: 'ok', text: `${usd(billing.pack.creditUsd)} ekstra kredit er lagt i puljen. Købet kommer med på næste faktura.` });
      setConfirm(false);
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="Ekstra forbrug"
      description={`${usd(billing.pack.priceUsd)} giver ${usd(billing.pack.creditUsd)} i AI-kredit til hele virksomheden. Kreditten udløber ikke og bruges først, når månedens pulje er tom.`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3">
          <Sparkles className="size-5 text-brand" />
          <span className="text-[14px] text-ink-2">
            Ekstra kredit nu: <b className="text-ink tabular">{usd(billing.creditUsd, 2)}</b>
          </span>
        </div>
        {isAdmin ? (
          <AnimatePresence mode="wait" initial={false}>
            {confirm ? (
              <motion.div key="confirm" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }} className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">Køb for {usd(billing.pack.priceUsd)}?</span>
                <Button size="sm" variant="brand" loading={busy} onClick={() => void buy()}>
                  Ja, køb
                </Button>
                <Button size="sm" variant="quiet" onClick={() => setConfirm(false)}>
                  Fortryd
                </Button>
              </motion.div>
            ) : (
              <motion.div key="buy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Button size="sm" onClick={() => setConfirm(true)}>
                  <Plus className="size-4" />
                  Køb ekstra forbrug · {usd(billing.pack.priceUsd)}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <span className="text-[13.5px] text-muted">Kun administratorer kan købe ekstra forbrug.</span>
        )}
      </div>
      {msg && (
        <div className="mt-4">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
    </Panel>
  );
}

function PlanPicker({ company, billing, isAdmin, onChanged }: { company: CompanyInfo; billing: BillingState; isAdmin: boolean; onChanged: (c: CompanyInfo) => Promise<void> }) {
  const [chosen, setChosen] = useState<PlanId>(company.plan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setChosen(company.plan), [company.plan]);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onChanged(await api<CompanyInfo>('/company/plan', { method: 'PUT', body: JSON.stringify({ plan: chosen }) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div id="plan">
      <Panel title="Plan" description={isAdmin ? 'Skift plan når som helst. Prisen følger antallet af aktive personer.' : 'Kun administratorer kan skifte plan.'}>
        <div className="grid gap-3 md:grid-cols-2">
          {(['solo', 'teams'] as const).map((id) => {
            const p = PLANS[id];
            const on = chosen === id;
            const current = company.plan === id;
            return (
              <button
                key={id}
                type="button"
                disabled={!isAdmin}
                onClick={() => setChosen(id)}
                className={cn(
                  'relative rounded-[22px] p-5 text-left ring-1 transition-[box-shadow,background] disabled:cursor-default',
                  on ? 'bg-brand-50 ring-2 ring-brand' : 'bg-white ring-black/[0.08] enabled:hover:ring-black/[0.18]',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[16px] font-bold text-ink">
                    {id === 'teams' && <Users className="size-4 text-brand" />}
                    {p.name}
                  </span>
                  {current && <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11.5px] font-semibold text-white">Nuværende</span>}
                </span>
                <span className="mt-1 block text-[13px] text-muted">{p.tagline}</span>
                <span className="mt-4 block text-[24px] font-bold tracking-[-0.03em] text-ink tabular">
                  {usd(monthlyPrice(id, billing.people))}
                  <span className="ml-1 text-[13px] font-medium tracking-normal text-muted">/ måned</span>
                </span>
                <span className="mt-1 block text-[13px] text-muted">
                  {billedSeats(id, billing.people)} {billedSeats(id, billing.people) === 1 ? 'plads' : 'pladser'} · {usd(includedUsage(id, billing.people))} AI-forbrug
                </span>
                <ul className="mt-4 grid gap-1.5">
                  {p.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-ink-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-brand" strokeWidth={3} />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        {error && (
          <div className="mt-4">
            <Notice>{error}</Notice>
          </div>
        )}
        {isAdmin && chosen !== company.plan && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button loading={busy} onClick={() => void save()}>
              Skift til {PLANS[chosen].name}
            </Button>
            <span className="text-[13.5px] text-muted">
              Ny pris: {usd(monthlyPrice(chosen, billing.people))} / måned fra i dag.
            </span>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Purchases() {
  const [rows, setRows] = useState<(BillingPurchase & { month: string })[] | null>(null);
  useEffect(() => {
    api<{ purchases: (BillingPurchase & { month: string })[] }>('/billing/purchases')
      .then((r) => setRows(r.purchases))
      .catch(() => setRows([]));
  }, []);
  return (
    <Panel title="Køb af ekstra forbrug" description="Alle køb med dato og hvem der købte – de kommer med på fakturaen for måneden.">
      {rows === null ? (
        <p className="text-[14px] text-muted">Henter …</p>
      ) : rows.length === 0 ? (
        <p className="flex items-center gap-2 text-[14px] text-muted">
          <Receipt className="size-4" /> Ingen køb endnu.
        </p>
      ) : (
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[12.5px] uppercase tracking-[0.06em] text-subtle">
              <th className="pb-2 font-semibold">Dato</th>
              <th className="pb-2 font-semibold">Købt af</th>
              <th className="pb-2 text-right font-semibold">Kredit</th>
              <th className="pb-2 text-right font-semibold">Pris</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.at} className="border-t border-line-2">
                <td className="py-2.5 text-ink-2">{fmtDate(r.at)}</td>
                <td className="py-2.5 text-ink-2">{r.by}</td>
                <td className="py-2.5 text-right tabular text-ink-2">{usd(r.creditUsd)}</td>
                <td className="py-2.5 text-right font-semibold tabular text-ink">{usd(r.priceUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
