/**
 * "Forbind Microsoft Advertising": connect the workspace's shared ad account (or
 * start using it on this PC). Opened from the account menu, the Demo badge in the
 * top bar and the settings.
 */
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { useConnection } from '@/stores/connection';
import { useUi } from '@/stores/ui';
import { goLive } from '@/workspace/shared';
import { AdsConnectionForm, MicrosoftSetupGuide, SharedBy } from './forms';

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
  const mode = useConnection((s) => s.mode);
  const ads = useAccount((s) => s.workspace?.ads ?? null);
  const connected = !!ads?.connected && !ads.error;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={connected ? 'Brug jeres Microsoft Advertising-konto' : 'Forbind Microsoft Advertising'}
      description={
        connected
          ? 'Afdelingens annoncekonto er allerede forbundet. Skift fra demo-data til de rigtige kampagner.'
          : 'Forbindelsen deles af alle i appen: den logges ind én gang og gemmes på jeres Cloudflare. Du logger ind hos Microsoft i browseren – appen ser aldrig adgangskoden.'
      }
      className="w-[min(560px,calc(100vw-32px))]"
      footer={
        <Button variant="secondary" onClick={() => setOpen(false)}>
          {mode === 'demo' ? 'Fortsæt med demo' : 'Luk'}
        </Button>
      }
    >
      {connected && ads ? (
        <div className="grid gap-3">
          <div className="grid gap-1 rounded-xl border border-line px-3.5 py-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <MicrosoftLogo /> {ads.accountName ?? 'Microsoft Advertising'}
            </div>
            <SharedBy by={ads.connectedBy} at={ads.connectedAt} />
          </div>
          <Button
            variant="gradient"
            onClick={() => {
              goLive();
              setOpen(false);
            }}
          >
            Brug de rigtige data
          </Button>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="rounded-2xl border border-line bg-[#fafafb] p-4">
            <MicrosoftSetupGuide />
          </div>
          <AdsConnectionForm compact onDone={() => setOpen(false)} />
        </div>
      )}
    </Dialog>
  );
}
