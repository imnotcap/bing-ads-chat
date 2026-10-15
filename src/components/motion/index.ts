/**
 * Motion vocabulary (motion/react). One easing curve, short durations and small
 * distances, so the app feels calm. The Animationer setting is applied through
 * <MotionConfig reducedMotion> in App.tsx.
 */
import type { Transition, Variants } from 'motion/react';

/** Smooth "ease-out-quint" – fast start, soft landing. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const SPRING: Transition = { type: 'spring', stiffness: 420, damping: 34 };
export const SOFT_SPRING: Transition = { type: 'spring', stiffness: 260, damping: 30 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE } },
};

export function stagger(staggerChildren = 0.05, delayChildren = 0): Variants {
  return { hidden: {}, show: { transition: { staggerChildren, delayChildren } } };
}

export const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18, ease: EASE } },
};
