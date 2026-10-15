import { motion } from 'motion/react';
import {
  Activity,
  Building2,
  Check,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  FlaskConical,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plug,
  Search,
  Settings,
  SquarePen,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatedList } from '@/components/reactbits';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/controls';
import { Dialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '@/components/ui/overlays';
import { fmtRelative, fmtUsd } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useChat, type Conversation } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUi, type View } from '@/stores/ui';
import { monthTotal, useUsage } from '@/stores/usage';
import { Logo, LogoMark } from './Logo';

const NAV: { view: View; label: string; icon: LucideIcon }[] = [
  { view: 'chat', label: 'Chat', icon: MessageSquare },
  { view: 'campaigns', label: 'Kampagner', icon: LayoutGrid },
  { view: 'activity', label: 'Aktivitet', icon: Activity },
  { view: 'settings', label: 'Indstillinger', icon: Settings },
];

function NavButton({ item, compact }: { item: (typeof NAV)[number]; compact: boolean }) {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);
  const pending = useChat((s) => Object.values(s.running).some(Boolean));
  const active = view === item.view;
  const btn = (
    <button
      type="button"
      onClick={() => go(item.view)}
      aria-label={compact ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-10 w-full items-center rounded-xl text-[14px] font-medium transition-colors',
        compact ? 'justify-center' : 'gap-3 px-3.5',
        active ? 'text-brand' : 'text-ink-2 hover:bg-white/70 hover:text-ink',
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_3px_rgb(16_24_64/0.08)]"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        />
      )}
      <item.icon className="relative size-[18px] shrink-0" strokeWidth={1.9} />
      {!compact && <span className="relative">{item.label}</span>}
      {item.view === 'chat' && pending && <span className="absolute right-2.5 top-2.5 size-2 animate-pulse rounded-full bg-brand" />}
    </button>
  );
  return compact ? (
    <Tooltip content={item.label} side="right">
      {btn}
    </Tooltip>
  ) : (
    btn
  );
}

