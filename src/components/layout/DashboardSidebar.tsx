/**
 * Sidebar of the dashboard workspace: categories that fold out like dropdowns and can
 * be hidden with the eye (e.g. the SEO team hides "Betalt markedsføring"). Hidden
 * categories are listed at the bottom so they can be shown again.
 */
import { AnimatePresence, motion } from 'motion/react';
import { Activity, ChevronDown, Eye, EyeOff, LayoutDashboard, LayoutGrid, Package, Plus, Search, Sparkles, SquareKanban, UserRound,
  UsersRound, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BrandIcon, type Brand } from '@/components/brand/BrandIcon';
import { EASE } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
import { LABEL_COLORS, boardAccess, myOpenCards, useBoard, visibleBoards, type BoardAccess } from '@/stores/board';
import { useNewBoardDialog } from '@/features/board/BoardAccess';
import { useSettings } from '@/stores/settings';
import { useUi, type View } from '@/stores/ui';
import { AccountMenu, ModeNav } from './Sidebar';
import { startNewConversation } from './TopBar';

interface NavItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  brand?: Brand;
  /** Board colour (tints the board icon). */
  swatch?: string;
  /** Who can see the board (private and selected boards get their own icon). */
  access?: BoardAccess;
  active: boolean;
  onSelect?: () => void;
  soon?: boolean;
  badge?: number;
  /** A channel (Microsoft Ads, Google Ads …) folds out to its own pages. */
  children?: NavItem[];
  expanded?: boolean;
  onToggle?: () => void;
}

interface Category {
  id: string;
  label: string;
  items: NavItem[];
  onAdd?: () => void;
  addLabel?: string;
  empty?: string;
}

