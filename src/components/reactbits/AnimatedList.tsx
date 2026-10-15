/** List whose items fade and scale in as they appear (React Bits style). */
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { EASE } from '../motion';

export function AnimatedList<T>({
  items,
  getKey,
  renderItem,
  className,
  itemClassName,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <ul className={className}>
      <AnimatePresence initial={false}>
        {items.map((item, i) => (
          <motion.li
            key={getKey(item)}
            layout="position"
            className={itemClassName}
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.32, ease: EASE, delay: Math.min(i, 10) * 0.025 } }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
          >
            {renderItem(item, i)}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
