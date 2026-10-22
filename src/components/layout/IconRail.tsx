/**
 * The icon rail on the far left: the app's independent parts (Chat, Dashboard,
 * Planlægning, Aktivitet) – each with its own sidebar next to it – and settings and
 * the account at the bottom. The names show on hover.
 */
import { Activity, LayoutDashboard, MessageSquare, Settings, SquareKanban, type LucideIcon } from '@/components/icons';
import { Tooltip } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
import { useChat } from '@/stores/chat';
import { myOpenCards, useBoard } from '@/stores/board';
import { useUi, type View } from '@/stores/ui';
import { AccountMenu } from './Sidebar';

export type Section = 'chat' | 'dashboard' | 'planning' | 'activity';

export function sectionOf(view: View): Section {
  if (view === 'chat') return 'chat';
  if (view === 'board') return 'planning';
  if (view === 'activity') return 'activity';
  return 'dashboard';
}

/** Pages of the Dashboard section (the rail returns to the last one used). */
const DASHBOARD_PAGES: View[] = ['dashboard', 'campaigns', 'products'];

function RailButton({ label, icon: Icon, active, onClick, dot, badge }: { label: string; icon: LucideIcon; active: boolean; onClick: () => void; dot?: boolean; badge?: number }) {
  return (
    <Tooltip content={label} side="right">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn('relative grid size-9 place-items-center rounded-lg transition-colors duration-200', active ? 'text-brand' : 'text-subtle hover:text-ink')}
      >
        <Icon className="size-[17px]" />
        {dot && <span className="absolute right-1.5 top-1.5 size-1.5 animate-pulse rounded-full bg-brand" />}
        {!!badge && (
          <span className="absolute right-0 top-0 grid size-[15px] place-items-center rounded-full bg-brand text-[8.5px] font-bold leading-none text-white tabular ring-2 ring-[#fafafb]">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>
    </Tooltip>
  );
}

export function IconRail() {
  const view = useUi((s) => s.view);
  const go = useUi((s) => s.go);
  const lastDashView = useUi((s) => s.lastDashView);
  const running = useChat((s) => Object.values(s.running).some(Boolean));
  const myCards = useBoard((s) => myOpenCards(s));
  const section = sectionOf(view);

  return (
    <nav aria-label="Hovedmenu" className="flex h-full w-[56px] shrink-0 flex-col items-center gap-1 border-r border-line bg-[#fafafb] py-3">
      <RailButton label="Chat" icon={MessageSquare} active={section === 'chat'} onClick={() => go('chat')} dot={running && section !== 'chat'} />
      <RailButton
        label="Dashboard"
        icon={LayoutDashboard}
        active={section === 'dashboard'}
        onClick={() => go(DASHBOARD_PAGES.includes(lastDashView) && section !== 'dashboard' ? lastDashView : 'dashboard')}
      />
      <RailButton label="Planlægning" icon={SquareKanban} active={section === 'planning'} onClick={() => go('board')} badge={myCards} />
      <RailButton label="Aktivitet" icon={Activity} active={section === 'activity'} onClick={() => go('activity')} />
      <div className="flex-1" />
      <RailButton label="Indstillinger" icon={Settings} active={false} onClick={() => go('settings')} />
      <AccountMenu variant="rail" />
    </nav>
  );
}
