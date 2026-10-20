import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  Check,
  Download,
  Gauge,
  Globe,
  KeyRound,
  Languages,
  LogIn,
  MessageSquareText,
  Search,
  ShieldCheck,
  Swords,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AppFrame, Clip } from '@site/components/AppFrame';
import { Faq } from '@site/components/Faq';
import { PricingCards } from '@site/components/PricingCards';
import { Showcase } from '@site/components/Showcase';
import { Accent, ButtonLink, Container, Eyebrow, Reveal, SectionHead, ease } from '@site/lib/ui';

export function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <Showcase />
      <Split />
      <Toolkit />
      <Steps />
      <Safety />
      <section id="priser" className="pb-24">
        <Container>
          <SectionHead
            eyebrow="Priser"
            title={
              <>
                Betal for pladserne, <Accent>del forbruget</Accent>
              </>
            }
            lead="Solo til den selvstændige. Teams til marketingafdelingen – hver medarbejder lægger AI-forbrug i en fælles pulje."
          />
          <div className="mt-12">
            <PricingCards compact />
          </div>
          <p className="mt-6 text-center">
            <ButtonLink href="/priser" variant="quiet" arrow>
              Se alle detaljer om priser
            </ButtonLink>
          </p>
        </Container>
      </section>
      <Faq />
      <DarkCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate -mt-[68px] overflow-hidden pb-20 pt-[128px] sm:pt-[150px]">
      <div aria-hidden className="bg-aurora absolute inset-x-0 top-0 -z-10 h-[820px]" />
      <div aria-hidden className="bg-grid-faint absolute inset-x-0 top-0 -z-10 h-[620px] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />
      <Container className="flex flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="flex items-center gap-2 rounded-full bg-white/80 py-1.5 pl-1.5 pr-4 text-[12.5px] font-semibold text-ink-2 shadow-card ring-1 ring-black/[0.05] backdrop-blur sm:text-[13.5px]"
        >
          <span className="rounded-full bg-ink px-2.5 py-1 text-[12px] text-white">Ny</span>
          <span>
            <span className="hidden sm:inline">Din </span>AI-rådgiver til Microsoft Advertising – på dansk
          </span>
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08, ease }}
          className="mt-7 max-w-4xl text-balance text-[42px] font-bold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[66px]"
        >
          Styr Microsoft Ads <Accent>ved at spørge</Accent>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease }}
          className="mt-6 max-w-[600px] text-pretty text-[17.5px] leading-relaxed text-muted"
        >
          XavierOS analyserer dine kampagner, finder spildte klik, skriver annoncer og følger op – som en specialist i dit team. Intet ændres, før du har
          godkendt det.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3, ease }} className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/login?opret=1" size="lg" arrow>
            Opret din virksomhed
          </ButtonLink>
          <ButtonLink href="/download" size="lg" variant="ghost">
            <Download className="size-4" />
            Hent til Windows
          </ButtonLink>
        </motion.div>
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13.5px] font-medium text-muted"
        >
          {['Log ind med Microsoft', 'Alle ændringer kræver godkendelse', 'Dansk korrektur'].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check className="size-4 text-positive" strokeWidth={2.5} />
              {t}
            </li>
          ))}
        </motion.ul>
      </Container>
      <Container className="relative mt-14">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.4, ease }} className="relative mx-auto max-w-[1060px]">
          <AppFrame>
            <Clip name="hero" label="XavierOS analyserer en kampagne i chatten" />
          </AppFrame>
          <Floating className="-left-4 top-[22%] hidden md:flex" delay={1.2} icon={<Search className="size-4" />} title="38 negative søgeord" text="fundet i Kontormøbler" />
          <Floating className="-right-6 top-[48%] hidden md:flex" delay={1.6} icon={<ShieldCheck className="size-4" />} title="Venter på dig" text="Dagsbudget 250 → 300 kr." />
          <Floating className="bottom-[-18px] left-[18%] hidden md:flex" delay={2} icon={<CalendarClock className="size-4" />} title="Opfølgning lagt i Outlook" text="Om 14 dage kl. 9.00" />
        </motion.div>
      </Container>
    </section>
  );
}

