import { A } from '@site/lib/router';
import { Container } from '@site/lib/ui';
import { Logo } from './Header';

const COLUMNS = [
  {
    title: 'Produkt',
    links: [
      { label: 'Funktioner', href: '/#funktioner' },
      { label: 'Priser', href: '/priser' },
      { label: 'Download til Windows', href: '/download' },
    ],
  },
  {
    title: 'Konto',
    links: [
      { label: 'Log ind', href: '/login' },
      { label: 'Opret virksomhed', href: '/login?opret=1' },
      { label: 'Abonnement', href: '/konto/abonnement' },
      { label: 'Team', href: '/konto/team' },
    ],
  },
  {
    title: 'Hjælp',
    links: [
      { label: 'Spørgsmål og svar', href: '/#faq' },
      { label: 'Sådan virker det', href: '/#saadan' },
      { label: 'Sikkerhed og godkendelse', href: '/#sikkerhed' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-[1200px] rounded-[32px] bg-white py-14 shadow-card ring-1 ring-black/[0.05]">
        <Container className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14.5px] leading-relaxed text-muted">
              Din danske AI-rådgiver til Microsoft Advertising. Den analyserer, foreslår og forklarer – du godkender.
            </p>
          </div>
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-subtle">{c.title}</p>
              <ul className="mt-4 grid gap-2.5">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <A href={l.href} className="text-[14.5px] font-medium text-ink-2 transition-colors hover:text-brand-600">
                      {l.label}
                    </A>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Container>
        <Container className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[13px] text-muted">
          <span>© {new Date().getFullYear()} XavierOS. Alle priser er i USD ekskl. moms.</span>
          <span>Microsoft Advertising er et varemærke tilhørende Microsoft. XavierOS er ikke tilknyttet Microsoft.</span>
        </Container>
      </div>
    </footer>
  );
}
