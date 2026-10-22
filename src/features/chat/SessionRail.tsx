/**
 * The session rail next to the chat: what the conversation works on, how full its
 * context is, the shared connections, what it produced, the changes it made on the
 * account and what is running right now. Every card folds on its own.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, type ReactNode } from 'react';
import { COMPACT_AT } from '@/ai/agent';
import { modelInfo } from '@/ai/models';
import { TERMINAL_TOOLS } from '@/ai/tools';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { Ban, BarChart3, Building2, CalendarDays, Check, ChevronDown, Clock3, Crosshair, FileText, Loader2, PanelRightClose, Paperclip, Rows3, TrendingUp, X, type LucideIcon } from '@/components/icons';
import { EASE } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Select, Tooltip } from '@/components/ui/overlays';
import { useSelectedRange } from '@/hooks/useAdsData';
import { DATE_PRESET_LABELS, fmtNumber, fmtTime, fmtUsd, type DatePreset } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAccount } from '@/stores/account';
import { useActivity, type ActivityEntry } from '@/stores/activity';
import { useChat, type Conversation } from '@/stores/chat';
import { useConnection, useCurrentAccount } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { useFocus } from './focus';

const WIDTH = 300;

type OutputKind = 'chart' | 'table' | 'kpis' | 'file' | 'attachment';
interface Output {
  itemId: string;
  kind: OutputKind;
  title: string;
}
interface Snapshot {
  id: string;
  context: number;
  cost: number;
  outputs: Output[];
  running: { id: string; label: string; waiting: boolean }[];
  done: number;
}

const OUTPUT_ICONS: Record<OutputKind, LucideIcon> = { chart: BarChart3, table: Rows3, kpis: TrendingUp, file: FileText, attachment: Paperclip };
const OUTPUT_NAMES: Record<OutputKind, string> = { chart: 'Graf', table: 'Tabel', kpis: 'Nøgletal', file: 'Fil', attachment: 'Vedhæftet fil' };

/** What the rail shows of a conversation, as a string – so streamed text doesn't re-render the rail. */
function snapshotOf(c: Conversation | undefined): string {
  if (!c) return '';
  const snap: Snapshot = { id: c.id, context: 0, cost: 0, outputs: [], running: [], done: 0 };
  for (const it of c.items) {
    if (it.kind === 'user') {
      for (const a of it.attachments ?? []) snap.outputs.push({ itemId: it.id, kind: 'attachment', title: a.name });
      continue;
    }
    snap.cost += it.costUsd ?? 0;
    if (it.contextTokens) snap.context = it.contextTokens;
    for (const p of it.parts) {
      if (p.type === 'visual' && p.visual.type !== 'suggestions') {
        const v = p.visual;
        snap.outputs.push({ itemId: it.id, kind: v.type, title: (v.type === 'file' ? v.fileName : v.title) || OUTPUT_NAMES[v.type] });
      } else if (p.type === 'tool' && !TERMINAL_TOOLS.has(p.name)) {
        if (p.status === 'running' || p.status === 'streaming' || p.status === 'awaiting_approval') snap.running.push({ id: p.id, label: p.label, waiting: p.status === 'awaiting_approval' });
        else if (p.status === 'done') snap.done++;
      }
    }
  }
  return JSON.stringify(snap);
}

