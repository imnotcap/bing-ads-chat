/**
 * GradientASCII – a soft colour gradient rendered through a grid of ASCII glyphs
 * (React Bits "GradientASCII" API: colors, shape, characters, cellSize, density …).
 *
 * One WebGL2 pass: a procedural shape field (horizon / pinch / rise / eclipse) is
 * mapped to the colour stops; each cell samples the field at its centre and picks a
 * glyph from a canvas-rendered atlas. In light mode the glyphs are drawn as ink over
 * the gradient. Pointer movement scrambles glyphs along a short trail and clicks send
 * a wave. Pauses off-screen / in hidden tabs and renders a single frame under reduced
 * motion.
 */
import { useReducedMotionConfig } from 'framer-motion';
import { useEffect, useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/ui';

// Website copy of the app's src/components/reactbits/GradientASCII.tsx. The site's cn() doesn't
// resolve class conflicts, so the root is only `relative` when no className positions it.

export type GradientASCIIShape = 'horizon' | 'pinch' | 'rise' | 'eclipse';

export interface GradientASCIIProps {
  colors?: string[];
  shape?: GradientASCIIShape;
  characters?: string;
  /** Glyph cell height in CSS px (width is 0.6 × height). */
  cellSize?: number;
  /** Share of cells that draw a glyph (0–1). */
  density?: number;
  glyphOpacity?: number;
  flicker?: number;
  softness?: number;
  scale?: number;
  flow?: number;
  speed?: number;
  gradientOpacity?: number;
  grain?: number;
  variation?: number;
  mouseInteraction?: boolean;
  scrambleRadius?: number;
  clickEffect?: 'wave' | 'none';
  intro?: boolean;
  /** Glyphs as dark ink over the gradient – for light backgrounds. */
  lightMode?: boolean;
  /** Ink colour used in light mode (defaults to the first colour). */
  inkColor?: string;
  fontFamily?: string;
  className?: string;
  style?: CSSProperties;
}

const MAX_STOPS = 8;
const TRAIL = 24;
const TRAIL_LIFE = 0.7;
const CLICKS = 4;
const CLICK_LIFE = 1.2;
const SHAPES: Record<GradientASCIIShape, number> = { horizon: 0, pinch: 1, rise: 2, eclipse: 3 };

const VERT = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;          // device px
uniform float uCell;        // device px (height)
uniform float uTime;
uniform float uGlyphTime;
uniform float uIntro;
uniform int uShape;
uniform float uDensity;
uniform float uGlyphOpacity;
uniform float uFlicker;
uniform float uSoftness;
uniform float uScale;
uniform float uFlow;
uniform float uGradientOpacity;
uniform float uGrain;
uniform float uSeed;
uniform float uLight;
uniform vec3 uInk;
uniform vec3 uStops[${MAX_STOPS}];
uniform int uStopCount;
uniform sampler2D uAtlas;
uniform vec2 uAtlasGrid;    // columns, rows
uniform float uGlyphCount;
uniform vec4 uTrail[${TRAIL}];  // x, y (domain), weight, unused
uniform float uScrambleRadius;
uniform vec4 uClicks[${CLICKS}]; // x, y, age, active
out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21) + uSeed * 0.137);
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

// Returns (x, y, z): two tones and their blend, plus the reveal order in w.
vec4 field(vec2 uv) {
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 q = p / uScale;
  float t = uTime;
  vec2 warp = vec2(vnoise(q * 2.3 + vec2(t * 0.11, 0.0)), vnoise(q * 2.3 + vec2(3.7, -t * 0.09))) - 0.5;
  q += warp * uFlow * (uShape == 3 ? 0.04 : 0.18);
  float soft = mix(0.05, 0.22, uSoftness);

  if (uShape == 1) { // pinch
    float sway = 0.02 * sin(1.7 * q.x + 0.55 * t);
    float width = (0.13 + 0.22 * q.x * q.x) * (1.0 + 0.08 * sin(t * 0.8)) * mix(0.8, 1.3, uSoftness);
    float y = abs(q.y - sway) / width;
    float v = exp(-pow(y, 2.2)) * (0.42 + 0.58 * exp(-1.8 * q.x * q.x));
    return vec4(v, v, 0.5, clamp(1.0 - y * 0.5, 0.0, 1.0));
  }
  if (uShape == 2) { // rise
    float wide = 0.5 * max(aspect, 1.0);
    vec2 c = vec2(0.05 * sin(0.45 * t) * wide, -0.7);
    vec2 d = (q - c) / vec2(0.82 * wide, 0.64);
    float s = mix(0.6, 1.15, uSoftness);
    float v = clamp(pow(max(1.0 - length(d), 0.0), s) * 1.35, 0.0, 1.0);
    return vec4(v, v, 0.5, clamp(length(d), 0.0, 1.0));
  }
  if (uShape == 3) { // eclipse
    float fit = min(aspect, 1.0);
    float r = 0.23 * fit;
    float d = length(q) - r;
    float reach = mix(0.05, 0.16, uSoftness) * (0.8 + 0.4 * vnoise(vec2(atan(q.y, q.x) * 3.0, t * 0.3)));
    float v = smoothstep(-0.006, 0.006 + 0.02 * uSoftness, d) * exp(-max(d, 0.0) / reach);
    return vec4(v, v, 0.5, clamp(d * 3.0, 0.0, 1.0));
  }
  // horizon
  float span = 0.5 * max(aspect, 1.0);
  float x = q.x / span;
  float arch = -0.17 - 0.2 * x * x + 0.02 * sin(0.6 * t);
  float edge = q.y - arch;
  float rim = 0.38 * smoothstep(-soft, 0.42, edge);
  vec2 sun = vec2(0.08 * sin(0.31 * t) * span, 0.58);
  vec2 sd = (q - sun) / vec2(1.15 * span, 0.95);
  float spread = exp(-dot(sd, sd) * 2.2);
  float sky = mix(0.55, 1.0, smoothstep(0.2, 0.95, spread));
  return vec4(rim, sky, smoothstep(0.18, 0.62, edge), clamp(edge * 1.3, 0.0, 1.0));
}

