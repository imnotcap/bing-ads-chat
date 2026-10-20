import { Check, Minus, Plus, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { EXTRA_USAGE_PACK, PLANS, includedUsage, monthlyPrice } from '@/workspace/plans';
import { useSignedIn } from '@site/lib/api';
import { ButtonLink, cn, ease, usd } from '@site/lib/ui';

/** Solo and Teams side by side; Teams with a seat picker that shows the price and the pool. */
export function PricingCards({ compact = false }: { compact?: boolean }) {
  const [seats, setSeats] = useState(5);
  const signedIn = useSignedIn();
  const solo = PLANS.solo;
  const teams = PLANS.teams;
  const clamp = (n: number) => Math.min(teams.maxSeats, Math.max(teams.minSeats, Math.round(n) || teams.minSeats));
  const cta = (plan: string) => (signedIn ? '/konto/abonnement' : `/login?opret=1&plan=${plan}`);

  return (
    <div className={cn('mx-auto grid max-w-[980px] gap-5 md:grid-cols-2', compact && 'max-w-[920px]')}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease }}
        className="flex flex-col rounded-[30px] bg-white p-8 shadow-card ring-1 ring-black/[0.05]"
      >
        <p className="text-[15px] font-bold text-ink">{solo.name}</p>
        <p className="mt-1 text-[14px] text-muted">{solo.tagline}</p>
        <p className="mt-7 flex items-baseline gap-1.5">
          <span className="text-[52px] font-bold leading-none tracking-[-0.04em] tabular">{usd(solo.priceUsd)}</span>
          <span className="text-[14px] font-medium text-muted">/ måned</span>
        </p>
        <p className="mt-2 text-[13.5px] text-muted">1 person · {usd(solo.includedUsd)} AI-forbrug inkluderet</p>
        <ul className="mt-7 grid gap-3">
          {solo.features.map((f) => (
            <Feature key={f}>{f}</Feature>
          ))}
        </ul>
        <div className="mt-auto pt-8">
          <ButtonLink href={cta('solo')} variant="ghost" className="w-full" arrow>
            Kom i gang med Solo
          </ButtonLink>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, delay: 0.08, ease }}
        className="relative flex flex-col overflow-hidden rounded-[30px] bg-ink p-8 text-white shadow-pop"
      >
        <div aria-hidden className="bg-lavender absolute -right-24 -top-24 size-72 rounded-full opacity-50 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <p className="text-[15px] font-bold">{teams.name}</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/85">
            <Sparkles className="size-3.5" />
            Fælles forbrugspulje
          </span>
        </div>
        <p className="relative mt-1 text-[14px] text-white/60">{teams.tagline}</p>
        <p className="relative mt-7 flex items-baseline gap-1.5">
          <motion.span key={seats} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[52px] font-bold leading-none tracking-[-0.04em] tabular">
            {usd(monthlyPrice('teams', seats))}
          </motion.span>
          <span className="text-[14px] font-medium text-white/60">/ måned</span>
        </p>
        <p className="relative mt-2 text-[13.5px] text-white/60">
          {usd(teams.priceUsd)} pr. medarbejder · {usd(includedUsage('teams', seats))} AI-forbrug i puljen
        </p>

        <div className="relative mt-6 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="seats" className="text-[13.5px] font-semibold text-white/85">
              Medarbejdere
            </label>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="Færre" onClick={() => setSeats((s) => clamp(s - 1))} className="grid size-8 place-items-center rounded-full bg-white/10 hover:bg-white/20">
                <Minus className="size-4" />
              </button>
              <input
                id="seats"
                inputMode="numeric"
                value={seats}
                onChange={(e) => setSeats(clamp(Number(e.target.value.replace(/\D/g, ''))))}
                className="h-8 w-12 rounded-lg bg-white/10 text-center text-[15px] font-bold tabular outline-none focus:bg-white/20"
              />
              <button type="button" aria-label="Flere" onClick={() => setSeats((s) => clamp(s + 1))} className="grid size-8 place-items-center rounded-full bg-white/10 hover:bg-white/20">
                <Plus className="size-4" />
              </button>
            </div>
          </div>
          <input
            type="range"
            min={teams.minSeats}
            max={50}
            value={Math.min(seats, 50)}
            onChange={(e) => setSeats(clamp(Number(e.target.value)))}
            aria-label="Antal medarbejdere"
            className="mt-4 w-full accent-[#8b7cf8]"
          />
          <p className="mt-2 text-[12.5px] text-white/50">Mindst {teams.minSeats} pladser. Tilføj og fjern medarbejdere når som helst.</p>
        </div>

        <ul className="relative mt-7 grid gap-3">
          {teams.features.map((f) => (
            <Feature key={f} dark>
              {f}
            </Feature>
          ))}
        </ul>
        <div className="relative mt-auto pt-8">
          <ButtonLink href={cta('teams')} variant="brand" className="w-full" arrow>
            Opret Teams til {seats} medarbejdere
          </ButtonLink>
        </div>
      </motion.div>

      <div className="flex flex-col items-center justify-between gap-3 rounded-[24px] bg-brand-50 px-6 py-5 text-center ring-1 ring-brand/10 sm:flex-row sm:text-left md:col-span-2">
        <p className="text-[14.5px] text-ink-2">
          <b className="text-ink">Brugt hele puljen?</b> En administrator køber ekstra forbrug: {usd(EXTRA_USAGE_PACK.priceUsd)} giver {usd(EXTRA_USAGE_PACK.creditUsd)} i
          AI-kredit, som ikke udløber.
        </p>
        <span className="shrink-0 text-[13px] font-semibold text-brand-600">Priser i USD ekskl. moms</span>
      </div>
    </div>
  );
}

function Feature({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <li className={cn('flex items-start gap-3 text-[14.5px] font-medium', dark ? 'text-white/85' : 'text-ink-2')}>
      <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', dark ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-600')}>
        <Check className="size-3" strokeWidth={3} />
      </span>
      {children}
    </li>
  );
}
