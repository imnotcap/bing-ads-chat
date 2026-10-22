/**
 * The quiet background behind every page: React Bits' GradientASCII in light grey
 * squares, shaped as an arc from the left side over the top to the right side, so the
 * middle (where the content is) stays clean. The left half is drawn and mirrored to the
 * right, so the arc is exactly symmetric around the middle. It stays when the page
 * changes.
 */
import type { CSSProperties } from 'react';
import { GradientASCII } from '@/components/reactbits';
import { cn } from '@/lib/utils';

/** Grey stops dark enough for the glyphs to read; the mask and glyph opacity make them faint. */
const GREYS = ['#5f656f', '#8c919a', '#6f757f', '#a7abb3'];

/** Visible outside an ellipse standing on the bottom edge = an arc; faded out towards the bottom. */
const MASK = [
  'radial-gradient(ellipse 64% 96% at 50% 100%, transparent 80%, rgb(0 0 0 / 0.35) 91%, black 104%)',
  'linear-gradient(180deg, black 0%, black 40%, transparent 80%)',
].join(', ');

function Half({ mirrored }: { mirrored?: boolean }) {
  return (
    <div className={cn('absolute inset-y-0 w-1/2', mirrored ? 'right-0 -scale-x-100' : 'left-0')}>
      <GradientASCII
        className="absolute inset-0"
        colors={GREYS}
        shape="horizon"
        characters=" ·▪■"
        cellSize={14}
        density={0.55}
        glyphOpacity={0.15}
        gradientOpacity={0}
        grain={0}
        flicker={0.12}
        speed={0.6}
        lightMode
        inkColor="#c3c7cd"
        intro={false}
        mouseInteraction={false}
        clickEffect="none"
      />
    </div>
  );
}

export function AsciiArc({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 z-0', className)}
      style={{ maskImage: MASK, WebkitMaskImage: MASK, maskComposite: 'intersect', WebkitMaskComposite: 'source-in', ...style }}
    >
      <Half />
      <Half mirrored />
    </div>
  );
}
