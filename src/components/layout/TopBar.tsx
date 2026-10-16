/**
 * Top bar of the frameless window (Claude-desktop style): app menu, sidebar toggle,
 * back/forward, the current title with a dropdown, insights toggle and the window
 * controls. Empty areas are drag regions for moving the window.
 */
import { getVersion } from '@tauri-apps/api/app';
import { motion } from 'motion/react';
import {
  ArrowDownToLine,
  LayoutDashboard,
  MessageSquare,
  ClipboardCopy,
  EllipsisVertical,
  FileText,
  FolderOpen,
  Paperclip,
  Share,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Copy,
  LayoutGrid,
  Activity,
  Menu,
  Minus,
  PanelLeft,
  PanelRight,
  Pencil,
  Power,
  RefreshCw,
  Settings,
  Square,
  SquarePen,
  Trash2,
  Info,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '@/components/notifications/toast';
import { navigate } from '@/hooks/useNavigationHistory';
import { ATTACH_EVENT } from '@/features/chat/Composer';
import { assistantMarkdown, conversationMarkdown, exportFileName } from '@/features/chat/exportConversation';
import { formatBytes } from '@/lib/attachments';
import { isTauri, openExportsFolder, saveExport } from '@/lib/platform';
import { errorMessage } from '@/lib/utils';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { closeWindow, isMaximized, minimizeWindow, onWindowResized, quitApp, toggleMaximizeWindow } from '@/lib/window';
import { useBoard } from '@/stores/board';
import { useActiveConversation, useChat } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { isDashboardView, useUi } from '@/stores/ui';
import { Badge } from '../ui/controls';
import { Button } from '../ui/button';
import { Dialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '../ui/overlays';
import { LogoMark } from './Logo';
import { UpdateButton } from './UpdatePrompt';
import { NotificationBell } from '../notifications/NotificationBell';

const PAGE_TITLES = { dashboard: 'Dashboard', campaigns: 'Microsoft Ads · Kampagner', activity: 'Aktivitet', board: 'Planlægning' } as const;

function IconButton({ label, onClick, disabled, children, shortcut }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; shortcut?: string }) {
  return (
    <Tooltip content={shortcut ? `${label} (${shortcut})` : label} side="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-line-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35"
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function toggleSidebar() {
  const s = useSettings.getState();
  s.setAppearance({ sidebarCollapsed: !s.appearance.sidebarCollapsed });
}

export function toggleInsights() {
  const s = useSettings.getState();
  s.setAppearance({ insightsPanel: !s.appearance.insightsPanel });
}

export function startNewConversation() {
  const { accountId, mode } = useConnection.getState();
  useChat.getState().newConversation(accountId, mode);
  useUi.getState().go('chat');
}

function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const update = () => void isMaximized().then(setMaximized);
    update();
    return onWindowResized(update);
  }, []);
  const base = 'grid h-full w-[46px] place-items-center text-ink-2 transition-colors';
  return (
    <div className="flex h-full">
      <button type="button" aria-label="Minimér" onClick={minimizeWindow} className={cn(base, 'hover:bg-line-2')}>
        <Minus className="size-4" strokeWidth={1.5} />
      </button>
      <button type="button" aria-label={maximized ? 'Gendan' : 'Maksimér'} onClick={toggleMaximizeWindow} className={cn(base, 'hover:bg-line-2')}>
        {maximized ? <Copy className="size-3.5 -scale-x-100" strokeWidth={1.5} /> : <Square className="size-3.5" strokeWidth={1.5} />}
      </button>
      <button type="button" aria-label="Luk" onClick={closeWindow} className={cn(base, 'hover:bg-[#e81123] hover:text-white')}>
        <X className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

function ConversationTitle() {
  const conversation = useActiveConversation();
  const rename = useChat((s) => s.rename);
  const remove = useChat((s) => s.remove);
  const editing = useUi((s) => s.renaming);
  const setEditing = useUi((s) => s.setRenaming);
  const [title, setTitle] = useState('');
  const confirm = useUi((s) => s.confirmDelete);
  const setConfirm = useUi((s) => s.setConfirmDelete);
  useEffect(() => {
    if (editing && conversation) setTitle(conversation.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  const label = conversation && conversation.items.length ? conversation.title : 'Ny samtale';

  if (editing && conversation) {
    return (
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          rename(conversation.id, title.trim() || conversation.title);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="h-7 w-[320px] rounded-md border border-brand/40 bg-white px-2 text-[13px] outline-none"
      />
    );
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex h-8 min-w-0 max-w-[420px] items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-ink transition-colors hover:bg-line-2 data-[state=open]:bg-line-2"
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          <DropdownMenuItem onSelect={startNewConversation}>
            <SquarePen /> <span className="flex-1">Ny samtale</span> <span className="text-[11px] text-subtle">Ctrl N</span>
          </DropdownMenuItem>
          {conversation && conversation.items.length > 0 && (
            <>
              <DropdownMenuItem
                onSelect={() => setEditing(true)}
              >
                <Pencil /> Omdøb
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-negative data-[highlighted]:bg-negative-bg data-[highlighted]:text-negative [&_svg]:!text-negative">
                <Trash2 /> Slet samtale
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {conversation && (
        <Dialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Slet samtalen?"
          description={`"${conversation.title}" slettes permanent. Ændringer på kontoen påvirkes ikke.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Annullér
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  remove(conversation.id);
                  setConfirm(false);
                }}
              >
                Slet
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

function AppMenu() {
  const go = useUi((s) => s.go);
  const sidebarCollapsed = useSettings((s) => s.appearance.sidebarCollapsed);
  const insights = useSettings((s) => s.appearance.insightsPanel);
  return (
    <DropdownMenu>
      <Tooltip content="Menu" side="bottom">
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Menu" className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-line-2 hover:text-ink data-[state=open]:bg-line-2 data-[state=open]:text-ink">
            <Menu className="size-4" />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-[250px]">
        <DropdownMenuItem onSelect={startNewConversation}>
          <SquarePen /> <span className="flex-1">Ny samtale</span> <span className="text-[11px] text-subtle">Ctrl N</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleSidebar}>
          <PanelLeft /> <span className="flex-1">{sidebarCollapsed ? 'Vis sidebar' : 'Skjul sidebar'}</span> <span className="text-[11px] text-subtle">Ctrl B</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleInsights}>
          <PanelRight /> <span className="flex-1">{insights ? 'Skjul indsigt' : 'Vis indsigt'}</span> <span className="text-[11px] text-subtle">Ctrl I</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go('campaigns')}>
          <LayoutGrid /> Kampagner
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go('activity')}>
          <Activity /> Aktivitet
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go('settings')}>
          <Settings /> <span className="flex-1">Indstillinger</span> <span className="text-[11px] text-subtle">Ctrl ,</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void queryClient.invalidateQueries();
            toast.sync('Data opdateres …', { description: 'Henter de nyeste tal fra Microsoft Advertising.' });
          }}
        >
          <RefreshCw /> Opdatér data
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            const version = isTauri ? await getVersion().catch(() => '') : 'dev';
            toast('Bing Ads Chat', { description: `Version ${version} · AI-assistent til Microsoft Advertising` });
          }}
        >
          <Info /> Om Bing Ads Chat
        </DropdownMenuItem>
        {isTauri && (
          <DropdownMenuItem onSelect={quitApp}>
            <Power /> Afslut
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------ conversation actions ------------------------------ */

let lastExport: string | null = null;

async function exportConversation() {
  const c = useChat.getState().conversations.find((x) => x.id === useChat.getState().activeId);
  if (!c || !c.items.length) return;
  try {
    const path = await saveExport(exportFileName(c), conversationMarkdown(c));
    lastExport = path;
    toast.success('Samtalen er eksporteret', {
      description: path ? `Gemt i Overførsler › Bing Ads Chat` : 'Filen er hentet som Markdown.',
      action: path ? { label: 'Vis i mappe', onClick: () => void openExportsFolder(path) } : undefined,
    });
  } catch (e) {
    toast.error('Eksporten mislykkedes', { description: errorMessage(e) });
  }
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} er kopieret`);
  } catch (e) {
    toast.error('Kunne ikke kopiere', { description: errorMessage(e) });
  }
}

const menuButton =
  'grid size-8 place-items-center rounded-lg text-muted outline-none transition-colors hover:bg-line-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35 data-[state=open]:bg-line-2 data-[state=open]:text-ink';

/** A top-bar icon that opens a dropdown (tooltip on hover). */
function MenuIcon({ label, disabled, icon, children, width = 'w-[260px]' }: { label: string; disabled?: boolean; icon: React.ReactNode; children: React.ReactNode; width?: string }) {
  return (
    <DropdownMenu>
      <Tooltip content={label} side="bottom">
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button type="button" aria-label={label} className={menuButton}>
            {icon}
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className={width}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Right side of the top bar in the chat: insights, export, files, share and more. */
function ConversationActions() {
  const conversation = useActiveConversation();
  const insights = useSettings((s) => s.appearance.insightsPanel);
  const setRenaming = useUi((s) => s.setRenaming);
  const setConfirmDelete = useUi((s) => s.setConfirmDelete);
  const hasItems = !!conversation?.items.length;
  const attachments = (conversation?.items ?? []).flatMap((it) => (it.kind === 'user' ? (it.attachments ?? []) : []));
  const lastReply = [...(conversation?.items ?? [])].reverse().find((it) => it.kind === 'assistant');

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip content={`${insights ? 'Skjul' : 'Vis'} indsigt (Ctrl+I)`} side="bottom">
        <button
          type="button"
          aria-label={insights ? 'Skjul indsigt' : 'Vis indsigt'}
          aria-pressed={insights}
          onClick={toggleInsights}
          className={cn(menuButton, insights && 'bg-line-2 text-ink')}
        >
          <PanelRight className="size-4" />
        </button>
      </Tooltip>

      <IconButton label="Eksportér samtale" onClick={() => void exportConversation()} disabled={!hasItems}>
        <ArrowDownToLine className="size-4" />
      </IconButton>

      <MenuIcon label="Filer" icon={<FolderOpen className="size-4" />}>
        <DropdownMenuLabel>Filer i samtalen</DropdownMenuLabel>
        {attachments.length ? (
          attachments.slice(-8).map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-ink-2">
              <FileText className="size-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <span className="shrink-0 text-[11.5px] text-subtle">{formatBytes(a.size)}</span>
            </div>
          ))
        ) : (
          <div className="px-2.5 pb-2 pt-0.5 text-[12.5px] text-subtle">Ingen vedhæftede filer endnu.</div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => window.dispatchEvent(new Event(ATTACH_EVENT))}>
          <Paperclip /> Vedhæft filer …
        </DropdownMenuItem>
        {isTauri && (
          <DropdownMenuItem onSelect={() => void openExportsFolder(lastExport ?? undefined).catch((e) => toast.error(errorMessage(e)))}>
            <FolderOpen /> Åbn mappen med eksporter
          </DropdownMenuItem>
        )}
      </MenuIcon>

      <MenuIcon label="Del" icon={<Share className="size-4" />} disabled={!hasItems}>
        <DropdownMenuItem onSelect={() => conversation && void copyText(conversationMarkdown(conversation), 'Samtalen')}>
          <ClipboardCopy /> Kopiér hele samtalen
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!lastReply} onSelect={() => lastReply?.kind === 'assistant' && void copyText(assistantMarkdown(lastReply), 'Svaret')}>
          <Copy /> Kopiér seneste svar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void exportConversation()}>
          <ArrowDownToLine /> Gem som Markdown-fil
        </DropdownMenuItem>
      </MenuIcon>

      <MenuIcon label="Flere handlinger" icon={<EllipsisVertical className="size-4" />} width="w-[230px]">
        <DropdownMenuItem onSelect={startNewConversation}>
          <SquarePen /> <span className="flex-1">Ny samtale</span> <span className="text-[11px] text-subtle">Ctrl N</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasItems} onSelect={() => setRenaming(true)}>
          <Pencil /> Omdøb samtale
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void queryClient.invalidateQueries();
            toast.sync('Data opdateres …', { description: 'Henter de nyeste tal fra Microsoft Advertising.' });
          }}
        >
          <RefreshCw /> Opdatér data
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!hasItems}
          onSelect={() => setConfirmDelete(true)}
          className="text-negative data-[highlighted]:bg-negative-bg data-[highlighted]:text-negative [&_svg]:!text-negative"
        >
          <Trash2 /> Slet samtale
        </DropdownMenuItem>
      </MenuIcon>
    </div>
  );
}

/** Chat ↔ Dashboard switch in the middle of the top bar. */
function ModeSwitch() {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);
  const lastDashView = useUi((s) => s.lastDashView);
  const options = [
    { value: 'chat' as const, label: 'Chat', icon: MessageSquare },
    { value: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  ];
  const active = isDashboardView(view) ? 'dashboard' : 'chat';
  return (
    <div className="flex h-8 items-center rounded-[10px] bg-line-2 p-0.5" role="tablist" aria-label="Visning">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={active === o.value}
          onClick={() => (o.value === 'dashboard' ? (active === 'dashboard' ? go('dashboard') : go(lastDashView)) : go('chat'))}
          className={cn('relative flex h-7 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium transition-colors', active === o.value ? 'text-ink' : 'text-muted hover:text-ink')}
        >
          {active === o.value && <motion.span layoutId="mode-switch" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <o.icon className="relative size-3.5" />
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function TopBar() {
  const view = useUi((s) => s.view);
  const canBack = useUi((s) => s.historyIndex > 0);
  const canForward = useUi((s) => s.historyIndex < s.history.length - 1);
  const sidebarCollapsed = useSettings((s) => s.appearance.sidebarCollapsed);
  const mode = useConnection((s) => s.mode);
  const boardId = useUi((s) => s.boardId);
  const boardTitle = useBoard((s) => s.boards.find((b) => b.id === boardId)?.title ?? s.boards[0]?.title);

  return (
    <header data-tauri-drag-region className="relative z-30 flex h-10 shrink-0 select-none items-center gap-0.5 border-b border-line bg-surface pl-2.5">
      <LogoMark className="pointer-events-none mr-1 size-[22px]" />
      <AppMenu />
      <IconButton label={sidebarCollapsed ? 'Vis sidebar' : 'Skjul sidebar'} onClick={toggleSidebar} shortcut="Ctrl+B">
        <PanelLeft className="size-4" />
      </IconButton>
      {sidebarCollapsed && view === 'chat' && (
        <IconButton label="Ny samtale" onClick={startNewConversation} shortcut="Ctrl+N">
          <SquarePen className="size-4" />
        </IconButton>
      )}
      <IconButton label="Tilbage" onClick={() => navigate(-1)} disabled={!canBack} shortcut="Alt+←">
        <ArrowLeft className="size-4" />
      </IconButton>
      <IconButton label="Frem" onClick={() => navigate(1)} disabled={!canForward} shortcut="Alt+→">
        <ArrowRight className="size-4" />
      </IconButton>

      <div className="ml-3 flex min-w-0 items-center gap-2">
        {view === 'chat' ? <ConversationTitle /> : <span className="px-2 text-[13px] font-medium text-ink">{view === 'board' && boardTitle ? `Planlægning · ${boardTitle}` : PAGE_TITLES[view]}</span>}
        {mode === 'demo' && (
          <Tooltip content="Du ser demo-data – klik for at logge ind med din rigtige konto" side="bottom">
            <button type="button" onClick={() => useUi.getState().setSignInOpen(true)} className="rounded-full transition-opacity hover:opacity-80">
              <Badge tone="brand">Demo-konto · Log ind</Badge>
            </button>
          </Tooltip>
        )}
      </div>

      <div data-tauri-drag-region className="h-full min-w-6 flex-1" />
      <ModeSwitch />
      <div data-tauri-drag-region className="h-full min-w-6 flex-1" />

      <UpdateButton />
      <NotificationBell />
      {view === 'chat' && <ConversationActions />}
      {isTauri ? (
        <>
          <span className="mx-1.5 h-4 w-px bg-line" />
          <WindowControls />
        </>
      ) : (
        <span className="w-2" />
      )}
    </header>
  );
}
