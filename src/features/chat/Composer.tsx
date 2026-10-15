import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, CalendarDays, Sparkles, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MODELS, type ModelId } from '@/ai/models';
import { Magnet } from '@/components/reactbits';
import { Select } from '@/components/ui/overlays';
import { EASE } from '@/components/motion';
import { DATE_PRESET_LABELS, type DatePreset } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { SLASH_COMMANDS } from './suggestions';

export function Composer({ running, onSend, onStop, disabled }: { running: boolean; onSend: (text: string) => void; onStop: () => void; disabled?: boolean }) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const draft = useUi((s) => s.draft);
  const setDraft = useUi((s) => s.setDraft);
  const datePreset = useSettings((s) => s.datePreset);
  const setDatePreset = useSettings((s) => s.setDatePreset);
  const model = useSettings((s) => s.ai.model);
  const setAi = useSettings((s) => s.setAi);

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

  const slash = useMemo(() => {
    const m = /^\/(\S*)$/.exec(text);
    if (!m) return [];
    const q = m[1]!.toLowerCase();
    return SLASH_COMMANDS.filter((c) => c.command.slice(1).startsWith(q) || c.label.toLowerCase().includes(q));
  }, [text]);

  useEffect(() => setActive(0), [slash.length]);

  const submit = () => {
    const t = text.trim();
    if (!t || running || disabled) return;
    onSend(t);
    setText('');
  };

  const pick = (i: number) => {
    const cmd = slash[i];
    if (!cmd) return;
    setText(cmd.prompt);
    requestAnimationFrame(() => ref.current?.focus());
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {slash.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 p-1.5 shadow-pop backdrop-blur-xl"
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
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px]', i === active ? 'bg-brand-50 text-ink' : 'text-ink-2')}
              >
                <c.icon className="size-4 text-brand" />
                <span className="font-semibold">{c.command}</span>
                <span className="text-muted">{c.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          'rounded-[26px] border border-black/[0.06] bg-white/85 p-2 shadow-[0_18px_50px_-24px_rgb(31_41_95/0.35),0_2px_6px_rgb(16_24_64/0.04)] backdrop-blur-xl transition-[box-shadow,border-color]',
          'focus-within:border-brand/30 focus-within:shadow-[0_18px_50px_-20px_rgb(79_107_245/0.45),0_0_0_4px_rgb(79_107_245/0.08)]',
        )}
      >
        <textarea
          ref={ref}
          value={text}
          rows={1}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
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
          placeholder={disabled ? 'Tilføj din Claude API-nøgle under Indstillinger for at chatte …' : 'Spørg om din konto, eller bed mig ændre noget …   (skriv / for genveje)'}
          className="block max-h-[220px] w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-subtle"
          aria-label="Besked til assistenten"
        />
        <div className="flex items-center gap-1.5 px-1 pt-1">
          <Select<DatePreset>
            triggerVariant="pill"
            aria-label="Periode"
            value={datePreset}
            onChange={setDatePreset}
            options={(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => ({ value: p, label: DATE_PRESET_LABELS[p], icon: <CalendarDays className="size-3.5 text-muted" /> }))}
          />
          <Select<ModelId>
            triggerVariant="pill"
            aria-label="Model"
            value={model}
            onChange={(m) => setAi({ model: m })}
            contentClassName="w-[300px]"
            options={MODELS.map((m) => ({ value: m.id, label: m.label, description: m.description, icon: <Sparkles className="size-3.5 text-violet" /> }))}
          />
          <span className="ml-auto hidden pr-2 text-[11.5px] text-subtle md:inline">Enter sender · Shift+Enter ny linje</span>
          <Magnet strength={6} padding={16} disabled={running}>
            {running ? (
              <motion.button
                type="button"
                onClick={onStop}
                whileTap={{ scale: 0.92 }}
                className="grid size-10 place-items-center rounded-full bg-ink text-white shadow-[0_6px_16px_-6px_rgb(15_18_34/0.6)]"
                aria-label="Stop"
              >
                <Square className="size-3.5 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={submit}
                disabled={!text.trim() || disabled}
                whileTap={{ scale: 0.9 }}
                className="grid size-10 place-items-center rounded-full bg-[linear-gradient(135deg,#4f6bf5,#8b5cf6)] text-white shadow-[0_8px_20px_-8px_rgb(91_92_246/0.8)] transition-[opacity,filter] hover:brightness-110 disabled:opacity-35 disabled:shadow-none"
                aria-label="Send"
              >
                <ArrowUp className="size-[18px]" strokeWidth={2.4} />
              </motion.button>
            )}
          </Magnet>
        </div>
      </div>
    </div>
  );
}
