/**
 * "Log ind med Microsoft": leave the demo data and work on the real Microsoft
 * Advertising account. Opened from the account menu, the Demo badge in the top
 * bar and the settings.
 */
import { ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/components/notifications/toast';
import { hasBuiltinMicrosoft } from '@/bing/credentials';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/overlays';
import { isTauri } from '@/lib/platform';
import { cn, errorMessage } from '@/lib/utils';
import { useConnection } from '@/stores/connection';
import { useUi } from '@/stores/ui';
import { reconnectLive, signInMicrosoft } from './connection';
import { MicrosoftConnectForm, MicrosoftSetupGuide } from './forms';

export function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={cn('size-4', className)} aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function SignInDialog() {
  const open = useUi((s) => s.signInOpen);
  const setOpen = useUi((s) => s.setSignInOpen);
  const c = useConnection();
  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  // One click when the app has built-in credentials or they were entered before.
  const ready = hasBuiltinMicrosoft || (!!c.msClientId && c.hasDeveloperToken);

  const done = (res: { name: string; accounts: number }) => {
    toast.success(`Logget ind som ${res.name}`, { description: `${res.accounts} annoncekonto${res.accounts === 1 ? '' : 'er'} fundet – du arbejder nu med rigtige data.` });
    setOpen(false);
  };

  const signIn = async (fn: () => Promise<{ name: string; accounts: number }>) => {
    setBusy(true);
    try {
      done(await fn());
    } catch (e) {
      toast.error('Login mislykkedes', { description: errorMessage(e), duration: 12_000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && setOpen(o)}
      title="Log ind med din Microsoft Advertising-konto"
      description="Forlad demo-data og arbejd med dine rigtige kampagner. Du logger ind hos Microsoft i din browser – appen ser aldrig din adgangskode."
      className="w-[min(560px,calc(100vw-32px))]"
      footer={
        <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
          {c.mode === 'demo' ? 'Fortsæt med demo' : 'Luk'}
        </Button>
      }
    >
      {!isTauri ? (
        <p className="rounded-xl bg-warning-bg px-3.5 py-3 text-[13px] text-warning">Login med Microsoft virker kun i desktop-appen.</p>
      ) : ready ? (
        <div className="grid gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void signIn(signInMicrosoft)}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-white text-[15px] font-semibold text-ink shadow-sm transition-[border-color,box-shadow] hover:border-black/15 hover:shadow-pop disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-5 animate-spin text-muted" /> : <MicrosoftLogo className="size-5" />}
            {busy ? 'Fuldfør login i browservinduet …' : 'Log ind med Microsoft'}
          </button>
          {c.hasMsRefreshToken && c.mode === 'demo' && !busy && (
            <Button variant="ghost" onClick={() => void signIn(reconnectLive)}>
              Brug det gemte login{c.msUserName ? ` (${c.msUserName})` : ''}
            </Button>
          )}
          <p className="text-[12.5px] leading-relaxed text-muted">
            Brug den Microsoft-konto, du logger ind på ads.microsoft.com med. Alle annoncekonti, du har adgang til, bliver tilgængelige, og du kan skifte mellem dem i
            kontomenuen nederst til venstre.
          </p>
          <button type="button" onClick={() => setShowSetup((v) => !v)} className="flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
            Skift developer token eller client ID <ChevronDown className={cn('size-3.5 transition-transform', showSetup && 'rotate-180')} />
          </button>
          {showSetup && <MicrosoftConnectForm onDone={() => setOpen(false)} />}
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="rounded-2xl border border-line bg-[#fafafb] p-4">
            <div className="mb-3 text-[13px] font-semibold text-ink">Engangsopsætning af API-adgang</div>
            <MicrosoftSetupGuide />
          </div>
          <MicrosoftConnectForm compact onDone={() => setOpen(false)} />
        </div>
      )}
    </Dialog>
  );
}
