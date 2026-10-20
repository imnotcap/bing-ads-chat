import { Globe, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { CompanyInfo } from '@/workspace/types';
import { api } from '@site/lib/api';
import { Button, cn } from '@site/lib/ui';
import { inputClass } from '../Login';
import { Notice, PageTitle, Panel, fmtDate, useAccount } from './AccountLayout';

export function Settings() {
  const { company, isAdmin, setCompany, me } = useAccount();
  const [name, setName] = useState(company.name);
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState<'name' | 'domains' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const save = async (what: 'name' | 'domains', body: Partial<Pick<CompanyInfo, 'name' | 'domains'>>, ok: string) => {
    setBusy(what);
    setMsg(null);
    try {
      const next = await api<CompanyInfo>('/company', { method: 'PATCH', body: JSON.stringify(body) });
      setCompany(next);
      setName(next.name);
      setMsg({ tone: 'ok', text: ok });
      return true;
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addDomain = async (e: FormEvent) => {
    e.preventDefault();
    const d = domain.trim().toLowerCase().replace(/^@/, '');
    if (!d) return;
    if (await save('domains', { domains: [...company.domains, d] }, `Alle med en @${d}-mail kan nu logge ind uden invitation.`)) setDomain('');
  };

  const own = me.email.split('@')[1] ?? '';

  return (
    <>
      <PageTitle title="Indstillinger" lead={isAdmin ? 'Virksomhedens navn og hvem der kan komme ind.' : 'Kun administratorer kan ændre indstillingerne.'} />
      <div className="grid gap-5">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <Panel title="Virksomhed">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save('name', { name }, 'Navnet er gemt.');
            }}
            className="grid max-w-lg gap-4"
          >
            <label className="grid gap-2">
              <span className="text-[14px] font-semibold text-ink">Navn</span>
              <input className={cn(inputClass, !isAdmin && 'bg-canvas text-muted')} value={name} onChange={(e) => setName(e.target.value)} readOnly={!isAdmin} maxLength={80} />
            </label>
            {isAdmin && (
              <Button type="submit" loading={busy === 'name'} disabled={name.trim() === company.name || name.trim().length < 2} className="justify-self-start">
                Gem navn
              </Button>
            )}
          </form>
          <p className="mt-5 text-[13px] text-muted">Oprettet {fmtDate(company.createdAt)}.</p>
        </Panel>

        <Panel
          title="Firmadomæner"
          description="Alle med en arbejdsmail på et af jeres domæner kommer ind i virksomheden, når de logger ind – uden invitation. Offentlige mailtjenester som gmail.com kan ikke bruges."
        >
          {company.plan === 'solo' ? (
            <p className="text-[14px] text-muted">Firmadomæner kræver Teams – Solo er til én person.</p>
          ) : company.domains.length ? (
            <ul className="flex flex-wrap gap-2">
              {company.domains.map((d) => (
                <li key={d} className="inline-flex items-center gap-2 rounded-full bg-canvas py-1.5 pl-3 pr-1.5 text-[14px] font-semibold text-ink-2">
                  <Globe className="size-3.5 text-brand" />
                  {d}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void save('domains', { domains: company.domains.filter((x) => x !== d) }, `${d} er fjernet.`)}
                      className="grid size-6 place-items-center rounded-full text-muted hover:bg-white hover:text-ink"
                      aria-label={`Fjern ${d}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">Ingen domæner – kolleger skal inviteres under Team.</p>
          )}
          {isAdmin && company.plan === 'teams' && (
            <form onSubmit={(e) => void addDomain(e)} className="mt-5 flex max-w-lg flex-wrap gap-2">
              <input className={cn(inputClass, 'min-w-[200px] flex-1')} placeholder={own || 'firma.dk'} value={domain} onChange={(e) => setDomain(e.target.value)} />
              <Button type="submit" loading={busy === 'domains'} className="h-11" variant="ghost">
                <Plus className="size-4" />
                Tilføj domæne
              </Button>
            </form>
          )}
        </Panel>

        <Panel title="I appen" description="Forbindelsen til Microsoft Advertising, AI-nøgler, budgetgrænser og playbooks styres i XavierOS-appen under Indstillinger, så de altid gælder for hele teamet.">
          <p className="text-[13.5px] text-muted">Åbn XavierOS og gå til Indstillinger.</p>
        </Panel>
      </div>
    </>
  );
}
