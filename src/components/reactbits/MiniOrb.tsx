/**
 * The React Bits Orb as a small avatar. Each animated orb is its own WebGL context and
 * browsers allow only ~16, so only the ones that matter animate (the newest answer, the
 * insights panel); the rest show a still frame of the same orb (assets/orb-still.png).
 */
import { cn } from '@/lib/utils';
import still from '@/assets/orb-still.png';
import Orb from './Orb';

export function MiniOrb({ size = 28, active = false, animated = true, className }: { size?: number; active?: boolean; animated?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('relative inline-block shrink-0 overflow-hidden rounded-full transition-shadow', className)}
      style={{ width: size, height: size, boxShadow: active ? '0 0 0 3px rgb(109 92 246 / 0.14), 0 6px 18px -6px rgb(109 92 246 / 0.55)' : undefined }}
    >
      {animated ? (
        <Orb backgroundColor="#ffffff" forceHoverState={active} hoverIntensity={active ? 1.2 : 0.6} followCursor={false} clickPulse={false} intro={false} />
      ) : (
        <img src={still} alt="" className="absolute inset-0 size-full" draggable={false} />
      )}
    </span>
  );
}
