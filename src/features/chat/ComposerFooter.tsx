/**
 * The row under the chat field (Claude style): approval mode on the left; model,
 * effort and the monthly AI-usage ring on the right.
 */
import { Check, ChevronDown, Hand, Rocket, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { EFFORT_LABELS, MODELS, modelInfo, type Effort } from '@/ai/models';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '@/components/ui/overlays';
import { fmtUsd } from '@/lib/format';
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

function UsageRing() {
  const months = useUsage((s) => s.months);
  const cap = useSettings((s) => s.ai.monthlyAiBudgetUsd);
  const go = useUi((s) => s.go);
  const used = useMemo(() => monthTotal(months).costUsd, [months]);
  const share = cap ? Math.min(1, used / cap) : 0;
  const r = 6.5;
  const c = 2 * Math.PI * r;
  return (
    <Tooltip content={cap ? `AI-forbrug denne måned: ${fmtUsd(used)} af ${fmtUsd(cap)}` : `AI-forbrug denne måned: ${fmtUsd(used)} (intet loft)`}>
      <button type="button" aria-label="AI-forbrug" onClick={() => go('settings', 'ai')} className="grid size-7 place-items-center rounded-md transition-colors hover:bg-line-2">
        <svg viewBox="0 0 16 16" className="size-4 -rotate-90">
          <circle cx="8" cy="8" r={r} fill="none" stroke="var(--color-line)" strokeWidth="2" />
          <circle
            cx="8"
            cy="8"
            r={r}
            fill="none"
            stroke={share >= 1 ? 'var(--color-negative)' : share >= 0.8 ? 'var(--color-warning)' : 'var(--color-brand)'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - share)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
      </button>
    </Tooltip>
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
