import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { ClickSpark } from '@/components/reactbits';
import { Sidebar } from '@/components/layout/Sidebar';
import { TooltipProvider } from '@/components/ui/overlays';
import { ActivityPage } from '@/features/activity/ActivityPage';
import { CampaignsPage } from '@/features/campaigns/CampaignsPage';
import { ChatView } from '@/features/chat/ChatView';
import { InsightsPanel } from '@/features/insights/InsightsPanel';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useBudgetWatch } from '@/hooks/useBudgetWatch';
import { queryClient } from '@/lib/queryClient';
import { useChat } from '@/stores/chat';
import { useConnection } from '@/stores/connection';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        const { accountId, mode } = useConnection.getState();
        useChat.getState().newConversation(accountId, mode);
        useUi.getState().go('chat');
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
  useBudgetWatch();
  useShortcuts();

  return (
    <div className="flex h-full bg-canvas">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-[28px] bg-[#fbfbfe] shadow-[-1px_0_0_rgb(16_24_64/0.04),-12px_0_40px_-20px_rgb(16_24_64/0.12)]">
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
                <AnimatePresence>{insights && <InsightsPanel key="insights" />}</AnimatePresence>
              </div>
            )}
            {view === 'campaigns' && <CampaignsPage key="campaigns" />}
            {view === 'activity' && <ActivityPage key="activity" />}
            {view === 'settings' && <SettingsPage key="settings" />}
          </AnimatePresence>
        </div>
      </main>
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
