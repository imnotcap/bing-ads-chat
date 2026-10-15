/**
 * Top bar of the frameless window (Claude-desktop style): app menu, sidebar toggle,
 * back/forward, the current title with a dropdown, insights toggle and the window
 * controls. Empty areas are drag regions for moving the window.
 */
import { getVersion } from '@tauri-apps/api/app';
import {
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
import { toast } from 'sonner';
import { navigate } from '@/hooks/useNavigationHistory';
import { isTauri } from '@/lib/platform';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { closeWindow, isMaximized, minimizeWindow, onWindowResized, toggleMaximizeWindow } from '@/lib/window';
import { useActiveConversation, useChat } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { Badge } from '../ui/controls';
import { Button } from '../ui/button';
import { Dialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '../ui/overlays';
import { LogoMark } from './Logo';

const PAGE_TITLES = { campaigns: 'Kampagner', activity: 'Aktivitet' } as const;

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
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [confirm, setConfirm] = useState(false);
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
                onSelect={() => {
                  setTitle(conversation.title);
                  setEditing(true);
                }}
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
            toast('Data opdateres …');
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
          <DropdownMenuItem onSelect={closeWindow}>
            <Power /> Afslut
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar() {
  const view = useUi((s) => s.view);
  const canBack = useUi((s) => s.historyIndex > 0);
  const canForward = useUi((s) => s.historyIndex < s.history.length - 1);
  const sidebarCollapsed = useSettings((s) => s.appearance.sidebarCollapsed);
  const insights = useSettings((s) => s.appearance.insightsPanel);
  const mode = useConnection((s) => s.mode);

  return (
    <header data-tauri-drag-region className="relative z-30 flex h-10 shrink-0 select-none items-center gap-0.5 border-b border-line bg-surface pl-2.5">
      <LogoMark className="pointer-events-none mr-1 size-[22px]" />
      <AppMenu />
      <IconButton label={sidebarCollapsed ? 'Vis sidebar' : 'Skjul sidebar'} onClick={toggleSidebar} shortcut="Ctrl+B">
        <PanelLeft className="size-4" />
      </IconButton>
      {sidebarCollapsed && (
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
        {view === 'chat' ? <ConversationTitle /> : <span className="px-2 text-[13px] font-medium text-ink">{PAGE_TITLES[view]}</span>}
        {mode === 'demo' && <Badge tone="brand">Demo-konto</Badge>}
      </div>

      <div data-tauri-drag-region className="h-full min-w-6 flex-1" />

      {view === 'chat' && (
        <IconButton label={insights ? 'Skjul indsigt' : 'Vis indsigt'} onClick={toggleInsights} shortcut="Ctrl+I">
          <PanelRight className={cn('size-4', insights && 'text-brand')} />
        </IconButton>
      )}
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
