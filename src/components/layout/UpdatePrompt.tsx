/**
 * "Ny version er klar": the update is downloaded and installed inside the app
 * (signed, from Cloudflare) – nobody has to fetch a new installer.
 */
import { AlertCircle, Download, ExternalLink, Loader2, RefreshCw, Sparkles } from '@/components/icons';
import { motion } from 'motion/react';
import { openDownloadPage } from '@/lib/updater';
import { isBusy, useUpdate } from '@/stores/update';
import { Button } from '../ui/button';
import { Dialog, Tooltip } from '../ui/overlays';
import { NOTES_FALLBACK, tidyNotes } from '@/lib/releaseNotes';

const mb = (bytes: number) => `${(bytes / 1_048_576).toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;

export function UpdateDialog() {
  const { available, promptOpen, phase, progress, downloaded, total, error, closePrompt, install } = useUpdate();
  if (!available) return null;
  const busy = isBusy(phase);
  const percent = progress === null ? null : Math.round(progress * 100);

  return (
    <Dialog
      open={promptOpen}
      onOpenChange={(open) => !open && closePrompt()}
      title={`XavierOS ${available.version} er klar`}
      description="Opdateringen installeres direkte i appen – du skal ikke hente noget nyt."
      footer={
        <>
          {phase === 'error' && (
            <Button variant="ghost" className="mr-auto" onClick={() => void openDownloadPage().catch(() => undefined)}>
              <ExternalLink /> Hent manuelt
            </Button>
          )}
          <Button variant="secondary" onClick={closePrompt} disabled={busy}>
            Senere
          </Button>
          <Button onClick={() => void install()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : phase === 'error' ? <RefreshCw /> : <Download />}
            {phase === 'error' ? 'Prøv igen' : 'Opdatér nu'}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand">
          {phase === 'error' ? <AlertCircle className="size-5" /> : <Sparkles className="size-5" />}
        </span>
        <div className="min-w-0 flex-1 text-[13.5px] text-ink-2">
          {phase === 'error' ? (
            <>
              <p className="text-negative">{error}</p>
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                Virker det stadig ikke, kan du hente den nye version fra download-siden og installere den ovenpå – dine samtaler og indstillinger bevares.
              </p>
            </>
          ) : busy ? (
            <>
              <p className="font-medium text-ink">{phase === 'installing' ? 'Installerer og genstarter …' : `Henter opdatering${percent === null ? ' …' : ` – ${percent} %`}`}</p>
              {phase === 'downloading' && downloaded > 0 && (
                <p className="mt-0.5 text-[12px] text-muted tabular">{total ? `${mb(downloaded)} af ${mb(total)}` : `${mb(downloaded)} hentet`}</p>
              )}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-line-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
                {percent === null && phase === 'downloading' ? (
                  <motion.div className="h-full w-1/3 rounded-full bg-brand" animate={{ x: ['-100%', '300%'] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }} />
                ) : (
                  <motion.div className="h-full rounded-full bg-brand" animate={{ width: `${percent ?? 100}%` }} transition={{ duration: 0.3 }} />
                )}
              </div>
              <p className="mt-3 text-[12px] text-muted">Appen lukker kort og åbner igen af sig selv.</p>
            </>
          ) : (
            <>
              <p className="font-medium text-ink">Nyheder</p>
              {/* Tidied here too, so notes published before releaseNotes.ts existed read right; and
                  scrolled, so a long text never pushes the buttons off the screen. */}
              <p className="mt-1 max-h-[min(45vh,340px)] overflow-y-auto whitespace-pre-line pr-1 leading-relaxed">{tidyNotes(available.notes) || NOTES_FALLBACK}</p>
              <p className="mt-3 text-[12px] text-muted">Tager under et minut. Appen genstarter af sig selv, og dine samtaler og nøgler bevares.</p>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** Reminder in the top bar after "Senere" – always visible, also with the sidebar hidden. */
export function UpdateButton() {
  const available = useUpdate((s) => s.available);
  const openPrompt = useUpdate((s) => s.openPrompt);
  if (!available) return null;
  return (
    <Tooltip content={`Version ${available.version} er klar – klik for at opdatere`} side="bottom">
      <motion.button
        type="button"
        onClick={openPrompt}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mr-1 flex h-7 items-center gap-1.5 rounded-full bg-brand px-3 text-[12.5px] font-medium text-white shadow-glow transition-colors hover:bg-brand-600"
      >
        <Download className="size-3.5" /> Opdatér
      </motion.button>
    </Tooltip>
  );
}