vec3 ramp(float t) {
  float x = smoothstep(0.3, 1.0, t) * float(uStopCount - 1);
  int i = int(floor(x));
  vec3 a = uStops[0];
  vec3 b = uStops[0];
  for (int k = 0; k < ${MAX_STOPS}; k++) {
    if (k == i) a = uStops[k];
    if (k == min(i + 1, uStopCount - 1)) b = uStops[k];
  }
  return mix(a, b, fract(x));
}

// Colour + alpha (straight) of the gradient at uv.
vec4 shade(vec2 uv, out float order) {
  vec4 f = field(uv);
  order = f.w;
  float reveal = smoothstep(0.0, 1.0, (uIntro * 1.45 - order) / 0.45);
  vec3 c = mix(ramp(f.x), ramp(f.y), f.z);
  float a = mix(smoothstep(0.0, 0.38, f.x), smoothstep(0.0, 0.38, f.y), f.z) * reveal;
  return vec4(c, a);
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  float order;
  vec4 g = shade(uv, order);

  // Glyph grid.
  vec2 cellSize = vec2(uCell * 0.6, uCell);
  vec2 cell = floor(frag / cellSize);
  vec2 local = fract(frag / cellSize);
  vec2 cuv = (cell + 0.5) * cellSize / uRes;
  float corder;
  vec4 gc = shade(cuv, corder);

  float aspect = uRes.x / uRes.y;
  vec2 dom = (cuv - 0.5) * vec2(aspect, 1.0);
  float scramble = 0.0;
  for (int i = 0; i < ${TRAIL}; i++) {
    vec4 tp = uTrail[i];
    if (tp.z <= 0.0) continue;
    vec2 d = dom - tp.xy;
    scramble += tp.z * exp(-dot(d, d) / (uScrambleRadius * uScrambleRadius));
  }
  for (int i = 0; i < ${CLICKS}; i++) {
    vec4 c = uClicks[i];
    if (c.w <= 0.0) continue;
    float ring = abs(length(dom - c.xy) - c.z * 0.75);
    scramble += (1.0 - c.z / ${CLICK_LIFE.toFixed(1)}) * smoothstep(0.06, 0.0, ring);
  }
  scramble = clamp(scramble, 0.0, 1.0);

  float value = uLight > 0.5 ? gc.a * (1.0 - luma(gc.rgb)) * 1.6 + gc.a * 0.15 : luma(gc.rgb) * gc.a;
  value = clamp(value, 0.0, 1.0);
  float wob = (hash(cell + floor(uGlyphTime * 9.0)) - 0.5) * uFlicker * 0.35;
  float tone = clamp(pow(value, 0.75) + wob + scramble * 0.25, 0.0, 1.0);
  float idx = floor(tone * (uGlyphCount - 1.0) + 0.5);
  if (scramble > hash(cell * 1.7 + floor(uGlyphTime * 20.0))) {
    idx = floor(hash(cell + floor(uGlyphTime * 20.0) * 3.1) * (uGlyphCount - 0.01));
  }
  float present = step(hash(cell * 0.73 + 11.0), uDensity) * step(0.05, value + scramble);
  vec2 ag = vec2(mod(idx, uAtlasGrid.x), floor(idx / uAtlasGrid.x));
  vec2 auv = (ag + vec2(local.x, 1.0 - local.y)) / uAtlasGrid;
  float cov = texture(uAtlas, auv).r * present * uGlyphOpacity;

  float grain = (hash(frag + floor(uTime * 48.0)) - 0.5) * uGrain;
  vec3 col;
  float alpha;
  if (uLight > 0.5) {
    // Gradient as a soft wash, glyphs as ink on top.
    float wa = g.a * uGradientOpacity;
    vec3 ink = mix(uInk, gc.rgb, 0.45);
    float ia = cov * clamp(gc.a * 1.1 + scramble, 0.0, 1.0) * 0.8;
    alpha = ia + wa * (1.0 - ia);
    col = alpha > 0.0 ? (ink * ia + g.rgb * wa * (1.0 - ia)) / alpha : vec3(0.0);
  } else {
    float wa = g.a * uGradientOpacity;
    vec3 glyph = mix(gc.rgb, vec3(1.0), 0.35);
    float ia = cov * clamp(gc.a * 1.2 + scramble, 0.0, 1.0);
    col = g.rgb * wa + glyph * ia;
    alpha = clamp(wa + ia, 0.0, 1.0);
    col = alpha > 0.0 ? col / max(alpha, 1e-4) : vec3(0.0);
  }
  col += grain * alpha;
  fragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
}`;

function parseColor(css: string): [number, number, number] {
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return [0, 0, 0];
  c.fillStyle = '#000';
  c.fillStyle = css;
  const v = c.fillStyle as string;
  if (v.startsWith('#')) {
    const n = parseInt(v.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = v.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [(m[0] ?? 0) / 255, (m[1] ?? 0) / 255, (m[2] ?? 0) / 255];
}

function buildAtlas(chars: string[], fontFamily: string) {
  const cw = 60;
  const ch = 100;
  const cols = 16;
  const rows = Math.ceil(chars.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * cw;
  canvas.height = rows * ch;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = `300 78px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chars.forEach((c, i) => ctx.fillText(c, (i % cols) * cw + cw / 2, Math.floor(i / cols) * ch + ch / 2 + 4));
  return { canvas, cols, rows };
}

