import { motion } from 'motion/react';
import {
  Building2,
  SquareKanban,
  Check,
  FlaskConical,
  LayoutDashboard,
  LayoutGrid,
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
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatedList } from '@/components/reactbits';
import { Button } from '@/components/ui/button';
import { Dialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '@/components/ui/overlays';
import { fmtUsd } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useBoard, visibleBoards } from '@/stores/board';
import { useChat, type Conversation } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { useUi, type View } from '@/stores/ui';
import { monthTotal, useUsage } from '@/stores/usage';
import { signOut } from '@/workspace/account';
import { goDemo } from '@/workspace/shared';
import { useAccount } from '@/stores/account';
import { MicrosoftLogo } from '@/features/settings/SignInDialog';
import { toast } from '@/components/notifications/toast';

// The chat sidebar links into the dashboard workspace, which has its own sidebar.
const NAV: { view: View; label: string; icon: LucideIcon }[] = [
  { view: 'chat', label: 'Chat', icon: MessageSquare },
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'board', label: 'Planlægning', icon: SquareKanban },
  { view: 'campaigns', label: 'Kampagner', icon: LayoutGrid },
];

function NavButton({ item }: { item: (typeof NAV)[number] }) {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);
  const openBoard = useUi((s) => s.openBoard);
  const pending = useChat((s) => Object.values(s.running).some(Boolean));
  const active = view === item.view;
  return (
    <button
      type="button"
      onClick={() => {
        if (item.view !== 'board') return go(item.view);
        const { boardId } = useUi.getState();
        const { boards: all, meId } = useBoard.getState();
        const boards = visibleBoards(all, meId);
        const target = boards.find((b) => b.id === boardId) ?? boards.find((b) => !b.ownerId) ?? boards[0];
        if (target) openBoard(target.id);
        else go('dashboard');
      }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-9 w-full items-center gap-2.5 rounded-[10px] px-3 text-[13.5px] font-medium transition-colors',
        active ? 'text-ink' : 'text-muted hover:bg-line-2 hover:text-ink',
      )}
    >
      {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-[10px] bg-line-2" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
      <item.icon className="relative size-[17px] shrink-0" strokeWidth={1.8} />
      <span className="relative">{item.label}</span>
      {item.view === 'chat' && pending && <span className="absolute right-2.5 top-2.5 size-2 animate-pulse rounded-full bg-brand" />}
    </button>
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
export function AccountMenu() {
  const { accounts, accountId, mode, set } = useConnection();
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
  const conversations = useChat((s) => s.conversations);
  const newConversation = useChat((s) => s.newConversation);
  const go = useUi((s) => s.go);
  const mode = useConnection((s) => s.mode);
  const [query, setQuery] = useState('');

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
    <div className="flex h-full w-[260px] flex-col">
      <div className="px-3 pt-3">
        <Button variant="secondary" className="h-9 w-full justify-start" onClick={startNew}>
          <SquarePen /> Ny samtale
          <span className="ml-auto text-[11px] font-normal text-subtle">Ctrl N</span>
        </Button>
      </div>

      <nav aria-label="Hovedmenu" className="mt-3 grid gap-0.5 px-3">
        {NAV.map((item) => (
          <NavButton key={item.view} item={item} />
        ))}
      </nav>

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
