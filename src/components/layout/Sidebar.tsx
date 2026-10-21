import { motion } from 'motion/react';
import {
  FlaskConical,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  LogOut,
  Search,
  Settings,
  Sparkles,
  SquarePen,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { AnimatedList } from '@/components/reactbits';
import { Button } from '@/components/ui/button';
import { Dialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '@/components/ui/overlays';
import { fmtUsd } from '@/lib/format';
import { cn } from '@/lib/utils';
import { KEEP_DAYS, useChat, useConversationSummaries, type ConversationSummary } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { isDashboardView, useUi } from '@/stores/ui';
import { monthTotal, useUsage } from '@/stores/usage';
import { signOut } from '@/workspace/account';
import { goDemo } from '@/workspace/shared';
import { useAccount } from '@/stores/account';
import { MicrosoftLogo } from '@/features/settings/SignInDialog';
import { toast } from '@/components/notifications/toast';

// The chat sidebar links into the dashboard workspace, which has its own sidebar.
/**
 * Chat ↔ Dashboard, always at the top of the sidebar (both the chat's and the
 * dashboard's) – and as two icons in the top bar when the sidebar is hidden.
 */
export function ModeNav({ compact = false }: { compact?: boolean }) {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);
  const lastDashView = useUi((s) => s.lastDashView);
  const pending = useChat((s) => Object.values(s.running).some(Boolean));
  const dash = isDashboardView(view);
  const options = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, active: !dash, onClick: () => go('chat'), dot: pending },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, active: dash, onClick: () => go(dash ? 'dashboard' : lastDashView), dot: false },
  ];
  return (
    <div className={cn('grid grid-cols-2 rounded-[11px] bg-line-2 p-0.5', compact ? 'h-8 w-[76px]' : 'h-9')} role="tablist" aria-label="Chat eller dashboard">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.active}
          aria-label={o.label}
          title={compact ? o.label : undefined}
          onClick={o.onClick}
          className={cn('relative flex items-center justify-center gap-1.5 rounded-[9px] text-[13px] font-medium transition-colors', o.active ? 'text-ink' : 'text-muted hover:text-ink')}
        >
          {o.active && <motion.span layoutId={compact ? 'mode-nav-compact' : 'mode-nav'} className="absolute inset-0 rounded-[9px] bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <o.icon className="relative size-[15px] shrink-0" strokeWidth={1.9} />
          {!compact && <span className="relative">{o.label}</span>}
          {o.dot && <span className="absolute right-1.5 top-1.5 size-1.5 animate-pulse rounded-full bg-brand" />}
        </button>
      ))}
    </div>
  );
}

const ConversationRow = memo(function ConversationRow({ c }: { c: ConversationSummary }) {
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
});

function initials(name: string | undefined) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Account & settings menu in the bottom-left corner, styled like Claude's. */
export function AccountMenu() {
  const { accounts, accountId, mode } = useConnection();
  const go = useUi((s) => s.go);
  const account = accounts.find((a) => a.id === accountId);
  const months = useUsage((s) => s.months);
  const usage = useMemo(() => monthTotal(months), [months]);
  const plan = mode === 'demo' ? 'Demo' : 'Live';
  const user = useAccount((s) => s.user);

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
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-line-2 data-[state=open]:bg-line-2"
          >
            {avatar}
            <span className="min-w-0 flex-1 truncate text-[13.5px]">
              <span className="font-medium text-ink">{account?.name ?? 'Ingen konto'}</span>
              <span className="text-muted"> · {plan}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-[264px]">
          {user && (
            <>
              <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">{initials(user.name)}</span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">{user.name}</div>
                  <div className="truncate text-[11.5px] text-muted">{user.email}</div>
                </div>
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1.5">
            {avatar}
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-ink">{account?.name ?? 'Ingen konto'}</div>
              <div className="truncate text-[11.5px] text-muted">
                {mode === 'demo' ? 'Demo-konto' : `Microsoft Advertising · ${account?.number ?? account?.id ?? ''}`}
              </div>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => go('settings', 'connections')}>
            <Settings /> <span className="flex-1">Indstillinger</span> <span className="text-[11px] text-subtle">Ctrl ,</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => go('settings', 'spend')}>
            <Wallet /> Budget og grænser
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => go('settings', 'ai')}>
            <Sparkles /> <span className="flex-1">AI-forbrug</span> <span className="text-[11.5px] tabular text-muted">{fmtUsd(usage.costUsd)}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {mode === 'demo' ? (
            <DropdownMenuItem onSelect={() => useUi.getState().setSignInOpen(true)}>
              <MicrosoftLogo /> <span className="flex-1">Brug Microsoft Advertising</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => goDemo()}>
              <FlaskConical /> Skift til demo-data
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => go('settings', 'users')}>
            <Users /> Brugere
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void signOut().then(() => toast('Du er logget ud'))}>
            <LogOut /> Log ud
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
    </div>
  );
}

/** Conversations grouped like a chat app: I dag, De seneste 7 dage, Ældre. */
function GroupedConversations({ list }: { list: ConversationSummary[] }) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const groups: [string, ConversationSummary[]][] = [
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
  const conversations = useConversationSummaries();
  const newConversation = useChat((s) => s.newConversation);
  const go = useUi((s) => s.go);
  const mode = useConnection((s) => s.mode);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return list;
    const items = new Map(useChat.getState().conversations.map((c) => [c.id, c.items]));
    return list.filter((c) => c.title.toLowerCase().includes(q) || items.get(c.id)?.some((i) => i.kind === 'user' && i.text.toLowerCase().includes(q)));
  }, [conversations, query]);

  const startNew = () => {
    newConversation(useConnection.getState().accountId, mode);
    go('chat');
  };

  return (
    <div className="flex h-full w-[260px] flex-col">
      <div className="grid gap-2 px-3 pt-3">
        <ModeNav />
        <Button variant="secondary" className="h-9 w-full justify-start" onClick={startNew}>
          <SquarePen /> Ny samtale
          <span className="ml-auto text-[11px] font-normal text-subtle">Ctrl N</span>
        </Button>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col px-3">
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-[12px] font-medium text-subtle">Samtaler</span>
          <span className="text-[11px] text-subtle" title="Samtaler slettes automatisk 14 dage efter den seneste besked">
            Slettes efter {KEEP_DAYS} dage
          </span>
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
            <p className="px-3 py-6 text-center text-[12.5px] leading-relaxed text-subtle">{query ? 'Ingen samtaler matcher.' : 'Dine samtaler med assistenten vises her.'}</p>
          ) : (
            <GroupedConversations list={filtered} />
          )}
        </div>
      </div>

      <div className="border-t border-line px-2 py-2">
        <AccountMenu />
      </div>
    </div>
  );
}
