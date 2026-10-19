/**
 * Indstillinger → Forbindelser, laid out like Claude's connector list: one compact
 * card per source (logo, name, one line), connected ones first. Clicking a card
 * opens its setup in a dialog, so the page never becomes one long form.
 */
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, Loader2, LogIn, Plus, Search, Settings2, Unplug, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Dialog } from '@/components/ui/overlays';
import { fmtRelative } from '@/lib/format';
import { openExternal } from '@/lib/platform';
import { cn, errorMessage } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { CONNECTORS, CONNECTOR_GROUPS, type ConnectorDef, type ConnectorGroup, type ConnectorStatus, type ConnectorSummary } from '@/workspace/connectors';
import { completeSourceLogin, disconnectSource, loadSources, saveSource, startSourceLogin, testSource, useSources } from '@/workspace/sources';
import { ConnectorLogo, type LogoId } from './ConnectorLogo';
import { AdsConnectionForm, ClaudeKeyForm, InventarlandForm, MicrosoftSetupGuide, SharedBy } from './forms';

type Group = ConnectorGroup | 'ai';
const GROUPS: { id: Group; label: string }[] = [{ id: 'ai', label: 'AI' }, ...(Object.entries(CONNECTOR_GROUPS) as [ConnectorGroup, string][]).map(([id, label]) => ({ id, label }))];

/** The three connections that have their own forms (shared from before). */
type BuiltinId = 'claude' | 'microsoft_ads' | 'inventarland';

interface Item {
  id: LogoId;
  name: string;
  description: string;
  vendor: string;
  group: Group;
  status: ConnectorStatus;
  /** The account it reached, or what is wrong. */
  detail: string | null;
  builtin?: BuiltinId;
  def?: ConnectorDef;
}

function useItems(): Item[] {
  const ws = useAccount((s) => s.workspace);
  const list = useSources((s) => s.list);
  return useMemo(() => {
    const ads = ws?.ads;
    const inv = ws?.inventarland;
    const builtins: Item[] = [
      {
        id: 'claude',
        builtin: 'claude',
        name: 'Claude',
        description: 'AI-assistenten i chatten',
        vendor: 'Anthropic',
        group: 'ai',
        status: ws?.keys.anthropic ? 'connected' : 'not_connected',
        detail: ws?.keys.anthropic ? `Nøgle …${ws.keys.anthropic.hint}` : null,
      },
      {
        id: 'microsoft_ads',
        builtin: 'microsoft_ads',
        name: 'Microsoft Advertising',
        description: 'Bing-kampagner – læs og ændr via chatten',
        vendor: 'Microsoft',
        group: 'ads',
        status: ads?.connected ? (ads.error ? 'needs_login' : 'connected') : 'not_connected',
        detail: ads?.connected ? (ads.error ?? (ads.accountName ? `Via ${ads.accountName}` : null)) : null,
      },
      {
        id: 'inventarland',
        builtin: 'inventarland',
        name: 'Inventarland',
        description: 'Webshop-salg og alle kanaler fra Inventarland Dashboard',
        vendor: 'Inventarland',
        group: 'shop',
        status: inv?.connected ? (inv.error ? 'error' : 'connected') : 'not_connected',
        detail: inv?.connected ? (inv.error ?? inv.email) : null,
      },
    ];
    const sources: Item[] = CONNECTORS.map((def) => {
      const s = list?.find((c) => c.id === def.id);
      return {
        id: def.id,
        def,
        name: def.name,
        description: def.description,
        vendor: def.vendor,
        group: def.group,
        status: s?.status ?? 'not_connected',
        detail: s ? (s.status === 'connected' ? s.accountLabel : s.lastError) : null,
      };
    });
    return [...builtins, ...sources];
  }, [ws, list]);
}

function StatusMark({ status }: { status: ConnectorStatus }) {
  if (status === 'connected') return <CheckCircle2 className="size-3.5 shrink-0 text-positive" aria-label="Forbundet" />;
  if (status === 'error' || status === 'needs_login') return <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-label="Kræver handling" />;
  return null;
}

function ConnectorCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const connected = item.status !== 'not_connected';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 items-center gap-3.5 rounded-2xl border border-line bg-white p-3.5 text-left transition-[border-color,box-shadow] hover:border-black/10 hover:shadow-[0_2px_10px_-4px_rgb(18_18_22/0.12)]"
    >
      <ConnectorLogo id={item.id} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-ink">{item.name}</span>
          <StatusMark status={item.status} />
        </span>
        <span className="block truncate text-[12.5px] text-muted">{item.description}</span>
        <span className={cn('block truncate text-[12px]', item.status === 'error' || item.status === 'needs_login' ? 'text-warning' : 'text-subtle')}>
          {connected && item.detail ? item.detail : `af ${item.vendor}`}
        </span>
      </span>
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-lg transition-colors',
          connected ? 'text-muted group-hover:bg-line-2 group-hover:text-ink' : 'bg-line-2 text-ink-2 group-hover:bg-ink group-hover:text-white',
        )}
        aria-hidden
      >
        {connected ? <Settings2 className="size-4" /> : <Plus className="size-4" />}
      </span>
    </button>
  );
}

