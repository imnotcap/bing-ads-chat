import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Briefcase, Building2, CalendarCheck, Check, Mail, MessageSquareText, MousePointerClick, ShieldCheck, ShoppingBag, Wallet } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AsciiField } from '@/components/ascii/AsciiArc';
import { GradientASCII } from '@/components/ascii/GradientASCII';
import { BRAND_NAMES, BrandIcon, type BrandId } from '@/components/BrandIcons';
import { Logo } from '@/components/Header';
import { ButtonLink, CONTACT_EMAIL, Container, CoverClip, DOWNLOAD_URL, Reveal, TwoTone, WEB_APP_URL, XavierShards, cn, ease } from '@/lib/ui';

/** The faint lines in the reference's product panels: a grid tipped back in perspective. */
function PerspectiveGrid({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden [perspective:900px]', className)}>
      <div
        className="absolute -inset-x-1/4 -bottom-1/4 top-[-10%] [transform:rotateX(58deg)_rotateZ(-28deg)] [transform-origin:50%_100%]"
        style={{
          backgroundImage: 'linear-gradient(to right, rgb(18 18 22 / 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgb(18 18 22 / 0.07) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 65% 70% at 50% 55%, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 65% 70% at 50% 55%, black 20%, transparent 75%)',
        }}
      />
    </div>
  );
}

/** The big pale mark behind some panels (the reference's watermark logo). */
function Watermark({ className }: { className?: string }) {
  return <XavierShards className={cn('pointer-events-none absolute text-[#f1f1f4]', className)} />;
}

/* ----------------------------------------------------------------- logo strip */

const PLATFORMS: { id: BrandId; soon?: boolean }[] = [
  { id: 'microsoft_ads' },
  { id: 'claude' },
  { id: 'outlook' },
  { id: 'google_ads', soon: true },
  { id: 'meta', soon: true },
  { id: 'webshop', soon: true },
];

const COVERS = ['Kampagner', 'Annoncegrupper', 'Søgeord', 'Søgetermer', 'Annoncer', 'Rapporter', 'Budgetter', 'Produkter'];

