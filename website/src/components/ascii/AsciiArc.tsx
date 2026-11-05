/**
 * The app's background (src/components/layout/AsciiArc.tsx in the app): React Bits'
 * GradientASCII in light grey squares, shaped as an arc from the left side over the top
 * to the right side, so the middle stays clean. The left half is drawn and mirrored.
 */
import type { CSSProperties } from 'react';
import { cn } from '@/lib/ui';
import { GradientASCII, type GradientASCIIShape } from './GradientASCII';

/** Grey stops dark enough for the glyphs to read; the mask and glyph opacity make them faint. */
const GREYS = ['#5f656f', '#8c919a', '#6f757f', '#a7abb3'];

/** Visible outside an ellipse standing on the bottom edge = an arc; faded out towards the bottom. */
const ARC = [
  'radial-gradient(ellipse 64% 96% at 50% 100%, transparent 80%, rgb(0 0 0 / 0.35) 91%, black 104%)',
  'linear-gradient(180deg, black 0%, black 40%, transparent 80%)',
].join(', ');

function Half({ mirrored, ink, opacity }: { mirrored?: boolean; ink: string; opacity: number }) {
  return (
    <div className={cn('absolute inset-y-0 w-1/2', mirrored ? 'right-0 -scale-x-100' : 'left-0')}>
      <GradientASCII
        className="absolute inset-0"
        colors={GREYS}
        shape="horizon"
        characters=" ·▪■"
        cellSize={14}
        density={0.55}
        glyphOpacity={opacity}
        gradientOpacity={0}
        grain={0}
        flicker={0.12}
        speed={0.6}
        lightMode
        inkColor={ink}
        intro={false}
        mouseInteraction={false}
        clickEffect="none"
      />
    </div>
  );
}

/** `strength` lifts the glyphs a little above the app's (a web page has more white around it). */
export function AsciiArc({ className, style, strength = 1 }: { className?: string; style?: CSSProperties; strength?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 z-0', className)}
      style={{ maskImage: ARC, WebkitMaskImage: ARC, maskComposite: 'intersect', WebkitMaskComposite: 'source-in', ...style }}
    >
      <Half ink={strength > 1 ? '#aeb3bb' : '#c3c7cd'} opacity={0.15 * strength} />
      <Half mirrored ink={strength > 1 ? '#aeb3bb' : '#c3c7cd'} opacity={0.15 * strength} />
    </div>
  );
}

/** A quiet grey ASCII field for panels and bands (any shape, faded at the edges). */
export function AsciiField({
  className,
  shape = 'pinch',
  mask = 'radial-gradient(ellipse 70% 80% at 50% 50%, black 30%, transparent 80%)',
  ink = '#b9bdc4',
  opacity = 0.22,
  interactive = false,
}: {
  className?: string;
  shape?: GradientASCIIShape;
  mask?: string;
  ink?: string;
  opacity?: number;
  interactive?: boolean;
}) {
  return (
    <div aria-hidden="true" className={cn('absolute inset-0', !interactive && 'pointer-events-none', className)} style={{ maskImage: mask, WebkitMaskImage: mask }}>
      <GradientASCII
        className="absolute inset-0"
        colors={GREYS}
        shape={shape}
        characters=" ·▪■"
        cellSize={13}
        density={0.6}
        glyphOpacity={opacity}
        gradientOpacity={0}
        grain={0}
        flicker={0.15}
        speed={0.6}
        lightMode
        inkColor={ink}
        intro={false}
        mouseInteraction={interactive}
        clickEffect={interactive ? 'wave' : 'none'}
      />
    </div>
  );
}
