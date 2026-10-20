import { Check, Minus } from 'lucide-react';
import { Faq, FAQ } from '@site/components/Faq';
import { PricingCards } from '@site/components/PricingCards';
import { Accent, Container, Eyebrow, Reveal, SectionHead, usd } from '@site/lib/ui';
import { EXTRA_USAGE_PACK, PLANS } from '@/workspace/plans';
import { DarkCta } from './Home';

const ROWS: { label: string; solo: boolean | string; teams: boolean | string }[] = [
  { label: 'Pris', solo: `${usd(PLANS.solo.priceUsd)} / måned`, teams: `${usd(PLANS.teams.priceUsd)} pr. medarbejder / måned` },
  { label: 'Personer', solo: '1', teams: `${PLANS.teams.minSeats}–${PLANS.teams.maxSeats}` },
  { label: 'AI-forbrug inkluderet', solo: `${usd(PLANS.solo.includedUsd)} / måned`, teams: `${usd(PLANS.teams.includedUsd)} pr. medarbejder i fælles pulje` },
  { label: 'Ekstra forbrug', solo: `${usd(EXTRA_USAGE_PACK.priceUsd)} for ${usd(EXTRA_USAGE_PACK.creditUsd)}`, teams: `${usd(EXTRA_USAGE_PACK.priceUsd)} for ${usd(EXTRA_USAGE_PACK.creditUsd)}` },
  { label: 'AI-rådgiver til Microsoft Advertising', solo: true, teams: true },
  { label: 'Godkendelse af alle ændringer', solo: true, teams: true },
  { label: 'Søgevolumen, bud og auktionsindsigt', solo: true, teams: true },
  { label: 'Dansk korrektur af søgeord og annoncer', solo: true, teams: true },
  { label: 'Dashboard, planlægning og opfølgninger', solo: true, teams: true },
  { label: 'Delte tavler, playbooks og budgetgrænser', solo: false, teams: true },
  { label: 'Roller og invitationer', solo: false, teams: true },
  { label: 'Log ind med firmadomæne uden invitation', solo: false, teams: true },
  { label: 'Forbrug pr. medarbejder', solo: false, teams: true },
];

const PRICE_FAQ = [
  {
    q: 'Hvad tæller som en plads?',
    a: `Hver aktiv person i virksomheden. Teams faktureres for mindst ${PLANS.teams.minSeats} pladser. Prisen følger antallet af aktive personer, så den falder, når du fjerner en medarbejder.`,
  },
  FAQ[2]!,
  {
    q: 'Hvorfor koster ekstra forbrug mere, end det giver?',
    a: `Pakken dækker AI-modellernes pris og driften af tjenesten. ${usd(EXTRA_USAGE_PACK.priceUsd)} giver ${usd(EXTRA_USAGE_PACK.creditUsd)} i AI-kredit, som ikke udløber, og som først bruges, når månedens pulje er tom.`,
  },
  {
    q: 'Kan vi skifte fra Solo til Teams?',
    a: 'Ja, under Konto → Abonnement. Jeres samtaler, forbindelser og indstillinger følger med. Fra Teams til Solo kan I skifte, når der kun er én person tilbage.',
  },
  {
    q: 'Hvordan betaler vi?',
    a: 'Abonnement og ekstra forbrug faktureres månedligt. Alle køb af ekstra forbrug kan ses under Konto → Abonnement.',
  },
];

export function Pricing() {
  return (
    <>
      <section className="relative isolate -mt-[68px] pb-16 pt-[128px] sm:pt-[150px]">
        <div aria-hidden className="bg-aurora absolute inset-x-0 top-0 -z-10 h-[620px]" />
        <Container>
          <SectionHead
            eyebrow="Priser"
            title={
              <>
                Enkel pris pr. person, <Accent>fælles forbrug</Accent>
              </>
            }
            lead="Vælg Solo, hvis det kun er dig. Vælg Teams, og hver medarbejder lægger AI-forbrug i virksomhedens fælles pulje – så den travle kollega kan låne af den stille."
          />
          <div className="mt-12">
            <PricingCards />
          </div>
        </Container>
      </section>

      <section className="pb-24">
        <Container className="max-w-[980px]">
          <Reveal className="mb-8 text-center">
            <Eyebrow>Sammenlign</Eyebrow>
          </Reveal>
          <div className="overflow-hidden rounded-[28px] bg-white shadow-card ring-1 ring-black/[0.05]">
            <table className="w-full text-left text-[14.5px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-6 py-5 font-semibold text-muted" scope="col">
                    <span className="sr-only">Funktion</span>
                  </th>
                  <th className="w-[26%] px-4 py-5 text-[15px] font-bold text-ink" scope="col">
                    Solo
                  </th>
                  <th className="w-[30%] px-4 py-5 text-[15px] font-bold text-ink" scope="col">
                    Teams
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label} className="border-b border-line-2 last:border-0">
                    <th scope="row" className="px-6 py-4 font-medium text-ink-2">
                      {r.label}
                    </th>
                    <Cell v={r.solo} />
                    <Cell v={r.teams} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <Faq items={PRICE_FAQ} />
      <DarkCta />
    </>
  );
}

function Cell({ v }: { v: boolean | string }) {
  return (
    <td className="px-4 py-4 text-ink">
      {v === true ? (
        <Check className="size-[18px] text-positive" strokeWidth={2.5} aria-label="Ja" />
      ) : v === false ? (
        <Minus className="size-[18px] text-subtle" aria-label="Nej" />
      ) : (
        <span className="font-semibold">{v}</span>
      )}
    </td>
  );
}
