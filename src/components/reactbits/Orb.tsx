/**
 * Orb – a glowing, swirling orb (React Bits "Orb" API).
 *
 * WebGL2, one full-screen triangle. The orb is a procedural 2D field: a noisy ring
 * whose colour swirls between colors[0] and colors[1] over a colors[2] base, an
 * orbiting highlight with a comet trail, a soft bloom and a hover displacement that
 * reaches towards the pointer. Composited for light or dark backgrounds.
 */
import { useReducedMotionConfig } from 'motion/react';
import { useEffect, useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { SIMPLEX_NOISE, hexToRgb } from './webgl';

export interface OrbProps {
  colors?: string[];
  /** Hue rotation in degrees (YIQ). */
  hue?: number;
  backgroundColor?: string;
  /** Larger = bigger orb in the canvas. */
  size?: number;
  glow?: number;
  /** Soft coloured bloom outside the ring (turn off for a clean edge on light backgrounds). */
  halo?: boolean;
  bleed?: number;
  wobble?: number;
  highlight?: number;
  trail?: number;
  speed?: number;
  hoverIntensity?: number;
  rotateOnHover?: boolean;
  forceHoverState?: boolean;
  followCursor?: boolean;
  clickPulse?: boolean;
  intro?: boolean;
  opacity?: number;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
}

const VERT = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform float uRotation;
uniform vec2 uReach;
uniform float uHover;
uniform float uNear;
uniform float uSwirl;
uniform float uOrbit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uGlow;
uniform float uBleed;
uniform float uWobble;
uniform float uHighlight;
uniform float uTrail;
uniform float uHoverIntensity;
uniform float uBgLum;
uniform float uReveal;
uniform vec2 uEcho;
uniform float uOpacity;
uniform float uHalo;
out vec4 fragColor;
${SIMPLEX_NOISE}

float snoise3(vec3 p) {
  // Cheap 3D noise from two 2D samples (time on the third axis).
  return 0.5 * (snoise(p.xy + p.z * 0.71) + snoise(p.yx * 1.13 - p.z * 0.53));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uRes * 0.5) / min(uRes.x, uRes.y) * 2.0 * uScale;
  float s = sin(uRotation), c = cos(uRotation);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

  float rawLen = length(uv);
  vec2 dir = rawLen > 0.0 ? uv / rawLen : vec2(0.0);
  float reachLen = length(uReach);
  vec2 reachDir = reachLen > 0.0 ? uReach / reachLen : vec2(0.0);
  float facing = exp((dot(dir, reachDir) - 1.0) * 3.2);
  float len = max(rawLen - reachLen * facing * smoothstep(0.25, 0.65, rawLen), 0.0);
  float ang = atan(uv.y, uv.x);
  float t = uTime;

  float n0 = snoise3(vec3(uv * 0.65, t * 0.5)) * 0.5 + 0.5;
  float r0 = mix(0.8 - 0.04 * uWobble, 0.8 + 0.04 * uWobble, n0);
  float d0 = abs(len - r0);
  float glow = max(uGlow, 0.1);
  float v0 = 1.0 / (1.0 + d0 * 10.0 / glow) * smoothstep(r0 * 1.05, r0, len);
  float reach = max(uBleed, 0.04);
  float body = smoothstep(0.8 - 0.2 * reach, 0.8, len);
  float v2 = smoothstep(1.0, mix(0.6, 1.0, n0 * 0.5), len);

  float cl = cos(ang + uSwirl) * 0.5 + 0.5;
  vec3 colBase = mix(uColor1, uColor2, cl);
  vec3 col = mix(uColor3, colBase, v0);

  vec2 hp = r0 * vec2(cos(uOrbit), sin(uOrbit));
  float d = distance(uv, hp);
  float lag = mod(ang - uOrbit + 3.14159265, 6.2831853) - 3.14159265;
  float trailTerm = uTrail > 0.0 ? smoothstep(0.0, 0.35, lag) * exp(-max(lag, 0.0) * 2.6 / uTrail) : 0.0;
  float v1 = (1.5 / (1.0 + 5.0 * d * d) + trailTerm * 0.6) * uHighlight / (1.0 + 50.0 * d0);

  col = (col + v1 * mix(vec3(1.0), colBase, 0.35)) * v2 * mix(1.0, body, clamp(reach * 0.5, 0.0, 1.0));
  col *= 1.0 + 0.25 * uHover * uHoverIntensity + 0.2 * uNear;

  // Bloom outside the ring.
  float dist = max(len - r0, 0.0);
  float bloom = 1.0 / (1.0 + (160.0 / glow) * dist * dist) * smoothstep(1.0 + 0.4 * glow, r0, len);
  col += mix(colBase, uColor1, 0.5) * bloom * 0.35 * (1.0 - v2 * 0.5) * uHalo;

  // Without the halo, everything outside the ring fades out fast – a clean edge instead
  // of a purple disc on light backgrounds.
  col *= mix(1.0, smoothstep(r0 + 0.07, r0 - 0.01, len), 1.0 - uHalo);

  // Click echo ring.
  float echo = uEcho.y * (1.0 - uEcho.x) * exp(-pow((len - r0 - uEcho.x * 0.6) * 12.0, 2.0));
  col += colBase * echo;

  col = clamp(col, 0.0, 1.0);
  float a = max(max(col.r, col.g), col.b);
  vec3 rgb = col / max(a, 1e-4);
  // On light backgrounds the dark base reads as colour, not as transparency.
  float alpha = mix(a, sqrt(a), uBgLum);
  alpha = clamp(alpha * uReveal * uOpacity + (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0, 0.0, 1.0);
  fragColor = vec4(rgb * alpha, alpha);
}`;

/** Rotates a colour's hue in YIQ space. */
export function adjustHue([r, g, b]: [number, number, number], degrees: number): [number, number, number] {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const i = 0.596 * r - 0.274 * g - 0.322 * b;
  const q = 0.211 * r - 0.523 * g + 0.312 * b;
  const h = (degrees * Math.PI) / 180;
  const i2 = i * Math.cos(h) - q * Math.sin(h);
  const q2 = i * Math.sin(h) + q * Math.cos(h);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [clamp(y + 0.956 * i2 + 0.621 * q2), clamp(y - 0.272 * i2 - 0.647 * q2), clamp(y - 1.106 * i2 + 1.703 * q2)];
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function Orb({
  colors = ['#9c43fe', '#4cc2e9', '#101499'],
  hue = 0,
  backgroundColor = '#ffffff',
  size = 1,
  glow = 1,
  halo = true,
  bleed = 1,
  wobble = 1,
  highlight = 1,
  trail = 1,
  speed = 1,
  hoverIntensity = 1,
  rotateOnHover = true,
  forceHoverState = false,
  followCursor = true,
  clickPulse = true,
  intro = true,
  opacity = 1,
  paused = false,
  className,
  style,
}: OrbProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionConfig();
  const key = [colors.join(), hue, backgroundColor, size, glow, halo, bleed, wobble, highlight, trail, speed, hoverIntensity, rotateOnHover, forceHoverState, followCursor, clickPulse, intro, opacity, paused].join('|');

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) {
      host.style.background = `radial-gradient(circle, ${colors[0]} 0%, ${colors[1] ?? colors[0]} 45%, transparent 60%)`;
      return;
    }
    host.appendChild(canvas);
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    gl.useProgram(program);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const u = (n: string) => gl.getUniformLocation(program, n);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const base = [colors[0], colors[1] ?? colors[0], colors[2] ?? colors[1] ?? colors[0]].map((c) => adjustHue(hexToRgb(c ?? '#ffffff'), hue));
    gl.uniform3fv(u('uColor1'), base[0]!);
    gl.uniform3fv(u('uColor2'), base[1]!);
    gl.uniform3fv(u('uColor3'), base[2]!);
    gl.uniform1f(u('uGlow'), Math.min(5, Math.max(0.1, glow)));
    gl.uniform1f(u('uBleed'), Math.min(4, Math.max(0, bleed)));
    gl.uniform1f(u('uWobble'), Math.max(0, wobble));
    gl.uniform1f(u('uHighlight'), Math.max(0, highlight));
    gl.uniform1f(u('uTrail'), Math.max(0, trail));
    gl.uniform1f(u('uHoverIntensity'), Math.max(0, hoverIntensity));
    gl.uniform1f(u('uBgLum'), luminance(backgroundColor));
    gl.uniform1f(u('uOpacity'), Math.min(1, Math.max(0, opacity)));
    gl.uniform1f(u('uHalo'), halo ? 1 : 0);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.max(1, Math.round(host.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(host.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('uRes'), canvas.width, canvas.height);
    };

    const motion = reduce ? 0 : 1;
    const st = {
      time: 0,
      swirl: 0,
      orbit: 0,
      rotation: 0,
      hover: forceHoverState ? 1 : 0,
      near: 0,
      reach: [0, 0],
      reachV: [0, 0],
      pulse: 0,
      pulseV: 0,
      kick: 0,
      echo: 1,
      reveal: intro && !reduce ? 0 : 1,
      grow: intro && !reduce ? 0 : 1,
      pointer: null as null | { x: number; y: number },
    };
    const sizeC = Math.min(3, Math.max(0.1, size));
    const scaleNow = () => 1 / (sizeC * (1 + st.pulse) * (0.62 + 0.38 * st.grow));

    /** Pointer → orb coordinates (inverse of the shader mapping). */
    const toOrb = (clientX: number, clientY: number) => {
      const r = host.getBoundingClientRect();
      const m = Math.min(r.width, r.height);
      let x = ((clientX - (r.left + r.width / 2)) / m) * 2 * scaleNow();
      let y = (-(clientY - (r.top + r.height / 2)) / m) * 2 * scaleNow();
      const s = Math.sin(-st.rotation);
      const c = Math.cos(-st.rotation);
      [x, y] = [c * x - s * y, s * x + c * y];
      return { x, y };
    };
    const onMove = (e: PointerEvent) => (st.pointer = toOrb(e.clientX, e.clientY));
    const onLeave = () => (st.pointer = null);
    const onDown = (e: PointerEvent) => {
      if (!clickPulse || reduce) return;
      const p = toOrb(e.clientX, e.clientY);
      if (Math.hypot(p.x, p.y) <= 1) {
        st.pulseV += 0.9;
        st.kick = 2.2;
        st.echo = 0;
      }
    };
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointerdown', onDown);

    let raf = 0;
    let prev = performance.now();
    let visible = true;
    const draw = () => {
      gl.uniform1f(u('uTime'), st.time);
      gl.uniform1f(u('uScale'), scaleNow());
      gl.uniform1f(u('uRotation'), st.rotation);
      gl.uniform2f(u('uReach'), st.reach[0]!, st.reach[1]!);
      gl.uniform1f(u('uHover'), st.hover);
      gl.uniform1f(u('uNear'), st.near);
      gl.uniform1f(u('uSwirl'), st.swirl);
      gl.uniform1f(u('uOrbit'), st.orbit);
      gl.uniform1f(u('uReveal'), st.reveal >= 1 ? 1 : (() => { const x = Math.min(1, st.reveal / 0.55); return x * x * (3 - 2 * x); })());
      gl.uniform2f(u('uEcho'), st.echo, st.echo < 1 ? 1 : 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.0005, (now - prev) / 1000));
      prev = now;
      const p = st.pointer;
      const distance = p ? Math.hypot(p.x, p.y) : 99;
      const region = Math.min(1, Math.max(0, (1.45 - distance) / 0.4));
      const zone = motion ? region * region * (3 - 2 * region) : 0;
      const aimed = zone * Math.min(1, Math.max(0, (distance - 0.15) / 0.45));
      const near = zone > 0.5;

      st.hover += ((forceHoverState ? 1 : zone) - st.hover) * (1 - Math.exp(-dt / 0.16));
      const dirX = p && distance > 0 ? p.x / distance : 0;
      const dirY = p && distance > 0 ? p.y / distance : 0;
      const goal = 0.075 * hoverIntensity * aimed;
      for (let i = 0; i < 2; i++) {
        const target = goal * (i === 0 ? dirX : dirY);
        st.reachV[i]! += (70 * (target - st.reach[i]!) - 7 * st.reachV[i]!) * dt;
        st.reach[i]! += st.reachV[i]! * dt;
      }
      st.near += (aimed * hoverIntensity - st.near) * (1 - Math.exp(-dt / 0.12));
      const stepT = dt * speed * motion;
      st.time += stepT;
      st.swirl += stepT * 2 * (1 + st.kick);
      st.echo = Math.min(1, st.echo + dt / 1.2);
      if (rotateOnHover) st.rotation += dt * 0.3 * st.hover * motion;
      if (followCursor && near && p) {
        const target = Math.atan2(p.y, p.x);
        let diff = target - st.orbit;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        st.orbit += diff * (1 - Math.exp(-6 * dt));
      } else {
        st.orbit -= stepT;
      }
      st.pulseV += (-170 * st.pulse - 11 * st.pulseV) * dt;
      st.pulse += st.pulseV * dt;
      st.kick *= Math.exp(-2.5 * dt);
      if (st.reveal < 1) st.reveal = Math.min(1, st.reveal + dt / 1.1);
      if (st.grow < 1) st.grow = Math.min(1, st.grow + dt / 1.1);
      draw();
      if (!paused && !reduce && visible && !document.hidden) raf = requestAnimationFrame(step);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      prev = performance.now();
      raf = requestAnimationFrame(step);
    };

    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(host);
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      if (visible) start();
    });
    io.observe(host);
    const onVis = () => !document.hidden && start();
    document.addEventListener('visibilitychange', onVis);
    resize();
    start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerdown', onDown);
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduce]);

  return <div ref={ref} className={cn('relative', className)} style={style} aria-hidden />;
}

export default Orb;

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
        style={{ background: 'conic-gradient(from 210deg, #6d5cf6, #a78bfa, #f0abfc, #8b7bff, #6d5cf6)' }}
      />
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.95),rgba(255,255,255,0.15)_55%,transparent_70%)]" />
    </span>
  );
}
