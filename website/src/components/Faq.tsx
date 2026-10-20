import { Minus, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState } from 'react';
import { Accent, Container, SectionHead, cn, ease } from '@site/lib/ui';

export interface Qa {
  q: string;
  a: string;
}

export const FAQ: Qa[] = [
  {
    q: 'Kan XavierOS ændre noget på min konto uden at spørge?',
    a: 'Nej. Alle ændringer – budgetter, bud, søgeord, annoncer og negative søgeord – vises først som et forslag med før og efter, og sker først når du trykker Godkend. Administratoren kan desuden sætte grænser for, hvor meget et budget må ændres.',
  },
  {
    q: 'Hvilke Microsoft Advertising-konti kan jeg bruge?',
    a: 'Den konto, du logger ind på i Microsoft Advertising. Virksomheden forbinder sin konto én gang, og så arbejder alle i teamet på de samme kampagner – uden at dele adgangskoder.',
  },
  {
    q: 'Hvad er AI-forbrug, og hvad sker der, når puljen er brugt?',
    a: 'Hver plads giver $25 AI-forbrug om måneden til virksomhedens fælles pulje, som alle i teamet bruger af. Når puljen er brugt, kan en administrator købe ekstra forbrug: $25 giver $20 i kredit, som ikke udløber. Puljen fyldes op igen den 1. i måneden.',
  },
  {
    q: 'Skriver den ordentligt dansk?',
    a: 'Ja. Søgeord, annoncetekster og navne gennemgås af en dansk korrektur før du godkender dem, så du undgår stavefejl og tyske eller svenske ord som "regal" i stedet for "reol".',
  },
  {
    q: 'Hvor kommer tallene fra?',
    a: 'Direkte fra Microsoft Advertising: kampagner, annoncegrupper, søgetermer, søgevolumen i Danmark, foreslåede bud og auktionsindsigt. Rådgiveren kan også søge på nettet og læse jeres hjemmeside for at skrive bedre annoncer.',
  },
  {
    q: 'Hvordan tilføjer jeg mine kolleger?',
    a: 'Vælg Teams, og invitér dem med deres arbejdsmail under Konto → Team. Har I et eget domæne, kan alle med en mail på domænet komme ind uden invitation. Prisen følger antallet af medarbejdere.',
  },
  {
    q: 'Hvad kræver det at installere?',
    a: 'Windows 10 eller 11. Appen installeres uden administratorrettigheder og opdaterer sig selv, når der kommer en ny version.',
  },
];

/** Numbered questions; the open one is filled dark. */
export function Faq({ items = FAQ, className }: { items?: Qa[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <section id="faq" className={cn('pb-24', className)}>
      <Container className="max-w-[860px]">
        <SectionHead
          eyebrow="FAQ"
          title={
            <>
              Spørgsmål? <Accent>Vi har svar</Accent>
            </>
          }
          lead="Det, de fleste vil vide, før de lader en AI hjælpe med deres annoncer."
        />
        <ol className="mt-12 grid gap-3">
          {items.map((f, i) => {
            const isOpen = open === i;
            const id = `${base}-${i}`;
            return (
              <li key={f.q}>
                <motion.div
                  layout
                  transition={{ duration: 0.35, ease }}
                  className={cn('overflow-hidden rounded-[22px] ring-1 transition-colors', isOpen ? 'bg-ink text-white ring-ink' : 'bg-white text-ink ring-black/[0.06] hover:ring-black/[0.14]')}
                >
                  <h3>
                    <button type="button" aria-expanded={isOpen} aria-controls={id} onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center gap-4 px-6 py-5 text-left">
                      <span className={cn('w-7 shrink-0 text-[15px] font-extrabold tabular', isOpen ? 'text-brand-200' : 'text-subtle')}>{i + 1}.</span>
                      <span className="flex-1 text-[16px] font-bold">{f.q}</span>
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', isOpen ? 'bg-white text-ink' : 'bg-ink text-white')}>
                        {isOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}
                      </span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div id={id} role="region" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }}>
                        <p className="px-6 pb-6 pl-[68px] text-[15px] leading-relaxed text-white/75">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}
