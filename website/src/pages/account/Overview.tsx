import { ArrowRight, Download, PartyPopper, Users, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { PLANS } from '@/workspace/plans';
import type { BillingState } from '@/workspace/types';
import { A, useSearch } from '@site/lib/router';
import { ButtonLink, cn, ease, usd } from '@site/lib/ui';
import { PageTitle, Panel, monthName, useAccount } from './AccountLayout';

/** The month's pool: included use first, then bought credits. */
export function PoolMeter({ billing, className }: { billing: BillingState; className?: string }) {
  const share = billing.includedUsd > 0 ? Math.min(1, billing.usedUsd / billing.includedUsd) : 1;
  const tone = share >= 1 ? (billing.creditUsd > 0 ? 'bg-violet' : 'bg-negative') : share > 0.8 ? 'bg-warning' : 'bg-brand';
  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3">
        <p>
          <span className="text-[34px] font-bold leading-none tracking-[-0.03em] text-ink tabular">{usd(billing.usedUsd, 2)}</span>
          <span className="ml-1.5 text-[14px] font-medium text-muted">af {usd(billing.includedUsd)} brugt</span>
        </p>
        <p className="text-right text-[13px] font-semibold text-muted">{Math.round(share * 100)} %</p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-line-2" role="meter" aria-valuemin={0} aria-valuemax={billing.includedUsd} aria-valuenow={billing.usedUsd} aria-label="Brugt af puljen">
        <motion.div className={cn('h-full rounded-full', tone)} initial={{ width: 0 }} animate={{ width: `${share * 100}%` }} transition={{ duration: 1, ease }} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
        <div>
          <dt className="text-muted">Tilbage i puljen</dt>
          <dd className="mt-0.5 text-[15px] font-bold text-ink tabular">{usd(billing.includedLeftUsd, 2)}</dd>
        </div>
        <div>
          <dt className="text-muted">Ekstra kredit</dt>
          <dd className="mt-0.5 text-[15px] font-bold text-ink tabular">{usd(billing.creditUsd, 2)}</dd>
        </div>
        <div>
          <dt className="text-muted">Kan bruges i alt</dt>
          <dd className="mt-0.5 text-[15px] font-bold text-ink tabular">{usd(billing.remainingUsd, 2)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function Overview() {
  const { me, company, billing, isAdmin } = useAccount();
  const welcome = useSearch().get('velkommen') === '1';
  const plan = PLANS[company.plan];
  const top = billing.byPerson.slice(0, 4);

  return (
    <>
      <PageTitle title={`Hej ${me.name.split(' ')[0]}`} lead={`${company.name} · ${isAdmin ? 'Administrator' : 'Medarbejder'}`} />
      {welcome && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="bg-lavender relative mb-5 overflow-hidden rounded-[26px] p-7 text-white"
        >
          <div aria-hidden className="bg-dots absolute -right-8 -top-8 size-44 rounded-full opacity-40" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <PartyPopper className="mt-0.5 size-7 shrink-0" />
              <div>
                <p className="text-[19px] font-bold">{company.name} er oprettet</p>
                <p className="mt-1 max-w-md text-[14.5px] text-white/80">
                  Hent appen, log ind med den samme Microsoft-konto og forbind jeres Microsoft Advertising-konto. Invitér kollegerne under Team.
                </p>
              </div>
            </div>
            <ButtonLink href="/download" variant="ghost">
              <Download className="size-4" />
              Hent XavierOS
            </ButtonLink>
          </div>
        </motion.div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title={`AI-forbrug i ${monthName(billing.month)}`}
          description="Virksomhedens fælles pulje. Den fyldes op den 1. i hver måned."
          action={
            <A href="/konto/abonnement" className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-600 hover:underline">
              Detaljer <ArrowRight className="size-3.5" />
            </A>
          }
        >
          <PoolMeter billing={billing} />
        </Panel>
        <Panel title="Abonnement">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <Wallet className="size-5" />
            </span>
            <div>
              <p className="text-[17px] font-bold text-ink">{plan.name}</p>
              <p className="text-[13.5px] text-muted">
                {billing.seats} {billing.seats === 1 ? 'plads' : 'pladser'} · {usd(billing.priceMonthlyUsd)} / måned
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/konto/abonnement" size="sm" variant={isAdmin ? 'primary' : 'ghost'}>
              {isAdmin ? 'Administrér abonnement' : 'Se abonnement'}
            </ButtonLink>
            {company.plan === 'solo' && isAdmin && (
              <ButtonLink href="/konto/abonnement#plan" size="sm" variant="soft">
                Skift til Teams
              </ButtonLink>
            )}
          </div>
        </Panel>
        <Panel
          title="Forbrug pr. person"
          className="xl:col-span-2"
          action={
            <A href="/konto/team" className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-600 hover:underline">
              <Users className="size-3.5" /> Team
            </A>
          }
        >
          {top.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {top.map((p, i) => (
                <li key={i} className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-3">
                  <span className="truncate text-[14.5px] font-semibold text-ink-2">{p.name}</span>
                  <span className="text-[14.5px] font-bold text-ink tabular">{usd(p.usedUsd, 2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">Ingen har brugt AI’en endnu i denne måned.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