/* ------------------------------- the setup dialog ------------------------------- */

function SetupSteps({ def }: { def: ConnectorDef }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-line-2/60 px-3.5 py-2.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 text-left text-[13px] font-medium text-ink-2">
        Sådan får du nøglerne <ChevronDown className={cn('ml-auto size-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ol className="mt-2 grid gap-1.5">
          {def.setup.map((s, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-semibold text-brand">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
          {def.docs && (
            <li className="pl-7">
              <button type="button" onClick={() => void openExternal(def.docs!)} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
                Dokumentation <ExternalLink className="size-3" />
              </button>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

function SourceForm({ def, summary }: { def: ConnectorDef; summary: ConnectorSummary | undefined }) {
  const status = summary?.status ?? 'not_connected';
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...summary?.config }));
  const [busy, setBusy] = useState<'save' | 'test' | 'off' | 'login' | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [code, setCode] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const set = (key: string, v: string) => setValues((s) => ({ ...s, [key]: v }));

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<{ ok: boolean; message: string }>) => {
    setBusy(kind);
    try {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.warning(r.message, { duration: 10_000 });
      return r;
    } catch (e) {
      toast.error('Det lykkedes ikke', { description: errorMessage(e), duration: 10_000 });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    const config: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    for (const f of def.fields) (f.secret ? secrets : config)[f.key] = (values[f.key] ?? '').trim();
    return run('save', async () => {
      const r = await saveSource(def.id, config, secrets);
      // Secrets are never shown again – clear what was typed.
      setValues((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !def.fields.find((f) => f.key === k)?.secret)));
      if (def.oauth && r.connector.status === 'needs_login' && !r.connector.secretsSet.includes('refreshToken')) setLoginOpen(true);
      return r;
    });
  };

  return (
    <div className="grid gap-4">
      <SetupSteps def={def} />
      <div className="grid gap-3.5">
        {def.fields.map((f) => {
          const stored = !!summary?.secretsSet.includes(f.key);
          const common = {
            id: `src-${f.key}`,
            value: values[f.key] ?? '',
            placeholder: f.secret && stored ? '•••••••• (gemt – udfyld kun for at skifte)' : f.placeholder,
            autoComplete: 'off',
            spellCheck: false,
          };
          return (
            <Field key={f.key} label={`${f.label}${f.required ? '' : ' (valgfri)'}`} htmlFor={common.id} hint={f.help}>
              {f.multiline ? (
                <Textarea {...common} rows={4} onChange={(e) => set(f.key, e.target.value)} className="font-mono text-[12px] placeholder:font-sans" />
              ) : (
                <Input {...common} type={f.secret ? 'password' : 'text'} onChange={(e) => set(f.key, e.target.value)} className={cn(f.secret && 'font-mono text-[13px] placeholder:font-sans')} />
              )}
            </Field>
          );
        })}
      </div>

      {def.oauth && (status === 'needs_login' || loginOpen) && summary?.secretsSet.includes('clientId') && (
        <div className="grid gap-2.5 rounded-xl border border-brand/25 bg-brand-50/50 p-3.5">
          <div className="text-[13px] font-medium text-ink">Log ind hos {def.name}</div>
          <p className="text-[12.5px] leading-relaxed text-muted">Login åbner i browseren. Når du har logget ind, viser {def.name} en kode – kopiér den hele og indsæt den her.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!!busy}
              onClick={async () => {
                setBusy('login');
                try {
                  const { url } = await startSourceLogin(def.id);
                  await openExternal(url);
                  setLoginOpen(true);
                } catch (e) {
                  toast.error('Login kunne ikke startes', { description: errorMessage(e) });
                } finally {
                  setBusy(null);
                }
              }}
            >
              <LogIn /> Log ind hos {def.name}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Indsæt koden" className="font-mono text-[12.5px] placeholder:font-sans" />
            <Button size="sm" variant="gradient" disabled={!!busy || code.trim().length < 10} onClick={() => void run('login', () => completeSourceLogin(def.id, code)).then((r) => r?.ok && setCode(''))}>
              {busy === 'login' && <Loader2 className="animate-spin" />} Afslut
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button variant="gradient" disabled={!!busy} onClick={() => void save()}>
          {busy === 'save' ? <Loader2 className="animate-spin" /> : status === 'not_connected' ? <Plus /> : <CheckCircle2 />} {status === 'not_connected' ? 'Forbind' : 'Gem og test'}
        </Button>
        {status !== 'not_connected' && (
          <Button variant="secondary" disabled={!!busy} onClick={() => void run('test', () => testSource(def.id))}>
            {busy === 'test' && <Loader2 className="animate-spin" />} Test forbindelse
          </Button>
        )}
        {status !== 'not_connected' &&
          (confirmOff ? (
            <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-muted">
              Afbryd for alle?
              <Button size="xs" variant="destructive" disabled={!!busy} onClick={() => void run('off', () => disconnectSource(def.id)).then(() => setConfirmOff(false))}>
                Afbryd
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setConfirmOff(false)}>
                Fortryd
              </Button>
            </span>
          ) : (
            <Button variant="ghost" className="ml-auto text-muted" disabled={!!busy} onClick={() => setConfirmOff(true)}>
              <Unplug /> Afbryd
            </Button>
          ))}
      </div>
    </div>
  );
}

function StatusBanner({ item, summary }: { item: Item; summary?: ConnectorSummary }) {
  if (item.status === 'not_connected') return null;
  const ok = item.status === 'connected';
  return (
    <div className={cn('grid gap-0.5 rounded-xl px-3.5 py-2.5 text-[13px]', ok ? 'bg-positive-bg text-positive' : 'bg-warning-bg text-warning')}>
      <span className="flex items-center gap-2 font-medium">
        {ok ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
        {ok ? `Forbundet${summary?.accountLabel ? ` · ${summary.accountLabel}` : ''}` : (summary?.lastError ?? item.detail ?? 'Kræver handling')}
      </span>
      {summary && (
        <span className={cn('text-[12px]', ok ? 'text-positive/80' : 'text-warning/80')}>
          <SharedBy by={summary.connectedBy} at={summary.connectedAt} className="text-inherit" />
          {summary.checkedAt ? ` · tjekket ${fmtRelative(summary.checkedAt)}` : ''}
        </span>
      )}
    </div>
  );
}

function ConnectorDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const summary = useSources((s) => s.list?.find((c) => c.id === item?.id));
  // Keep showing the last item while the dialog animates out.
  const [shown, setShown] = useState(item);
  useEffect(() => {
    if (item) setShown(item);
  }, [item]);
  const current = item ?? shown;
  return (
    <Dialog
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      title={
        current ? (
          <span className="flex items-center gap-3">
            <ConnectorLogo id={current.id} className="size-10" />
            <span className="grid">
              <span>{current.name}</span>
              <span className="text-[12.5px] font-normal text-muted">
                {current.description} · af {current.vendor}
              </span>
            </span>
          </span>
        ) : (
          ''
        )
      }
      className="w-[min(600px,calc(100vw-32px))]"
    >
      {current && (
        <div className="-mx-1 grid max-h-[min(66vh,620px)] gap-4 overflow-y-auto px-1">
          {current.builtin !== 'microsoft_ads' && current.builtin !== 'claude' && current.builtin !== 'inventarland' && <StatusBanner item={current} summary={summary} />}
          {current.builtin === 'claude' && <ClaudeKeyForm />}
          {current.builtin === 'microsoft_ads' && (
            <>
              <MicrosoftSetupGuide collapsible />
              <AdsConnectionForm compact />
            </>
          )}
          {current.builtin === 'inventarland' && <InventarlandForm />}
          {current.def && <SourceForm key={current.def.id} def={current.def} summary={summary} />}
        </div>
      )}
    </Dialog>
  );
}

/* ---------------------------------- the page ---------------------------------- */

export function ConnectorsTab() {
  const items = useItems();
  const error = useSources((s) => s.error);
  const loaded = useSources((s) => !!s.list);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Item | null>(null);

  useEffect(() => {
    void loadSources();
  }, []);

  const q = query.trim().toLowerCase();
  const match = (i: Item) => !q || `${i.name} ${i.description} ${i.vendor}`.toLowerCase().includes(q);
  const connected = items.filter((i) => i.status !== 'not_connected' && match(i));
  const available = items.filter((i) => i.status === 'not_connected' && match(i));
  const live = open ? (items.find((i) => i.id === open.id) ?? open) : null;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 text-[13px] leading-relaxed text-muted">
          <Users className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>Forbindelserne er fælles for alle i appen og gemmes på jeres Cloudflare. Nøgler vises aldrig igen, når de er gemt.</span>
        </div>
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søg i forbindelser" className="h-9 pl-9 text-[13px]" aria-label="Søg i forbindelser" />
        </div>
      </div>

      {error && !loaded && <p className="rounded-xl bg-warning-bg px-3.5 py-2.5 text-[12.5px] text-warning">Datakilderne kunne ikke hentes: {error}</p>}

      {connected.length > 0 && (
        <section>
          <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink">
            Forbundet <span className="rounded-full bg-line-2 px-1.5 text-[11.5px] font-medium text-muted tabular">{connected.length}</span>
          </h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {connected.map((i) => (
              <ConnectorCard key={i.id} item={i} onOpen={() => setOpen(i)} />
            ))}
          </div>
        </section>
      )}

      {GROUPS.map((g) => {
        const list = available.filter((i) => i.group === g.id);
        if (!list.length) return null;
        return (
          <section key={g.id}>
            <h3 className="mb-2.5 text-[13px] font-semibold text-ink">{g.label}</h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {list.map((i) => (
                <ConnectorCard key={i.id} item={i} onOpen={() => setOpen(i)} />
              ))}
            </div>
          </section>
        );
      })}

      {!connected.length && !available.length && <p className="text-[13px] text-muted">Ingen forbindelser matcher “{query}”.</p>}

      <ConnectorDialog item={live} onClose={() => setOpen(null)} />
    </div>
  );
}