/** Two rows of faded marks under the hero: the platforms, then what XavierOS works on. */
export function LogoStrip() {
  return (
    <section aria-label="Platforme" className="border-b border-line">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 px-5 pb-6 pt-9 sm:grid-cols-4 lg:grid-cols-8 lg:px-14">
        {PLATFORMS.map((p) => (
          <div key={p.id} className="flex items-center justify-center gap-2 opacity-55 grayscale transition-[opacity,filter] hover:opacity-100 hover:grayscale-0">
            <BrandIcon id={p.id} className="size-[18px]" />
            <span className="whitespace-nowrap text-[14px] font-semibold text-ink-2">{BRAND_NAMES[p.id]}</span>
            {p.soon && <span className="text-[10.5px] font-medium text-subtle">snart</span>}
          </div>
        ))}
        <div className="flex items-center justify-center text-[14px] font-semibold text-ink-2 opacity-55">Windows 10 og 11</div>
        <div className="flex items-center justify-center text-[14px] font-semibold text-ink-2 opacity-55">Web-app</div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 pb-9 sm:grid-cols-4 lg:grid-cols-8 lg:px-14">
        {COVERS.map((c) => (
          <div key={c} className="text-center text-[15px] font-medium tracking-[-0.01em] text-[#b9b9c3]">
            {c}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- about */

/** The approval card from the app (front panel of the product picture). */
function ApprovalPanel() {
  const rows = [
    ['brugt kontorstol', '1.120 kr.'],
    ['kontorstol reservedele', '690 kr.'],
    ['gratis kontorstol', '540 kr.'],
    ['kontorstol job', '410 kr.'],
  ];
  return (
    <div className="h-[250px] w-[300px] rounded-[14px] border border-black/[0.08] bg-white p-4 shadow-[0_40px_60px_-30px_rgb(18_18_22/0.45)]">
      <div className="text-[12.5px] font-semibold text-ink">Negative søgeord · Kontorstole</div>
      <div className="mt-0.5 text-[11px] text-muted">Søgetermer uden konverteringer, 30 dage</div>
      <div className="mt-2.5 grid gap-1">
        {rows.map(([term, cost], i) => (
          <div key={term} className="flex items-center gap-2 rounded-md bg-line-2/70 px-2 py-[5px] text-[11.5px]">
            <span className={cn('grid size-3.5 place-items-center rounded-[4px]', i === 3 ? 'border border-black/20 bg-white' : 'bg-brand text-white')}>{i !== 3 && <Check className="size-2.5" strokeWidth={3.5} />}</span>
            <span className="flex-1 text-ink-2">{term}</span>
            <span className="tabular text-muted">{cost}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex h-8 items-center justify-center rounded-lg bg-ink text-[11.5px] font-semibold text-white">Tilføj 3 negative søgeord</div>
    </div>
  );
}

/** The confirmation, in the app's dark mark colour (back panel). */
function ConfirmedPanel() {
  // Only the upper part shows behind the approval card, so everything sits at the top.
  return (
    <div className="h-[330px] w-[250px] rounded-[14px] bg-mark p-5 text-white shadow-[0_40px_60px_-30px_rgb(18_18_22/0.6)]">
      <div className="flex items-center justify-between">
        <XavierShards className="w-8 text-white" />
        <span className="text-[10.5px] font-medium text-white/45">Aktivitet</span>
      </div>
      <div className="mt-5 flex items-center gap-1.5 text-[12px] font-semibold text-emerald-300">
        <ShieldCheck className="size-3.5" /> Bekræftet hos Microsoft
      </div>
      <div className="mt-1.5 text-[11.5px] leading-relaxed text-white/60">3 negative søgeord på Kontorstole – Generisk, læst tilbage efter ændringen.</div>
    </div>
  );
}

/**
 * Callouts in the picture's own 700 × 560 coordinates. The panels are turned 18° about
 * their centres (white: 300 × 250 at 330,330 · dark: 250 × 330 at 480,250); each line
 * ends on a panel edge.
 */
const CALLOUTS = [
  { title: 'Godkendelseskort', text: 'Hver ændring med før og efter – intet sendes før dit klik.', x: 24, y: 112, w: 200, line: 'M 110 182 L 110 236 L 186 282' },
  { title: 'Læst tilbage fra Microsoft', text: 'Kun det, Microsoft viser, kaldes bekræftet.', x: 516, y: 4, w: 184, line: 'M 590 66 L 590 96 L 572 107' },
  { title: 'Forbrugsregler i koden', text: 'Lofter og beskyttede kampagner tjekkes før hver ændring.', x: 474, y: 470, w: 210, line: 'M 466 480 L 330 480 L 300 450' },
] as const;

const W = 700;
const H = 560;

/** The product picture: two app panels tipped like the reference's solar panels, with callouts. */
function ProductPicture() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, (e?.contentRect.width ?? W) / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[700px]" style={{ height: H * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 1, ease }}
          className="absolute"
          style={{ left: 480 - 125, top: 250 - 165, rotate: 18 }}
        >
          <ConfirmedPanel />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 1, delay: 0.12, ease }}
          className="absolute"
          style={{ left: 330 - 150, top: 330 - 125, rotate: 18 }}
        >
          <ApprovalPanel />
        </motion.div>
        <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
          {CALLOUTS.map((c) => (
            <path key={c.title} d={c.line} fill="none" stroke="#8c8c98" strokeWidth="1" />
          ))}
        </svg>
        {CALLOUTS.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.5 + i * 0.15, ease }}
            className="absolute"
            style={{ left: c.x, top: c.y, width: c.w }}
          >
            <div className="text-[15px] font-medium tracking-[-0.01em] text-ink">{c.title}</div>
            <div className="mt-1 text-[12.5px] leading-snug text-muted">{c.text}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function About() {
  return (
    <section id="om" className="border-b border-line">
      <div className="grid lg:grid-cols-2">
        <div className="flex flex-col lg:border-r lg:border-line">
          <div className="relative min-h-[420px] overflow-hidden px-5 pb-10 pt-14 sm:px-8 lg:min-h-[540px] lg:px-14">
            <Watermark className="-bottom-24 right-[-6%] w-[62%]" />
            <Reveal className="relative">
              <TwoTone
                dark="En rådgiver, der arbejder i jeres Microsoft Ads-konto"
                light="– enkel, ærlig og bygget til at blive brugt hver dag"
                className="max-w-[640px] text-[30px] leading-[1.15] text-ink sm:text-[38px]"
              />
            </Reveal>
          </div>
          <div className="border-t border-line px-5 py-10 sm:px-8 lg:px-14">
            <Reveal>
              <p className="max-w-[620px] text-[14.5px] leading-relaxed text-ink-2">
                XavierOS læser kampagner, søgetermer, budgetter og rapporter direkte fra Microsoft Advertising og svarer som en erfaren
                performance-rådgiver – på dansk, med periode, tal og en anbefaling. Ændringerne gør den klar på et kort; I godkender, og
                XavierOS sender og tjekker efter.
              </p>
              <ButtonLink href="#kontakt" className="mt-7">
                Kom i gang
              </ButtonLink>
            </Reveal>
          </div>
        </div>
        <div className="relative flex items-center overflow-hidden border-t border-line px-5 py-12 sm:px-8 lg:border-t-0">
          <PerspectiveGrid />
          <ProductPicture />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- benefits */

const SLIDES = [
  {
    icon: ShoppingBag,
    title: 'Webshops',
    text: 'Find søgetermer, der koster uden at sælge, se ROAS og break-even pr. kampagne, og flyt budget derhen, hvor visningerne tabes.',
    clip: '/clips/app-analyse',
    alt: 'XavierOS viser forbrug og ROAS pr. kampagne og søgetermer uden konverteringer',
  },
  {
    icon: Building2,
    title: 'B2B og lead-generering',
    text: 'CPA mod jeres mål, LinkedIn-målretning i Microsoft Ads – og et tydeligt signal, når datagrundlaget er for lille til at konkludere.',
    clip: '/clips/fan',
    alt: 'Animation: kampagnekort med ROAS, tabt visningsandel og et budgetforslag',
    contain: true,
  },
  {
    icon: Briefcase,
    title: 'Bureauer',
    text: 'Specialisterne får ændringerne forberedt og dokumenteret: godkendelseskort før hver ændring, aktivitetslog med fortryd og fælles tavler.',
    clip: '/clips/app-godkend',
    alt: 'XavierOS: negative søgeord vælges, godkendes og bekræftes hos Microsoft',
  },
];

export function Benefits() {
  const [i, setI] = useState(0);
  const slide = SLIDES[i]!;
  return (
    <section aria-labelledby="fordele-titel" className="pb-2">
      <Container className="pb-10 pt-16">
        <div className="grid items-end gap-6 lg:grid-cols-[1fr_340px]">
          <Reveal>
            <h2 id="fordele-titel" className="max-w-[700px] text-balance text-[30px] font-medium leading-[1.15] tracking-[-0.035em] text-ink sm:text-[38px]">
              Hvorfor marketingteams og bureauer vælger XavierOS til Microsoft Ads
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[13px] leading-relaxed text-muted">Analyse, forslag, godkendelse og opfølgning i én app – til jer, der har penge på Microsoft Ads.</p>
          </Reveal>
        </div>
      </Container>
      <div className="px-2">
        <div className={cn('relative h-[560px] overflow-hidden rounded-[10px] sm:h-[620px]', slide.contain ? 'bg-mesh' : 'bg-[#f7f6fa]')}>
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }} className="absolute inset-0">
              {slide.contain ? (
                <div className="absolute inset-y-0 right-[4%] aspect-[640/569]">
                  <CoverClip src={slide.clip} alt={slide.alt} replay={i} />
                </div>
              ) : (
                <div className="absolute inset-x-[4%] top-[7%] bottom-0 overflow-hidden rounded-t-[12px] border border-b-0 border-black/[0.06] bg-white shadow-[0_30px_80px_-40px_rgb(18_18_22/0.4)]">
                  <CoverClip src={slide.clip} alt={slide.alt} position="top" replay={i} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <a href={WEB_APP_URL} aria-label="Åbn web-appen" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white text-ink shadow-card transition-transform hover:scale-105">
            <XavierShards className="w-4" />
          </a>
          <div className="absolute bottom-4 left-4 right-4 grid gap-1.5 sm:right-auto sm:w-[420px]">
            <div className="flex items-center gap-3 rounded-[8px] bg-white px-4 py-3">
              <span className="grid size-7 place-items-center rounded-full border border-line text-ink-2">
                <slide.icon className="size-3.5" />
              </span>
              <AnimatePresence mode="wait">
                <motion.span key={slide.title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="text-[18px] font-medium tracking-[-0.02em] text-ink">
                  {slide.title}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="rounded-[8px] bg-white px-4 py-4">
              <AnimatePresence mode="wait">
                <motion.p key={slide.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="text-[13px] leading-relaxed text-ink-2">
                  {slide.text}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <div className="absolute bottom-4 right-4 flex items-center gap-4 rounded-[8px] bg-white py-2.5 pl-4 pr-3 text-[13px] font-medium shadow-card">
            <span className="tabular text-muted">
              {i + 1} / {SLIDES.length}
            </span>
            <button type="button" onClick={() => setI((v) => (v + 1) % SLIDES.length)} className="flex items-center gap-1.5 text-ink hover:underline">
              Næste <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- solutions */

function ImageCard({ clip, alt, title }: { clip: string; alt: string; title: string }) {
  return (
    <Reveal className="relative h-[520px] overflow-hidden rounded-[10px] bg-mesh sm:h-[620px]">
      <CoverClip src={clip} alt={alt} />
      <h3 className="absolute left-7 top-7 max-w-[80%] text-[28px] font-medium tracking-[-0.03em] text-ink sm:text-[32px]">{title}</h3>
    </Reveal>
  );
}

function SpecCard({ icon: Icon, label, title, text, specs }: { icon: typeof Check; label: string; title: string; text: string; specs: [string, string][] }) {
  return (
    <Reveal className="relative flex h-[520px] flex-col justify-between overflow-hidden rounded-[10px] bg-ink p-7 text-white sm:h-[620px]">
      <AsciiField shape="rise" mask="radial-gradient(ellipse 60% 55% at 100% 100%, black 10%, transparent 75%)" ink="#3a3a44" opacity={0.5} />
      <div className="relative">
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-white/60">
          <Icon className="size-3.5 text-brand-200" /> {label}
        </p>
        <h3 className="mt-4 text-[24px] font-medium tracking-[-0.025em] sm:text-[27px]">{title}</h3>
        <p className="mt-3 max-w-[560px] text-[13.5px] leading-relaxed text-white/70">{text}</p>
      </div>
      <dl className="relative grid gap-3.5">
        {specs.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[130px_1fr] gap-4 text-[13px]">
            <dt className="text-white/45">{k}</dt>
            <dd className="text-white/90">{v}</dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}

export function Solutions() {
  return (
    <section id="funktioner" className="pb-2">
      <Container className="pb-8 pt-16">
        <div className="grid items-end gap-6 lg:grid-cols-[1fr_480px]">
          <Reveal>
            <TwoTone dark="Alt det, en dygtig rådgiver gør" light="– bare hurtigere og med tallene på bordet." className="max-w-[700px] text-[30px] leading-[1.15] text-ink sm:text-[38px]" />
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[13px] leading-relaxed text-muted">
              Spørg, få svar med grafer og tabeller, godkend ændringerne og følg op – i én app til hele marketingteamet eller jeres bureau.
            </p>
          </Reveal>
        </div>
      </Container>
      <div className="grid gap-2 px-2 md:grid-cols-2">
        <ImageCard clip="/clips/chat" alt="Animation: et spørgsmål i chatten bliver til et svar med en graf og fundet spild" title="Rådgiveren i chatten" />
        <SpecCard
          icon={MousePointerClick}
          label="Godkendelse"
          title="Du godkender. XavierOS tjekker efter."
          text="Hver ændring vises på et kort med før og efter. Intet sendes til Microsoft, før du klikker – og bagefter læser XavierOS ændringen tilbage og siger kun bekræftet, når den faktisk er sket."
          specs={[
            ['Ændringer', 'Bud, budgetter, søgeord, negative søgeord og annoncer'],
            ['Kontrol', 'Intet sendes før et klik på Godkend'],
            ['Resultat', 'Bekræftet, delvist eller ikke gennemført – pr. element'],
            ['Fortryd', 'Fra Aktivitet-siden, med hvem og hvornår'],
          ]}
        />
        <SpecCard
          icon={Wallet}
          label="Forbrugsregler"
          title="Budgetter og grænser, der holder"
          text="Reglerne tjekkes i koden før hver ændring – ikke kun i en prompt. Et forslag over loftet stoppes, før det når Microsoft."
          specs={[
            ['Månedsbudget', 'Prognose for måneden ved hver budgetændring'],
            ['Lofter', 'For dagsbudget og CPC-bud'],
            ['Beskyttelse', 'Udvalgte kampagner kan ikke røres'],
            ['Sletning', 'Kan slås helt fra'],
          ]}
        />
        <ImageCard clip="/clips/board" alt="Animation: et kort flyttes fra I gang til Færdig på planlægningstavlen" title="Planlægning for hele teamet" />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- process */

const STEPS = [
  { icon: MessageSquareText, title: 'Spørg på dansk', text: '»Hvor spilder vi penge?« XavierOS henter tallene fra Microsoft Advertising og forklarer, hvad de viser – med periode, tal og en anbefaling.' },
  { icon: MousePointerClick, title: 'Godkend ændringerne', text: 'Ændringerne står klar på et kort. Vælg til og fra, ret værdierne – og godkend. Intet sendes før.' },
  { icon: ShieldCheck, title: 'Bekræftet hos Microsoft', text: 'XavierOS sender ændringen og læser den tilbage. Kun det, Microsoft viser, kaldes bekræftet – resten står som delvist eller ikke gennemført.' },
  { icon: CalendarCheck, title: 'Følg op på effekten', text: 'Et kort på din tavle og en påmindelse i din Outlook-kalender, så effekten af ændringen bliver målt.' },
];

/** Positions on the ring (top, right, bottom, left) in % of the diagram. */
const RING = [
  [50, 18],
  [82, 50],
  [50, 82],
  [18, 50],
] as const;

export function Process() {
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  return (
    <section id="proces" className="border-b border-line">
      <Container className="pb-12 pt-16">
        <Reveal>
          <TwoTone dark="Fra spørgsmål til" light="bekræftet ændring – på et minut." className="max-w-[640px] text-[30px] leading-[1.15] text-ink sm:text-[38px]" />
        </Reveal>
      </Container>
      <div className="grid border-t border-line lg:grid-cols-2">
        <div className="relative h-[460px] overflow-hidden lg:h-[580px] lg:border-r lg:border-line">
          <PerspectiveGrid />
          <div className="absolute left-1/2 top-1/2 aspect-square w-[min(80%,380px)] -translate-x-1/2 -translate-y-1/2">
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
              <circle cx="50" cy="50" r="32" fill="none" stroke="#ebebf0" strokeWidth="0.4" />
              <motion.g animate={{ rotate: 360 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '50px 50px', transformBox: 'view-box' }}>
                <circle cx="50" cy="18" r="1.1" fill="#6d5cf6" />
              </motion.g>
            </svg>
            <XavierShards className="absolute left-1/2 top-1/2 w-[22%] -translate-x-1/2 -translate-y-1/2 text-brand" />
            {STEPS.map((s, n) => (
              <button
                key={s.title}
                type="button"
                onClick={() => setI(n)}
                aria-label={s.title}
                aria-pressed={n === i}
                className={cn('absolute grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white transition-[background,transform] duration-300', n === i ? 'scale-110 bg-brand' : 'bg-ink hover:bg-ink-2')}
                style={{ left: `${RING[n]![0]}%`, top: `${RING[n]![1]}%` }}
              >
                <s.icon className="size-[18px]" />
              </button>
            ))}
          </div>
        </div>
        <div className="relative flex min-h-[460px] flex-col justify-between overflow-hidden px-5 py-8 sm:px-8 lg:min-h-[580px] lg:px-10">
          <Watermark className="right-[-4%] top-[8%] w-[56%]" />
          <div className="relative flex items-center justify-between text-[13px] font-medium">
            <span className="text-ink-2">
              Trin {i + 1} af {STEPS.length}
            </span>
            <button type="button" onClick={() => setI((v) => (v + 1) % STEPS.length)} className="text-ink hover:underline">
              Næste
            </button>
          </div>
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35, ease }}>
                <h3 className="text-[20px] font-medium tracking-[-0.02em] text-ink">{step.title}</h3>
                <p className="mt-3 max-w-[500px] text-[13.5px] leading-relaxed text-ink-2">{step.text}</p>
              </motion.div>
            </AnimatePresence>
            <ButtonLink href="#kontakt" className="mt-7">
              Book en demo
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- quote */

const PRINCIPLES = [
  { dark: '»Ingen ændring sker, før et menneske har klikket Godkend.', light: 'Det håndhæver appen – ikke kun AI’en.«' },
  { dark: '»Ingen ændring kaldes bekræftet,', light: 'før Microsoft selv viser den.«' },
  { dark: '»Hver ændring kan ses og fortrydes', light: '– med hvem, hvad og hvornår.«' },
];

/** The reference's testimonial panel, with the rules XavierOS is built on (no invented customers). */
export function Principles() {
  const [i, setI] = useState(0);
  const p = PRINCIPLES[i]!;
  return (
    <section aria-label="Principperne bag XavierOS" className="px-2 pt-2">
      <div className="relative h-[620px] overflow-hidden rounded-[10px] bg-ink sm:h-[680px]">
        <CoverClip src="/clips/app-godkend" alt="" position="top" className="opacity-35 blur-[1px]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(18_18_22/0.55),rgb(18_18_22/0.75))]" />
        <div className="relative px-5 pt-9 sm:px-8 lg:px-14">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease }}
              className="max-w-[1000px] text-balance text-[28px] font-medium leading-[1.2] tracking-[-0.03em] text-white sm:text-[40px]"
            >
              {p.dark} <span className="text-white/50">{p.light}</span>
            </motion.blockquote>
          </AnimatePresence>
        </div>
        <div className="absolute bottom-5 left-5 sm:bottom-8 sm:left-8 lg:left-14">
          <div className="relative hidden h-[210px] w-[360px] overflow-hidden rounded-[12px] bg-mesh sm:block">
            <CoverClip src="/clips/approve" alt="Animation: et godkendelseskort bliver godkendt og bekræftet" />
          </div>
          <p className="mt-4 text-[13px] text-white/75">— Sådan er XavierOS bygget</p>
        </div>
        <div className="absolute bottom-14 right-5 flex items-center gap-6 text-[13px] font-medium text-white/80 sm:bottom-8 sm:right-10 sm:gap-8">
          <button type="button" onClick={() => setI((v) => (v + PRINCIPLES.length - 1) % PRINCIPLES.length)} className="flex items-center gap-1.5 hover:text-white">
            <ArrowLeft className="size-3.5" /> Forrige
          </button>
          <button type="button" onClick={() => setI((v) => (v + 1) % PRINCIPLES.length)} className="flex items-center gap-1.5 hover:text-white">
            Næste <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- contact */

function Choice({ name, options, initial }: { name: string; options: string[]; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => (
        <label
          key={o}
          className={cn(
            'cursor-pointer rounded-full border px-5 py-1.5 text-[12.5px] transition-colors',
            value === o ? 'border-ink bg-ink text-white' : 'border-black/12 bg-white text-ink-2 hover:border-black/30',
          )}
        >
          <input type="radio" name={name} value={o} checked={value === o} onChange={() => setValue(o)} className="sr-only" />
          {o}
        </label>
      ))}
    </div>
  );
}

const line =
  'h-11 w-full border-0 border-b border-line bg-transparent px-1 text-[14px] text-ink placeholder:text-subtle focus:border-ink focus:outline-none focus:ring-0';

/** Contact: heading, mail address and a picture on the left; the form on the right. Sending opens the mail program. */
export function Contact() {
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = [
      `Navn: ${f.get('navn')}`,
      `Arbejdsmail: ${f.get('email')}`,
      `Virksomhed: ${f.get('firma')}`,
      `Telefon: ${f.get('telefon') || '–'}`,
      `Type: ${f.get('type')}`,
      `Budget på Microsoft Ads: ${f.get('budget')}`,
      `Brugere: ${f.get('brugere')}`,
      '',
      String(f.get('besked') || ''),
    ].join('\n');
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Demo af XavierOS – ${f.get('firma')}`)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };
  return (
    <section id="kontakt" className="py-20 sm:py-24">
      <Container className="grid gap-14 lg:grid-cols-2 lg:gap-10 lg:px-24">
        <div className="flex flex-col">
          <Reveal>
            <TwoTone dark="Se XavierOS" light="på jeres egen konto" className="max-w-[460px] text-[30px] leading-[1.15] text-ink sm:text-[38px]" />
            <p className="mt-5 max-w-[440px] text-[13.5px] leading-relaxed text-ink-2">
              Fortæl os lidt om jeres annoncering. På 30 minutter viser vi, hvad XavierOS finder i jeres Microsoft Advertising-konto – og de ændringer, vi
              ville starte med.
            </p>
          </Reveal>
          <div className="mt-14 lg:mt-auto">
            <p className="text-[12.5px] text-muted">Generelle henvendelser</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-1 block text-[24px] font-medium tracking-[-0.02em] text-ink hover:underline">
              {CONTACT_EMAIL}
            </a>
            <div className="relative mt-5 aspect-[500/330] w-full max-w-[500px] overflow-hidden rounded-[10px] bg-mesh">
              <CoverClip src="/clips/followup" alt="Animation: en opfølgning lander i Outlook-kalenderen med en påmindelse" />
            </div>
          </div>
        </div>
        <Reveal>
          <form onSubmit={submit} className="grid gap-7">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-[13px] font-medium text-ink">Kontaktoplysninger</legend>
              <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
                <input name="navn" required autoComplete="name" placeholder="Fulde navn" aria-label="Fulde navn" className={line} />
                <input name="email" type="email" required autoComplete="email" placeholder="Arbejdsmail" aria-label="Arbejdsmail" className={line} />
                <input name="firma" required autoComplete="organization" placeholder="Virksomhed" aria-label="Virksomhed" className={line} />
                <input name="telefon" type="tel" autoComplete="tel" placeholder="Telefon (valgfrit)" aria-label="Telefon" className={line} />
              </div>
            </fieldset>
            <fieldset className="grid gap-4">
              <legend className="mb-1 text-[13px] font-medium text-ink">Om jeres annoncering</legend>
              <div className="grid gap-2.5">
                <span className="text-[12.5px] text-muted">Type</span>
                <Choice name="type" options={['Webshop', 'B2B', 'Bureau', 'Lead-generering', 'Andet']} initial="Webshop" />
              </div>
              <div className="grid gap-2.5">
                <span className="text-[12.5px] text-muted">Månedligt budget på Microsoft Ads</span>
                <Choice name="budget" options={['< 10.000 kr.', '10–50.000 kr.', '> 50.000 kr.']} initial="10–50.000 kr." />
              </div>
              <div className="grid gap-2.5">
                <span className="text-[12.5px] text-muted">Antal brugere</span>
                <Choice name="brugere" options={['1–3', '4–10', 'Over 10']} initial="1–3" />
              </div>
            </fieldset>
            <textarea name="besked" rows={3} placeholder="Andet, vi skal vide" aria-label="Andet, vi skal vide" className={cn(line, 'h-auto resize-none py-2.5')} />
            <label className="flex items-center gap-2.5 text-[12.5px] text-ink-2">
              <input type="checkbox" required className="size-3.5 accent-[#121216]" />
              Jeg accepterer, at XavierOS kontakter mig om en demo.
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" className="group inline-flex h-11 items-center gap-3 rounded-full border border-black/10 bg-white pl-5 pr-1.5 text-[14px] font-medium text-ink transition-colors hover:border-black/25">
                Book en demo
                <span className="grid size-8 place-items-center rounded-full bg-ink text-white transition-transform duration-300 group-hover:translate-x-0.5">
                  <ArrowRight className="size-3.5" strokeWidth={2.2} />
                </span>
              </button>
              <span className="text-[12.5px] text-muted" aria-live="polite">
                {sent ? `Din mailapp åbner med forespørgslen – tryk Send.` : ''}
              </span>
            </div>
          </form>
        </Reveal>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ CTA */

const DARK_ASCII = ['#2a2440', '#4b3fa8', '#6d5cf6', '#8f86c9', '#3b3a48'];

export function FinalCta() {
  return (
    <section aria-label="Kom i gang" className="px-2">
      <div className="relative isolate flex h-[560px] items-center justify-center overflow-hidden rounded-[10px] bg-ink px-5 text-center text-white sm:h-[600px]">
        <GradientASCII
          colors={DARK_ASCII}
          shape="horizon"
          characters=" ·:▪■"
          cellSize={14}
          density={0.7}
          glyphOpacity={0.55}
          gradientOpacity={0.35}
          grain={0}
          flicker={0.2}
          speed={0.6}
          mouseInteraction
          clickEffect="wave"
          intro={false}
          className="absolute inset-0 -z-10"
        />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,rgb(18_18_22/0.75),transparent_80%)]" />
        <Reveal className="relative">
          <h2 className="text-balance text-[32px] font-medium tracking-[-0.035em] sm:text-[44px]">Klar til at spørge jeres konto?</h2>
          <p className="mx-auto mt-3 max-w-[460px] text-[13.5px] leading-relaxed text-white/75">
            Book en demo på jeres egen konto – eller åbn web-appen og hent XavierOS til Windows, når I er klar.
          </p>
          <ButtonLink href="#kontakt" className="mt-8 border-transparent">
            Book en demo
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- footer */

const FOOTER: { title: string; links: [string, string][] }[] = [
  { title: 'Navigation', links: [['Om appen', '#om'], ['Funktioner', '#funktioner'], ['Proces', '#proces'], ['Kontakt', '#kontakt']] },
  { title: 'Kom i gang', links: [['Book en demo', '#kontakt'], ['Web-app', WEB_APP_URL], ['Hent til Windows', DOWNLOAD_URL]] },
  { title: 'Kontakt', links: [[CONTACT_EMAIL, `mailto:${CONTACT_EMAIL}`]] },
];

export function Footer() {
  const [email, setEmail] = useState('');
  return (
    <footer className="p-2">
      <div className="relative isolate overflow-hidden rounded-[10px] bg-mark px-5 pb-8 pt-10 text-white sm:px-8 lg:px-14">
        <AsciiField shape="rise" ink="#4a4752" opacity={0.6} mask="linear-gradient(135deg, transparent 45%, black 100%)" className="-z-10" />
        <div className="grid gap-12 lg:grid-cols-[1fr_auto]">
          <div>
            <Logo light />
            <p className="mt-6 max-w-[560px] text-[24px] font-medium leading-[1.25] tracking-[-0.025em] sm:text-[28px]">
              En AI-rådgiver til Microsoft Ads, der spørger først og tjekker efter.
            </p>
            <form
              className="mt-7 flex h-11 w-full max-w-[380px] items-center rounded-full bg-white p-1 pl-4"
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Kontakt mig om XavierOS')}&body=${encodeURIComponent(`Kontakt mig på ${email}`)}`;
              }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Din arbejdsmail"
                aria-label="Din arbejdsmail"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-subtle focus:outline-none"
              />
              <button type="submit" className="h-full rounded-full bg-ink px-6 text-[13px] font-medium text-white hover:bg-ink-2">
                Send
              </button>
            </form>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-16">
            {FOOTER.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <div className="text-[12.5px] text-white/45">{col.title}</div>
                <ul className="mt-4 grid gap-2">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <a href={href} className="text-[13.5px] text-white/85 hover:text-white">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-24 flex justify-end">
          <a href={`mailto:${CONTACT_EMAIL}`} aria-label="Skriv til os" className="text-white/80 hover:text-white">
            <Mail className="size-5" />
          </a>
        </div>
        <div className="mt-6 flex flex-col justify-between gap-2 border-t border-white/10 pt-6 text-[12px] text-white/45 sm:flex-row">
          <span>© 2026 XavierOS · Alle rettigheder forbeholdes</span>
          <span>Microsoft Advertising, Outlook, Claude, Google Ads og Meta er varemærker tilhørende deres ejere.</span>
        </div>
      </div>
    </footer>
  );
}

