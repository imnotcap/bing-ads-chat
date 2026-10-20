import { BellRing, LayoutDashboard, ListFilter, MessagesSquare, PenLine, ShieldCheck, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Accent, Container, SectionHead, cn, ease } from '@site/lib/ui';
import { AppFrame, Clip } from './AppFrame';

interface Feature {
  clip: string;
  icon: LucideIcon;
  title: string;
  text: string;
}

export const FEATURES: Feature[] = [
  {
    clip: 'hero',
    icon: MessagesSquare,
    title: 'Spørg som til en kollega',
    text: 'Hvorfor faldt konverteringerne? Hvilke annoncegrupper bruger pengene? Rådgiveren henter tallene fra din konto og svarer med tabeller, grafer og et klart forslag.',
  },
  {
    clip: 'negatives',
    icon: ListFilter,
    title: 'Negative søgeord på et øjeblik',
    text: 'Søgetermerne fra én kampagne ad gangen, sorteret efter spildte penge. Slå til og fra i en tabel, vælg Exact eller Phrase – og tilføj dine egne.',
  },
  {
    clip: 'ads',
    icon: PenLine,
    title: 'Annoncer, der er skrevet til danskere',
    text: 'Nye responsive søgeannoncer med søgeordet fastgjort som overskrift 1, dansk korrektur og tjek af tegngrænser – før noget sendes til Microsoft.',
  },
  {
    clip: 'approval',
    icon: ShieldCheck,
    title: 'Intet ændres uden dit ja',
    text: 'Hver ændring vises som et kort med før og efter. Du godkender, retter eller afviser – og virksomhedens budgetgrænser gælder altid.',
  },
  {
    clip: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard og planlægning',
    text: 'Forbrug, klik, konverteringer og ROAS for den konto, du er logget ind på – og en fælles tavle til teamets opgaver.',
  },
  {
    clip: 'followup',
    icon: BellRing,
    title: 'Opfølgning i din kalender',
    text: 'Bed om at følge op om 14 dage, så sender XavierOS en påmindelse til din Outlook og opretter et kort i din personlige planlægning.',
  },
];

const STEP_MS = 9000;

/** The features, each with a recording of the app; advances by itself until clicked. */
export function Showcase() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % FEATURES.length), STEP_MS);
    return () => window.clearTimeout(t);
  }, [active, auto]);
  const f = FEATURES[active]!;

  return (
    <section id="funktioner" className="pb-24 pt-8">
      <Container>
        <SectionHead
          eyebrow="Funktioner"
          title={
            <>
              En hel specialist i Microsoft Ads, <Accent>i én chat</Accent>
            </>
          }
          lead="Analyse, søgeord, annoncer, budgetter og opfølgning. XavierOS kender Microsoft Advertising til bunds og arbejder på din konto – med dig ved roret."
        />
        <div className="mt-14 grid items-start gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <ol className="grid gap-2">
            {FEATURES.map((item, i) => {
              const on = i === active;
              return (
                <li key={item.clip}>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(i);
                      setAuto(false);
                    }}
                    className={cn(
                      'relative w-full overflow-hidden rounded-[20px] px-5 py-4 text-left transition-colors',
                      on ? 'bg-white shadow-card ring-1 ring-black/[0.05]' : 'hover:bg-white/60',
                    )}
                    aria-pressed={on}
                  >
                    <span className="flex items-center gap-3">
                      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl transition-colors', on ? 'bg-brand text-white' : 'bg-white text-ink-2 ring-1 ring-black/[0.06]')}>
                        <item.icon className="size-[18px]" />
                      </span>
                      <span className={cn('text-[16px] font-bold', on ? 'text-ink' : 'text-ink-2')}>{item.title}</span>
                    </span>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.p
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease }}
                          className="overflow-hidden pl-12 text-[14.5px] leading-relaxed text-muted"
                        >
                          <span className="block pt-2">{item.text}</span>
                        </motion.p>
                      )}
                    </AnimatePresence>
                    {on && auto && (
                      <motion.span
                        key={`bar-${active}`}
                        className="absolute bottom-0 left-0 h-[3px] bg-brand/70"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="relative lg:sticky lg:top-24">
            <div aria-hidden className="bg-aurora absolute -inset-y-10 inset-x-0 -z-10 blur-2xl sm:-inset-x-10" />
            <AppFrame title={`XavierOS – ${f.title}`}>
              <AnimatePresence mode="wait">
                <motion.div key={f.clip} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease }}>
                  <Clip name={f.clip} label={f.title} />
                </motion.div>
              </AnimatePresence>
            </AppFrame>
          </div>
        </div>
      </Container>
    </section>
  );
}
