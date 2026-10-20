import { CreditCard, Hourglass, LayoutGrid, Loader2, LogOut, Settings, UserRound, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { PLANS } from '@/workspace/plans';
import type { BillingState, CompanyInfo, WorkspaceUser } from '@/workspace/types';
import { api, getMe, signOut, useSignedIn } from '@site/lib/api';
import { A, navigate, usePath } from '@site/lib/router';
import { Button, cn, ease } from '@site/lib/ui';

interface AccountData {
  me: WorkspaceUser;
  company: CompanyInfo;
  billing: BillingState;
  isAdmin: boolean;
  setMe: (u: WorkspaceUser) => void;
  setCompany: (c: CompanyInfo) => void;
  setBilling: (b: BillingState) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<AccountData | null>(null);

export function useAccount(): AccountData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount outside AccountLayout');
  return v;
}

const NAV = [
  { href: '/konto', label: 'Overblik', icon: LayoutGrid },
  { href: '/konto/profil', label: 'Profil', icon: UserRound },
  { href: '/konto/abonnement', label: 'Abonnement', icon: CreditCard },
  { href: '/konto/team', label: 'Team', icon: Users },
  { href: '/konto/indstillinger', label: 'Indstillinger', icon: Settings },
];

type State = { kind: 'loading' } | { kind: 'pending'; me: WorkspaceUser } | { kind: 'error'; message: string } | { kind: 'ready'; me: WorkspaceUser; company: CompanyInfo; billing: BillingState };

/** The account area: signed-in only; loads the person, their company and the pool once. */
export function AccountLayout({ children }: { children: ReactNode }) {
  const signedIn = useSignedIn();
  const path = usePath();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const me = await getMe();
      if (me.status !== 'active') {
        setState({ kind: 'pending', me });
        return;
      }
      const [company, billing] = await Promise.all([api<CompanyInfo>('/company'), api<BillingState>('/billing')]);
      setState({ kind: 'ready', me, company, billing });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    if (!signedIn) navigate(`/login?next=${encodeURIComponent(path)}`, { replace: true });
    else void load();
    // Only when signing in or out – not on every page inside the account.
  }, [signedIn, load]);

  const leave = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  if (!signedIn || state.kind === 'loading') {
    return (
      <Shell>
        <div className="grid min-h-[50vh] place-items-center">
          <Loader2 className="size-6 animate-spin text-brand" />
        </div>
      </Shell>
    );
  }
  if (state.kind === 'error') {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-[28px] bg-white p-8 text-center shadow-card ring-1 ring-black/[0.05]">
          <p className="text-[16px] font-bold text-ink">Kontoen kunne ikke hentes</p>
          <p className="mt-2 text-[14px] text-muted">{state.message}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button size="sm" onClick={() => void load()}>
              Prøv igen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void leave()}>
              Log ud
            </Button>
          </div>
        </div>
      </Shell>
    );
  }
  if (state.kind === 'pending') {
    return (
      <Shell>
        <div className="mx-auto max-w-lg rounded-[28px] bg-white p-10 text-center shadow-card ring-1 ring-black/[0.05]">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-warning-bg text-warning">
            <Hourglass className="size-6" />
          </span>
          <p className="mt-5 text-[22px] font-bold tracking-[-0.02em] text-ink">Venter på adgang</p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Du er logget ind som {state.me.email}, men en administrator i virksomheden skal give dig adgang først. Prøv igen, når de har gjort det.
          </p>
          <div className="mt-7 flex justify-center gap-2">
            <Button size="sm" onClick={() => void load()}>
              Tjek igen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void leave()}>
              Log ud
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  const value: AccountData = {
    me: state.me,
    company: state.company,
    billing: state.billing,
    isAdmin: state.me.role === 'admin',
    setMe: (me) => setState((s) => (s.kind === 'ready' ? { ...s, me } : s)),
    setCompany: (company) => setState((s) => (s.kind === 'ready' ? { ...s, company } : s)),
    setBilling: (billing) => setState((s) => (s.kind === 'ready' ? { ...s, billing } : s)),
    reload: load,
  };

  return (
    <Ctx.Provider value={value}>
      <Shell>
        <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[26px] bg-white p-3 shadow-card ring-1 ring-black/[0.05]">
              <div className="flex items-center gap-3 px-3 pb-4 pt-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-[15px] font-bold text-white">{state.company.name.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold text-ink">{state.company.name}</span>
                  <span className="block text-[12.5px] font-medium text-muted">
                    {PLANS[state.company.plan].name} · {state.billing.people} {state.billing.people === 1 ? 'person' : 'personer'}
                  </span>
                </span>
              </div>
              <nav aria-label="Konto" className="flex gap-1 overflow-x-auto lg:grid">
                {NAV.map((n) => {
                  const on = path === n.href;
                  return (
                    <A
                      key={n.href}
                      href={n.href}
                      className={cn(
                        'relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition-colors',
                        on ? 'text-ink' : 'text-ink-2 hover:bg-black/[0.035]',
                      )}
                    >
                      {on && <motion.span layoutId="account-nav" className="absolute inset-0 rounded-xl bg-brand-50" transition={{ duration: 0.3, ease }} />}
                      <n.icon className={cn('relative size-[18px]', on ? 'text-brand' : 'text-muted')} />
                      <span className="relative">{n.label}</span>
                    </A>
                  );
                })}
                <button
                  type="button"
                  onClick={() => void leave()}
                  className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold text-ink-2 transition-colors hover:bg-black/[0.035] lg:mt-2 lg:border-t lg:border-line lg:pt-3"
                >
                  <LogOut className="size-[18px] text-muted" />
                  Log ud
                </button>
              </nav>
            </div>
          </aside>
          <motion.main key={path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="min-w-0">
            {children}
          </motion.main>
        </div>
      </Shell>
    </Ctx.Provider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <section className="relative isolate -mt-[68px] pb-20 pt-[100px] sm:pt-[110px]">
      <div aria-hidden className="bg-aurora absolute inset-x-0 top-0 -z-10 h-[520px] opacity-70" />
      <div className="mx-auto w-full max-w-[1160px] px-4 sm:px-6">{children}</div>
    </section>
  );
}

/** A titled white panel inside the account area. */
export function Panel({ title, description, action, children, className }: { title?: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[26px] bg-white p-6 shadow-card ring-1 ring-black/[0.05] sm:p-7', className)}>
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[17px] font-bold text-ink">{title}</h2>}
            {description && <p className="mt-1 text-[14px] leading-relaxed text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageTitle({ title, lead }: { title: ReactNode; lead?: ReactNode }) {
  return (
    <div className="mb-6 px-1">
      <h1 className="text-[30px] font-bold tracking-[-0.03em] text-ink sm:text-[34px]">{title}</h1>
      {lead && <p className="mt-1.5 text-[15px] text-muted">{lead}</p>}
    </div>
  );
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'ok'; children: ReactNode }) {
  return <p className={cn('rounded-2xl px-4 py-3 text-[14px]', tone === 'error' ? 'bg-negative-bg text-negative' : 'bg-positive-bg text-positive')}>{children}</p>;
}

export const fmtDate = (t: number) => new Date(t).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
export const monthName = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
