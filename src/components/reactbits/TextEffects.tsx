/** Text effects in React Bits style: BlurText, ShinyText, GradientText, RotatingText. */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EASE } from '../motion';

/** Words blur and slide into place one after another. */
export function BlurText({
  text,
  className,
  delay = 0.06,
  startDelay = 0,
  as: Tag = 'p',
}: {
  text: string;
  className?: string;
  delay?: number;
  startDelay?: number;
  as?: 'p' | 'h1' | 'h2' | 'span';
}) {
  const words = text.split(' ');
  const MotionTag = motion[Tag];
  return (
    <MotionTag className={cn('flex flex-wrap', className)} initial="hidden" animate="show" aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          aria-hidden
          className="inline-block whitespace-pre"
          variants={{
            hidden: { opacity: 0, filter: 'blur(10px)', y: -10 },
            show: {
              opacity: 1,
              filter: 'blur(0px)',
              y: 0,
              transition: { duration: 0.55, ease: EASE, delay: startDelay + i * delay },
            },
          }}
        >
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </MotionTag>
  );
}

/** A light sweep across muted text – used for "thinking" states. */
export function ShinyText({ children, className, disabled = false }: { children: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <span
      className={cn('inline-block bg-clip-text text-transparent', !disabled && 'animate-shimmer', className)}
      style={{
        backgroundImage: 'linear-gradient(110deg, #8a8fa6 35%, #e9ecff 50%, #8a8fa6 65%)',
        backgroundSize: '220% 100%',
      }}
    >
      {children}
    </span>
  );
}

/** Slowly flowing brand gradient text. */
export function GradientText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.span
      className={cn('inline-block bg-clip-text text-transparent', className)}
      style={{
        backgroundImage: 'linear-gradient(100deg, #4f6bf5, #8b5cf6, #14b8a6, #4f6bf5)',
        backgroundSize: '300% 100%',
      }}
      animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
      transition={{ duration: 10, ease: 'linear', repeat: Infinity }}
    >
      {children}
    </motion.span>
  );
}

/** Cycles through words with a vertical slide. */
export function RotatingText({ words, interval = 2600, className }: { words: string[]; interval?: number; className?: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  return (
    <span className={cn('relative inline-flex overflow-hidden align-bottom', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={index}
          className="inline-block whitespace-nowrap"
          initial={{ y: '100%', opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-100%', opacity: 0, filter: 'blur(4px)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
