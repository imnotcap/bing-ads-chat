/**
 * The row under the chat field (Claude style): the focus (campaign / ad group) and connectors on
 * the left; model, effort and the monthly AI-usage ring on the right.
 */
import { ChartColumn, Check, ChevronDown, Loader2, Plug, Plus, Settings } from '@/components/icons';
import { AnimatePresence, motion } from 'motion/react';
import { Popover } from 'radix-ui';
import { memo, useEffect, useState } from 'react';
import { CONNECTORS, isConnectorOn } from '@/ai/connectors';
import { EFFORT_LABELS, PROVIDER_LABELS, availableModels, modelInfo, type Effort, type Provider } from '@/ai/models';
import { Switch } from '@/components/ui/controls';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/notifications/toast';
import { BrandIcon, type Brand } from '@/components/brand/BrandIcon';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';
import { fmtUsd } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { buyExtraUsage, refreshBilling, useBilling } from '@/workspace/billing';
import { PLANS } from '@/workspace/plans';
import { useAccount } from '@/stores/account';
import { FocusPicker } from './FocusPicker';


const EFFORT_SHORT: Record<Effort, string> = { low: 'Lav', medium: 'Mellem', high: 'Høj', xhigh: 'Meget høj', max: 'Maks' };

const shortModel = (label: string) => label.replace(/^Claude\s+/, '');

const trigger =
  'inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[12.5px] text-muted outline-none transition-colors hover:bg-line-2 hover:text-ink data-[state=open]:bg-line-2 data-[state=open]:text-ink';

const nextMonthLabel = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' }).format(new Date(now.getFullYear(), now.getMonth() + 1, 1));
};

const tone = (share: number) => (share >= 1 ? 'var(--color-negative)' : share >= 0.8 ? 'var(--color-warning)' : 'var(--color-brand)');

