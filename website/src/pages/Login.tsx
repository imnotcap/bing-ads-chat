import { Building2, Check, Loader2, Mail, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { LogoMark } from '@/components/layout/Logo';
import { PLANS, isPlanId, monthlyPrice, type PlanId } from '@/workspace/plans';
import type { PublicConfig } from '@/workspace/types';
import { hasSession } from '@site/lib/api';
import { createCompany, devSignIn, finishMicrosoftLogin, loadConfig, pendingSignup, startMicrosoftLogin, type SignInResult } from '@site/lib/auth';
import { A, navigate, useSearch } from '@site/lib/router';
import { Accent, Button, cn, ease, usd } from '@site/lib/ui';

const PLAN_KEY = 'xos_plan';

function rememberPlan(search: URLSearchParams) {
  const plan = search.get('plan');
  if (isPlanId(plan)) sessionStorage.setItem(PLAN_KEY, plan);
}

function go(result: SignInResult) {
  navigate(result.kind === 'needsCompany' ? '/opret' : result.next, { replace: true });
}

/** The Microsoft logo (four squares). */
function MicrosoftMark() {
  return (
    <svg viewBox="0 0 21 21" className="size-[18px]" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function AuthShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="relative isolate -mt-[68px] pb-20 pt-[110px] sm:pt-[130px]">
      <div aria-hidden className="bg-aurora absolute inset-x-0 top-0 -z-10 h-[700px]" />
      <div className="mx-auto grid w-full max-w-[1040px] gap-5 px-4 sm:px-6 lg:grid-cols-[1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="rounded-[32px] bg-white p-7 shadow-pop ring-1 ring-black/[0.05] sm:p-11"
        >
          {children}
        </motion.div>
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease }}
          className="bg-lavender relative hidden overflow-hidden rounded-[32px] p-10 text-white lg:block"
        >
          <div aria-hidden className="bg-dots absolute -right-10 -top-10 size-56 rounded-full opacity-40" />
          {aside ?? <DefaultAside />}
        </motion.aside>
      </div>
    </section>
  );
}

