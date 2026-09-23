'use client';
import { useEffect, useRef } from 'react';

/** A lightweight adaptation of the supplied interactive dot-field prototype. */
export default function DotField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = 0, height = 0, frame = 0;
    const mouse = { x: -1000, y: -1000 };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (let x = 12; x < width; x += 24) for (let y = 12; y < height; y += 24) {
        const dx = x - mouse.x, dy = y - mouse.y, distance = Math.hypot(dx, dy);
        const proximity = reduced ? 0 : Math.max(0, 1 - distance / 180);
        const offset = proximity * proximity * 12;
        ctx.beginPath();
        ctx.arc(x + (dx / (distance || 1)) * offset, y + (dy / (distance || 1)) * offset, 0.65 + proximity * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(178,152,255,${0.10 + proximity * 0.33})`;
        ctx.fill();
      }
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width; height = rect.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); render();
    };
    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left; mouse.y = event.clientY - rect.top;
      cancelAnimationFrame(frame); frame = requestAnimationFrame(render);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    if (!reduced) window.addEventListener('pointermove', move, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener('pointermove', move); cancelAnimationFrame(frame); };
  }, []);
  return <canvas className="dot-field" ref={ref} aria-hidden="true" />;
}
