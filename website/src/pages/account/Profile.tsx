import { useState, type FormEvent } from 'react';
import type { WorkspaceUser } from '@/workspace/types';
import { api, signOut } from '@site/lib/api';
import { navigate } from '@site/lib/router';
import { Button } from '@site/lib/ui';
import { inputClass } from '../Login';
import { Notice, PageTitle, Panel, fmtDate, useAccount } from './AccountLayout';

export function Profile() {
  const { me, setMe, company } = useAccount();
  const [name, setName] = useState(me.name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { user } = await api<{ user: WorkspaceUser }>('/me', { method: 'PATCH', body: JSON.stringify({ name }) });
      setMe(user);
      setName(user.name);
      setMsg({ tone: 'ok', text: 'Dit navn er gemt. Kollegerne ser det i appen.' });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Profil" lead="Sådan ser dine kolleger dig i XavierOS." />
      <div className="grid gap-5">
        <Panel title="Dine oplysninger">
          <form onSubmit={(e) => void save(e)} className="grid max-w-lg gap-5">
            <label className="grid gap-2">
              <span className="text-[14px] font-semibold text-ink">Navn</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </label>
            <label className="grid gap-2">
              <span className="text-[14px] font-semibold text-ink">E-mail</span>
              <input className={`${inputClass} bg-canvas text-muted`} value={me.email} readOnly />
              <span className="text-[12.5px] text-muted">Kommer fra din Microsoft-konto og kan ikke ændres her.</span>
            </label>
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <Button type="submit" loading={busy} disabled={name.trim() === me.name || name.trim().length < 2} className="justify-self-start">
              Gem
            </Button>
          </form>
        </Panel>
        <Panel title="Konto">
          <dl className="grid gap-4 text-[14.5px] sm:grid-cols-3">
            <div>
              <dt className="text-muted">Virksomhed</dt>
              <dd className="mt-0.5 font-semibold text-ink">{company.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Rolle</dt>
              <dd className="mt-0.5 font-semibold text-ink">{me.role === 'admin' ? 'Administrator' : 'Medarbejder'}</dd>
            </div>
            <div>
              <dt className="text-muted">Med siden</dt>
              <dd className="mt-0.5 font-semibold text-ink">{fmtDate(me.createdAt)}</dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-line pt-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void signOut().then(() => {
                  navigate('/', { replace: true });
                })
              }
            >
              Log ud på denne browser
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
