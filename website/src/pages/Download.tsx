import { Download as DownloadIcon, Monitor, RefreshCw, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { AppFrame, Clip } from '@site/components/AppFrame';
import { A } from '@site/lib/router';
import { Accent, ButtonLink, Container, Eyebrow, ease } from '@site/lib/ui';

interface VersionInfo {
  version: string;
  date: string;
  notes?: string;
  sizeMb?: string;
}

const STEPS = [
  <>
    Åbn den hentede fil <b>XavierOS-Setup.exe</b> og klik <b>Installér</b>. Der kræves ikke administratorrettigheder.
  </>,
  <>
    Viser Windows <b>"Windows beskyttede din pc"</b>, så klik <b>Flere oplysninger</b> → <b>Kør alligevel</b>.
  </>,
  <>Start XavierOS fra Start-menuen og log ind med Microsoft. Har du en ældre version, installeres den nye ovenpå – samtaler og nøgler bevares.</>,
  <>Herefter opdaterer appen sig selv – du får besked i appen, når en ny version er klar.</>,
];

/** The installer and the newest version (version.json is written by scripts/publish.mjs). */
export function Download() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const windows = /Windows/.test(navigator.userAgent);
  useEffect(() => {
    fetch('/version.json', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<VersionInfo>) : null))
      .then(setInfo)
      .catch(() => {});
  }, []);
  const date = info ? new Date(info.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <section className="relative isolate -mt-[68px] pb-24 pt-[128px] sm:pt-[150px]">
      <div aria-hidden className="bg-aurora absolute inset-x-0 top-0 -z-10 h-[620px]" />
      <Container className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>
          <Eyebrow>Download</Eyebrow>
          <h1 className="mt-4 text-balance text-[40px] font-bold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[56px]">
            XavierOS <Accent>til Windows</Accent>
          </h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted">
            Chat med en AI-rådgiver, der analyserer og styrer din Microsoft Advertising-konto – med budgetgrænser og godkendelse af alle ændringer.
          </p>
          {info && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-medium text-ink-2 shadow-card ring-1 ring-black/[0.04]">
              <span className="size-2 animate-pulse-dot rounded-full bg-positive" />
              Version {info.version} · {date}
              {info.sizeMb ? ` · ${info.sizeMb} MB` : ''}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/XavierOS-Setup.exe" download size="lg">
              <DownloadIcon className="size-5" />
              Hent til Windows
            </ButtonLink>
            <ButtonLink href="/login?opret=1" size="lg" variant="ghost" arrow>
              Opret virksomhed først
            </ButtonLink>
          </div>
          <p className="mt-4 text-[13px] text-muted">
            Virker installationen ikke?{' '}
            <A href="/XavierOS-Setup-klassisk.exe" download className="font-semibold text-ink-2 underline underline-offset-2">
              Hent den klassiske installer
            </A>
            .
          </p>
          {!windows && (
            <p className="mt-6 rounded-2xl bg-brand-50 px-4 py-3 text-[14px] leading-relaxed text-brand-600">
              XavierOS er en computer-app til Windows. Åbn denne side på din pc for at installere den. Abonnement og team kan du styre herfra under{' '}
              <A href="/konto" className="font-semibold underline">
                Min konto
              </A>
              .
            </p>
          )}

          <ol className="mt-10 grid gap-4">
            {STEPS.map((s, i) => (
              <li key={i} className="grid grid-cols-[32px_1fr] gap-3 text-[15px] leading-relaxed text-ink-2 [&_b]:text-ink">
                <span className="grid size-8 place-items-center rounded-full bg-brand-50 text-[14px] font-bold text-brand-600">{i + 1}</span>
                <span className="pt-1">{s}</span>
              </li>
            ))}
          </ol>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease }} className="grid gap-5">
          <AppFrame>
            <Clip name="hero" label="XavierOS på Windows" />
          </AppFrame>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: Monitor, title: 'Windows 10 og 11', text: '64-bit. WebView2 hentes automatisk.' },
              { icon: RefreshCw, title: 'Opdaterer sig selv', text: 'Nye versioner kommer i appen.' },
              { icon: ShieldCheck, title: 'Signerede opdateringer', text: 'Hver opdatering er signeret.' },
            ].map((c) => (
              <div key={c.title} className="rounded-[20px] bg-white p-5 shadow-card ring-1 ring-black/[0.05]">
                <c.icon className="size-5 text-brand" />
                <p className="mt-3 text-[14.5px] font-bold text-ink">{c.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{c.text}</p>
              </div>
            ))}
          </div>
          {info?.notes && (
            <div className="rounded-[20px] bg-white p-5 shadow-card ring-1 ring-black/[0.05]">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-subtle">Nyt i {info.version}</p>
              <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{info.notes}</p>
            </div>
          )}
        </motion.div>
      </Container>
    </section>
  );
}
