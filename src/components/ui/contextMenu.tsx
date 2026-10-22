/**
 * Right-click menus. Only things with a menu react to a right-click; everywhere else
 * nothing happens (useNoDefaultContextMenu) – except text fields and selected text,
 * which keep Windows' own copy/paste menu.
 */
import { ContextMenu as Menu } from 'radix-ui';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ContextItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Draw a line above this item. */
  separated?: boolean;
  hint?: string;
}

export function ContextMenu({ items, children, label }: { items: (ContextItem | false | null | undefined)[]; children: ReactElement; label?: string }) {
  const list = items.filter((i): i is ContextItem => !!i);
  if (!list.length) return children;
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>{children}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          collisionPadding={8}
          className="z-50 min-w-[210px] overflow-hidden rounded-xl border border-line bg-white/95 p-1 shadow-pop backdrop-blur-xl animate-[fade-in_0.12s_ease-out]"
        >
          {label && <div className="truncate px-2.5 pb-1 pt-1.5 text-[11.5px] font-medium text-subtle">{label}</div>}
          {list.map((item, i) => (
            <div key={`${item.label}-${i}`}>
              {item.separated && i > 0 && <Menu.Separator className="-mx-1 my-1 h-px bg-line" />}
              <Menu.Item
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'relative flex h-8 cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0',
                  item.danger ? 'text-negative data-[highlighted]:bg-negative-bg [&_svg]:text-negative' : 'text-ink data-[highlighted]:bg-line-2 [&_svg]:text-muted',
                )}
              >
                {item.icon}
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && <span className="text-[11px] text-subtle">{item.hint}</span>}
              </Menu.Item>
            </div>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** No browser/WebView menu on right-click, except in text fields and on selected text. */
export function useNoDefaultContextMenu() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim() && target && selection.containsNode(target, true)) return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, []);
}

export const copyText = (text: string) => void navigator.clipboard.writeText(text).catch(() => {});
