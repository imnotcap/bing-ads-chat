import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { ClickSpark } from '@/components/reactbits';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar, startNewConversation, toggleInsights, toggleSidebar } from '@/components/layout/TopBar';
import { EASE } from '@/components/motion';
import { TooltipProvider } from '@/components/ui/overlays';
import { ActivityPage } from '@/features/activity/ActivityPage';
import { CampaignsPage } from '@/features/campaigns/CampaignsPage';
import { ChatView } from '@/features/chat/ChatView';
import { InsightsPanel } from '@/features/insights/InsightsPanel';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { UpdateDialog } from '@/components/layout/UpdatePrompt';
import { SignInDialog } from '@/features/settings/SignInDialog';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useBudgetWatch } from '@/hooks/useBudgetWatch';
import { navigate, useNavigationHistory } from '@/hooks/useNavigationHistory';
import { queryClient } from '@/lib/queryClient';
import { ensureFrameless } from '@/lib/window';
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
  const insights = useSettings((s) => s.appearance.insightsPanel);
  const onboarded = useSettings((s) => s.onboarded);
  const { error } = useBootstrap();
  const go = useUi((s) => s.go);
  const sidebarCollapsed = useSettings((s) => s.appearance.sidebarCollapsed);
  useBudgetWatch();
  useShortcuts();
  useEffect(ensureFrameless, []);
  useAutoUpdate();
  useNavigationHistory();

  return (
    <div className="flex h-full flex-col bg-surface">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.aside
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="relative z-20 h-full shrink-0 overflow-hidden border-r border-line bg-surface"
              aria-label="Sidebar"
            >
              <Sidebar />
            </motion.aside>
          )}
        </AnimatePresence>
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfbfc]">
          {error && (
            <button
              type="button"
              onClick={() => go('settings', 'connections')}
              className="relative z-30 flex items-center gap-2 bg-warning-bg px-6 py-2 text-left text-[13px] text-warning"
            >
              <AlertTriangle className="size-4 shrink-0" />
              <span className="truncate">Microsoft Advertising: {error}</span>
              <span className="ml-auto shrink-0 font-semibold underline">Åbn forbindelser</span>
            </button>
          )}
          <div className="flex min-h-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              {view === 'chat' && (
                <div key="chat" className="flex min-w-0 flex-1">
                  <ChatView />
                  <InsightsPanel open={insights} />
                </div>
              )}
              {view === 'campaigns' && <CampaignsPage key="campaigns" />}
              {view === 'activity' && <ActivityPage key="activity" />}
            </AnimatePresence>
          </div>
        </main>
      </div>
      <SettingsDialog />
      <UpdateDialog />
      <SignInDialog />
      <AnimatePresence>{!onboarded && <Onboarding key="onboarding" />}</AnimatePresence>
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
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: '!rounded-2xl !border-black/[0.06] !shadow-pop !font-sans',
                title: '!text-[13.5px] !font-semibold',
                description: '!text-[12.5px]',
              },
            }}
          />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