function UsageRow({ label, used, limit, reset }: { label: string; used: number; limit: number | null; reset: string }) {
  const share = limit ? used / limit : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13.5px] font-semibold text-ink">{label}</span>
        <span className="text-[12.5px] tabular text-muted">{limit ? `${Math.round(share * 100)} % brugt` : `${fmtUsd(used)} brugt`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tone(share) }}
          initial={{ width: 0 }}
          animate={{ width: `${limit ? Math.min(100, Math.max(share > 0 ? 2 : 0, share * 100)) : 0}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-[12px] text-subtle">
        {limit ? `${fmtUsd(used)} af ${fmtUsd(limit)} · ` : ''}
        {reset}
      </span>
    </div>
  );
}

/** Ring with this month's AI use; opens a "Brug" popover right above it (Claude style). */
function UsageRing() {
  const billing = useBilling((s) => s.state);
  const pending = useBilling((s) => s.pending);
  const go = useUi((s) => s.go);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [buying, setBuying] = useState(false);
  useEffect(() => {
    void refreshBilling();
  }, []);
  useEffect(() => {
    if (open) void refreshBilling();
    else setConfirm(false);
  }, [open]);
  const used = (billing?.usedUsd ?? 0) + pending;
  const left = Math.max(0, (billing?.remainingUsd ?? 0) - pending);
  const share = billing ? Math.min(1, used / Math.max(used + left, 0.0001)) : 0;
  const isAdmin = useAccount((s) => s.user?.role === 'admin');
  const r = 6.5;
  const c = 2 * Math.PI * r;
  const openSettings = () => {
    setOpen(false);
    go('settings', 'ai');
  };
  const buy = async () => {
    setBuying(true);
    try {
      const state = await buyExtraUsage();
      setConfirm(false);
      toast.success('Ekstra forbrug købt', { description: `${fmtUsd(state.pack.creditUsd)} lagt i virksomhedens pulje – nu ${fmtUsd(state.remainingUsd)} tilbage.` });
    } catch (e) {
      toast.error('Købet gik ikke igennem', { description: errorMessage(e) });
    } finally {
      setBuying(false);
    }
  };
  const headerButton = 'grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-line-2 hover:text-ink';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label="AI-forbrug" className="grid size-7 place-items-center rounded-md transition-colors hover:bg-line-2 data-[state=open]:bg-line-2">
          <svg viewBox="0 0 16 16" className="size-4 -rotate-90">
            <circle cx="8" cy="8" r={r} fill="none" stroke="var(--color-line)" strokeWidth="2" />
            <circle
              cx="8"
              cy="8"
              r={r}
              fill="none"
              stroke={tone(share)}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - share)}
              className="transition-[stroke-dashoffset] duration-500"
            />
          </svg>
        </button>
      </Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content forceMount side="top" align="end" sideOffset={10} collisionPadding={12} className="z-50 outline-none">
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="w-[340px] origin-[var(--radix-popover-content-transform-origin)] rounded-2xl border border-line bg-white p-4 shadow-pop"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-ink">Brug</span>
                  <div className="flex items-center">
                    <button type="button" aria-label="Forbrugsoversigt" title="Forbrugsoversigt" onClick={openSettings} className={headerButton}>
                      <ChartColumn className="size-4" />
                    </button>
                    <button type="button" aria-label="AI-indstillinger" title="AI-indstillinger" onClick={openSettings} className={headerButton}>
                      <Settings className="size-4" />
                    </button>
                  </div>
                </div>
                {!billing ? (
                  <p className="text-[13px] text-muted">Forbruget kunne ikke hentes lige nu.</p>
                ) : (
                  <div className="grid gap-4">
                    <UsageRow
                      label="Virksomhedens pulje"
                      used={Math.min(used, billing.includedUsd)}
                      limit={billing.includedUsd}
                      reset={`${PLANS[billing.plan].name} · ${billing.seats} ${billing.seats === 1 ? 'plads' : 'pladser'} · nulstilles ${nextMonthLabel()}`}
                    />
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13.5px] font-semibold text-ink">Ekstra credits</span>
                      <span className="text-[12.5px] tabular text-muted">{fmtUsd(billing.creditUsd)} tilbage</span>
                    </div>
                    {left <= 0 && (
                      <div className="rounded-lg bg-negative-bg px-2.5 py-1.5 text-[12.5px] text-negative">
                        Puljen er brugt – {isAdmin ? 'køb ekstra for at fortsætte.' : 'bed en administrator om at købe ekstra forbrug.'}
                      </div>
                    )}
                    {!isAdmin ? (
                      <p className="text-[12px] leading-relaxed text-subtle">Kun administratorer kan købe ekstra forbrug til virksomheden.</p>
                    ) : confirm ? (
                      <div className="grid gap-2 rounded-xl border border-brand/25 bg-brand-50/60 p-3">
                        <div className="text-[13px] text-ink">
                          Køb ekstra forbrug for <b>{fmtUsd(billing.pack.priceUsd)}</b> og få <b>{fmtUsd(billing.pack.creditUsd)}</b> mere AI-forbrug til virksomhedens pulje.
                        </div>
                        <div className="text-[12px] text-muted">Købet registreres med dit navn og kommer på næste faktura.</div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="gradient" disabled={buying} onClick={() => void buy()}>
                            {buying ? <Loader2 className="animate-spin" /> : <Check />} Køb for {fmtUsd(billing.pack.priceUsd)}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={buying} onClick={() => setConfirm(false)}>
                            Annullér
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant={left <= 0 ? 'gradient' : 'secondary'} className="w-full" onClick={() => setConfirm(true)}>
                        <Plus /> Køb ekstra forbrug · {fmtUsd(billing.pack.priceUsd)} for {fmtUsd(billing.pack.creditUsd)}
                      </Button>
                    )}
                    {billing.purchases.length > 0 && (
                      <div className="text-[12px] text-subtle">
                        Købt denne måned: {billing.purchases.length} × {fmtUsd(billing.pack.priceUsd)}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

/** Connectors on/off for this chat (like Claude's "Search and tools"). */
function ConnectorsMenu() {
  const connectors = useSettings((s) => s.ai.connectors);
  const model = useSettings((s) => s.ai.model);
  const setAi = useSettings((s) => s.setAi);
  const provider = modelInfo(model).provider;
  const usable = CONNECTORS.filter((c) => !c.providers || c.providers.includes(provider));
  const on = usable.filter((c) => isConnectorOn(connectors, c.id)).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(trigger, 'gap-1.5')} aria-label="Connectors">
          {isConnectorOn(connectors, 'msads_read') ? <BrandIcon brand="microsoft_ads" className="size-3.5" /> : <Plug className="size-3.5" />}
          <span>
            {on}/{usable.length}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[340px]">
        <DropdownMenuLabel className="normal-case tracking-normal">Connectors – hvad assistenten må bruge</DropdownMenuLabel>
        {CONNECTORS.map((c) => {
          const supported = !c.providers || c.providers.includes(provider);
          const checked = supported && isConnectorOn(connectors, c.id);
          return (
            <DropdownMenuItem
              key={c.id}
              disabled={!supported}
              onSelect={(e) => {
                e.preventDefault();
                setAi({ connectors: { ...connectors, [c.id]: !checked } });
              }}
              className="items-start"
            >
              {c.brand ? <BrandIcon brand={c.brand} className="mt-0.5 !size-4" /> : <c.icon className="mt-0.5" />}
              <span className="grid flex-1 gap-0.5">
                <span className={cn(checked && 'font-medium text-ink')}>{c.label}</span>
                <span className="text-[12px] leading-snug text-muted">{supported ? c.description : 'Kun med Claude-modeller'}</span>
              </span>
              <Switch checked={checked} tabIndex={-1} className="pointer-events-none mt-0.5" aria-hidden />
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {(['google_ads', 'meta'] as Brand[]).map((b) => (
          <div key={b} className="flex items-center gap-2.5 px-2.5 py-2 text-[13.5px] text-muted">
            <BrandIcon brand={b} className="opacity-60" />
            <span className="flex-1">{b === 'google_ads' ? 'Google Ads' : 'Meta Ads'}</span>
            <span className="rounded-full bg-line-2 px-2 py-0.5 text-[11px]">Kommer snart</span>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const providerBrand = (p: Provider): Brand => (p === 'google' ? 'gemini' : 'claude');

/** Memoized: it has no props, so typing in the chat field never re-renders it. */
export const ComposerFooter = memo(function ComposerFooter() {
  const ai = useSettings((s) => s.ai);
  const setAi = useSettings((s) => s.setAi);
  // Re-read when the admin changes the allowed models.
  useSettings((s) => s.ai.enabledModels);
  useSettings((s) => s.ai.customModels);
  const models = availableModels();
  const providers = new Set(models.map((m) => m.provider)).size;
  // The admin may have removed the model in use – fall back to the first allowed one.
  useEffect(() => {
    if (!models.some((m) => m.id === ai.model)) setAi({ model: models[0]!.id });
  }, [models, ai.model, setAi]);

  return (
    <div className="mt-1.5 flex items-center px-2">
      <FocusPicker />

      <ConnectorsMenu />

      <span className="ml-auto" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={trigger} aria-label="Model og indsats">
            <BrandIcon brand={providerBrand(modelInfo(ai.model).provider)} className="size-3.5" />
            <span className="text-ink-2">{shortModel(modelInfo(ai.model).label)}</span>
            <span>{EFFORT_SHORT[ai.effort]}</span>
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={8} className="max-h-[70vh] w-[320px] overflow-y-auto">
          <DropdownMenuLabel className="normal-case tracking-normal">Model</DropdownMenuLabel>
          {(['google', 'anthropic'] as Provider[]).map((provider) => {
            const list = models.filter((m) => m.provider === provider);
            if (!list.length) return null;
            return (
              <div key={provider}>
                {providers > 1 && <div className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-medium text-subtle">{PROVIDER_LABELS[provider]}</div>}
                {list.map((m) => (
                  <DropdownMenuItem key={m.id} onSelect={() => setAi({ model: m.id })} className="items-start">
                    <BrandIcon brand={providerBrand(m.provider)} className="mt-0.5 !size-4" />
                    <span className="grid flex-1 gap-0.5">
                      <span className={cn(m.id === ai.model && 'font-medium text-ink')}>{shortModel(m.label)}</span>
                      {m.description && <span className="line-clamp-2 text-[12px] leading-snug text-muted">{m.description}</span>}
                    </span>
                    {m.id === ai.model && <Check className="mt-0.5 !text-brand" />}
                  </DropdownMenuItem>
                ))}
              </div>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="normal-case tracking-normal">Indsats</DropdownMenuLabel>
          {(['low', 'medium', 'high', 'xhigh'] as Effort[]).map((e) => (
            <DropdownMenuItem key={e} onSelect={() => setAi({ effort: e })}>
              <span className={cn('flex-1', e === ai.effort && 'font-medium text-ink')}>{EFFORT_SHORT[e]}</span>
              <span className="text-[11.5px] text-subtle">{EFFORT_LABELS[e].split(' – ')[1]}</span>
              {e === ai.effort && <Check className="!text-brand" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <UsageRing />
    </div>
  );
});
