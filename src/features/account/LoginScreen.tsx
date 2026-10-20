/**
 * Shown until someone is signed in (and let in): "Log ind med Microsoft" gives an
 * account in the department's workspace and access to your own Outlook calendar.
 * People an admin hasn't let in yet see a waiting screen.
 */
import { motion } from 'motion/react';
import { CalendarDays, Clock, Loader2, LogOut, RefreshCw, UserRound, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BlurText } from '@/components/reactbits';
import { EASE } from '@/components/motion';
import { LogoMark, Wordmark } from '@/components/layout/Logo';
import { WindowControls } from '@/components/layout/TopBar';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { MicrosoftLogo } from '@/features/settings/SignInDialog';
import { isTauri } from '@/lib/platform';
import { errorMessage } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { createCompany, devSignIn, restoreSession, signIn, signOut } from '@/workspace/account';
import { PLANS, type PlanId } from '@/workspace/plans';
import { SITE_URL } from '@/workspace/api';
import { openExternal } from '@/lib/platform';
import { loadConfig } from '@/workspace/api';

const ACCESS = [
  { icon: UserRound, title: 'Din konto i appen', text: 'Dit navn og din e-mail, så kollegerne kan se, hvem der gør hvad.' },
  { icon: CalendarDays, title: 'Din Outlook: kalender og mail til dig selv', text: 'Kun til påmindelser, begivenheder og opfølgningsmails, du selv opretter fra appen – mails sendes kun til dig.' },
  { icon: Users, title: 'Fælles for afdelingen', text: 'Annoncekonti, AI-nøgler og planlægning deles af alle – de forbindes én gang.' },
];

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-canvas">
      <header data-tauri-drag-region className="flex h-10 shrink-0 select-none items-center gap-2 pl-3">
        <LogoMark className="pointer-events-none size-[22px]" />
        <span data-tauri-drag-region className="text-[13px]">
          <Wordmark />
        </span>
        <div data-tauri-drag-region className="h-full flex-1" />
        {isTauri && <WindowControls />}
      </header>
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0"
          style={{ background: 'radial-gradient(700px 420px at 100% 0%, rgb(139 123 255 / 0.18), transparent 70%), radial-gradient(600px 380px at 0% 100%, rgb(109 92 246 / 0.07), transparent 70%)' }}
        />
        <div className="flex min-h-full items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="relative w-full max-w-[460px] rounded-3xl border border-line bg-white p-8 shadow-pop"
        >
          {children}
        </motion.div>
        </div>
      </div>
    </div>
  );
}

