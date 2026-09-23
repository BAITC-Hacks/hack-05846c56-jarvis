'use client';

// React Bits BorderGlow, adapted from the source supplied by the user.
import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import './BorderGlow.css';

interface BorderGlowProps {
  children: ReactNode;
  className?: string;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
  fillOpacity?: number;
}

const DEFAULT_COLORS = ['#c084fc', '#f472b6', '#38bdf8'];
const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
const GRADIENT_KEYS = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven'];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function buildGlowVars(color: string, intensity: number) {
  const match = color.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  const [h, s, l] = match ? match.slice(1).map(Number) : [40, 80, 80];
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  return Object.fromEntries(opacities.map((opacity, i) => [
    `--glow-color${keys[i]}`, `hsl(${h}deg ${s}% ${l}% / ${Math.min(opacity * intensity, 100)}%)`,
  ]));
}

function buildGradientVars(colors: string[]) {
  const palette = colors.length ? colors : DEFAULT_COLORS;
  const vars: Record<string, string> = {};
  GRADIENT_KEYS.forEach((key, i) => {
    vars[key] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${palette[Math.min(COLOR_MAP[i], palette.length - 1)]} 0px, transparent 50%)`;
  });
  vars['--gradient-base'] = `linear-gradient(${palette[0]} 0 100%)`;
  return vars;
}

function isLightColor(color: string) {
  const value = color.trim().replace('#', '');
  if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(value)) return false;
  const hex = value.length === 3 ? value.split('').map(char => char + char).join('') : value;
  const [red, green, blue] = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 > 180;
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x: number) => x * x * x;

function animateValue({ start = 0, end = 100, duration = 1000, delay = 0, ease = easeOutCubic, onUpdate, onEnd }: {
  start?: number; end?: number; duration?: number; delay?: number; ease?: (x: number) => number;
  onUpdate: (value: number) => void; onEnd?: () => void;
}) {
  let frame = 0;
  const startedAt = performance.now() + delay;
  function tick(now: number) {
    const progress = Math.min(Math.max((now - startedAt) / duration, 0), 1);
    onUpdate(start + (end - start) * ease(progress));
    if (progress < 1) frame = requestAnimationFrame(tick);
    else onEnd?.();
  }
  const timer = setTimeout(() => { frame = requestAnimationFrame(tick); }, delay);
  return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
}

export default function BorderGlow({ children, className = '', edgeSensitivity = 30, glowColor = '40 80 80', backgroundColor = '#120F17', borderRadius = 28, glowRadius = 40, glowIntensity = 1, coneSpread = 25, animated = false, colors = DEFAULT_COLORS, fillOpacity = 0.5 }: BorderGlowProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card || event.pointerType === 'touch' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    if (!cx || !cy) return;
    const dx = event.clientX - rect.left - cx, dy = event.clientY - rect.top - cy;
    const edge = Math.min(Math.max(Math.abs(dx) / cx, Math.abs(dy) / cy), 1);
    const angle = dx === 0 && dy === 0 ? 0 : (Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360;
    card.style.setProperty('--edge-proximity', (edge * 100).toFixed(3));
    card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`);
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!animated || !card || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    card.classList.add('sweep-active');
    card.style.setProperty('--cursor-angle', '110deg');
    const edge = (value: number) => card.style.setProperty('--edge-proximity', String(value));
    const angle = (value: number) => card.style.setProperty('--cursor-angle', `${355 * value / 100 + 110}deg`);
    const stop = [
      animateValue({ duration: 500, onUpdate: edge }),
      animateValue({ ease: easeInCubic, duration: 1500, end: 50, onUpdate: angle }),
      animateValue({ ease: easeOutCubic, delay: 1500, duration: 2250, start: 50, end: 100, onUpdate: angle }),
      animateValue({ ease: easeInCubic, delay: 2500, duration: 1500, start: 100, end: 0, onUpdate: edge, onEnd: () => card.classList.remove('sweep-active') }),
    ];
    return () => { stop.forEach(cancel => cancel()); card.classList.remove('sweep-active'); };
  }, [animated]);

  return <div ref={cardRef} onPointerMove={handlePointerMove}
    className={`border-glow-card${isLightColor(backgroundColor) ? ' border-glow-card--light' : ''} ${className}`}
    style={{ '--card-bg': backgroundColor, '--edge-sensitivity': edgeSensitivity, '--border-radius': `${borderRadius}px`, '--glow-padding': `${glowRadius}px`, '--cone-spread': coneSpread, '--fill-opacity': fillOpacity, ...buildGlowVars(glowColor, glowIntensity), ...buildGradientVars(colors) } as CSSProperties}>
    <span className="edge-light" aria-hidden="true" />
    <div className="border-glow-inner">{children}</div>
  </div>;
}
