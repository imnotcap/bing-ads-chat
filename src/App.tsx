import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AlertTriangle, WifiOff } from '@/components/icons';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { ClickSpark } from '@/components/reactbits';
import { Sidebar } from '@/components/layout/Sidebar';
import { IconRail, sectionOf } from '@/components/layout/IconRail';
import { useNoDefaultContextMenu } from '@/components/ui/contextMenu';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DownloadPromo } from '@/components/layout/DownloadPromo';
import { TopBar, startNewConversation, toggleInsights, toggleSidebar } from '@/components/layout/TopBar';
import { EASE } from '@/components/motion';
import { TooltipProvider } from '@/components/ui/overlays';
import { ActivityPage } from '@/features/activity/ActivityPage';
import { CampaignsPage } from '@/features/campaigns/CampaignsPage';
import { ProductsPage } from '@/features/products/ProductsPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DailyPage } from '@/features/dashboard/DailyPage';
import { BoardPage } from '@/features/board/BoardPage';
import { ChatView } from '@/features/chat/ChatView';
import { RAIL_WIDTH, SessionRail } from '@/features/chat/SessionRail';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { AsciiArc } from '@/components/layout/AsciiArc';
import { AccountGate } from '@/features/account/LoginScreen';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { UpdateDialog } from '@/components/layout/UpdatePrompt';
import { SignInDialog } from '@/features/settings/SignInDialog';
import { NewBoardDialog } from '@/features/board/BoardAccess';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { useDesktopShell } from '@/hooks/useDesktopShell';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useAccountSync } from '@/hooks/useAccountSync';
import { useBoardSync } from '@/board/sync';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useBudgetWatch } from '@/hooks/useBudgetWatch';
import { navigate, useNavigationHistory } from '@/hooks/useNavigationHistory';
import { queryClient } from '@/lib/queryClient';
import { ensureFrameless } from '@/lib/window';
import { useAccount } from '@/stores/account';
import { deleteOldConversations } from '@/stores/chat';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        navigate(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        startNewConversation();
      } else if (key === 'b') {
        e.preventDefault();
        toggleSidebar();
      } else if (key === 'i') {
        e.preventDefault();
        toggleInsights();
      } else if (key === ',') {
        e.preventDefault();
        useUi.getState().go('settings');
      } else if (key === 'k') {
        e.preventDefault();
        useUi.getState().go('chat');
        requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Besked til assistenten"]')?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Shell() {
  const view = useUi((s) => s.view);
  // The icon rail picks the section; each section (but Aktivitet) has its own sidebar.
  const section = sectionOf(view);
  const insights = useSettings((s) => s.appearance.insightsPanel);
  const onboarded = useSettings((s) => s.onboarded);
  const signedIn = useAccount((s) => s.status === 'ready');
  const offline = useAccount((s) => s.offline);
  const { error } = useBootstrap();
  const go = useUi((s) => s.go);
  const sidebarCollapsed = useSettings((s) => s.appearance.sidebarCollapsed);
  useBudgetWatch();
  useAutoRefresh();
  useNoDefaultContextMenu();
  useShortcuts();
  useEffect(ensureFrameless, []);
  // Conversations are deleted 14 days after their last message (checked every hour).
  useEffect(() => {
    deleteOldConversations();
    const t = setInterval(deleteOldConversations, 3600_000);
    return () => clearInterval(t);
  }, []);
  useAutoUpdate();
  useDesktopShell();
  useNavigationHistory();
  useAccountSync();
  useBoardSync();

  return (
    <div className="flex h-full flex-col bg-surface">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <IconRail />
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && section !== 'activity' && (
            <motion.aside
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 248, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="relative z-20 h-full shrink-0 overflow-hidden border-r border-line bg-surface"
              aria-label="Sidebar"
            >
              <div className="flex h-full w-[248px] flex-col">
                <div className="min-h-0 flex-1">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={section}
                      className="h-full"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2, ease: EASE }}
                    >
                      {section === 'chat' ? <Sidebar /> : <DashboardSidebar section={section === 'planning' ? 'planning' : 'dashboard'} />}
                    </motion.div>
                  </AnimatePresence>
                </div>
                {/* Web app only: the Windows app. */}
                <DownloadPromo />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfbfc]">
          {offline && (
            <div className="relative z-30 flex items-center gap-2 bg-line-2 px-6 py-2 text-[13px] text-muted">
              <WifiOff className="size-4 shrink-0" />
              Ingen forbindelse til jeres Cloudflare – du arbejder med det, denne PC husker.
            </div>
          )}
          {error && (
            <button
              type="button"
              onClick={() => go('settings', 'connections')}
              className="relative z-30 flex items-center gap-2 bg-warning-bg px-6 py-2 text-left text-[13px] text-warning"
            >
              <AlertTriangle className="size-4 shrink-0" />
              <span className="truncate" title={error}>
                Microsoft Advertising: {error}
              </span>
              <span className="ml-auto shrink-0 font-semibold underline">Åbn forbindelser</span>
            </button>
          )}
          {/* Centred on the page itself – in the chat, not under the session rail. */}
          <AsciiArc className="transition-[right] duration-300" style={{ right: view === 'chat' && insights ? RAIL_WIDTH : 0 }} />
          <div className="relative z-[1] flex min-h-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              {view === 'chat' && (
                <div key="chat" className="flex min-w-0 flex-1">
                  <ChatView />
                  <SessionRail open={insights} />
                </div>
              )}
              {view === 'dashboard' && <DashboardPage key="dashboard" />}
              {view === 'daily' && <DailyPage key="daily" />}
              {view === 'campaigns' && <CampaignsPage key="campaigns" />}
              {view === 'products' && <ProductsPage key="products" />}
              {view === 'activity' && <ActivityPage key="activity" />}
              {view === 'board' && <BoardPage key="board" />}
            </AnimatePresence>
          </div>
        </main>
      </div>
      <SettingsDialog />
      <UpdateDialog />
      <SignInDialog />
      <NewBoardDialog />
      <AnimatePresence>{signedIn && !onboarded && <Onboarding key="onboarding" />}</AnimatePresence>
      <AccountGate />
    </div>
  );
}

export function App() {
  const animations = useSettings((s) => s.appearance.animations);
  const clickSpark = useSettings((s) => s.appearance.clickSpark);
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion={animations === 'system' ? 'user' : animations === 'reduced' ? 'always' : 'never'}>
        <TooltipProvider>
          <ClickSpark enabled={clickSpark && animations !== 'reduced'}>
            <Shell />
          </ClickSpark>
          {/* Cards are drawn by components/notifications/toast.tsx. */}
          <Toaster position="top-right" offset={{ top: 52, right: 16 }} gap={8} toastOptions={{ unstyled: true }} />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
