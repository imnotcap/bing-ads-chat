/** Forms shared by the settings page and onboarding. */
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, Eye, EyeOff, Hand, KeyRound, Loader2, LogIn, Rocket, ShieldCheck, Unplug, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/input';
import { BUILTIN_MS } from '@/bing/credentials';
import { fmtRelative } from '@/lib/format';
import { isTauri, openExternal } from '@/lib/platform';
import { cn, errorMessage } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { useConnection } from '@/stores/connection';
import type { ApprovalMode } from '@/stores/settings';
import { connectInventarland, connectSharedAds, disconnectInventarland, disconnectSharedAds, goDemo, goLive, setSharedDeveloperToken } from '@/workspace/shared';
import { INVENTARLAND_URL, type SharedKeyInfo } from '@/workspace/types';
import { removeAnthropicKey, saveAnthropicKey, testAnthropicKey } from './connection';

function SecretInput({ value, onChange, placeholder, id }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-10 font-mono text-[13px]" autoComplete="off" spellCheck={false} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink" aria-label={show ? 'Skjul' : 'Vis'}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** "Fælles · sat af Jonas for 2 dage siden" */
export function SharedBy({ by, at, className }: { by: string | null; at: number | null; className?: string }) {
  if (!by) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[12px] text-muted', className)}>
      <Users className="size-3.5" /> Fælles for alle · sat af {by}
      {at ? ` ${fmtRelative(at)}` : ''}
    </span>
  );
}

function KeyStatus({ info }: { info: SharedKeyInfo }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-positive-bg px-3 py-2 text-[13px] text-positive">
      <span className="flex items-center gap-2">
        <CheckCircle2 className="size-4" /> Fælles nøgle <code className="font-mono text-[12px]">…{info.hint}</code>
      </span>
      <SharedBy by={info.by} at={info.at} className="text-positive/80" />
    </div>
  );
}

