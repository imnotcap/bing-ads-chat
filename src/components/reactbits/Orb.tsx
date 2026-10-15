/**
 * Orb – a glowing, slowly swirling sphere used as the assistant's presence
 * (React Bits style). Reacts to hover and to `active` (the assistant is working).
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
uniform float uHover;
uniform float uActive;
uniform vec2 uResolution;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
out vec4 fragColor;
${SIMPLEX_NOISE}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y) * 2.0;
  float t = uTime * (0.35 + uActive * 0.5);
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  // Smooth, low-frequency wobble (sin/cos keep it seamless around the circle).
  float wobble = snoise(vec2(cos(ang) * 0.8 + t * 0.25, sin(ang) * 0.8 - t * 0.2)) * (0.018 + 0.03 * uHover + 0.025 * uActive);
  float radius = 0.64 + wobble;
  float body = smoothstep(radius, radius - 0.02, r);
  // Swirling colour inside the sphere.
  vec2 p = uv * 1.05;
  float n1 = snoise(p + vec2(t * 0.5, -t * 0.3));
  float n2 = snoise(p * 1.7 + vec2(-t * 0.4, t * 0.6) + n1);
  vec3 col = mix(uA, uB, smoothstep(-0.6, 0.6, n1));
  col = mix(col, uC, smoothstep(0.1, 0.9, n2) * 0.65);
  // Soft highlight and rim.
  float light = smoothstep(0.9, 0.0, length(uv - vec2(-0.25, 0.3)));
  col = mix(col, vec3(1.0), light * 0.45);
  float rim = smoothstep(radius - 0.22, radius, r) * body;
  col = mix(col, vec3(1.0), rim * 0.35);
  // Outer glow.
  float glow = exp(-pow(max(r - radius, 0.0) * 6.0, 1.3)) * (1.0 - body) * (0.4 + 0.35 * uActive + 0.2 * uHover);
  glow *= smoothstep(1.0, 0.78, r);
  vec3 glowCol = mix(uA, uB, 0.5);
  float alpha = max(body, glow);
  vec3 color = col * body + glowCol * glow;
  fragColor = vec4(color, alpha);
}`;

export interface OrbProps {
  size?: number;
  active?: boolean;
  colors?: [string, string, string];
  className?: string;
}

export function Orb({ size = 160, active = false, colors = ['#5b7cff', '#a26bff', '#38d6c2'], className }: OrbProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionConfig();
  const [webgl] = useState(supportsWebGL);
  const state = useRef({ hover: 0, hoverTarget: 0, active: active ? 1 : 0, activeTarget: active ? 1 : 0 });
  state.current.activeTarget = active ? 1 : 0;

  useEffect(() => {
    const host = ref.current;
    if (!host || !webgl) return;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, dpr: Math.min(window.devicePixelRatio, 2) });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    host.appendChild(gl.canvas);
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    const [a, b, c] = colors.map(hexToRgb);
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uHover: { value: 0 },
        uActive: { value: 0 },
        uResolution: { value: [1, 1] },
        uA: { value: a },
        uB: { value: b },
        uC: { value: c },
      },
    });
    const geometry = new Triangle(gl);
    const mesh = new Mesh(gl, { geometry, program });
    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      program.uniforms.uResolution!.value = [gl.canvas.width, gl.canvas.height];
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const enter = () => (state.current.hoverTarget = 1);
    const leave = () => (state.current.hoverTarget = 0);
    host.addEventListener('pointerenter', enter);
    host.addEventListener('pointerleave', leave);

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const s = state.current;
      s.hover += (s.hoverTarget - s.hover) * 0.06;
      s.active += (s.activeTarget - s.active) * 0.04;
      program.uniforms.uTime!.value = (now - start) / 1000;
      program.uniforms.uHover!.value = s.hover;
      program.uniforms.uActive!.value = s.active;
      renderer.render({ scene: mesh });
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener('pointerenter', enter);
      host.removeEventListener('pointerleave', leave);
      gl.canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl, reduce, colors.join()]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('relative shrink-0', className)}
      style={{
        width: size,
        height: size,
        ...(webgl ? {} : { borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, #fff, ${colors[0]} 40%, ${colors[1]} 75%, ${colors[2]})` }),
      }}
    />
  );
}

/** Lightweight CSS version of the orb for avatars (no WebGL context per message). */
export function MiniOrb({ size = 28, active = false, className }: { size?: number; active?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('relative inline-block shrink-0 overflow-hidden rounded-full', className)}
      style={{
        width: size,
        height: size,
        boxShadow: active ? '0 0 0 3px rgb(91 124 255 / 0.15), 0 6px 18px -6px rgb(91 124 255 / 0.6)' : '0 4px 14px -6px rgb(91 124 255 / 0.55)',
      }}
    >
      <span
        className={cn('absolute -inset-1/4 rounded-full', active && 'animate-[spin_2.4s_linear_infinite]')}
        style={{ background: 'conic-gradient(from 210deg, #5b7cff, #a26bff, #38d6c2, #5b7cff)' }}
      />
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.95),rgba(255,255,255,0.15)_55%,transparent_70%)]" />
    </span>
  );
}