function DefaultAside() {
  return (
    <div className="relative flex h-full flex-col">
      <LogoMark className="size-11" />
      <p className="mt-auto text-[30px] font-bold leading-[1.1] tracking-[-0.03em]">Én konto til appen og hjemmesiden.</p>
      <ul className="mt-6 grid gap-3 text-[15px] font-medium text-white/85">
        {['Brug din Microsoft-arbejdskonto – ingen ny adgangskode', 'Se forbrug, abonnement og team her', 'Samme login i XavierOS-appen'].map((t) => (
          <li key={t} className="flex items-start gap-3">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/20">
              <Check className="size-3" strokeWidth={3} />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Login() {
  const search = useSearch();
  const creating = search.get('opret') === '1';
  const returning = search.has('code') || search.has('error');
  // Where to go afterwards: back into the account area, if that is where they came from.
  const nextParam = search.get('next');
  const next = nextParam?.startsWith('/konto') ? nextParam : '/konto';
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(returning);
  const handled = useRef(false);

  useEffect(() => {
    rememberPlan(search);
    loadConfig()
      .then(setConfig)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [search]);

  useEffect(() => {
    if (returning) {
      if (handled.current) return;
      handled.current = true;
      finishMicrosoftLogin(search)
        .then(go)
        .catch((e: unknown) => {
          setBusy(false);
          setError(e instanceof Error ? e.message : String(e));
          navigate('/login', { replace: true });
        });
    } else if (hasSession() && !creating) navigate(next, { replace: true });
  }, [returning, creating, search, next]);

  const microsoft = async () => {
    setBusy(true);
    setError(null);
    try {
      await startMicrosoftLogin(next);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <AuthShell>
      <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em] text-ink">
        {creating ? (
          <>
            Opret din <Accent>virksomhed</Accent>
          </>
        ) : (
          <>
            Log ind på <Accent>XavierOS</Accent>
          </>
        )}
      </h1>
      <p className="mt-3 text-[15.5px] leading-relaxed text-muted">
        {creating
          ? 'Log ind med den Microsoft-konto, du bruger på arbejdet. Bagefter vælger du navn og abonnement – og du bliver virksomhedens administrator.'
          : 'Brug den samme Microsoft-konto som i appen. Er du inviteret af en kollega, kommer du direkte ind i jeres virksomhed.'}
      </p>

      {returning && busy ? (
        <p className="mt-10 flex items-center gap-3 text-[15px] font-semibold text-ink-2">
          <Loader2 className="size-5 animate-spin text-brand" />
          Logger ind …
        </p>
      ) : (
        <>
          <Button size="lg" variant="ghost" className="mt-9 w-full" onClick={() => void microsoft()} loading={busy && !returning} disabled={!config?.clientId && !config?.devLogin}>
            <MicrosoftMark />
            Fortsæt med Microsoft
          </Button>
          {config && !config.clientId && !config.devLogin && <p className="mt-3 text-[13px] text-muted">Login er ikke sat op endnu.</p>}
          {config?.devLogin && <DevLogin next={next} onError={setError} />}
        </>
      )}

      {error && <p className="mt-5 rounded-2xl bg-negative-bg px-4 py-3 text-[14px] text-negative">{error}</p>}

      <p className="mt-8 border-t border-line pt-6 text-[14px] text-muted">
        {creating ? (
          <>
            Har I allerede XavierOS?{' '}
            <A href="/login" className="font-semibold text-ink-2 underline underline-offset-2">
              Log ind
            </A>{' '}
            – eller bed en administrator om en invitation.
          </>
        ) : (
          <>
            Ny hos XavierOS?{' '}
            <A href="/login?opret=1" className="font-semibold text-ink-2 underline underline-offset-2">
              Opret din virksomhed
            </A>
            .
          </>
        )}
      </p>
    </AuthShell>
  );
}

/** Local development: sign in with only an e-mail address. */
function DevLogin({ next, onError }: { next: string; onError: (e: string | null) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      go(await devSignIn(email, name, next));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="mt-6 grid gap-2 rounded-2xl bg-canvas p-4">
      <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-subtle">Udviklingslogin</p>
      <input className={inputClass} placeholder="e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={inputClass} placeholder="navn (valgfrit)" value={name} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" size="sm" loading={busy} className="justify-self-start">
        Log ind
      </Button>
    </form>
  );
}

export const inputClass =
  'h-11 w-full rounded-xl bg-white px-3.5 text-[15px] text-ink ring-1 ring-black/[0.1] outline-none transition-shadow placeholder:text-subtle focus:ring-2 focus:ring-brand/50';

/** After the Microsoft sign-in, for someone who isn't part of a company yet. */
export function Signup() {
  const pending = pendingSignup();
  const stored = sessionStorage.getItem(PLAN_KEY);
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<PlanId>(isPlanId(stored) ? stored : 'teams');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pending) {
    return (
      <AuthShell>
        <h1 className="text-[30px] font-bold tracking-[-0.03em] text-ink">Log ind først</h1>
        <p className="mt-3 text-[15.5px] text-muted">For at oprette en virksomhed skal vi vide, hvem du er. Log ind med Microsoft – det tager et øjeblik.</p>
        <Button size="lg" className="mt-8" onClick={() => navigate('/login?opret=1')}>
          Fortsæt til login
        </Button>
      </AuthShell>
    );
  }

  const domain = pending.email.split('@')[1] ?? '';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createCompany(name, plan);
      sessionStorage.removeItem(PLAN_KEY);
      navigate('/konto?velkommen=1', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      aside={
        <div className="relative flex h-full flex-col">
          <Building2 className="size-10" />
          <p className="mt-auto text-[28px] font-bold leading-[1.1] tracking-[-0.03em]">Inviteret af en kollega?</p>
          <p className="mt-3 text-[15px] leading-relaxed text-white/80">
            Så skal du ikke oprette en ny virksomhed. Bed jeres administrator invitere <b className="text-white">{pending.email}</b> under Konto → Team, og log ind igen.
          </p>
        </div>
      }
    >
      <p className="inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1 text-[13px] font-medium text-ink-2">
        <Mail className="size-3.5" />
        {pending.email}
      </p>
      <h1 className="mt-5 text-[32px] font-bold leading-tight tracking-[-0.03em] text-ink">
        Velkommen, <Accent>{pending.name.split(' ')[0]}</Accent>
      </h1>
      <p className="mt-3 text-[15.5px] leading-relaxed text-muted">Din Microsoft-konto er ikke tilknyttet en virksomhed endnu. Opret jeres – du bliver administrator.</p>
      <form onSubmit={(e) => void submit(e)} className="mt-8 grid gap-6">
        <label className="grid gap-2">
          <span className="text-[14px] font-semibold text-ink">Virksomhedens navn</span>
          <input className={inputClass} required minLength={2} maxLength={80} autoFocus placeholder={domain ? domain.split('.')[0]!.replace(/^./, (c) => c.toUpperCase()) : 'Firma ApS'} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[14px] font-semibold text-ink">Abonnement</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['solo', 'teams'] as const).map((id) => {
              const p = PLANS[id];
              const on = plan === id;
              return (
                <label
                  key={id}
                  className={cn('relative cursor-pointer rounded-2xl p-4 ring-1 transition-[box-shadow,background]', on ? 'bg-brand-50 ring-2 ring-brand' : 'bg-white ring-black/[0.1] hover:ring-black/[0.2]')}
                >
                  <input type="radio" name="plan" value={id} checked={on} onChange={() => setPlan(id)} className="sr-only" />
                  <span className="flex items-center gap-2 text-[15px] font-bold text-ink">
                    {id === 'teams' ? <Users className="size-4 text-brand" /> : <Building2 className="size-4 text-brand" />}
                    {p.name}
                  </span>
                  <span className="mt-1 block text-[13px] text-muted">{p.tagline}</span>
                  <span className="mt-3 block text-[14px] font-semibold text-ink-2">
                    {id === 'solo' ? `${usd(p.priceUsd)} / måned` : `${usd(p.priceUsd)} pr. medarbejder · fra ${usd(monthlyPrice('teams', 0))}`}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {error && <p className="rounded-2xl bg-negative-bg px-4 py-3 text-[14px] text-negative">{error}</p>}
        <Button type="submit" size="lg" loading={busy} disabled={name.trim().length < 2}>
          Opret virksomhed
        </Button>
        <p className="text-[13px] leading-relaxed text-muted">
          Du kan skifte abonnement og invitere kolleger bagefter. Se{' '}
          <A href="/priser" className="font-semibold text-ink-2 underline underline-offset-2">
            priserne
          </A>
          .
        </p>
      </form>
    </AuthShell>
  );
}