export function ClaudeKeyForm({ onDone }: { onDone?: () => void }) {
  const info = useAccount((s) => s.workspace?.keys.anthropic ?? null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | 'remove' | null>(null);
  return (
    <div className="grid gap-3">
      {info && <KeyStatus info={info} />}
      <Field
        label={info ? 'Erstat API-nøgle (for alle)' : 'Claude API-nøgle'}
        htmlFor="anthropic-key"
        hint={
          <>
            Opret en nøgle på{' '}
            <button type="button" className="font-medium text-brand hover:underline" onClick={() => void openExternal('https://console.anthropic.com/settings/keys')}>
              console.anthropic.com <ExternalLink className="inline size-3" />
            </button>
            . Nøglen gemmes på jeres Cloudflare og bruges af alle i appen.
          </>
        }
      >
        <SecretInput id="anthropic-key" value={key} onChange={setKey} placeholder="sk-ant-api03-…" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!key.trim() || !!busy}
          onClick={async () => {
            setBusy('save');
            try {
              await saveAnthropicKey(key);
              setKey('');
              toast.success('Claude er forbundet for alle');
              onDone?.();
            } catch (e) {
              toast.error('Nøglen kunne ikke bruges', { description: errorMessage(e) });
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === 'save' ? <Loader2 className="animate-spin" /> : <KeyRound />} Gem og test
        </Button>
        {info && (
          <>
            <Button
              variant="secondary"
              disabled={!!busy}
              onClick={async () => {
                setBusy('test');
                try {
                  const name = await testAnthropicKey();
                  toast.success(`Forbindelsen virker – ${name} er klar`);
                } catch (e) {
                  toast.error('Testen fejlede', { description: errorMessage(e) });
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === 'test' && <Loader2 className="animate-spin" />} Test forbindelse
            </Button>
            <Button
              variant="ghost"
              disabled={!!busy}
              onClick={async () => {
                setBusy('remove');
                try {
                  await removeAnthropicKey();
                  toast('Nøglen er fjernet for alle');
                } catch (e) {
                  toast.error('Nøglen kunne ikke fjernes', { description: errorMessage(e) });
                } finally {
                  setBusy(null);
                }
              }}
            >
              Fjern nøgle
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The workspace's Microsoft Advertising connection. Someone signs in once with the
 * Microsoft user that has access on ads.microsoft.com; everyone in the app uses it.
 */
export function AdsConnectionForm({ compact = false, onDone }: { compact?: boolean; onDone?: () => void }) {
  const ads = useAccount((s) => s.workspace?.ads ?? null);
  const mode = useConnection((s) => s.mode);
  const accounts = useConnection((s) => s.accounts.length);
  const [developerToken, setDeveloperToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [tenant, setTenant] = useState('');
  const [busy, setBusy] = useState<'connect' | 'token' | 'disconnect' | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const connected = !!ads?.connected;
  const needsToken = !BUILTIN_MS.developerToken && !ads?.hasDeveloperToken;

  const connect = async () => {
    setBusy('connect');
    try {
      const res = await connectSharedAds({ developerToken, clientId, tenant });
      setDeveloperToken('');
      toast.success(`Microsoft Advertising er forbundet for alle`, { description: `Via ${res.name} · ${res.accounts} annoncekonto${res.accounts === 1 ? '' : 'er'}.` });
      onDone?.();
    } catch (e) {
      toast.error('Kunne ikke forbinde Microsoft Advertising', { description: errorMessage(e), duration: 12_000 });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid content-start gap-4">
      {connected && ads && (
        <div className={cn('grid gap-1 rounded-xl px-3.5 py-2.5 text-[13px]', ads.error ? 'bg-warning-bg text-warning' : 'bg-positive-bg text-positive')}>
          <div className="flex flex-wrap items-center gap-2">
            {ads.error ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
            <span className="font-medium">Forbundet{ads.accountName ? ` via ${ads.accountName}` : ''}</span>
            {mode === 'live' && accounts > 0 && <span className="opacity-80">· {accounts} konti</span>}
          </div>
          {ads.error && <p className="text-[12.5px]">{ads.error}</p>}
          <SharedBy by={ads.connectedBy} at={ads.connectedAt} className={ads.error ? 'text-warning/80' : 'text-positive/80'} />
        </div>
      )}
      {connected && mode === 'demo' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-[13px] text-ink-2">
          Du ser demo-data på denne PC.
          <Button size="xs" variant="secondary" className="ml-auto" onClick={goLive}>
            Brug de rigtige data
          </Button>
        </div>
      )}

      {(needsToken || advanced) && (
        <Field
          label="Developer token"
          htmlFor="ms-dev"
          hint={ads?.hasDeveloperToken ? 'Gemt fælles – udfyld kun for at erstatte.' : 'ads.microsoft.com → Indstillinger → Developer settings → Request Developer Token.'}
        >
          <SecretInput id="ms-dev" value={developerToken} onChange={setDeveloperToken} placeholder={ads?.hasDeveloperToken ? '•••••••••••• (gemt)' : 'fx 1A2B3C4D5E6F7G8H'} />
        </Field>
      )}
      {advanced && (
        <div className={cn('grid gap-4', !compact && 'md:grid-cols-2')}>
          <Field label="Application (client) ID" htmlFor="ms-client" hint="Tom = appens egen app-registrering (anbefalet).">
            <Input id="ms-client" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder={ads?.clientId ?? '00000000-0000-0000-0000-000000000000'} className="font-mono text-[13px]" />
          </Field>
          <Field label="Tenant" htmlFor="ms-tenant" hint='Normalt "common".'>
            <Input id="ms-tenant" value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder={ads?.tenant ?? 'common'} />
          </Field>
        </div>
      )}

      {!isTauri && <p className="rounded-xl bg-warning-bg px-3.5 py-2.5 text-[12.5px] text-warning">Login hos Microsoft virker kun i desktop-appen.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={connected ? 'secondary' : 'gradient'} disabled={!!busy || !isTauri || (needsToken && !developerToken.trim())} onClick={() => void connect()}>
          {busy === 'connect' ? <Loader2 className="animate-spin" /> : <LogIn />} {connected ? 'Forbind med en anden Microsoft-bruger' : 'Forbind Microsoft Advertising'}
        </Button>
        {connected && advanced && developerToken.trim() && (
          <Button
            variant="secondary"
            disabled={!!busy}
            onClick={async () => {
              setBusy('token');
              try {
                await setSharedDeveloperToken(developerToken);
                setDeveloperToken('');
                toast.success('Developer tokenet er skiftet for alle');
              } catch (e) {
                toast.error('Kunne ikke gemme', { description: errorMessage(e) });
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'token' && <Loader2 className="animate-spin" />} Gem kun developer token
          </Button>
        )}
        {connected && mode === 'live' && (
          <Button variant="ghost" disabled={!!busy} onClick={() => goDemo()}>
            Vis demo-data på denne PC
          </Button>
        )}
        {connected &&
          (confirmOff ? (
            <span className="flex items-center gap-2 text-[12.5px] text-muted">
              Afbryd for alle i appen?
              <Button
                size="xs"
                variant="destructive"
                disabled={!!busy}
                onClick={async () => {
                  setBusy('disconnect');
                  try {
                    await disconnectSharedAds();
                    toast('Microsoft Advertising er afbrudt for alle', { description: 'Appen viser nu demo-data.' });
                  } catch (e) {
                    toast.error('Kunne ikke afbryde', { description: errorMessage(e) });
                  } finally {
                    setBusy(null);
                    setConfirmOff(false);
                  }
                }}
              >
                Afbryd
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setConfirmOff(false)}>
                Fortryd
              </Button>
            </span>
          ) : (
            <Button variant="ghost" className="text-muted" disabled={!!busy} onClick={() => setConfirmOff(true)}>
              <Unplug /> Afbryd
            </Button>
          ))}
      </div>
      <button type="button" onClick={() => setAdvanced((v) => !v)} className="flex w-fit items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
        {advanced ? 'Skjul avanceret' : 'Developer token og app-registrering'} <ChevronDown className={cn('size-3.5 transition-transform', advanced && 'rotate-180')} />
      </button>
    </div>
  );
}

/**
 * Inventarland's API: the webshop's sales and the other ad channels, read with a
 * shared Inventarland user that only has the "Læser" role.
 */
export function InventarlandForm() {
  const inv = useAccount((s) => s.workspace?.inventarland ?? null);
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'save' | 'off' | null>(null);
  const [editing, setEditing] = useState(false);
  const connected = !!inv?.connected;
  const showForm = !connected || editing;

  const save = async () => {
    setBusy('save');
    try {
      await connectInventarland({ url: url.trim() || undefined, email, password });
      setPassword('');
      setEditing(false);
      toast.success('Inventarland er forbundet for alle', { description: 'Assistenten kan nu se webshoppens salg og de andre annoncekanaler.' });
    } catch (e) {
      toast.error('Kunne ikke forbinde Inventarland', { description: errorMessage(e), duration: 10_000 });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid content-start gap-4">
      {connected && inv && (
        <div className={cn('grid gap-1 rounded-xl px-3.5 py-2.5 text-[13px]', inv.error ? 'bg-warning-bg text-warning' : 'bg-positive-bg text-positive')}>
          <div className="flex flex-wrap items-center gap-2">
            {inv.error ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
            <span className="font-medium">Forbundet som {inv.email}</span>
          </div>
          {inv.error && <p className="text-[12.5px]">{inv.error}</p>}
          <SharedBy by={inv.connectedBy} at={inv.connectedAt} className={inv.error ? 'text-warning/80' : 'text-positive/80'} />
        </div>
      )}
      {showForm && (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Inventarland-bruger (e-mail)" htmlFor="inv-email" hint="En bruger med rollen Læser – opret den i Inventarland under Administration → Brugere.">
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bing-ads-chat@inventarland.dk" autoComplete="off" />
          </Field>
          <Field label="Adgangskode" htmlFor="inv-password" hint="Gemmes kun på jeres Cloudflare – aldrig på PC'erne.">
            <SecretInput id="inv-password" value={password} onChange={setPassword} placeholder="••••••••" />
          </Field>
          <Field label="API-adresse" htmlFor="inv-url" hint="Tom = Inventarlands egen (inventarland-api).">
            <Input id="inv-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={inv?.url ?? INVENTARLAND_URL} className="font-mono text-[13px]" />
          </Field>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {showForm ? (
          <>
            <Button variant={connected ? 'secondary' : 'gradient'} disabled={!!busy || !email.includes('@') || !password} onClick={() => void save()}>
              {busy === 'save' ? <Loader2 className="animate-spin" /> : <LogIn />} {connected ? 'Gem og test' : 'Forbind Inventarland'}
            </Button>
            {editing && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Annullér
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Skift bruger
            </Button>
            <Button
              variant="ghost"
              className="text-muted"
              disabled={!!busy}
              onClick={async () => {
                setBusy('off');
                try {
                  await disconnectInventarland();
                  toast('Inventarland er afbrudt for alle');
                } catch (e) {
                  toast.error('Kunne ikke afbryde', { description: errorMessage(e) });
                } finally {
                  setBusy(null);
                }
              }}
            >
              <Unplug /> Afbryd
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function MicrosoftSetupGuide() {
  const steps = [
    <>
      Log ind på <b>ads.microsoft.com</b> → <b>Indstillinger → Developer settings</b> → vælg din bruger → <b>Request Developer Token</b> (kræver Super Admin).
    </>,
    <>
      Klik <b>Forbind Microsoft Advertising</b>, og log ind med den Microsoft-bruger, der har adgang til annoncekontiene.
    </>,
    <>
      Færdig: alle i appen arbejder nu på de samme konti. Forbindelsen gemmes på jeres Cloudflare – ikke på den enkelte PC.
    </>,
  ];
  return (
    <ol className="grid gap-2.5">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-ink-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[12px] font-semibold text-brand">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
      <li className="pl-9 text-[12.5px] text-muted">
        <button type="button" className="font-medium text-brand hover:underline" onClick={() => void openExternal('https://learn.microsoft.com/advertising/guides/get-started')}>
          Microsofts guide til API-adgang <ExternalLink className="inline size-3" />
        </button>
      </li>
    </ol>
  );
}

const APPROVAL_OPTIONS: { value: ApprovalMode; title: string; description: string; icon: typeof Hand; badge?: string }[] = [
  { value: 'all', title: 'Godkend alt', description: 'Assistenten foreslår – du godkender hver eneste ændring.', icon: Hand },
  { value: 'spend', title: 'Godkend forbrugsøgninger', description: 'Besparende ændringer (pauser, negative søgeord) udføres straks. Alt der kan øge forbruget kræver godkendelse.', icon: ShieldCheck, badge: 'Anbefalet' },
  { value: 'none', title: 'Autopilot', description: 'Assistenten udfører ændringer selv inden for dine grænser. Store budgetstigninger kræver stadig godkendelse.', icon: Rocket },
];

export function ApprovalModePicker({ value, onChange }: { value: ApprovalMode; onChange: (v: ApprovalMode) => void }) {
  return (
    <div role="radiogroup" className="grid gap-2.5 md:grid-cols-3">
      {APPROVAL_OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex flex-col rounded-2xl border p-4 text-left transition-[border-color,box-shadow,background-color]',
              active ? 'border-brand/40 bg-brand-50/50 shadow-[0_0_0_4px_rgb(109_92_246/0.08)]' : 'border-line bg-surface hover:border-black/10',
            )}
          >
            <div className="flex w-full items-center gap-2">
              <span className={cn('grid size-8 place-items-center rounded-xl', active ? 'bg-brand text-white' : 'bg-line-2 text-muted')}>
                <o.icon className="size-4" />
              </span>
              {o.badge && <Badge tone="brand">{o.badge}</Badge>}
              {active && (
                <motion.span layoutId="approval-check" className="ml-auto">
                  <CheckCircle2 className="size-5 text-brand" />
                </motion.span>
              )}
            </div>
            <div className="mt-3 text-[14px] font-semibold text-ink">{o.title}</div>
            <div className="mt-1 text-[12.5px] leading-relaxed text-muted">{o.description}</div>
          </button>
        );
      })}
    </div>
  );
}
