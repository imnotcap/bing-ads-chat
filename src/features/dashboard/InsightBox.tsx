/**
 * "Ugens indsigt" – the period read out in a few sentences, with chips for the
 * campaigns behind it, and the pages turning by themselves until the user takes over.
 * Behind it React Bits' MicroSlats in the app's lavender, fading out towards the text.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { ChevronLeft, ChevronRight, TrendingUp } from '@/components/icons';
import { EASE } from '@/components/motion';
import { MicroSlats } from '@/components/reactbits';
import { cn } from '@/lib/utils';
import { useSettings } from '@/stores/settings';
import type { InsightChip, InsightPage } from './insights';

const TURN_MS = 12_000;

const TONE: Record<InsightChip['tone'], string> = {
  up: 'text-positive',
  down: 'text-negative',
  warn: 'text-warning',
  info: 'text-muted',
};

export function InsightBox({ title, pages, loading, onAsk }: { title: string; pages: InsightPage[]; loading: boolean; onAsk: (prompt: string) => void }) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const still = useSettings((s) => s.appearance.animations === 'reduced');
  const count = pages.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const page = pages[current];

  useEffect(() => setIndex(0), [pages]);
  useEffect(() => {
    if (!auto || count < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), TURN_MS);
    return () => clearTimeout(t);
  }, [auto, count, index]);

  const step = (d: number) => {
    setAuto(false);
    setIndex((i) => (i + d + count) % count);
  };

  return (
    <section className="card relative overflow-hidden px-5 pb-4 pt-4">
      <div aria-hidden className="absolute inset-0 [mask-image:linear-gradient(180deg,black_0%,rgb(0_0_0/0.6)_25%,rgb(0_0_0/0.14)_55%,transparent_80%)]">
        <MicroSlats
          preset="tide"
          slatWidth={7}
          slatHeight={20}
          gap={3}
          roundness={0.85}
          color="#a596ff"
          glintColor="#ffffff"
          backgroundColor="#efedff"
          speed={0.4}
          scale={1.4}
          direction={250}
          contrast={1.35}
          glint={0.9}
          fog={0.45}
          perspective={0.45}
          cursorStrength={0.7}
          cursorSize={60}
          paused={still}
        />
      </div>

      <div className="pointer-events-none relative">
        <h2 className="flex items-center gap-2 text-[14.5px] font-semibold text-ink">
          <TrendingUp className="size-4 text-ink-2" />
          {title}
        </h2>

        <div className="mt-2.5 min-h-[88px]">
          {loading || !page ? (
            <div className="grid gap-2 pt-1">
              <div className="h-3.5 w-[85%] animate-pulse rounded-full bg-line-2" />
              <div className="h-3.5 w-[60%] animate-pulse rounded-full bg-line-2" />
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${current}-${page.text}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: EASE }}>
                <p className="max-w-[1000px] text-[13.5px] leading-relaxed text-ink-2">{page.text}</p>
                <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-2 pr-28">
                  {page.chips.map((c, i) => (
                    <button
                      key={`${c.label}-${i}`}
                      type="button"
                      onClick={() => onAsk(page.prompt)}
                      title="Spørg assistenten om det"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] transition-colors hover:border-black/15"
                    >
                      <BrandIcon brand="microsoft_ads" className="size-3.5 shrink-0" />
                      <span className="max-w-[260px] truncate font-medium text-[#0f6cbd]">{c.label}</span>
                      <span className={cn('shrink-0', TONE[c.tone])}>{c.detail}</span>
                    </button>
                  ))}
                  {!page.chips.length && (
                    <button type="button" onClick={() => onAsk(page.prompt)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink-2 hover:border-black/15">
                      Spørg assistenten
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {count > 1 && !loading && (
        <div className="absolute bottom-4 right-5 flex items-center gap-1 text-[12px] tabular text-muted">
          <button type="button" aria-label="Forrige indsigt" onClick={() => step(-1)} className="grid size-6 place-items-center rounded-md hover:bg-line-2 hover:text-ink">
            <ChevronLeft className="size-3" />
          </button>
          {current + 1} af {count}
          <button type="button" aria-label="Næste indsigt" onClick={() => step(1)} className="grid size-6 place-items-center rounded-md hover:bg-line-2 hover:text-ink">
            <ChevronRight className="size-3" />
          </button>
        </div>
      )}
    </section>
  );
}
