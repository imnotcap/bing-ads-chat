/**
 * Priser. The plans come from src/workspace/plans.ts – the same file the Cloudflare
 * Worker bills by and the app shows in the usage ring – so a price can be changed in one
 * place and never be wrong here.
 *
 * "Sammenlign planerne" opens the full matrix: a tick where a plan has something, a
 * cross where it has not, and the number where the answer is a number.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { EXTRA_USAGE_PACK, PLANS, type PlanId } from '@shared/plans';
import { AsciiField } from '@/components/ascii/AsciiArc';
import { ButtonLink, Container, Reveal, TwoTone, cn, ease } from '@/lib/ui';

const usd = (n: number) => `$${n}`;

/** A row's answer for one plan: has it, has it not, or a number/qualifier. */
type Cell = boolean | string;

const GROUPS: { title: string; rows: { label: string; note?: string; solo: Cell; teams: Cell }[] }[] = [
  {
    title: 'Rådgiveren',
    rows: [
      { label: 'AI-rådgiver til hele Microsoft Advertising', solo: true, teams: true },
      { label: 'Søgeordsundersøgelse og auktionsindsigt', solo: true, teams: true },
      { label: 'Websøgning om marked og konkurrenter', solo: true, teams: true },
      { label: 'Dashboard, grafer og opfølgninger', solo: true, teams: true },
      { label: 'Planlægningstavle', note: 'Teams deler den samme tavle', solo: 'Din egen', teams: 'Delt' },
    ],
  },
  {
    title: 'Kontrol',
    rows: [
      { label: 'Intet sendes, før du har klikket Godkend', solo: true, teams: true },
      { label: 'Ændringen læses tilbage fra Microsoft bagefter', solo: true, teams: true },
      { label: 'Fuld ændringslog med hvem, hvad og hvornår', solo: true, teams: true },
      { label: 'Fortryd en gennemført ændring', solo: true, teams: true },
      { label: 'Budgetgrænser for, hvad der må foreslås', solo: false, teams: true },
      { label: 'Roller og rettigheder', solo: false, teams: true },
    ],
  },
  {
    title: 'Samarbejde',
    rows: [
      { label: 'Fælles forbindelser til Microsoft Ads og Outlook', note: 'Én forbindelse for hele virksomheden', solo: false, teams: true },
      { label: 'Delte playbooks', solo: false, teams: true },
      { label: 'Administrér medarbejdere og forbrug samlet', solo: false, teams: true },
      { label: 'Pladser', solo: '1', teams: `${PLANS.teams.minSeats}–${PLANS.teams.maxSeats}` },
    ],
  },
  {
    title: 'Forbrug og adgang',
    rows: [
      { label: 'AI-forbrug inkluderet pr. måned', solo: usd(PLANS.solo.includedUsd), teams: `${usd(PLANS.teams.includedUsd)} pr. medarbejder` },
      { label: 'Ekstra forbrug kan købes', note: `${usd(EXTRA_USAGE_PACK.priceUsd)} giver ${usd(EXTRA_USAGE_PACK.creditUsd)}`, solo: true, teams: true },
      { label: 'Windows-app og web-app', solo: true, teams: true },
      { label: 'Jeres egen Claude-nøgle i stedet for vores', solo: true, teams: true },
    ],
  },
];

function Mark({ value }: { value: Cell }) {
  if (value === true)
    return (
      <span className="inline-grid size-[22px] place-items-center rounded-full bg-positive-bg text-positive" title="Med i planen">
        <Check className="size-3.5" strokeWidth={3} />
        <span className="sr-only">Med i planen</span>
      </span>
    );
  if (value === false)
    return (
      <span className="inline-grid size-[22px] place-items-center rounded-full bg-line-2 text-subtle" title="Ikke med i planen">
        <X className="size-3.5" strokeWidth={2.6} />
        <span className="sr-only">Ikke med i planen</span>
      </span>
    );
  return <span className="tabular text-[13px] font-medium text-ink">{value}</span>;
}

