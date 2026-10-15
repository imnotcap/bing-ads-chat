/** Small sparks radiate from every click (React Bits style). */
import { useEffect, useRef, type ReactNode } from 'react';

interface Spark {
  x: number;
  y: number;
  angle: number;
  start: number;
}

export function ClickSpark({
  children,
  enabled = true,
  color = '#6f86ff',
  count = 8,
  radius = 18,
  size = 9,
  duration = 420,
}: {
  children: ReactNode;
  enabled?: boolean;
  color?: string;
  count?: number;
  radius?: number;
  size?: number;
  duration?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<Spark[]>([]);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      sparks.current = sparks.current.filter((s) => {
        const t = (now - s.start) / duration;
        if (t >= 1) return false;
        const eased = 1 - (1 - t) * (1 - t) * (1 - t);
        const dist = eased * radius;
        const len = size * (1 - eased);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1 - t * 0.6;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x + dist * Math.cos(s.angle), s.y + dist * Math.sin(s.angle));
        ctx.lineTo(s.x + (dist + len) * Math.cos(s.angle), s.y + (dist + len) * Math.sin(s.angle));
        ctx.stroke();
        return true;
      });
      ctx.globalAlpha = 1;
      raf.current = sparks.current.length ? requestAnimationFrame(draw) : 0;
    };

    const onClick = (e: PointerEvent) => {
      if (e.button !== 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const now = performance.now();
      for (let i = 0; i < count; i++) sparks.current.push({ x: e.clientX, y: e.clientY, angle: (2 * Math.PI * i) / count, start: now });
      if (!raf.current) raf.current = requestAnimationFrame(draw);
    };
    window.addEventListener('pointerdown', onClick);
    return () => {
      window.removeEventListener('pointerdown', onClick);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [enabled, color, count, radius, size, duration]);

  return (
    <>
      {children}
      {enabled && <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[100] h-full w-full" />}
    </>
  );
}
