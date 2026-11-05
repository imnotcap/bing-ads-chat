/**
 * Text that decodes out of the app's ASCII glyphs (" ·▪■") when it scrolls into view –
 * left to right, about half a second. Screen readers get the plain text.
 */
import { useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const GLYPHS = '·▪■:+=*#';

const scrambled = (text: string) => text.replace(/\S/g, (_, i: number) => GLYPHS[i % GLYPHS.length]!);

export function ScrambleText({ text, className, duration = 650 }: { text: string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(() => (reduce ? text : scrambled(text)));

  useEffect(() => {
    if (reduce) return setShown(text);
    if (!inView) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const done = Math.floor(p * text.length);
      let out = text.slice(0, done);
      for (let i = done; i < text.length; i++) out += text[i] === ' ' ? ' ' : GLYPHS[(i * 7 + Math.floor(now / 45)) % GLYPHS.length];
      setShown(out);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Always end on the real text, also when frames are slow or skipped.
    const end = setTimeout(() => setShown(text), duration + 80);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(end);
    };
  }, [inView, reduce, text, duration]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
