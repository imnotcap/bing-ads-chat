/** Small building blocks shared by the board and the card dialog. */
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, ChevronUp, ChevronsUp, Equal, Pencil, Trash2, X } from '@/components/icons';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { EASE } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LABEL_COLORS, PRIORITIES, initialsOf, useBoard, type Priority, type Board, type BoardLabel, type LabelColor, type Member } from '@/stores/board';

export function Avatar({ member, size = 26, ring }: { member: Member; size?: number; ring?: boolean }) {
  const meId = useBoard((s) => s.meId);
  return (
    <span
      title={member.id === meId ? `${member.name} (dig)` : member.role ? `${member.name} · ${member.role}` : member.name}
      className={cn('grid shrink-0 place-items-center rounded-full font-semibold text-white', ring && 'ring-2 ring-white')}
      style={{ width: size, height: size, background: member.color, fontSize: Math.round(size * 0.4) }}
    >
      {initialsOf(member.name)}
    </span>
  );
}

export function LabelPill({ label, expanded = true, className }: { label: BoardLabel; expanded?: boolean; className?: string }) {
  const c = LABEL_COLORS[label.color];
  if (!expanded) return <span title={label.name} className={cn('h-2 w-10 rounded-full', className)} style={{ background: c.solid }} />;
  return (
    <span
      className={cn('inline-flex h-[22px] max-w-full items-center rounded-md px-2 text-[11.5px] font-medium leading-none', className)}
      style={{ background: c.soft, color: c.text, boxShadow: `inset 0 0 0 1px ${c.solid}26` }}
    >
      <span className="truncate">{label.name || c.name}</span>
    </span>
  );
}

const PRIORITY_ICONS = { highest: ChevronsUp, high: ChevronUp, medium: Equal, low: ChevronDown } as const;

export function PriorityTag({ priority, showLabel = true, className }: { priority: Priority; showLabel?: boolean; className?: string }) {
  const Icon = PRIORITY_ICONS[priority];
  const p = PRIORITIES[priority];
  return (
    <span title={`Prioritet: ${p.label}`} className={cn('inline-flex items-center gap-1 text-[12px] font-medium', className)} style={{ color: p.color }}>
      <Icon className="size-3.5" strokeWidth={2.4} />
      {showLabel && p.label}
    </span>
  );
}

export function PriorityPicker({ value, onChange }: { value: Priority | null; onChange: (p: Priority | null) => void }) {
  return (
    <div className="grid gap-0.5">
      {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
        <button key={p} type="button" onClick={() => onChange(p)} className="flex h-8 items-center justify-between rounded-lg px-2 hover:bg-line-2">
          <PriorityTag priority={p} />
          {value === p && <Check className="size-4 text-brand" />}
        </button>
      ))}
      {value && (
        <Button size="xs" variant="ghost" className="mt-1" onClick={() => onChange(null)}>
          Fjern prioritet
        </Button>
      )}
    </div>
  );
}