function DevLogin() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-3 rounded-2xl border border-dashed border-line p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await devSignIn(email, name);
        } catch (err) {
          toast.error('Test-login mislykkedes', { description: errorMessage(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="text-[12.5px] font-semibold text-muted">Test-login (kun lokal udvikling)</div>
      <Field label="E-mail" htmlFor="dev-email">
        <Input id="dev-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="navn@inventarland.dk" />
      </Field>
      <Field label="Navn" htmlFor="dev-name">
        <Input id="dev-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx Jonas Hansen" />
      </Field>
      <Button type="submit" variant="secondary" disabled={busy || !email.includes('@')}>
        {busy && <Loader2 className="animate-spin" />} Log ind
      </Button>
    </form>
  );
}

function SignInView() {
  const reason = useAccount((s) => s.reason);
  const [busy, setBusy] = useState(false);
  const [devLogin, setDevLogin] = useState(false);
  useEffect(() => {
    if (!isTauri) void loadConfig().then((c) => setDevLogin(c.devLogin), () => {});
  }, []);

  return (
    <Frame>
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-3" aria-label="XavierOS">
          <LogoMark className="size-14" />
          <Wordmark className="text-[38px] leading-none" />
        </div>
        <BlurText as="h1" text="Log ind" className="mt-5 text-[22px] font-medium tracking-[-0.03em] text-ink" />
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">Brug din Microsoft-konto. Appen ser aldrig din adgangskode.</p>
      </div>
      {reason && <p className="mt-5 rounded-xl bg-warning-bg px-3.5 py-2.5 text-[12.5px] text-warning">{reason}</p>}
      {isTauri ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const user = await signIn();
              if (user?.status === 'active') toast.success(`Velkommen, ${user.name}`);
            } catch (e) {
              toast.error('Login mislykkedes', { description: errorMessage(e), duration: 12_000 });
            } finally {
              setBusy(false);
            }
          }}
          className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-white text-[15px] font-semibold text-ink shadow-sm transition-[border-color,box-shadow] hover:border-black/15 hover:shadow-pop disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-5 animate-spin text-muted" /> : <MicrosoftLogo className="size-5" />}
          {busy ? 'Fuldfør login i browservinduet …' : 'Log ind med Microsoft'}
        </button>
      ) : (
        <p className="mt-6 rounded-xl bg-line-2 px-3.5 py-2.5 text-[12.5px] text-muted">Login med Microsoft virker i desktop-appen.</p>
      )}
      {!isTauri && devLogin && (
        <div className="mt-4">
          <DevLogin />
        </div>
      )}
      <div className="mt-6 grid gap-3 border-t border-line pt-5">
        <div className="text-[12px] font-semibold text-muted">Det giver appen adgang til</div>
        {ACCESS.map((a) => (
          <div key={a.title} className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand">
              <a.icon className="size-4" />
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-ink">{a.title}</span>
              <span className="block text-[12.5px] leading-relaxed text-muted">{a.text}</span>
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Signed in with Microsoft, but no company yet: create one here, or ask for an invitation. */
function NeedsCompanyView() {
  const who = useAccount((s) => s.needsCompany);
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<PlanId>('teams');
  const [busy, setBusy] = useState(false);
  return (
    <Frame>
      <div className="flex flex-col items-center text-center">
        <LogoMark className="size-12" />
        <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-ink">Opret din virksomhed</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
          <b className="text-ink">{who?.email}</b> hører ikke til en virksomhed i XavierOS endnu. Opret virksomheden – du bliver administrator og kan invitere dine kolleger.
        </p>
      </div>
      <form
        className="mt-6 grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const user = await createCompany(name, plan);
            toast.success(`Velkommen, ${user.name}`, { description: `${name.trim()} er oprettet.` });
          } catch (err) {
            toast.error('Virksomheden blev ikke oprettet', { description: errorMessage(err) });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Virksomhedens navn" htmlFor="company-name">
          <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx Inventarland ApS" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Abonnement">
          {(Object.values(PLANS) as (typeof PLANS)[PlanId][]).map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={plan === p.id}
              onClick={() => setPlan(p.id)}
              className={`rounded-xl border p-3 text-left transition-colors ${plan === p.id ? 'border-brand bg-brand-50/60 ring-2 ring-brand/15' : 'border-line hover:border-black/15'}`}
            >
              <div className="text-[14px] font-semibold text-ink">{p.name}</div>
              <div className="text-[12.5px] text-muted">
                ${p.priceUsd} {p.maxSeats > 1 ? 'pr. medarbejder' : ''}/md.
              </div>
              <div className="mt-1 text-[12px] leading-snug text-subtle">{p.tagline}</div>
            </button>
          ))}
        </div>
        <Button type="submit" variant="gradient" disabled={busy || name.trim().length < 2}>
          {busy && <Loader2 className="animate-spin" />} Opret virksomhed
        </Button>
      </form>
      <div className="mt-5 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
        Arbejder du i en virksomhed, der allerede bruger XavierOS? Bed en administrator om at invitere <b>{who?.email}</b>, og log ind igen.
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void openExternal(`${SITE_URL}/priser`)}>
            Se priser
          </Button>
          <Button size="sm" variant="ghost" onClick={() => useAccount.getState().signedOut()}>
            <LogOut /> Tilbage
          </Button>
        </div>
      </div>
    </Frame>
  );
}

function PendingView() {
  const user = useAccount((s) => s.user);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setInterval(() => void restoreSession(), 20_000);
    return () => clearInterval(t);
  }, []);
  return (
    <Frame>
      <div className="flex flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand">
          <Clock className="size-6" />
        </span>
        <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-ink">Venter på adgang</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
          Du er logget ind som <b className="text-ink">{user?.name}</b> ({user?.email}). En administrator skal give dig adgang under Indstillinger → Brugere. Appen
          åbner af sig selv, når det er sket.
        </p>
      </div>
      <div className="mt-6 flex justify-center gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await restoreSession();
            setBusy(false);
          }}
        >
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Tjek igen
        </Button>
        <Button variant="ghost" onClick={() => void signOut()}>
          <LogOut /> Log ud
        </Button>
      </div>
    </Frame>
  );
}

export function AccountGate() {
  const status = useAccount((s) => s.status);
  if (status === 'signedOut') return <SignInView />;
  if (status === 'needsCompany') return <NeedsCompanyView />;
  if (status === 'pending') return <PendingView />;
  if (status === 'loading')
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-canvas">
        <LogoMark className="size-14 animate-pulse" />
      </div>
    );
  return null;
}
