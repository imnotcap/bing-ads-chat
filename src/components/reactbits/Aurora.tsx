/**
 * Aurora – soft, slowly drifting light bands (React Bits style, light-theme variant).
 * WebGL via OGL; falls back to a static CSS gradient without WebGL and freezes
 * when reduced motion is on or the page is hidden.
 */
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useReducedMotionConfig } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { SIMPLEX_NOISE, hexToRgb, supportsWebGL } from './webgl';

const VERT = /* glsl */ `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform float uTime;
uniform float uAmplitude;
uniform float uIntensity;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
out vec4 fragColor;
${SIMPLEX_NOISE}
vec3 ramp(float x) {
  vec3 a = mix(uColorStops[0], uColorStops[1], smoothstep(0.0, 0.5, x));
  return mix(a, uColorStops[2], smoothstep(0.5, 1.0, x));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float t = uTime;
  float n1 = snoise(vec2(uv.x * 1.6 + t * 0.06, t * 0.12));
  float n2 = snoise(vec2(uv.x * 3.1 - t * 0.05, t * 0.09 + 4.0));
  // Two bands near the top that breathe and drift.
  float y1 = 0.78 + n1 * 0.10 * uAmplitude;
  float y2 = 0.62 + n2 * 0.08 * uAmplitude;
  float b1 = exp(-pow((uv.y - y1) * 3.0, 2.0));
  float b2 = exp(-pow((uv.y - y2) * 4.2, 2.0)) * 0.7;
  float shimmer = 0.85 + 0.15 * snoise(vec2(uv.x * 9.0, t * 0.4));
  vec3 color = ramp(clamp(uv.x + n1 * 0.15, 0.0, 1.0));
  float alpha = clamp((b1 + b2) * shimmer * uIntensity, 0.0, 1.0);
  fragColor = vec4(color * alpha, alpha);
}`;

export interface AuroraProps {
  colorStops?: [string, string, string];
  amplitude?: number;
  intensity?: number;
  speed?: number;
  className?: string;
}

export function Aurora({ colorStops = ['#7c9bff', '#b79cff', '#7fe3d4'], amplitude = 1, intensity = 0.55, speed = 1, className }: AuroraProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionConfig();
  const [webgl] = useState(supportsWebGL);

  useEffect(() => {
    const host = ref.current;
    if (!host || !webgl) return;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio, 1.5) });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    host.appendChild(gl.canvas);

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uIntensity: { value: intensity },
        uColorStops: { value: colorStops.map(hexToRgb) },
        uResolution: { value: [host.clientWidth, host.clientHeight] },
      },
    });
    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) delete (geometry.attributes as Record<string, unknown>).uv;
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      program.uniforms.uResolution!.value = [gl.canvas.width, gl.canvas.height];
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let raf = 0;
    const start = performance.now() - 20_000 * Math.random();
    const frame = (now: number) => {
      program.uniforms.uTime!.value = ((now - start) / 1000) * speed;
      renderer.render({ scene: mesh });
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) raf = requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      gl.canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl, reduce, amplitude, intensity, speed, colorStops.join()]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={
        webgl
          ? undefined
          : { background: `radial-gradient(60% 50% at 30% 0%, ${colorStops[0]}55, transparent), radial-gradient(50% 40% at 75% 10%, ${colorStops[1]}44, transparent)` }
      }
    />
  );
}
