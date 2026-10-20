import { MailPlus, Trash2, UserCheck, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PLANS } from '@/workspace/plans';
import type { BillingState, Invitation, Role, WorkspaceUser } from '@/workspace/types';
import { api } from '@site/lib/api';
import { A } from '@site/lib/router';
import { Button, cn, usd } from '@site/lib/ui';
import { inputClass } from '../Login';
import { Notice, PageTitle, Panel, fmtDate, useAccount } from './AccountLayout';

export function Team() {
  const { me, company, billing, isAdmin, setBilling } = useAccount();
  const [users, setUsers] = useState<WorkspaceUser[] | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const plan = PLANS[company.plan];

  const refreshBilling = useCallback(() => api<BillingState>('/billing').then(setBilling).catch(() => {}), [setBilling]);

  useEffect(() => {
    api<{ users: WorkspaceUser[] }>('/users')
      .then((r) => setUsers(r.users))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    if (isAdmin)
      api<{ invites: Invitation[] }>('/team/invites')
        .then((r) => setInvites(r.invites))
        .catch(() => {});
  }, [isAdmin]);

  const change = async (run: () => Promise<{ users: WorkspaceUser[] }>) => {
    setError(null);
    try {
      setUsers((await run()).users);
      void refreshBilling();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const patch = (id: string, body: { role?: Role; status?: WorkspaceUser['status'] }) =>
    change(() => api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }));
  const remove = (u: WorkspaceUser) => {
    if (!window.confirm(`Fjern ${u.name} fra ${company.name}? De kan kun komme ind igen med en ny invitation.`)) return;
    void change(() => api(`/users/${u.id}`, { method: 'DELETE' }));
  };

  const active = users?.filter((u) => u.status === 'active').length ?? billing.people;
  const pending = users?.filter((u) => u.status === 'pending') ?? [];

  return (
    <>
      <PageTitle
        title="Team"
        lead={
          company.plan === 'teams'
            ? `${active} ${active === 1 ? 'person' : 'personer'} · ${usd(plan.priceUsd)} pr. plads · hver plads lægger ${usd(plan.includedUsd)} i puljen`
            : 'Solo er til én person. Skift til Teams for at invitere kolleger.'
        }
      />
      <div className="grid gap-5">
        {isAdmin && (company.plan === 'teams' ? <InviteForm onInvited={setInvites} /> : <UpgradeHint />)}
        {error && <Notice>{error}</Notice>}

        {isAdmin && pending.length > 0 && (
          <Panel title="Venter på adgang" description="Har logget ind, men skal godkendes, før de kan bruge XavierOS.">
            <ul className="grid gap-2">
              {pending.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-bg/60 px-4 py-3">
                  <Person u={u} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void patch(u.id, { status: 'active' })}>
                      <UserCheck className="size-4" />
                      Giv adgang
                    </Button>
                    <Button size="sm" variant="quiet" onClick={() => remove(u)}>
                      Afvis
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="Medarbejdere">
          {!users ? (
            <p className="text-[14px] text-muted">Henter …</p>
          ) : (
            <ul className="divide-y divide-line-2">
              {users
                .filter((u) => u.status === 'active')
                .map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                    <Person u={u} you={u.id === me.id} />
                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={u.role}
                          onChange={(e) => void patch(u.id, { role: e.target.value as Role })}
                          className="h-9 rounded-xl bg-white px-3 text-[13.5px] font-semibold text-ink-2 ring-1 ring-black/[0.1] outline-none focus:ring-2 focus:ring-brand/50"
                          aria-label={`Rolle for ${u.name}`}
                        >
                          <option value="member">Medarbejder</option>
                          <option value="admin">Administrator</option>
                        </select>
                        {u.id !== me.id && (
                          <button type="button" onClick={() => remove(u)} className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-negative-bg hover:text-negative" aria-label={`Fjern ${u.name}`}>
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[13px] font-semibold text-muted">{u.role === 'admin' ? 'Administrator' : 'Medarbejder'}</span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </Panel>

        {isAdmin && invites.length > 0 && (
          <Panel title="Inviteret" description="Kommer ind, så snart de logger ind med Microsoft på denne e-mail.">
            <ul className="divide-y divide-line-2">
              {invites.map((i) => (
                <li key={i.email} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{i.email}</span>
                    <span className="block text-[12.5px] text-muted">
                      {i.role === 'admin' ? 'Administrator' : 'Medarbejder'} · inviteret af {i.invitedBy} {fmtDate(i.at)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void api<{ invites: Invitation[] }>('/team/invites', { method: 'DELETE', body: JSON.stringify({ email: i.email }) }).then((r) => setInvites(r.invites))
                    }
                    className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-black/[0.04] hover:text-ink"
                    aria-label={`Træk invitationen til ${i.email} tilbage`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}

function Person({ u, you }: { u: WorkspaceUser; you?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-full text-[14px] font-bold', u.role === 'admin' ? 'bg-ink text-white' : 'bg-brand-50 text-brand-600')}>
        {u.name
          .split(' ')
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] font-semibold text-ink">
          {u.name}
          {you && <span className="ml-1.5 text-[12.5px] font-medium text-muted">(dig)</span>}
        </span>
        <span className="block truncate text-[12.5px] text-muted">{u.email}</span>
      </span>
    </span>
  );
}

function InviteForm({ onInvited }: { onInvited: (i: Invitation[]) => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      onInvited((await api<{ invites: Invitation[] }>('/team/invites', { method: 'POST', body: JSON.stringify({ email, role }) })).invites);
      setMsg({ tone: 'ok', text: `${email} er inviteret. Send dem et link til ${location.origin}/download – de logger ind med Microsoft.` });
      setEmail('');
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Invitér en kollega" description="De kommer ind i virksomheden, når de logger ind med Microsoft på den e-mail. Prisen følger antallet af personer.">
      <form onSubmit={(e) => void submit(e)} className="flex flex-wrap gap-2">
        <input type="email" required placeholder="navn@firma.dk" value={email} onChange={(e) => setEmail(e.target.value)} className={cn(inputClass, 'min-w-[220px] flex-1')} />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={cn(inputClass, 'w-auto pr-8 font-semibold')} aria-label="Rolle">
          <option value="member">Medarbejder</option>
          <option value="admin">Administrator</option>
        </select>
        <Button type="submit" loading={busy} className="h-11">
          <MailPlus className="size-4" />
          Invitér
        </Button>
      </form>
      {msg && (
        <div className="mt-4">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
    </Panel>
  );
}

function UpgradeHint() {
  return (
    <div className="bg-lavender flex flex-wrap items-center justify-between gap-4 rounded-[26px] p-6 text-white">
      <div>
        <p className="text-[17px] font-bold">Vil du have kollegerne med?</p>
        <p className="mt-1 text-[14px] text-white/80">
          Med Teams får hver medarbejder sit eget login, og alle deler én pulje af AI-forbrug. {usd(PLANS.teams.priceUsd)} pr. plads.
        </p>
      </div>
      <A href="/konto/abonnement#plan" className="inline-flex h-10 items-center rounded-full bg-white px-5 text-[14px] font-semibold text-ink shadow-card">
        Skift til Teams
      </A>
    </div>
  );
}
