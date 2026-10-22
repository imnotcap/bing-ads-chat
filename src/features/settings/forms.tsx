/** Forms shared by the settings page and onboarding. */
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, Eye, EyeOff, KeyRound, Loader2, LogIn, PlugZap, ShieldCheck, Unplug, Users } from '@/components/icons';
import { useState } from 'react';
import { toast } from '@/components/notifications/toast';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { fmtRelative } from '@/lib/format';
import { openExternal } from '@/lib/platform';
import { cn, errorMessage } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { useConnection } from '@/stores/connection';
import { connectInventarland, disconnectInventarland, disconnectSharedAds, goDemo, goLive, saveSharedAds } from '@/workspace/shared';
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
export function AdsConnectionForm({ onDone }: { compact?: boolean; onDone?: () => void }) {
  const ads = useAccount((s) => s.workspace?.ads ?? null);
  const mode = useConnection((s) => s.mode);
  const accounts = useConnection((s) => s.accounts.length);
  const connected = !!ads?.connected;
  const [accountId, setAccountId] = useState(ads?.accountId ?? '');
  const [customerId, setCustomerId] = useState(ads?.customerId ?? '');
  const [developerToken, setDeveloperToken] = useState('');
  const [clientId, setClientId] = useState(ads?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [tenant, setTenant] = useState(ads?.tenant && ads.tenant !== 'common' ? ads.tenant : '');
  const [busy, setBusy] = useState<'save' | 'disconnect' | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = '•••••••• (gemt – udfyld kun for at skifte)';
  const missing = (!developerToken.trim() && !ads?.hasDeveloperToken) || !clientId.trim() || (!refreshToken.trim() && !ads?.hasRefreshToken);

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      const res = await saveSharedAds({ accountId, customerId, developerToken, clientId, clientSecret, refreshToken, tenant });
      setDeveloperToken('');
      setClientSecret('');
      setRefreshToken('');
      toast.success('Microsoft Advertising er forbundet for alle', { description: `Via ${res.name} · ${res.accounts} annoncekonto${res.accounts === 1 ? '' : 'er'}.` });
      onDone?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const shownAccounts = mode === 'live' && accounts > 0 ? accounts : ads?.accounts;
  return (
    <div className="grid content-start gap-4">
      {connected && ads && (
        <div className={cn('grid gap-1 rounded-xl px-3.5 py-2.5 text-[13px]', ads.error ? 'bg-warning-bg text-warning' : 'bg-positive-bg text-positive')}>
          <div className="flex flex-wrap items-center gap-2">
            {ads.error ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
            <span className="font-medium">{ads.error ? 'Kræver handling' : `Forbundet${ads.accountName ? ` via ${ads.accountName}` : ''}`}</span>
            {!ads.error && !!shownAccounts && <span className="opacity-80">· {shownAccounts} konti</span>}
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

      {/* Same fields, order and names as Inventarland Dashboard. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Konto-ID" htmlFor="ms-account" hint="Tallet i adressen på ads.microsoft.com: aid=…">
          <Input id="ms-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="fx 187654321" inputMode="numeric" autoComplete="off" spellCheck={false} />
        </Field>
        <Field label="Kunde-ID" htmlFor="ms-customer" hint="Tallet i adressen på ads.microsoft.com: cid=…">
          <Input id="ms-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="fx 251234567" inputMode="numeric" autoComplete="off" spellCheck={false} />
        </Field>
      </div>
      <Field label="Azure tenant" htmlFor="ms-tenant" hint='Tom = "common". Brug samme som i Inventarland.'>
        <Input id="ms-tenant" value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="common" autoComplete="off" spellCheck={false} />
      </Field>
      <Field label="Developer token" htmlFor="ms-dev" hint="ads.microsoft.com → Indstillinger → Developer settings.">
        <SecretInput id="ms-dev" value={developerToken} onChange={setDeveloperToken} placeholder={ads?.hasDeveloperToken ? saved : 'fx 1A2B3C4D5E6F7G8H'} />
      </Field>
      <Field label="OAuth client ID" htmlFor="ms-client" hint="Skal være den app-registrering, refresh tokenet er hentet med.">
        <Input id="ms-client" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="font-mono text-[13px] placeholder:font-sans" autoComplete="off" spellCheck={false} />
      </Field>
      <Field label="OAuth client secret (valgfri)" htmlFor="ms-secret" hint='Kun hvis app-registreringen er af typen "Web".'>
        <SecretInput id="ms-secret" value={clientSecret} onChange={setClientSecret} placeholder={ads?.hasClientSecret ? saved : ''} />
      </Field>
      <Field label="OAuth refresh token" htmlFor="ms-refresh" hint="Mellemrum og linjeskift fjernes automatisk. Microsoft fornyer tokenet – appen gemmer altid det nyeste.">
        <SecretInput id="ms-refresh" value={refreshToken} onChange={setRefreshToken} placeholder={ads?.hasRefreshToken ? saved : ''} />
      </Field>

      {error && (
        <p role="alert" className="flex gap-2 rounded-xl bg-warning-bg px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">
            <b className="font-medium">Ikke gemt.</b> {error}
          </span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button variant="gradient" disabled={!!busy || missing} onClick={() => void save()}>
          {busy === 'save' ? <Loader2 className="animate-spin" /> : <PlugZap />} {connected ? 'Gem og test' : 'Forbind'}
        </Button>
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
            <Button variant="ghost" className="ml-auto text-muted" disabled={!!busy} onClick={() => setConfirmOff(true)}>
              <Unplug /> Afbryd
            </Button>
          ))}
      </div>
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

const MS_STEPS = [
  <>
    <b>Developer token:</b> ads.microsoft.com → <b>Indstillinger → Developer settings</b> → vælg din bruger → <b>Request Developer Token</b> (kræver Super Admin).
  </>,
  <>
    <b>App-registrering:</b> portal.azure.com → <b>Microsoft Entra ID → App registrations → New registration</b>. Kopiér <b>Application (client) ID</b>. Tilføj under Authentication en
    &quot;Mobile and desktop&quot;-platform – så skal der ingen client secret til.
  </>,
  <>
    <b>Refresh token:</b> hent det én gang for en Microsoft-bruger med adgang til annoncekontiene (scope <code className="text-[12px]">https://ads.microsoft.com/msads.manage offline_access</code>
    ). Er Inventarland Dashboard allerede forbundet, så brug præcis de samme værdier derfra – refresh token, client ID, client secret og tenant hører sammen.
  </>,
  <>
    <b>Konto-ID og Kunde-ID:</b> åbn kontoen på ads.microsoft.com – adressen indeholder <code className="text-[12px]">aid=</code> (Konto-ID) og <code className="text-[12px]">cid=</code> (Kunde-ID).
  </>,
  <>Gem: Cloudflare tester nøglerne, og alle i appen arbejder på de samme konti. Refresh tokenet holdes friskt hver hverdag om morgenen.</>,
];

/** How to get the Microsoft Advertising keys. `collapsible`: folded like the other connections. */
export function MicrosoftSetupGuide({ collapsible = false }: { collapsible?: boolean }) {
  const [open, setOpen] = useState(!collapsible);
  const list = (
    <ol className={cn('grid', collapsible ? 'mt-2 gap-1.5' : 'gap-2.5')}>
      {MS_STEPS.map((s, i) => (
        <li key={i} className={cn('flex text-ink-2', collapsible ? 'gap-2 text-[12.5px] leading-relaxed' : 'gap-3 text-[13px] leading-relaxed')}>
          <span className={cn('grid shrink-0 place-items-center rounded-full font-semibold text-brand', collapsible ? 'size-5 bg-white text-[11px]' : 'size-6 bg-brand-50 text-[12px]')}>{i + 1}</span>
          <span className="min-w-0">{s}</span>
        </li>
      ))}
      <li className={cn('text-[12.5px] text-muted', collapsible ? 'pl-7' : 'pl-9')}>
        <button type="button" className="inline-flex items-center gap-1 font-medium text-brand hover:underline" onClick={() => void openExternal('https://learn.microsoft.com/advertising/guides/authentication-oauth-get-tokens')}>
          Microsofts guide til tokens <ExternalLink className="size-3" />
        </button>
      </li>
    </ol>
  );
  if (!collapsible) return list;
  return (
    <div className="rounded-xl bg-line-2/60 px-3.5 py-2.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 text-left text-[13px] font-medium text-ink-2">
        Sådan får du nøglerne <ChevronDown className={cn('ml-auto size-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && list}
    </div>
  );
}

/** Shown where the approval modes used to be: the assistant never acts on its own. */
export function ApprovalNotice() {
  return (
    <div className="flex gap-3 rounded-2xl border border-brand/25 bg-brand-50/50 p-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand text-white">
        <ShieldCheck className="size-4" />
      </span>
      <span className="grid gap-0.5 text-[13px] leading-relaxed text-ink-2">
        <span className="font-medium text-ink">Du godkender alt</span>
        Assistenten foreslår – den ændrer aldrig noget på egen hånd. Hver ændring vises på et godkendelseskort med begrundelse, og intet sendes til Microsoft Advertising, før du klikker Godkend.
      </span>
    </div>
  );
}