function Floating({ className, delay, icon, title, text }: { className: string; delay: number; icon: React.ReactNode; title: string; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: [0, -6, 0], scale: 1 }}
      transition={{ opacity: { delay, duration: 0.5 }, scale: { delay, duration: 0.5 }, y: { delay, duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
      className={`absolute items-center gap-3 rounded-2xl bg-white/95 py-2.5 pl-2.5 pr-4 shadow-pop ring-1 ring-black/[0.05] backdrop-blur ${className}`}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
      <span className="text-left">
        <span className="block text-[13.5px] font-bold text-ink">{title}</span>
        <span className="block text-[12.5px] text-muted">{text}</span>
      </span>
    </motion.div>
  );
}

const WORKS_WITH = [
  { icon: BarChart3, label: 'Microsoft Advertising' },
  { icon: LogIn, label: 'Microsoft-login' },
  { icon: CalendarClock, label: 'Outlook' },
  { icon: Globe, label: 'Websøgning' },
  { icon: Search, label: 'Søgevolumen i Danmark' },
  { icon: Swords, label: 'Auktionsindsigt' },
  { icon: Languages, label: 'Dansk korrektur' },
  { icon: Users, label: 'Fælles teams' },
];

function Marquee() {
  const row = [...WORKS_WITH, ...WORKS_WITH];
  return (
    <section aria-label="Virker sammen med" className="pb-20">
      <p className="text-center text-[13px] font-semibold uppercase tracking-[0.1em] text-subtle">Arbejder direkte i</p>
      <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <ul className="flex w-max animate-marquee gap-3">
          {row.map((w, i) => (
            <li key={i} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-ink-2 shadow-card ring-1 ring-black/[0.04]">
              <w.icon className="size-4 text-brand" />
              {w.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const POINTS = ['Læser kampagner, annoncegrupper og søgetermer', 'Tjekker søgevolumen og bud i Danmark', 'Søger på nettet og læser din hjemmeside', 'Husker samtalen – og jeres playbooks'];

function Split() {
  return (
    <section className="pb-24">
      <Container className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease }}
          className="bg-lavender relative aspect-[5/4] overflow-hidden rounded-[32px] p-8 text-white shadow-[0_40px_80px_-40px_rgb(109_92_246/0.8)]"
        >
          <div aria-hidden className="bg-dots absolute -right-10 -top-10 size-56 rounded-full opacity-40" />
          <span className="relative grid size-11 place-items-center rounded-full bg-white/90 text-ink">
            <ArrowUpRight className="size-5" />
          </span>
          <div className="absolute inset-x-8 bottom-8">
            <span className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-bold backdrop-blur">Fra spørgsmål til forslag</span>
            <p className="mt-4 text-[72px] font-extrabold leading-none tracking-[-0.04em] sm:text-[96px]">1 chat</p>
            <p className="mt-2 max-w-xs text-[16px] font-semibold text-white/85">i stedet for fem faner, tre rapporter og et regneark.</p>
          </div>
        </motion.div>
        <Reveal>
          <Eyebrow>Rådgiveren</Eyebrow>
          <h2 className="mt-4 text-balance text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[44px]">
            Den undersøger selv, <Accent>før den svarer</Accent>
          </h2>
          <p className="mt-4 max-w-lg text-[16.5px] leading-relaxed text-muted">
            XavierOS gætter ikke. Den henter tallene, tjekker markedet og forklarer, hvorfor den foreslår det, den gør – så du kan stå inde for hver ændring.
          </p>
          <ul className="mt-7 grid gap-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-[15px] font-semibold text-ink-2">
                <span className="grid size-6 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}

const TOOLS = [
  { icon: Search, title: 'Søgeordsundersøgelse', text: 'Søgevolumen måned for måned i Danmark og foreslåede bud, før du byder på et nyt søgeord.' },
  { icon: Swords, title: 'Auktionsindsigt', text: 'Se hvem du konkurrerer med, deres visningsandel og hvor ofte de står over dig.' },
  { icon: MessageSquareText, title: 'Annoncer med pinning', text: 'Overskrifter fastgjort på de rigtige pladser, og søgeordet altid som overskrift 1.' },
  { icon: Gauge, title: 'Budgetgrænser', text: 'Virksomheden bestemmer, hvor meget et budget eller bud må ændres ad gangen.' },
  { icon: Languages, title: 'Dansk korrektur', text: 'Stavning, bøjning og tyske låneord fanges, før søgeord og tekster går live.' },
  { icon: KeyRound, title: 'Én fælles forbindelse', text: 'Virksomheden forbinder Microsoft Advertising én gang – ingen deler adgangskoder.' },
];

function Toolkit() {
  return (
    <section className="pb-24">
      <Container>
        <SectionHead
          eyebrow="Værktøjskassen"
          title={
            <>
              Alt det, en specialist bruger, <Accent>indbygget</Accent>
            </>
          }
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t, i) => (
            <Reveal key={t.title} delay={(i % 3) * 0.06}>
              <div className="group h-full rounded-[26px] bg-white p-7 shadow-card ring-1 ring-black/[0.05] transition-shadow hover:shadow-pop">
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand group-hover:text-white">
                  <t.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-[17px] font-bold text-ink">{t.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{t.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

const STEPS = [
  { title: 'Opret virksomheden', text: 'Log ind med din Microsoft-arbejdskonto og vælg Solo eller Teams. Det tager under et minut.' },
  { title: 'Hent appen og forbind', text: 'Installér XavierOS på Windows, og forbind jeres Microsoft Advertising-konto én gang for hele teamet.' },
  { title: 'Spørg løs', text: '"Hvor spilder vi penge i denne måned?" – og godkend de forslag, du er enig i.' },
];

function Steps() {
  return (
    <section id="saadan" className="pb-24">
      <Container>
        <div className="rounded-[36px] bg-white px-6 py-14 shadow-card ring-1 ring-black/[0.05] sm:px-12">
          <SectionHead
            eyebrow="Sådan virker det"
            title={
              <>
                I gang på <Accent>fem minutter</Accent>
              </>
            }
          />
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <li className="relative h-full rounded-[24px] bg-canvas p-7">
                  <span className="grid size-10 place-items-center rounded-full bg-ink text-[15px] font-bold text-white">{i + 1}</span>
                  <h3 className="mt-5 text-[18px] font-bold text-ink">{s.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{s.text}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

const SAFETY = [
  { title: 'Godkendelse af alt', text: 'Hvert forslag vises med før og efter. Ingenting sendes til Microsoft, før du siger ja.' },
  { title: 'Grænser for budgetter', text: 'Administratoren sætter, hvor meget budgetter og bud må ændres – AI’en kan ikke gå udenom.' },
  { title: 'Kun det nødvendige', text: 'Microsoft-login giver adgang til din profil, din kalender og påmindelser til dig selv. XavierOS kan ikke læse din mail.' },
  { title: 'Samtaler ryddes op', text: 'Chats slettes automatisk efter 14 dage, og ingen i teamet behøver at kende adgangskoden til annoncekontoen.' },
];

function Safety() {
  return (
    <section id="sikkerhed" className="pb-24">
      <Container>
        <div className="relative overflow-hidden rounded-[36px] bg-ink px-6 py-16 text-white sm:px-12">
          <div aria-hidden className="bg-lavender absolute -left-32 -top-40 size-[420px] rounded-full opacity-35 blur-3xl" />
          <div className="relative grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold text-white/85">
                <ShieldCheck className="size-3.5" />
                Sikkerhed
              </span>
              <h2 className="mt-4 text-balance text-[34px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[44px]">AI’en foreslår. Du bestemmer.</h2>
              <p className="mt-4 max-w-md text-[16px] leading-relaxed text-white/65">
                XavierOS er bygget, så en AI aldrig gør noget på din konto uden at have fået lov. Det gælder for alle i teamet – også administratoren.
              </p>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2">
              {SAFETY.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.06}>
                  <div className="h-full rounded-[22px] bg-white/[0.06] p-6 ring-1 ring-white/10">
                    <Check className="size-5 text-brand-200" strokeWidth={2.5} />
                    <h3 className="mt-4 text-[16px] font-bold">{s.title}</h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">{s.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function DarkCta() {
  return (
    <section className="pb-16">
      <Container>
        <div className="bg-lavender relative overflow-hidden rounded-[36px] px-6 py-16 text-center text-white sm:px-12">
          <div aria-hidden className="bg-dots absolute -right-12 -top-12 size-64 rounded-full opacity-30" />
          <div aria-hidden className="bg-dots absolute -bottom-16 -left-10 size-56 rounded-full opacity-20" />
          <Reveal className="relative mx-auto max-w-2xl">
            <h2 className="text-balance text-[34px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[48px]">Klar til at få styr på Microsoft Ads?</h2>
            <p className="mx-auto mt-4 max-w-lg text-[16.5px] text-white/80">Opret virksomheden, hent appen og stil dit første spørgsmål i dag.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/login?opret=1" size="lg" arrow>
                Opret din virksomhed
              </ButtonLink>
              <ButtonLink href="/priser" size="lg" variant="ghost">
                Se priser
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
