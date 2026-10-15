/** Forms shared by the settings page and onboarding. */
import { motion } from 'motion/react';
import { CheckCircle2, ExternalLink, Eye, EyeOff, Hand, KeyRound, Loader2, LogIn, LogOut, Rocket, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/input';
import { BUILTIN_MS, hasBuiltinMicrosoft } from '@/bing/credentials';
import { openExternal } from '@/lib/platform';
import { cn, errorMessage } from '@/lib/utils';
import { useConnection } from '@/stores/connection';
import type { ApprovalMode } from '@/stores/settings';
import { disconnectMicrosoft, reconnectLive, removeAnthropicKey, saveAnthropicKey, saveMicrosoftSettings, signInMicrosoft, testAnthropicKey, applyManualRefreshToken } from './connection';

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

export function ClaudeKeyForm({ onDone }: { onDone?: () => void }) {
  const has = useConnection((s) => s.hasAnthropicKey);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  return (
    <div className="grid gap-3">
      {has && (
        <div className="flex items-center gap-2 rounded-xl bg-positive-bg px-3 py-2 text-[13px] text-positive">
          <CheckCircle2 className="size-4" /> En nøgle er gemt sikkert i Windows Credential Manager.
        </div>
      )}
      <Field label={has ? 'Erstat API-nøgle' : 'Claude API-nøgle'} htmlFor="anthropic-key" hint={
        <>
          Opret en nøgle på{' '}
          <button type="button" className="font-medium text-brand hover:underline" onClick={() => void openExternal('https://console.anthropic.com/settings/keys')}>
            console.anthropic.com <ExternalLink className="inline size-3" />
          </button>
          . Nøglen forlader aldrig din computer, undtagen til Claude API'et.
        </>
      }>
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
              toast.success('Claude er forbundet');
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
        {has && (
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
            <Button variant="ghost" onClick={() => void removeAnthropicKey().then(() => toast('Nøglen er fjernet'))}>
              Fjern nøgle
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function MicrosoftConnectForm({ compact = false, onDone }: { compact?: boolean; onDone?: () => void }) {
  const c = useConnection();
  const [developerToken, setDeveloperToken] = useState('');
  const [clientId, setClientId] = useState(c.msClientId);
  const [tenant, setTenant] = useState(c.msTenant || 'common');
  const [clientSecret, setClientSecret] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [busy, setBusy] = useState(false);
  const connected = c.mode === 'live' && c.hasMsRefreshToken;

  const persist = () =>
    saveMicrosoftSettings({
      clientId,
      tenant,
      developerToken: developerToken ? developerToken : undefined,
      clientSecret: clientSecret ? clientSecret : undefined,
    }).then(() => {
      setDeveloperToken('');
      setClientSecret('');
    });

  const run = async (fn: () => Promise<{ name: string; accounts: number }>) => {
    setBusy(true);
    try {
      await persist();
      const res = await fn();
      toast.success(`Forbundet som ${res.name}`, { description: `${res.accounts} annoncekonto${res.accounts === 1 ? '' : 'er'} fundet.` });
      onDone?.();
    } catch (e) {
      toast.error('Kunne ikke forbinde til Microsoft Advertising', { description: errorMessage(e), duration: 12_000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      {connected && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-positive-bg px-3.5 py-2.5 text-[13px] text-positive">
          <CheckCircle2 className="size-4" />
          <span>
            Forbundet{c.msUserName ? ` som ${c.msUserName}` : ''} · {c.accounts.length} konti
          </span>
          <Button size="xs" variant="ghost" className="ml-auto text-positive hover:bg-white/60" onClick={() => void disconnectMicrosoft().then(() => toast('Microsoft Advertising er afbrudt'))}>
            <LogOut /> Log ud
          </Button>
        </div>
      )}
      {!(compact && hasBuiltinMicrosoft) && (
      <div className={cn('grid gap-4', !compact && 'md:grid-cols-2')}>
        <Field
          label="Developer token"
          htmlFor="ms-dev"
          hint={
            BUILTIN_MS.developerToken
              ? 'Indbygget i appen – udfyld kun for at bruge dit eget.'
              : c.hasDeveloperToken
                ? 'Gemt – udfyld kun for at erstatte.'
                : 'Findes i Microsoft Advertising under Værktøjer → Developer Portal.'
          }
        >
          <SecretInput id="ms-dev" value={developerToken} onChange={setDeveloperToken} placeholder={c.hasDeveloperToken ? '•••••••••••• (gemt)' : 'fx 1A2B3C4D5E6F7G8H'} />
        </Field>
        <Field
          label="Application (client) ID"
          htmlFor="ms-client"
          hint={BUILTIN_MS.clientId ? 'Indbygget i appen – udfyld kun for at bruge din egen app-registrering.' : 'Fra din app-registrering i Microsoft Entra ID.'}
        >
          <Input id="ms-client" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="font-mono text-[13px]" />
        </Field>
        {!compact && (
          <>
            <Field label="Tenant" htmlFor="ms-tenant" hint='Normalt "common". Brug dit tenant-ID, hvis appen kun er til din organisation.'>
              <Input id="ms-tenant" value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="common" />
            </Field>
            <Field label="Client secret (valgfri)" htmlFor="ms-secret" hint="Kun nødvendig hvis app-registreringen er en web-app. Desktop-apps bruger PKCE uden secret.">
              <SecretInput id="ms-secret" value={clientSecret} onChange={setClientSecret} placeholder="Tom = ingen" />
            </Field>
          </>
        )}
      </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="gradient"
          disabled={busy || (!clientId.trim() && !BUILTIN_MS.clientId) || (!developerToken.trim() && !c.hasDeveloperToken)}
          onClick={() => run(signInMicrosoft)}
        >
          {busy ? <Loader2 className="animate-spin" /> : <LogIn />} Log ind med Microsoft
        </Button>
        {c.hasMsRefreshToken && c.mode !== 'live' && (
          <Button variant="secondary" disabled={busy} onClick={() => run(reconnectLive)}>
            Brug gemt login
          </Button>
        )}
        {!compact && (
          <Button variant="ghost" disabled={busy} onClick={() => void persist().then(() => toast.success('Gemt'))}>
            Gem uden at logge ind
          </Button>
        )}
      </div>
      {!compact && (
        <details className="rounded-xl border border-line px-3.5 py-2.5 text-[13px]">
          <summary className="cursor-pointer select-none font-medium text-ink-2">Avanceret: indsæt et refresh token manuelt</summary>
          <div className="mt-3 grid gap-2">
            <p className="text-[12.5px] text-muted">Hvis du allerede har et refresh token (fx fra Microsofts SDK-eksempler), kan du indsætte det her i stedet for at logge ind.</p>
            <SecretInput value={manualToken} onChange={setManualToken} placeholder="M.C5_BAY.0.U.-C…" />
            <div>
              <Button size="sm" variant="secondary" disabled={busy || !manualToken.trim()} onClick={() => run(() => applyManualRefreshToken(manualToken))}>
                Brug refresh token
              </Button>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

export function MicrosoftSetupGuide() {
  const steps = [
    <>
      Log ind på <b>Microsoft Advertising</b> og hent dit <b>developer token</b> under Værktøjer → Developer Portal (kræver Super Admin).
    </>,
    <>
      Gå til <b>portal.azure.com → Microsoft Entra ID → App-registreringer → Ny registrering</b>. Vælg “Accounts in any organizational directory and personal Microsoft accounts”.
    </>,
    <>
      Under <b>Authentication</b>: tilføj platformen <b>Mobile and desktop applications</b> med redirect-URI <code className="rounded bg-line-2 px-1">http://localhost</code>, og slå “Allow public client flows” til.
    </>,
    <>
      Kopiér <b>Application (client) ID</b> ind her sammen med developer token, og klik <b>Log ind med Microsoft</b>.
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