function Card({ id, title, meta, children }: { id: string; title: string; meta?: ReactNode; children: ReactNode }) {
  const open = useSettings((s) => s.appearance.insightSections[id] ?? true);
  const setAppearance = useSettings((s) => s.setAppearance);
  const toggle = () => setAppearance({ insightSections: { ...useSettings.getState().appearance.insightSections, [id]: !open } });
  return (
    <section className="min-w-0 shrink-0 rounded-xl border border-line">
      <button type="button" onClick={toggle} aria-expanded={open} className="group flex w-full items-center gap-1.5 px-3.5 py-2.5 text-left">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        <ChevronDown className={cn('size-3.5 text-subtle transition-transform duration-200 group-hover:text-ink', !open && '-rotate-90')} />
        {meta && <span className="ml-auto flex items-center gap-2 text-[12px] tabular text-muted">{meta}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.24, ease: EASE }} className="overflow-hidden">
            <div className="px-3.5 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Row({ icon, children, end, onClick, title }: { icon: ReactNode; children: ReactNode; end?: ReactNode; onClick?: () => void; title?: string }) {
  const body = (
    <>
      <span className="grid size-4 shrink-0 place-items-center text-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {end}
    </>
  );
  const cls = 'flex w-full items-center gap-2.5 rounded-md px-1 py-[5px] text-left text-[12.5px] text-ink-2';
  return onClick ? (
    <button type="button" onClick={onClick} title={title} className={cn(cls, 'transition-colors hover:bg-line-2 hover:text-ink')}>
      {body}
    </button>
  ) : (
    <div className={cls} title={title}>
      {body}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-1 text-[12px] leading-relaxed text-muted">{children}</p>;
}

function Dot({ on }: { on: boolean }) {
  return <span className={cn('size-1.5 shrink-0 rounded-full', on ? 'bg-positive' : 'bg-line')} />;
}

function Meter({ share, className }: { share: number; className?: string }) {
  return (
    <span className={cn('relative block h-1.5 overflow-hidden rounded-full bg-line-2', className)}>
      <span className={cn('absolute inset-y-0 left-0 rounded-full', share >= 0.85 ? 'bg-warning' : 'bg-brand')} style={{ width: `${Math.min(100, share * 100)}%` }} />
    </span>
  );
}

const scrollToMessage = (itemId: string) => document.getElementById(`msg-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

const CHANGE_ICON: Record<ActivityEntry['status'], ReactNode> = {
  success: <Check className="size-3.5 text-positive" />,
  failed: <X className="size-3.5 text-negative" />,
  rejected: <Ban className="size-3.5 text-subtle" />,
  blocked: <Ban className="size-3.5 text-warning" />,
};

function RailContent() {
  const account = useCurrentAccount();
  const mode = useConnection((s) => s.mode);
  const workspace = useAccount((s) => s.workspace);
  const model = useSettings((s) => s.ai.model);
  const setDatePreset = useSettings((s) => s.setDatePreset);
  const setAppearance = useSettings((s) => s.setAppearance);
  const go = useUi((s) => s.go);
  const range = useSelectedRange();
  const focus = useFocus();
  const raw = useChat((s) => snapshotOf(s.conversations.find((c) => c.id === s.activeId)));
  const snap = useMemo(() => (raw ? (JSON.parse(raw) as Snapshot) : null), [raw]);
  const entries = useActivity((s) => s.entries);
  const changes = useMemo(() => (snap ? entries.filter((e) => e.conversationId === snap.id) : []), [entries, snap]);

  const info = modelInfo(model);
  const share = snap ? snap.context / COMPACT_AT : 0;
  const connections = [
    { name: 'Microsoft Advertising', icon: <BrandIcon brand="microsoft_ads" className="size-3.5" />, on: !!workspace?.ads?.connected, note: mode === 'demo' ? 'Demo-data' : undefined },
    { name: 'Claude', icon: <BrandIcon brand="claude" className="size-3.5" />, on: !!workspace?.keys?.anthropic },
    { name: 'Gemini', icon: <BrandIcon brand="gemini" className="size-3.5" />, on: !!workspace?.keys?.google },
    { name: 'Inventarland', icon: <ShopIcon />, on: !!workspace?.inventarland?.connected },
  ];
  const connected = connections.filter((c) => c.on).length;

  return (
    <div className="flex h-full flex-col" style={{ width: WIDTH }}>
      <div className="flex h-14 shrink-0 items-center gap-1 px-4">
        <span className="pl-1 text-[14px] font-medium text-ink">Session</span>
        <Tooltip content="Skjul session (Ctrl+I)">
          <Button size="icon-xs" variant="ghost" className="ml-auto" aria-label="Skjul session" onClick={() => setAppearance({ insightsPanel: false })}>
            <PanelRightClose />
          </Button>
        </Tooltip>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-4">
        <Card id="session" title="Konto">
          <Row icon={<Building2 className="size-3.5" />} end={<span className="rounded-full bg-line-2 px-1.5 py-px text-[10.5px] font-medium text-muted">{mode === 'demo' ? 'Demo' : 'Live'}</span>}>
            <span className="font-medium text-ink">{account?.name ?? 'Ingen konto'}</span>
          </Row>
          <Row icon={<Crosshair className="size-3.5" />} title="Vælges i chatfeltet">
            {focus ? (focus.adGroupName ? `${focus.campaignName} › ${focus.adGroupName}` : focus.campaignName) : 'Hele kontoen'}
          </Row>
          <div className="flex items-center gap-2.5 px-1 py-[3px] text-[12.5px] text-ink-2">
            <CalendarDays className="size-3.5 shrink-0 text-muted" />
            <span className="flex-1">Periode</span>
            <Select<DatePreset>
              triggerVariant="pill"
              align="end"
              aria-label="Periode"
              value={range.preset}
              onChange={setDatePreset}
              options={(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => ({ value: p, label: DATE_PRESET_LABELS[p] }))}
            />
          </div>
          <Row icon={<BrandIcon brand={info.provider === 'google' ? 'gemini' : 'claude'} className="size-3.5" />}>{info.label}</Row>
        </Card>

        <Card id="context" title="Kontekst" meta={<><span>{Math.round(share * 100)} %</span><Meter share={share} className="w-7" /></>}>
          {snap?.context ? (
            <div className="grid gap-2 px-1">
              <Meter share={share} />
              <p className="text-[12px] tabular text-ink-2">
                {fmtNumber(snap.context)} af {fmtNumber(COMPACT_AT)} tokens
              </p>
              <p className="text-[12px] leading-relaxed text-muted">Ved 100 % opsummerer assistenten selv det tidlige i samtalen – det vigtige huskes stadig.</p>
              {snap.cost > 0 && <p className="text-[12px] tabular text-muted">AI-forbrug i samtalen ≈ {fmtUsd(snap.cost)}</p>}
            </div>
          ) : (
            <Empty>Fyldes, efterhånden som samtalen bliver længere.</Empty>
          )}
        </Card>

        <Card id="connections" title="Forbindelser" meta={`${connected} forbundet`}>
          {connections.map((c) => (
            <Row key={c.name} icon={c.icon} end={<span className="flex items-center gap-1.5 text-[11.5px] text-muted">{c.note ?? (c.on ? 'Forbundet' : 'Ikke forbundet')}<Dot on={c.on} /></span>}>
              {c.name}
            </Row>
          ))}
          <button type="button" onClick={() => go('settings', 'connections')} className="mt-1 px-1 text-[12px] font-medium text-brand hover:underline">
            Administrér forbindelser
          </button>
        </Card>

        <Card id="outputs" title="Output" meta={snap?.outputs.length ? String(snap.outputs.length) : undefined}>
          {snap?.outputs.length ? (
            <>
              {snap.outputs.slice(-8).map((o, i) => {
                const Icon = OUTPUT_ICONS[o.kind];
                return (
                  <Row key={`${o.itemId}-${i}`} icon={<Icon className="size-3.5" />} onClick={() => scrollToMessage(o.itemId)} title="Vis i samtalen">
                    {o.title}
                  </Row>
                );
              })}
              {snap.outputs.length > 8 && <Empty>+ {snap.outputs.length - 8} tidligere</Empty>}
            </>
          ) : (
            <Empty>Grafer, tabeller og filer fra samtalen samles her.</Empty>
          )}
        </Card>

        <Card id="changes" title="Ændringer" meta={changes.length ? String(changes.length) : undefined}>
          {changes.length ? (
            <>
              {changes.slice(0, 8).map((e) => (
                <Row key={e.id} icon={CHANGE_ICON[e.status]} end={<span className="shrink-0 text-[11px] tabular text-subtle">{fmtTime(e.ts)}</span>} title={e.error ?? e.summary}>
                  <span className={cn(e.undone && 'line-through')}>{e.summary}</span>
                </Row>
              ))}
              <button type="button" onClick={() => go('activity')} className="mt-1 px-1 text-[12px] font-medium text-brand hover:underline">
                Åbn Aktivitet
              </button>
            </>
          ) : (
            <Empty>Ingen ændringer på kontoen i denne samtale.</Empty>
          )}
        </Card>

        <Card id="tasks" title="Opgaver" meta={snap?.running.length ? `${snap.running.length} kører` : undefined}>
          {snap?.running.map((t) => (
            <Row key={t.id} icon={t.waiting ? <Clock3 className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin" />}>
              {t.waiting ? `Venter på godkendelse · ${t.label}` : t.label}
            </Row>
          ))}
          {snap?.done ? (
            <Row icon={<Check className="size-3.5" />}>
              {fmtNumber(snap.done)} færdige
            </Row>
          ) : (
            !snap?.running.length && <Empty>Når assistenten henter data eller laver ændringer, kan du følge det her.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

function ShopIcon() {
  return <span className="grid size-3.5 place-items-center rounded-[3px] bg-ink text-[8px] font-bold text-white">I</span>;
}

export function SessionRail({ open }: { open: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="session"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="relative z-10 h-full shrink-0 overflow-hidden border-l border-line"
          aria-label="Session"
        >
          <RailContent />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