function PlanCard({ id, featured }: { id: PlanId; featured?: boolean }) {
  const plan = PLANS[id];
  return (
    <div
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-[18px] p-7 sm:p-8',
        featured ? 'bg-ink text-white' : 'border border-line bg-surface',
      )}
    >
      {featured && <AsciiField shape="rise" ink="#55506b" opacity={0.55} mask="linear-gradient(150deg, transparent 40%, black 100%)" className="-z-0" />}
      <div className="relative">
        <div className="flex items-center justify-between">
          <h3 className={cn('text-[17px] font-semibold tracking-[-0.02em]', featured ? 'text-white' : 'text-ink')}>{plan.name}</h3>
          {featured && <span className="rounded-full bg-white/15 px-3 py-1 text-[11.5px] font-medium text-white">Mest valgt</span>}
        </div>
        <p className={cn('mt-1 text-[13.5px]', featured ? 'text-white/60' : 'text-muted')}>{plan.tagline}</p>

        <div className="mt-7 flex items-baseline gap-1.5">
          <span className={cn('tabular text-[44px] font-medium leading-none tracking-[-0.04em]', featured ? 'text-white' : 'text-ink')}>{usd(plan.priceUsd)}</span>
          <span className={cn('text-[13.5px]', featured ? 'text-white/55' : 'text-muted')}>pr. bruger / md.</span>
        </div>
        <p className={cn('mt-2 text-[12.5px]', featured ? 'text-white/50' : 'text-subtle')}>
          {plan.minSeats > 1 ? `Fra ${plan.minSeats} brugere · ` : ''}Faktureres i USD
        </p>

        <ul className="mt-7 grid gap-3">
          {plan.features.map((f) => (
            <li key={f} className="flex gap-2.5">
              <Check className={cn('mt-[3px] size-4 shrink-0', featured ? 'text-brand-200' : 'text-positive')} strokeWidth={2.6} />
              <span className={cn('text-[13.5px] leading-relaxed', featured ? 'text-white/80' : 'text-ink-2')}>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 pt-1">
          {/* Both cards use the white button: cn() does not resolve Tailwind conflicts, so
              overriding a variant's own colours here would leave two of each on the element. */}
          <ButtonLink href="#kontakt">Book en demo</ButtonLink>
        </div>
      </div>
    </div>
  );
}

export function Pricing() {
  const [open, setOpen] = useState(false);
  return (
    <section id="priser" className="border-b border-line py-20 sm:py-24">
      <Container>
        <Reveal>
          <TwoTone
            dark="Priser."
            light="Betal pr. bruger – AI-forbruget følger med."
            className="max-w-[760px] text-[30px] leading-[1.15] sm:text-[38px]"
          />
          <p className="mt-5 max-w-[560px] text-[14px] leading-relaxed text-muted">
            Hver bruger lægger {usd(PLANS.teams.includedUsd)} AI-forbrug i virksomhedens fælles pulje hver måned. Bruges den op, kan en
            administrator købe mere – {usd(EXTRA_USAGE_PACK.priceUsd)} giver {usd(EXTRA_USAGE_PACK.creditUsd)}. Ingen binding.
          </p>
        </Reveal>

        <Reveal delay={0.05} className="mt-10 grid gap-4 lg:grid-cols-2">
          <PlanCard id="solo" />
          <PlanCard id="teams" featured />
        </Reveal>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="prissammenligning"
            className="group inline-flex h-11 items-center gap-3 rounded-full border border-black/10 bg-white pl-5 pr-1.5 text-[14px] font-medium text-ink transition-colors hover:border-black/25"
          >
            {open ? 'Skjul sammenligningen' : 'Sammenlign planerne'}
            <span className="grid size-8 place-items-center rounded-full bg-ink text-white">
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3, ease }} className="grid place-items-center">
                <ChevronDown className="size-4" strokeWidth={2.4} />
              </motion.span>
            </span>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="prissammenligning"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.45, ease }}
              className="overflow-hidden"
            >
              <ComparisonTable />
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </section>
  );
}

function ComparisonTable() {
  return (
    <div className="mt-8 overflow-hidden rounded-[18px] border border-line bg-surface">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Sammenligning af Solo og Teams</caption>
        <thead>
          {/* Sticky, so the plan names stay visible while the long matrix scrolls past. */}
          <tr className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
            <th scope="col" className="w-[44%] border-b border-line px-4 py-4 text-[13px] font-medium text-muted sm:w-[58%] sm:px-7">
              Hvad er med
            </th>
            {(['solo', 'teams'] as const).map((id) => (
              <th key={id} scope="col" className="border-b border-line px-2 py-4 text-center sm:px-5">
                <span className="block text-[14px] font-semibold text-ink">{PLANS[id].name}</span>
                <span className="tabular mt-0.5 block whitespace-nowrap text-[11.5px] text-muted">{usd(PLANS[id].priceUsd)}/bruger</span>
              </th>
            ))}
          </tr>
        </thead>
        {GROUPS.map((group) => (
          <tbody key={group.title}>
            <tr>
              <th scope="colgroup" colSpan={3} className="bg-line-2/60 px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-subtle sm:px-7">
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-t border-line">
                <th scope="row" className="px-4 py-3.5 font-normal sm:px-7">
                  <span className="block text-[13.5px] leading-snug text-ink-2">{row.label}</span>
                  {row.note && <span className="mt-0.5 block text-[12px] text-subtle">{row.note}</span>}
                </th>
                <td className="px-2 py-3.5 text-center sm:px-5">
                  <Mark value={row.solo} />
                </td>
                <td className="bg-brand-50/40 px-2 py-3.5 text-center sm:px-5">
                  <Mark value={row.teams} />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <p className="border-t border-line px-4 py-4 text-[12.5px] text-subtle sm:px-7">
        AI-forbruget er, hvad svarene reelt koster hos modellen – appen viser forbruget undervejs, og puljen deles af hele virksomheden.
      </p>
    </div>
  );
}
