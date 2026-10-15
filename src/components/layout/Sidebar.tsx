import { motion } from 'motion/react';
import {
  Activity,
  Building2,
  Check,
  FlaskConical,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plug,
  Search,
  Settings,
  Sparkles,
  SquarePen,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatedList } from '@/components/reactbits';
import { Button } from '@/components/ui/button';
import { Dialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '@/components/ui/overlays';
import { fmtUsd } from '@/lib/format';
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
        'group relative flex h-9 w-full items-center rounded-[10px] text-[13.5px] font-medium transition-colors',
        compact ? 'justify-center' : 'gap-2.5 px-3',
        active ? 'text-ink' : 'text-muted hover:bg-line-2 hover:text-ink',
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-[10px] bg-line-2"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        />
      )}
      <item.icon className="relative size-[17px] shrink-0" strokeWidth={1.8} />
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
        'group relative flex items-center rounded-[10px] transition-colors',
        active ? 'bg-line-2' : 'hover:bg-line-2/60',
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
          className="flex min-w-0 flex-1 flex-col items-start px-3 py-1.5 text-left"
        >
          <span className={cn('w-full truncate text-[13px]', active ? 'font-medium text-ink' : 'text-ink-2')}>
            {running && <span className="mr-1.5 inline-block size-1.5 -translate-y-px animate-pulse rounded-full bg-brand" />}
            {c.title}
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

function initials(name: string | undefined) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Account & settings menu in the bottom-left corner, styled like Claude's. */
function AccountMenu({ compact }: { compact: boolean }) {
  const { accounts, accountId, mode, set } = useConnection();
  const go = useUi((s) => s.go);
  const account = accounts.find((a) => a.id === accountId);
  const months = useUsage((s) => s.months);
  const usage = useMemo(() => monthTotal(months), [months]);
  const plan = mode === 'demo' ? 'Demo' : 'Live';

  const avatar = (
    <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white', mode === 'demo' ? 'bg-brand' : 'bg-teal')}>
      {initials(account?.name)}
    </span>
  );

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Konto og indstillinger"
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] text-left transition-colors hover:bg-line-2 data-[state=open]:bg-line-2',
              compact ? 'justify-center p-1.5' : 'px-2 py-1.5',
            )}
          >
            {avatar}
            {!compact && (
              <span className="min-w-0 flex-1 truncate text-[13.5px]">
                <span className="font-medium text-ink">{account?.name ?? 'Ingen konto'}</span>
                <span className="text-muted"> · {plan}</span>
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-[264px]">
          <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1.5">
            {avatar}
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-ink">{account?.name ?? 'Ingen konto'}</div>
              <div className="truncate text-[11.5px] text-muted">
                {mode === 'demo' ? 'Demo-konto' : `Microsoft Advertising · ${account?.number ?? account?.id ?? ''}`}
              </div>
            </div>
          </div>
          {accounts.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Skift konto</DropdownMenuLabel>
              {accounts.map((a) => (
                <DropdownMenuItem key={a.id} onSelect={() => set({ accountId: a.id })}>
                  <Building2 />
                  <span className="flex-1 truncate">{a.name}</span>
                  {a.id === accountId && <Check className="!text-brand" />}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => go('settings', 'connections')}>
            <Settings /> <span className="flex-1">Indstillinger</span> <span className="text-[11px] text-subtle">Ctrl ,</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => go('settings', 'spend')}>
            <Wallet /> Forbrugsregler
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => go('settings', 'ai')}>
            <Sparkles /> <span className="flex-1">AI-forbrug</span> <span className="text-[11.5px] tabular text-muted">{fmtUsd(usage.costUsd)}</span>
          </DropdownMenuItem>
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
        </DropdownMenuContent>
      </DropdownMenu>
      {!compact && (
        <Tooltip content="Indstillinger">
          <button
            type="button"
            onClick={() => go('settings')}
            aria-label="Indstillinger"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-line-2 hover:text-ink"
          >
            <Settings className="size-4" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

/** Conversations grouped like a chat app: I dag, De seneste 7 dage, Ældre. */
function GroupedConversations({ list }: { list: Conversation[] }) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const groups: [string, Conversation[]][] = [
    ['I dag', list.filter((c) => c.updatedAt >= startOfToday)],
    ['De seneste 7 dage', list.filter((c) => c.updatedAt < startOfToday && c.updatedAt >= startOfToday - 6 * 86_400_000)],
    ['Ældre', list.filter((c) => c.updatedAt < startOfToday - 6 * 86_400_000)],
  ];
  return (
    <>
      {groups
        .filter(([, items]) => items.length)
        .map(([label, items]) => (
          <div key={label} className="mb-3">
            <div className="px-3 pb-1 text-[11.5px] text-subtle">{label}</div>
            <AnimatedList items={items} getKey={(c) => c.id} itemClassName="mb-px" renderItem={(c) => <ConversationRow c={c} />} />
          </div>
        ))}
    </>
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
  const toggle = () => setAppearance({ sidebarCollapsed: !collapsed });

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
    <aside className={cn('relative z-20 flex h-full shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-300', compact ? 'w-[68px]' : 'w-[260px]')}>
      <div className={cn('flex h-14 shrink-0 items-center', compact ? 'justify-center' : 'justify-between pl-4 pr-3')}>
        {compact ? (
          <Tooltip content="Udvid menu" side="right">
            <button type="button" onClick={toggle} aria-label="Udvid menu" className="group relative grid size-9 place-items-center rounded-lg hover:bg-line-2">
              <LogoMark className="size-8 transition-opacity group-hover:opacity-0" />
              <PanelLeftOpen className="absolute size-[18px] text-ink-2 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </Tooltip>
        ) : (
          <>
            <Logo />
            <Tooltip content="Skjul menu">
              <Button size="icon-xs" variant="ghost" onClick={toggle} aria-label="Skjul menu">
                <PanelLeftClose />
              </Button>
            </Tooltip>
          </>
        )}
      </div>

      <div className="px-3 pt-1">
        {compact ? (
          <Tooltip content="Ny samtale (Ctrl+N)" side="right">
            <Button variant="secondary" size="icon" className="w-full" onClick={startNew} aria-label="Ny samtale">
              <SquarePen />
            </Button>
          </Tooltip>
        ) : (
          <Button variant="secondary" className="h-9 w-full justify-start" onClick={startNew}>
            <SquarePen /> Ny samtale
            <span className="ml-auto text-[11px] font-normal text-subtle">Ctrl N</span>
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
            <span className="text-[12px] font-medium text-subtle">Samtaler</span>
          </div>
          <div className="relative mb-2 px-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søg i samtaler"
              className="h-8 w-full rounded-lg bg-line-2 pl-8 pr-2 text-[12.5px] outline-none placeholder:text-subtle focus:bg-white focus:ring-1 focus:ring-brand/30"
            />
          </div>
          <div className="-mx-1 flex-1 overflow-y-auto px-1 pb-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12.5px] leading-relaxed text-subtle">
                {query ? 'Ingen samtaler matcher.' : 'Dine samtaler med assistenten vises her.'}
              </p>
            ) : (
              <GroupedConversations list={filtered} />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="border-t border-line px-2 py-2">
        <AccountMenu compact={compact} />
      </div>
    </aside>
  );
}