function ConversationRow({ c }: { c: Conversation }) {
  const activeId = useChat((s) => s.activeId);
  const running = useChat((s) => !!s.running[c.id]);
  const select = useChat((s) => s.select);
  const remove = useChat((s) => s.remove);
  const rename = useChat((s) => s.rename);
  const go = useUi((s) => s.go);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(c.title);
  const [confirm, setConfirm] = useState(false);
  const active = c.id === activeId;

  return (
    <div
      className={cn(
        'group relative flex items-center rounded-xl transition-colors',
        active ? 'bg-white shadow-[0_1px_3px_rgb(16_24_64/0.07)]' : 'hover:bg-white/60',
      )}
    >
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            rename(c.id, title.trim() || c.title);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setTitle(c.title);
              setEditing(false);
            }
          }}
          className="mx-1 my-1 h-8 w-full rounded-lg border border-brand/40 bg-white px-2 text-[13px] outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            select(c.id);
            go('chat');
          }}
          className="flex min-w-0 flex-1 flex-col items-start px-3 py-2 text-left"
        >
          <span className={cn('w-full truncate text-[13px]', active ? 'font-semibold text-ink' : 'text-ink-2')}>
            {running && <span className="mr-1.5 inline-block size-1.5 -translate-y-px animate-pulse rounded-full bg-brand" />}
            {c.title}
          </span>
          <span className="text-[11px] text-subtle">
            {fmtRelative(c.updatedAt)}
            {c.mode === 'demo' && ' · demo'}
          </span>
        </button>
      )}
      {!editing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Flere handlinger"
              className="mr-1.5 grid size-7 shrink-0 place-items-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-line-2 hover:text-ink group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil /> Omdøb
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-negative data-[highlighted]:bg-negative-bg data-[highlighted]:text-negative [&_svg]:!text-negative">
              <Trash2 /> Slet samtale
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Slet samtalen?"
        description={`"${c.title}" slettes permanent. Ændringer på kontoen påvirkes ikke.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Annullér
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                remove(c.id);
                setConfirm(false);
              }}
            >
              Slet
            </Button>
          </>
        }
      />
    </div>
  );
}

function AccountSwitcher({ compact }: { compact: boolean }) {
  const { accounts, accountId, mode, set } = useConnection();
  const go = useUi((s) => s.go);
  const account = accounts.find((a) => a.id === accountId);
  const months = useUsage((s) => s.months);
  const usage = useMemo(() => monthTotal(months), [months]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2.5 rounded-2xl border border-black/[0.05] bg-white/80 text-left shadow-[0_1px_2px_rgb(16_24_64/0.04)] transition-colors hover:bg-white',
            compact ? 'justify-center p-2' : 'p-2.5',
          )}
          aria-label="Skift konto"
        >
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl', mode === 'demo' ? 'bg-violet-50 text-violet' : 'bg-teal-50 text-teal')}>
            {mode === 'demo' ? <FlaskConical className="size-4" /> : <Building2 className="size-4" />}
          </span>
          {!compact && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{account?.name ?? 'Ingen konto valgt'}</span>
                <span className="block truncate text-[11px] text-muted">
                  {mode === 'demo' ? 'Demo-tilstand' : account ? `Konto ${account.number ?? account.id}` : 'Microsoft Advertising'} · AI {fmtUsd(usage.costUsd)}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-[280px]">
        <DropdownMenuLabel>{mode === 'demo' ? 'Demo-konti' : 'Annoncekonti'}</DropdownMenuLabel>
        {accounts.map((a) => (
          <DropdownMenuItem key={a.id} onSelect={() => set({ accountId: a.id })}>
            <Building2 />
            <span className="flex-1 truncate">{a.name}</span>
            {a.id === accountId && <Check className="!text-brand" />}
          </DropdownMenuItem>
        ))}
        {accounts.length === 0 && <div className="px-3 py-2 text-[12.5px] text-muted">Ingen konti indlæst endnu.</div>}
        <DropdownMenuSeparator />
        {mode === 'demo' ? (
          <DropdownMenuItem onSelect={() => go('settings', 'connections')}>
            <Plug /> Forbind Microsoft Advertising
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => set({ mode: 'demo', accounts: [], accountId: null })}>
            <FlaskConical /> Skift til demo-konto
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => go('settings', 'connections')}>
          <Settings /> Forbindelser
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Sidebar() {
  const collapsed = useSettings((s) => s.appearance.sidebarCollapsed);
  const setAppearance = useSettings((s) => s.setAppearance);
  const conversations = useChat((s) => s.conversations);
  const newConversation = useChat((s) => s.newConversation);
  const go = useUi((s) => s.go);
  const mode = useConnection((s) => s.mode);
  const [query, setQuery] = useState('');
  const compact = collapsed;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return list;
    return list.filter((c) => c.title.toLowerCase().includes(q) || c.items.some((i) => i.kind === 'user' && i.text.toLowerCase().includes(q)));
  }, [conversations, query]);

  const startNew = () => {
    newConversation(useConnection.getState().accountId, mode);
    go('chat');
  };

  return (
    <aside className={cn('relative z-20 flex h-full shrink-0 flex-col bg-[#eff1f7]/70 transition-[width] duration-300', compact ? 'w-[76px]' : 'w-[284px]')}>
      <div className={cn('flex items-center pb-4 pt-5', compact ? 'justify-center' : 'justify-between px-5')}>
        {compact ? <LogoMark /> : <Logo />}
      </div>

      <div className={cn(compact ? 'px-3' : 'px-4')}>
        {compact ? (
          <Tooltip content="Ny samtale (Ctrl+N)" side="right">
            <Button variant="gradient" size="icon" className="w-full" onClick={startNew} aria-label="Ny samtale">
              <SquarePen />
            </Button>
          </Tooltip>
        ) : (
          <Button variant="gradient" className="w-full justify-start" onClick={startNew}>
            <SquarePen /> Ny samtale
            <span className="ml-auto rounded-md bg-white/20 px-1.5 py-0.5 text-[10.5px] font-medium">Ctrl N</span>
          </Button>
        )}
      </div>

      <nav aria-label="Hovedmenu" className={cn('mt-4 grid gap-0.5', compact ? 'px-3' : 'px-3')}>
        {NAV.map((item) => (
          <NavButton key={item.view} item={item} compact={compact} />
        ))}
      </nav>

      {!compact ? (
        <div className="mt-5 flex min-h-0 flex-1 flex-col px-3">
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Samtaler</span>
            {conversations.length > 0 && <Badge>{conversations.length}</Badge>}
          </div>
          <div className="relative mb-2 px-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søg i samtaler"
              className="h-8 w-full rounded-lg bg-white/60 pl-8 pr-2 text-[12.5px] outline-none ring-1 ring-black/[0.04] placeholder:text-subtle focus:bg-white focus:ring-brand/30"
            />
          </div>
          <div className="-mx-1 flex-1 overflow-y-auto px-1 pb-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12.5px] leading-relaxed text-subtle">
                {query ? 'Ingen samtaler matcher.' : 'Dine samtaler med assistenten vises her.'}
              </p>
            ) : (
              <AnimatedList items={filtered} getKey={(c) => c.id} itemClassName="mb-0.5" renderItem={(c) => <ConversationRow c={c} />} />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className={cn('grid gap-2 pb-4 pt-2', compact ? 'px-3' : 'px-4')}>
        <AccountSwitcher compact={compact} />
        <button
          type="button"
          onClick={() => setAppearance({ sidebarCollapsed: !collapsed })}
          className={cn('flex h-8 items-center gap-2 rounded-lg text-[12px] text-muted transition-colors hover:text-brand', compact ? 'justify-center' : 'px-2')}
          aria-label={compact ? 'Udvid menu' : 'Skjul menu'}
        >
          {compact ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!compact && 'Skjul menu'}
        </button>
      </div>
    </aside>
  );
}
