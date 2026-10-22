/**
 * Kolonner: choose which columns the product table shows and in which order – drag to
 * move, × to remove, + to add. Saved on this PC (appearance.productColumns).
 */
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Lock, Plus, RotateCcw, Search, X } from '@/components/icons';
import { AnimatePresence, motion } from 'motion/react';
import { Popover } from 'radix-ui';
import { useState, type ReactElement } from 'react';
import { EASE } from '@/components/motion';
import { cn } from '@/lib/utils';
import { useSettings } from '@/stores/settings';
import { COLUMNS, COLUMN_BY_ID, type ColumnDef } from './columns';
import { DEFAULT_PRODUCT_COLUMNS } from './defaults';

/** Always shown: without the title a row means nothing. */
const LOCKED = new Set(['title']);

function ShownRow({ col, onRemove }: { col: ColumnDef; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex h-8 items-center gap-1.5 rounded-lg px-1.5 text-[13px] text-ink', isDragging ? 'z-10 bg-white shadow-pop' : 'hover:bg-line-2')}
    >
      <button type="button" {...attributes} {...listeners} aria-label={`Flyt ${col.label}`} className="grid size-6 cursor-grab place-items-center rounded text-subtle hover:text-ink active:cursor-grabbing">
        <GripVertical className="size-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate" title={col.description}>
        {col.label}
      </span>
      {LOCKED.has(col.id) ? (
        <Lock className="mr-1.5 size-3 text-subtle" aria-label="Vises altid" />
      ) : (
        <button type="button" onClick={onRemove} aria-label={`Fjern ${col.label}`} className="grid size-6 place-items-center rounded text-subtle hover:bg-white hover:text-ink">
          <X className="size-3.5" />
        </button>
      )}
    </li>
  );
}

export function ColumnsMenu({ children }: { children: ReactElement }) {
  const columns = useSettings((s) => s.appearance.productColumns ?? DEFAULT_PRODUCT_COLUMNS);
  const setAppearance = useSettings((s) => s.setAppearance);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const save = (next: string[]) => setAppearance({ productColumns: next });
  const shown = columns.map((id) => COLUMN_BY_ID.get(id)).filter((c): c is ColumnDef => !!c);
  const q = query.trim().toLowerCase();
  const hidden = COLUMNS.filter((c) => !columns.includes(c.id) && (!q || c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)));
  const groups = ['Produkt', 'Resultater', 'Udvikling'] as const;

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    save(arrayMove(columns, columns.indexOf(String(e.active.id)), columns.indexOf(String(e.over.id))));
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content forceMount align="end" sideOffset={8} collisionPadding={12} className="z-50 outline-none">
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: EASE }}
                className="grid w-[560px] origin-top-right grid-cols-2 overflow-hidden rounded-2xl border border-line bg-white shadow-pop"
              >
                <div className="flex max-h-[460px] flex-col border-r border-line">
                  <div className="flex items-center justify-between px-3.5 pb-1.5 pt-3">
                    <span className="text-[12.5px] font-semibold text-ink">Viste kolonner</span>
                    <button
                      type="button"
                      onClick={() => save(DEFAULT_PRODUCT_COLUMNS)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted hover:bg-line-2 hover:text-ink"
                    >
                      <RotateCcw className="size-3" /> Nulstil
                    </button>
                  </div>
                  <p className="px-3.5 pb-2 text-[11.5px] text-muted">Træk for at ændre rækkefølgen.</p>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={columns} strategy={verticalListSortingStrategy}>
                      <ul className="grid gap-0.5 overflow-y-auto px-2 pb-2">
                        {shown.map((c) => (
                          <ShownRow key={c.id} col={c} onRemove={() => save(columns.filter((id) => id !== c.id))} />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                </div>
                <div className="flex max-h-[460px] flex-col">
                  <div className="px-3.5 pb-2 pt-3">
                    <span className="text-[12.5px] font-semibold text-ink">Tilføj kolonner</span>
                    <div className="relative mt-2">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Søg i kolonner"
                        className="h-8 w-full rounded-lg bg-line-2 pl-8 pr-2 text-[12.5px] outline-none focus:bg-white focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto px-2 pb-2">
                    {groups.map((g) => {
                      const list = hidden.filter((c) => c.group === g);
                      if (!list.length) return null;
                      return (
                        <div key={g} className="mb-1.5">
                          <p className="px-1.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">{g}</p>
                          {list.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => save([...columns, c.id])}
                              className="group flex w-full items-start gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-line-2"
                            >
                              <Plus className="mt-0.5 size-3.5 shrink-0 text-subtle group-hover:text-brand" />
                              <span className="grid">
                                <span className="text-[13px] text-ink">{c.label}</span>
                                <span className="text-[11.5px] leading-snug text-muted">{c.description}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                    {!hidden.length && <p className="px-1.5 py-3 text-[12.5px] text-muted">{q ? 'Ingen kolonner passer.' : 'Alle kolonner er vist.'}</p>}
                  </div>
                </div>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}