function BranchRow({ item }: { item: NavItem }) {
  const childActive = item.children!.some((c) => c.active);
  return (
    <div>
      <button
        type="button"
        onClick={item.onToggle}
        aria-expanded={item.expanded}
        className={cn(
          'group relative flex h-9 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13.5px] font-medium transition-colors hover:bg-line-2 hover:text-ink',
          childActive ? 'text-ink' : 'text-muted',
        )}
      >
        <span className="relative grid size-[17px] shrink-0 place-items-center">
          {item.brand ? <BrandIcon brand={item.brand} className="size-[16px]" /> : item.icon ? <item.icon className="size-[17px]" strokeWidth={1.8} /> : null}
        </span>
        <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
        {item.soon && <span className="relative rounded-full bg-line-2 px-1.5 py-px text-[10.5px] font-medium text-subtle">Snart</span>}
        <ChevronDown className={cn('size-3.5 shrink-0 text-subtle transition-transform duration-200', !item.expanded && '-rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {item.expanded && (
          <motion.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="relative ml-[21px] grid gap-0.5 border-l border-line py-0.5 pl-2">
              {item.children!.map((c) => (
                <ItemRow key={c.id} item={c} nested />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ItemRow({ item, nested = false }: { item: NavItem; nested?: boolean }) {
  if (item.children) return <BranchRow item={item} />;
  const content = (
    <button
      type="button"
      disabled={item.soon}
      onClick={item.onSelect}
      aria-current={item.active ? 'page' : undefined}
      className={cn(
        'group relative flex w-full items-center gap-2.5 rounded-[10px] px-3 text-left font-medium transition-colors',
        nested ? 'h-8 text-[13px]' : 'h-9 text-[13.5px]',
        item.active ? 'text-ink' : 'text-muted hover:bg-line-2 hover:text-ink',
        item.soon && 'cursor-default opacity-60 hover:bg-transparent hover:text-muted',
      )}
    >
      {item.active && <motion.span layoutId="dash-nav-active" className="absolute inset-0 rounded-[10px] bg-line-2" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
      <span className="relative grid size-[17px] shrink-0 place-items-center">
        {item.brand ? (
          <BrandIcon brand={item.brand} className="size-[16px]" />
        ) : item.swatch ? (
          item.access === 'private' ? (
            <UserRound className="size-[17px]" style={{ color: item.swatch }} strokeWidth={1.8} />
          ) : item.access === 'selected' ? (
            <UsersRound className="size-[17px]" style={{ color: item.swatch }} strokeWidth={1.8} />
          ) : (
            <SquareKanban className="size-[17px]" style={{ color: item.swatch }} strokeWidth={1.8} />
          )
        ) : item.icon ? (
          <item.icon className="size-[17px]" strokeWidth={1.8} />
        ) : null}
      </span>
      <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
      {item.soon && !nested && <span className="relative rounded-full bg-line-2 px-1.5 py-px text-[10.5px] font-medium text-subtle">Snart</span>}
      {!!item.badge && <span className="relative min-w-5 rounded-full bg-brand px-1.5 text-center text-[11px] font-semibold leading-5 text-white tabular">{item.badge}</span>}
    </button>
  );
  return item.soon && !nested ? <Tooltip content="Kommer snart – forbindelsen er på vej" side="right">{content}</Tooltip> : content;
}

function CategoryBlock({ cat, collapsed, onToggle, onHide }: { cat: Category; collapsed: boolean; onToggle: () => void; onHide: () => void }) {
  return (
    <motion.div layout="position" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }} className="mb-2">
      <div className="group/cat flex h-7 items-center gap-0.5 pl-1 pr-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md px-2 text-[12.5px] font-semibold text-ink-2/70 transition-colors hover:text-ink"
        >
          <ChevronDown className={cn('size-3.5 shrink-0 transition-transform duration-200', collapsed && '-rotate-90')} />
          <span className="truncate">{cat.label}</span>
        </button>
        <Tooltip content={`Skjul "${cat.label}" fra din menu`} side="right">
          <button
            type="button"
            aria-label={`Skjul ${cat.label}`}
            onClick={onHide}
            className="grid size-6 place-items-center rounded-md text-subtle opacity-0 transition-[opacity,color,background-color] hover:bg-line-2 hover:text-ink focus-visible:opacity-100 group-hover/cat:opacity-100"
          >
            <Eye className="size-3.5" />
          </button>
        </Tooltip>
        {cat.onAdd && (
          <Tooltip content={cat.addLabel ?? 'Tilføj'} side="right">
            <button
              type="button"
              aria-label={cat.addLabel ?? 'Tilføj'}
              onClick={cat.onAdd}
              className="grid size-6 place-items-center rounded-md text-subtle transition-colors hover:bg-line-2 hover:text-ink"
            >
              <Plus className="size-3.5" />
            </button>
          </Tooltip>
        )}
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="grid gap-0.5 pt-0.5">
              {cat.items.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
              {!cat.items.length && <p className="px-3 py-1.5 text-[12px] text-subtle">{cat.empty ?? 'Intet her endnu.'}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Menu search: a channel stays (opened) when it or one of its pages matches. */
function matchItem(item: NavItem, q: string): NavItem[] {
  if (item.label.toLowerCase().includes(q)) return [item.children ? { ...item, expanded: true } : item];
  const children = item.children?.filter((c) => c.label.toLowerCase().includes(q));
  return children?.length ? [{ ...item, children, expanded: true }] : [];
}

export function DashboardSidebar() {
  const view = useUi((s) => s.view);
  const boardId = useUi((s) => s.boardId);
  const go = useUi((s) => s.go);
  const openBoard = useUi((s) => s.openBoard);
  const boards = useBoard((s) => s.boards);
  const cards = useBoard((s) => s.cards);
  const meId = useBoard((s) => s.meId);
  const collapsed = useSettings((s) => s.appearance.navCollapsed);
  const hidden = useSettings((s) => s.appearance.navHidden);
  const setAppearance = useSettings((s) => s.setAppearance);
  const [query, setQuery] = useState('');

  const categories = useMemo<Category[]>(() => {
    const nav = (id: string, label: string, icon: LucideIcon, target: View): NavItem => ({ id, label, icon, active: view === target, onSelect: () => go(target) });
    const soon = (id: string, label: string, icon: LucideIcon): NavItem => ({ id, label, icon, active: false, soon: true });
    // Each channel folds out to its own pages; open unless folded (its page being open keeps it open).
    const branch = (id: string, label: string, brand: Brand, children: NavItem[], isSoon = false): NavItem => {
      const key = `branch:${id}`;
      const open = collapsed[key] === undefined ? !isSoon : !collapsed[key];
      return {
        id,
        label,
        brand,
        active: false,
        soon: isSoon,
        children,
        expanded: open || children.some((c) => c.active),
        onToggle: () => setAppearance({ navCollapsed: { ...collapsed, [key]: open } }),
      };
    };
    return [
      {
        id: 'overview',
        label: 'Overblik',
        items: [nav('dashboard', 'Dashboard', LayoutDashboard, 'dashboard'), nav('activity', 'Aktivitet', Activity, 'activity')],
      },
      {
        id: 'paid',
        label: 'Betalt markedsføring',
        items: [
          branch('msads', 'Microsoft Ads', 'microsoft_ads', [nav('campaigns', 'Kampagner', LayoutGrid, 'campaigns'), nav('products', 'Produkter', Package, 'products')]),
          branch('gads', 'Google Ads', 'google_ads', [soon('gads-campaigns', 'Kampagner', LayoutGrid), soon('gads-products', 'Produkter', Package)], true),
          branch('meta', 'Meta Ads', 'meta', [soon('meta-campaigns', 'Kampagner', LayoutGrid), soon('meta-catalog', 'Katalog', Package)], true),
          branch('linkedin', 'LinkedIn Ads', 'linkedin', [soon('linkedin-campaigns', 'Kampagner', LayoutGrid)], true),
        ],
      },
      {
        id: 'planning',
        label: 'Planlægning',
        addLabel: 'Ny tavle',
        onAdd: () => useNewBoardDialog.getState().setOpen(true),
        empty: 'Ingen tavler endnu – klik + for at lave en.',
        items: visibleBoards(boards, meId).map((b) => ({
          id: b.id,
          label: b.title,
          swatch: LABEL_COLORS[b.accent].solid,
          access: boardAccess(b),
          active: view === 'board' && boardId === b.id,
          onSelect: () => openBoard(b.id),
          badge: myOpenCards({ cards, meId }, b.id),
        })),
      },
    ];
  }, [view, boardId, boards, cards, meId, go, openBoard, collapsed, setAppearance]);

  const q = query.trim().toLowerCase();
  const visible = categories
    .filter((c) => !hidden.includes(c.id))
    .map((c) => (q ? { ...c, items: c.items.flatMap((i) => matchItem(i, q)) } : c))
    .filter((c) => !q || c.items.length);
  const hiddenCats = categories.filter((c) => hidden.includes(c.id));

  const toggle = (id: string) => setAppearance({ navCollapsed: { ...collapsed, [id]: !collapsed[id] } });
  const hide = (id: string) => setAppearance({ navHidden: [...hidden, id] });
  const show = (id: string) => setAppearance({ navHidden: hidden.filter((h) => h !== id) });

  return (
    <div className="flex h-full w-[260px] flex-col">
      <div className="px-3 pt-3">
        <ModeNav />
        <Button variant="secondary" className="mt-2 h-9 w-full justify-start" onClick={startNewConversation}>
          <Sparkles className="text-brand" /> Spørg assistenten
        </Button>
        <div className="relative mt-3 px-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søg i menuen"
            className="h-8 w-full rounded-lg bg-line-2 pl-8 pr-2 text-[12.5px] outline-none placeholder:text-subtle focus:bg-white focus:ring-1 focus:ring-brand/30"
          />
        </div>
      </div>

      <nav aria-label="Dashboard-menu" className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <AnimatePresence initial={false}>
          {visible.map((cat) => (
            <div key={cat.id}>
              <CategoryBlock cat={cat} collapsed={!q && !!collapsed[cat.id]} onToggle={() => toggle(cat.id)} onHide={() => hide(cat.id)} />
            </div>
          ))}
        </AnimatePresence>
        {q && !visible.length && <p className="px-3 py-6 text-center text-[12.5px] text-subtle">Intet i menuen matcher.</p>}
      </nav>

      {hiddenCats.length > 0 && (
        <div className="px-3 pb-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[12.5px] text-subtle transition-colors hover:bg-line-2 hover:text-ink-2 data-[state=open]:bg-line-2"
              >
                <EyeOff className="size-3.5" />
                {hiddenCats.length === 1 ? '1 skjult menu' : `${hiddenCats.length} skjulte menuer`}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-[236px]">
              <DropdownMenuLabel>Skjulte menuer</DropdownMenuLabel>
              {hiddenCats.map((c) => (
                <DropdownMenuItem key={c.id} onSelect={() => show(c.id)}>
                  <Eye /> <span className="flex-1">Vis {c.label}</span>
                </DropdownMenuItem>
              ))}
              {hiddenCats.length > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setAppearance({ navHidden: [] })}>
                    <Eye /> Vis alle
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="border-t border-line px-2 py-2">
        <AccountMenu />
      </div>
    </div>
  );
}