/** Popover panel with a title row, in the dropdown style. */
export function Pop({
  trigger,
  title,
  children,
  open,
  onOpenChange,
  align = 'start',
  width = 'w-[288px]',
}: {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  align?: 'start' | 'end' | 'center';
  width?: string;
}) {
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const setOpen = (o: boolean) => {
    setInner(o);
    onOpenChange?.(o);
  };
  return (
    <Popover.Root open={isOpen} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <AnimatePresence>
        {isOpen && (
          <Popover.Portal forceMount>
            <Popover.Content forceMount align={align} sideOffset={6} collisionPadding={12} className="z-[60] outline-none">
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: EASE }}
                className={cn('fit-width grid max-w-[calc(100vw-24px)] rounded-xl border border-line bg-white/95 p-3 shadow-pop backdrop-blur-xl', width)}
              >
                <div className="mb-2.5 flex items-center">
                  <span className="flex-1 text-center text-[12.5px] font-semibold text-ink-2">{title}</span>
                  <Popover.Close aria-label="Luk" className="grid size-6 place-items-center rounded-md text-muted hover:bg-line-2 hover:text-ink">
                    <X className="size-3.5" />
                  </Popover.Close>
                </div>
                {children}
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

const COLOR_KEYS = Object.keys(LABEL_COLORS) as LabelColor[];

export function ColorGrid({ value, onChange }: { value: LabelColor | null; onChange: (c: LabelColor) => void }) {
  return (
    <div className="grid grid-cols-9 gap-1.5">
      {COLOR_KEYS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={LABEL_COLORS[c].name}
          title={LABEL_COLORS[c].name}
          onClick={() => onChange(c)}
          className={cn('grid h-6 place-items-center rounded-md transition-transform hover:scale-110', value === c && 'ring-2 ring-ink/70 ring-offset-1')}
          style={{ background: LABEL_COLORS[c].solid }}
        >
          {value === c && <Check className="size-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}

/** Pick labels for a card, and create/edit/delete the board's labels. */
export function LabelPicker({ board, selected, onToggle }: { board: Board; selected: string[]; onToggle: (labelId: string) => void }) {
  const addLabel = useBoard((s) => s.addLabel);
  const updateLabel = useBoard((s) => s.updateLabel);
  const deleteLabel = useBoard((s) => s.deleteLabel);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<LabelColor>('green');

  if (editing) {
    const save = () => {
      if (editing === 'new') {
        const id = addLabel(board.id, name, color);
        onToggle(id);
      } else updateLabel(board.id, editing, { name: name.trim(), color });
      setEditing(null);
    };
    return (
      <div className="grid gap-3">
        <div className="grid place-items-center rounded-lg bg-line-2 py-3">
          <LabelPill label={{ id: 'preview', name: name || 'Etiket', color }} />
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Navn, f.eks. SEO"
          className="h-8 rounded-lg border border-line px-2.5 text-[13px] outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
        />
        <ColorGrid value={color} onChange={setColor} />
        <div className="flex gap-2">
          <Button size="xs" variant="gradient" onClick={save}>
            {editing === 'new' ? 'Opret' : 'Gem'}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setEditing(null)}>
            Tilbage
          </Button>
          {editing !== 'new' && (
            <Button
              size="xs"
              variant="ghost"
              className="ml-auto text-negative hover:bg-negative-bg hover:text-negative"
              onClick={() => {
                deleteLabel(board.id, editing);
                setEditing(null);
              }}
            >
              <Trash2 /> Slet
            </Button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-1.5">
      {board.labels.map((l) => {
        const on = selected.includes(l.id);
        return (
          <div key={l.id} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggle(l.id)}
              className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-line-2"
            >
              <span className={cn('grid size-4 shrink-0 place-items-center rounded border', on ? 'border-brand bg-brand text-white' : 'border-black/20')}>{on && <Check className="size-3" />}</span>
              <LabelPill label={l} className="flex-1" />
            </button>
            <button
              type="button"
              aria-label={`Redigér ${l.name}`}
              onClick={() => {
                setName(l.name);
                setColor(l.color);
                setEditing(l.id);
              }}
              className="grid size-7 place-items-center rounded-md text-subtle hover:bg-line-2 hover:text-ink"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        );
      })}
      <Button
        size="xs"
        variant="secondary"
        className="mt-1"
        onClick={() => {
          setName('');
          setColor('green');
          setEditing('new');
        }}
      >
        Opret en ny etiket
      </Button>
    </div>
  );
}

export function MemberPicker({ selected, onToggle }: { selected: string[]; onToggle: (memberId: string) => void }) {
  const members = useBoard((s) => s.members);
  const meId = useBoard((s) => s.meId);
  const [q, setQ] = useState('');
  const list = members.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.role?.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="grid gap-1">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Søg i teamet"
        className="mb-1 h-8 rounded-lg border border-line px-2.5 text-[13px] outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
      />
      {list.map((m) => {
        const on = selected.includes(m.id);
        return (
          <button key={m.id} type="button" onClick={() => onToggle(m.id)} className="flex h-9 items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-line-2">
            <Avatar member={m} size={24} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
              {m.name}
              {m.id === meId && <span className="text-subtle"> (dig)</span>}
              {m.role && <span className="text-subtle"> · {m.role}</span>}
            </span>
            {on && <Check className="size-4 text-brand" />}
          </button>
        );
      })}
      <p className="mt-1 px-1 text-[11.5px] leading-relaxed text-subtle">Tilføj kolleger under "Team" øverst på tavlen.</p>
    </div>
  );
}

/** Animated list wrapper for the comment/activity feed. */
export function FadeIn({ children, k }: { children: React.ReactNode; k: string }) {
  return (
    <motion.div key={k} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }}>
      {children}
    </motion.div>
  );
}