export function GradientASCII({
  colors = ['#1e3fd8', '#f6f8ff', '#a5d8ff', '#38bdf8'],
  shape = 'horizon',
  characters = ' =+xX0S8#@',
  cellSize = 18,
  density = 0.8,
  glyphOpacity = 0.85,
  flicker = 0.2,
  softness = 0.5,
  scale = 1,
  flow = 0.5,
  speed = 1,
  gradientOpacity = 0.9,
  grain = 0.08,
  variation = 0,
  mouseInteraction = true,
  scrambleRadius = 0.1,
  clickEffect = 'wave',
  intro = true,
  lightMode = false,
  inkColor,
  fontFamily = '"Cascadia Mono", "Consolas", ui-monospace, monospace',
  className,
  style,
}: GradientASCIIProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionConfig();
  const key = `${colors.join()}|${shape}|${characters}|${cellSize}|${density}|${glyphOpacity}|${flicker}|${softness}|${scale}|${flow}|${speed}|${gradientOpacity}|${grain}|${variation}|${mouseInteraction}|${scrambleRadius}|${clickEffect}|${intro}|${lightMode}|${inkColor}|${fontFamily}`;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return;
    host.appendChild(canvas);

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    gl.useProgram(program);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const u = (name: string) => gl.getUniformLocation(program, name);

    const chars = [...new Set([...characters])];
    if (!chars.length) chars.push(' ');
    const texture = gl.createTexture();
    const uploadAtlas = () => {
      const atlas = buildAtlas(chars, fontFamily);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform2f(u('uAtlasGrid'), atlas.cols, atlas.rows);
    };
    uploadAtlas();
    void document.fonts?.ready.then(() => {
      uploadAtlas();
      wake();
    });

    const stops = colors.slice(0, MAX_STOPS).map(parseColor);
    if (stops.length === 1) stops.push(stops[0]!);
    const flat = new Float32Array(MAX_STOPS * 3);
    stops.forEach((c, i) => flat.set(c, i * 3));
    gl.uniform3fv(u('uStops'), flat);
    gl.uniform1i(u('uStopCount'), stops.length);
    gl.uniform3fv(u('uInk'), parseColor(inkColor ?? colors[0] ?? '#000'));
    gl.uniform1i(u('uShape'), SHAPES[shape] ?? 0);
    gl.uniform1f(u('uDensity'), Math.min(1, Math.max(0, density)));
    gl.uniform1f(u('uGlyphOpacity'), glyphOpacity);
    gl.uniform1f(u('uFlicker'), reduce ? 0 : flicker);
    gl.uniform1f(u('uSoftness'), softness);
    gl.uniform1f(u('uScale'), Math.min(2.5, Math.max(0.4, scale)));
    gl.uniform1f(u('uFlow'), flow);
    gl.uniform1f(u('uGradientOpacity'), gradientOpacity);
    gl.uniform1f(u('uGrain'), grain);
    gl.uniform1f(u('uSeed'), variation);
    gl.uniform1f(u('uLight'), lightMode ? 1 : 0);
    gl.uniform1f(u('uGlyphCount'), chars.length);
    gl.uniform1f(u('uScrambleRadius'), scrambleRadius);
    gl.uniform1i(u('uAtlas'), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Resizing a canvas clears it, so resizing on every frame of a layout animation
    // (e.g. the insights panel sliding open) makes it blink. While the size keeps
    // changing, the canvas is just stretched by CSS; it is re-rendered sharply once
    // the size has settled – and drawn immediately, so there is never an empty frame.
    let settle: ReturnType<typeof setTimeout> | undefined;
    const applySize = () => {
      const w = Math.max(1, Math.round(host.clientWidth * dpr));
      const h = Math.max(1, Math.round(host.clientHeight * dpr));
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u('uRes'), w, h);
      gl.uniform1f(u('uCell'), Math.min(64, Math.max(6, cellSize)) * dpr);
      render();
      wake();
    };
    const resize = () => {
      clearTimeout(settle);
      settle = setTimeout(applySize, 140);
    };

    // Pointer trail and clicks in the aspect-correct domain (centre = 0, height = 1).
    const trail: { x: number; y: number; age: number }[] = [];
    const clicks: { x: number; y: number; age: number }[] = [];
    const toDomain = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
      return { x: ((e.clientX - r.left) / r.width - 0.5) * (r.width / r.height), y: 0.5 - (e.clientY - r.top) / r.height };
    };
    let last: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const p = toDomain(e);
      if (!p) return (last = null);
      if (last) {
        const steps = Math.min(4, Math.floor(Math.hypot(p.x - last.x, p.y - last.y) / (scrambleRadius * 0.6)));
        for (let i = 1; i <= steps; i++) trail.push({ x: last.x + ((p.x - last.x) * i) / (steps + 1), y: last.y + ((p.y - last.y) * i) / (steps + 1), age: 0 });
      }
      trail.push({ ...p, age: 0 });
      while (trail.length > TRAIL) trail.shift();
      last = p;
      wake();
    };
    const onDown = (e: PointerEvent) => {
      if (clickEffect === 'none') return;
      const p = toDomain(e);
      if (!p) return;
      clicks.push({ ...p, age: 0 });
      while (clicks.length > CLICKS) clicks.shift();
      wake();
    };
    if (mouseInteraction && !reduce) {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerdown', onDown);
    }

    const trailBuf = new Float32Array(TRAIL * 4);
    const clickBuf = new Float32Array(CLICKS * 4);
    let time = 0;
    let glyphTime = 0;
    let introClock = intro && !reduce ? 0 : 1;
    let raf = 0;
    let prev = performance.now();
    let visible = true;
    let running = false;

    const render = () => {
      trailBuf.fill(0);
      trail.forEach((p, i) => trailBuf.set([p.x, p.y, (1 - p.age / TRAIL_LIFE) ** 2, 0], i * 4));
      clickBuf.fill(0);
      clicks.forEach((c, i) => clickBuf.set([c.x, c.y, c.age, 1], i * 4));
      gl.uniform4fv(u('uTrail'), trailBuf);
      gl.uniform4fv(u('uClicks'), clickBuf);
      gl.uniform1f(u('uTime'), time);
      gl.uniform1f(u('uGlyphTime'), glyphTime);
      gl.uniform1f(u('uIntro'), introClock);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.0005, (now - prev) / 1000));
      prev = now;
      time += dt * speed * 0.5;
      glyphTime += dt * Math.max(speed, 0.15);
      if (introClock < 1) introClock = Math.min(1, introClock + dt / 2.4);
      for (const p of trail) p.age += dt;
      for (const c of clicks) c.age += dt;
      while (trail.length && trail[0]!.age > TRAIL_LIFE) trail.shift();
      while (clicks.length && clicks[0]!.age > CLICK_LIFE) clicks.shift();
      render();
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(frame);
      else running = false;
    };
    function wake() {
      if (reduce) {
        render();
        return;
      }
      if (running || !visible || document.hidden) return;
      running = true;
      prev = performance.now();
      raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    canvas.width = 0; // force the first applySize() below
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) wake();
    });
    io.observe(host);
    const onVisibility = () => !document.hidden && wake();
    document.addEventListener('visibilitychange', onVisibility);
    applySize();

    return () => {
      clearTimeout(settle);
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      gl.deleteProgram(program);
      gl.deleteTexture(texture);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduce]);

  return <div ref={ref} className={cn('overflow-hidden', className ?? 'relative')} style={style} />;
}

export default GradientASCII;
