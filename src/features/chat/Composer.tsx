import { AnimatePresence, motion } from 'motion/react';
import { ClipboardPaste, CornerDownLeft, FileText, FolderOpen, ImageIcon, Loader2, Mic, Paperclip, Plus, Square, X } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '@/components/ui/overlays';
import { EASE } from '@/components/motion';
import { ACCEPT_ALL, MAX_ATTACHMENTS, classify, formatBytes, readAttachment, type Attachment } from '@/lib/attachments';
import { cn, errorMessage } from '@/lib/utils';
import { useUi } from '@/stores/ui';
import { ComposerFooter } from './ComposerFooter';
import { SLASH_COMMANDS } from './suggestions';
import { useDictation } from './useDictation';

export interface ComposerHandle {
  addFiles: (files: File[]) => void;
}

function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
      className="group relative flex h-14 max-w-[220px] items-center gap-2.5 rounded-xl border border-line bg-surface pl-1.5 pr-3"
      title={a.name}
    >
      {a.thumb ? (
        <img src={a.thumb} alt="" className="size-11 rounded-lg object-cover" />
      ) : (
        <span className={cn('grid size-11 place-items-center rounded-lg', a.kind === 'pdf' ? 'bg-negative-bg text-negative' : 'bg-brand-50 text-brand')}>
          <FileText className="size-5" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium text-ink">{a.name}</span>
        <span className="block text-[11px] uppercase text-muted">
          {a.kind === 'text' ? a.name.split('.').pop() : a.kind} · {formatBytes(a.size)}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Fjern ${a.name}`}
        className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3" />
      </button>
    </motion.div>
  );
}

export const Composer = forwardRef<
  ComposerHandle,
  { running: boolean; onSend: (text: string, attachments: Attachment[]) => void; onStop: () => void; disabled?: boolean }
>(function Composer({ running, onSend, onStop, disabled }, handle) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reading, setReading] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const draft = useUi((s) => s.draft);
  const setDraft = useUi((s) => s.setDraft);
  const dictation = useDictation((t) => setText((cur) => (cur && !/\s$/.test(cur) ? `${cur} ${t}` : cur + t)), () => ref.current?.focus());

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
    folderInput.current?.setAttribute('directory', '');
  }, []);

  useEffect(() => {
    if (draft === null) return;
    setText(draft);
    setDraft(null);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(draft.length, draft.length);
    });
  }, [draft, setDraft]);

  // Auto-grow.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  const addFiles = async (files: File[], fromFolder = false) => {
    let list = files;
    if (fromFolder) {
      const supported = files.filter((f) => classify(f));
      if (supported.length < files.length) toast(`${files.length - supported.length} filer i mappen blev sprunget over (ikke-understøttet type).`);
      list = supported;
    }
    const room = MAX_ATTACHMENTS - attachments.length;
    if (list.length > room) {
      toast.warning(`Du kan højst vedhæfte ${MAX_ATTACHMENTS} filer pr. besked.`);
      list = list.slice(0, Math.max(0, room));
    }
    if (!list.length) return;
    setReading((n) => n + list.length);
    for (const file of list) {
      try {
        const a = await readAttachment(file);
        setAttachments((prev) => [...prev, a]);
      } catch (e) {
        toast.error('Filen kunne ikke vedhæftes', { description: errorMessage(e) });
      } finally {
        setReading((n) => n - 1);
      }
    }
    requestAnimationFrame(() => ref.current?.focus());
  };

  useImperativeHandle(handle, () => ({ addFiles: (files) => void addFiles(files) }));

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) files.push(new File([await item.getType(type)], `udklip-${files.length + 1}.${type.split('/')[1]}`, { type }));
        else if (item.types.includes('text/plain')) {
          const t = await (await item.getType('text/plain')).text();
          setText((cur) => (cur ? `${cur}\n${t}` : t));
        }
      }
      if (files.length) void addFiles(files);
      else if (!items.length) toast('Udklipsholderen er tom.');
    } catch {
      toast('Tryk Ctrl+V i chatfeltet for at indsætte fra udklipsholderen.');
      ref.current?.focus();
    }
  };

  const slash = useMemo(() => {
    const m = /^\/(\S*)$/.exec(text);
    if (!m) return [];
    const q = m[1]!.toLowerCase();
    return SLASH_COMMANDS.filter((c) => c.command.slice(1).startsWith(q) || c.label.toLowerCase().includes(q));
  }, [text]);

  useEffect(() => setActive(0), [slash.length]);

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !reading && !running && !disabled;
  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), attachments);
    setText('');
    setAttachments([]);
  };

  const pick = (i: number) => {
    const cmd = slash[i];
    if (!cmd) return;
    setText(cmd.prompt);
    requestAnimationFrame(() => ref.current?.focus());
  };

  const fileInputs = (
    <>
      <input ref={fileInput} type="file" multiple accept={ACCEPT_ALL} hidden onChange={(e) => (void addFiles([...(e.target.files ?? [])]), (e.target.value = ''))} />
      <input ref={imageInput} type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => (void addFiles([...(e.target.files ?? [])]), (e.target.value = ''))} />
      <input ref={folderInput} type="file" multiple hidden onChange={(e) => (void addFiles([...(e.target.files ?? [])], true), (e.target.value = ''))} />
    </>
  );

  return (
    <div className="relative">
      {fileInputs}
      <AnimatePresence>
        {slash.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-line bg-white/95 p-1 shadow-pop backdrop-blur-xl"
            role="listbox"
          >
            {slash.map((c, i) => (
              <button
                key={c.command}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px]', i === active ? 'bg-line-2 text-ink' : 'text-ink-2')}
              >
                <c.icon className="size-4 text-brand" />
                <span className="font-medium">{c.command}</span>
                <span className="text-muted">{c.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          'rounded-2xl border border-brand/20 bg-white/90 p-1.5 shadow-[0_10px_36px_-16px_rgb(109_92_246/0.35)] backdrop-blur-xl transition-[box-shadow,border-color]',
          'focus-within:border-brand/40 focus-within:shadow-[0_12px_40px_-14px_rgb(109_92_246/0.5),0_0_0_4px_rgb(109_92_246/0.07)]',
          dictation.listening && 'border-brand/50',
        )}
      >
        <AnimatePresence initial={false}>
          {(attachments.length > 0 || reading > 0) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 px-1.5 pb-1 pt-1.5">
                <AnimatePresence>
                  {attachments.map((a) => (
                    <AttachmentChip key={a.id} a={a} onRemove={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))} />
                  ))}
                </AnimatePresence>
                {reading > 0 && (
                  <div className="flex h-14 items-center gap-2 rounded-xl border border-dashed border-line px-3 text-[12.5px] text-muted">
                    <Loader2 className="size-4 animate-spin" /> Læser {reading} fil{reading === 1 ? '' : 'er'} …
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-end gap-1">
          <DropdownMenu>
            <Tooltip content="Vedhæft filer, billeder eller mapper">
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label="Vedhæft"
                  className="grid size-9 shrink-0 place-items-center rounded-[10px] text-muted transition-colors hover:bg-line-2 hover:text-ink disabled:opacity-40 data-[state=open]:bg-line-2 data-[state=open]:text-ink"
                >
                  <Plus className="size-[18px] transition-transform duration-200 [[data-state=open]>&]:rotate-45" />
                </button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent side="top" align="start" sideOffset={10} className="w-[268px]">
              <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                <Paperclip /> <span className="flex-1">Upload filer</span> <span className="text-[11px] text-subtle">PDF, CSV, TXT</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => imageInput.current?.click()}>
                <ImageIcon /> <span className="flex-1">Billeder</span> <span className="text-[11px] text-subtle">PNG, JPG</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => folderInput.current?.click()}>
                <FolderOpen /> Mappe
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void pasteFromClipboard()}>
                <ClipboardPaste /> <span className="flex-1">Indsæt fra udklipsholder</span> <span className="text-[11px] text-subtle">Ctrl V</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="normal-case tracking-normal">Du kan også trække filer ind i chatten</DropdownMenuLabel>
            </DropdownMenuContent>
          </DropdownMenu>

          <textarea
            ref={ref}
            value={text}
            rows={1}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.length) {
                e.preventDefault();
                void addFiles(files);
              }
            }}
            onKeyDown={(e) => {
              if (slash.length) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  return setActive((a) => (a + 1) % slash.length);
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  return setActive((a) => (a - 1 + slash.length) % slash.length);
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  return pick(active);
                }
                if (e.key === 'Escape') return setText('');
              }
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={disabled ? 'Tilføj din Claude API-nøgle under Indstillinger for at chatte …' : dictation.listening ? 'Lytter … tal nu' : 'Spørg om hvad som helst, eller bed mig ændre noget …'}
            className="block max-h-[220px] min-h-9 flex-1 resize-none bg-transparent px-1.5 py-[7px] text-[15px] leading-[22px] text-ink outline-none placeholder:text-subtle"
            aria-label="Besked til assistenten"
          />

          {running ? (
            <Tooltip content="Stop">
              <motion.button type="button" onClick={onStop} whileTap={{ scale: 0.92 }} className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ink text-white" aria-label="Stop">
                <Square className="size-3 fill-current" />
              </motion.button>
            </Tooltip>
          ) : (
            <Tooltip content="Send (Enter)">
              <motion.button
                type="button"
                onClick={submit}
                disabled={!canSend}
                whileTap={{ scale: 0.9 }}
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-[10px] transition-colors',
                  canSend ? 'bg-ink text-white hover:bg-brand' : 'text-subtle',
                )}
                aria-label="Send"
              >
                <CornerDownLeft className="size-[17px]" strokeWidth={2} />
              </motion.button>
            </Tooltip>
          )}
          <Tooltip content={dictation.listening ? 'Stop diktering' : 'Diktér (tale til tekst)'}>
            <button
              type="button"
              disabled={disabled}
              onClick={dictation.toggle}
              aria-label="Diktér"
              aria-pressed={dictation.listening}
              className={cn(
                'relative grid size-9 shrink-0 place-items-center rounded-[10px] transition-colors disabled:opacity-40',
                dictation.listening ? 'bg-brand-50 text-brand' : 'text-muted hover:bg-line-2 hover:text-ink',
              )}
            >
              {dictation.listening && <span className="absolute inset-1 animate-ping rounded-[8px] bg-brand/15" />}
              <Mic className="relative size-[17px]" />
            </button>
          </Tooltip>
        </div>
      </div>

      <ComposerFooter />
    </div>
  );
});
