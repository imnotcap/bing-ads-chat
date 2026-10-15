/**
 * The row under the chat field (Claude style): approval mode on the left; model,
 * effort and the monthly AI-usage ring on the right.
 */
import { ChartColumn, Check, ChevronDown, Hand, Rocket, Settings, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Popover } from 'radix-ui';
import { useMemo, useState } from 'react';
import { EFFORT_LABELS, MODELS, modelInfo, type Effort } from '@/ai/models';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';
import { daysInMonth, fmtUsd, today } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSettings, type ApprovalMode } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { monthTotal, useUsage } from '@/stores/usage';

const MODES: { value: ApprovalMode; label: string; description: string; icon: typeof Hand }[] = [
  { value: 'all', label: 'Godkend alt', description: 'Du godkender hver ændring', icon: Hand },
  { value: 'spend', label: 'Auto', description: 'Besparelser udføres straks – forbrugsøgninger kræver godkendelse', icon: ShieldCheck },
  { value: 'none', label: 'Autopilot', description: 'Ændringer inden for dine grænser udføres selv', icon: Rocket },
];

const EFFORT_SHORT: Record<Effort, string> = { low: 'Lav', medium: 'Mellem', high: 'Høj', xhigh: 'Meget høj', max: 'Maks' };

const shortModel = (label: string) => label.replace(/^Claude\s+/, '');

const trigger =
  'inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[12.5px] text-muted outline-none transition-colors hover:bg-line-2 hover:text-ink data-[state=open]:bg-line-2 data-[state=open]:text-ink';

const nextMonthLabel = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' }).format(new Date(now.getFullYear(), now.getMonth() + 1, 1));
};

const untilMidnight = () => {
  const now = new Date();
  const mins = Math.max(1, Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()) / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)} t ${mins % 60} min` : `${mins} min`;
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

/** Ring with this month's AI spend; opens a "Brug" popover right above it (Claude style). */
function UsageRing() {
  const months = useUsage((s) => s.months);
  const days = useUsage((s) => s.days);
  const cap = useSettings((s) => s.ai.monthlyAiBudgetUsd);
  const go = useUi((s) => s.go);
  const [open, setOpen] = useState(false);
  const used = useMemo(() => monthTotal(months).costUsd, [months]);
  const usedToday = days[today()] ?? 0;
  const share = cap ? Math.min(1, used / cap) : 0;
  const r = 6.5;
  const c = 2 * Math.PI * r;
  const openSettings = () => {
    setOpen(false);
    go('settings', 'ai');
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
                className="w-[330px] origin-[var(--radix-popover-content-transform-origin)] rounded-2xl border border-line bg-white p-4 shadow-pop"
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
                <div className="grid gap-4">
                  <UsageRow label="I dag" used={usedToday} limit={cap ? cap / daysInMonth() : null} reset={`Nulstilles om ${untilMidnight()}`} />
                  <UsageRow label="Denne måned" used={used} limit={cap} reset={`Nulstilles ${nextMonthLabel()}`} />
                </div>
                {!cap && (
                  <button type="button" onClick={openSettings} className="mt-3 text-[12.5px] font-medium text-brand hover:underline">
                    Sæt et månedligt loft for AI-forbrug
                  </button>
                )}
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

export function ComposerFooter() {
  const mode = useSettings((s) => s.spend.approvalMode);
  const setSpend = useSettings((s) => s.setSpend);
  const ai = useSettings((s) => s.ai);
  const setAi = useSettings((s) => s.setAi);
  const current = MODES.find((m) => m.value === mode) ?? MODES[1]!;

  return (
    <div className="mt-1.5 flex items-center px-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={trigger} aria-label="Godkendelse af ændringer">
            {current.label}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[300px]">
          <DropdownMenuLabel className="normal-case tracking-normal">Godkendelse af ændringer</DropdownMenuLabel>
          {MODES.map((m) => (
            <DropdownMenuItem key={m.value} onSelect={() => setSpend({ approvalMode: m.value })} className="items-start">
              <m.icon className="mt-0.5" />
              <span className="grid flex-1 gap-0.5">
                <span className={cn(m.value === mode && 'font-medium text-ink')}>{m.label}</span>
                <span className="text-[12px] leading-snug text-muted">{m.description}</span>
              </span>
              {m.value === mode && <Check className="mt-0.5 !text-brand" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="ml-auto" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={trigger} aria-label="Model og indsats">
            <span className="text-ink-2">{shortModel(modelInfo(ai.model).label)}</span>
            <span>{EFFORT_SHORT[ai.effort]}</span>
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-[300px]">
          <DropdownMenuLabel className="normal-case tracking-normal">Model</DropdownMenuLabel>
          {MODELS.map((m) => (
            <DropdownMenuItem key={m.id} onSelect={() => setAi({ model: m.id })} className="items-start">
              <span className="grid flex-1 gap-0.5">
                <span className={cn(m.id === ai.model && 'font-medium text-ink')}>{shortModel(m.label)}</span>
                <span className="text-[12px] leading-snug text-muted">{m.description}</span>
              </span>
              {m.id === ai.model && <Check className="mt-0.5 !text-brand" />}
            </DropdownMenuItem>
          ))}
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
}
