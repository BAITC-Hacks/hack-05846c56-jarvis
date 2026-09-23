'use client';
import { useEffect, useRef, useState } from 'react';

export interface ScrollVelocityProps { text: string; baseVelocity?: number; numCopies?: number; className?: string }

export default function ScrollVelocity({ text, baseVelocity = 100, numCopies = 2, className = '' }: ScrollVelocityProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(Math.max(2, numCopies));
  useEffect(() => {
    const scroller = ref.current, first = scroller?.querySelector('span');
    if (!scroller || !first) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let copyWidth = 0, x = 0, rawVelocity = 0, smoothVelocity = 0;
    let lastScrollY = window.scrollY, lastScrollTime = performance.now();
    let lastFrame = 0, raf = 0, visible = false;
    function resize() {
      copyWidth = first!.getBoundingClientRect().width;
      if (copyWidth > 0) setCopies(Math.max(2, numCopies, Math.ceil(window.innerWidth / copyWidth) + 1));
    }
    function onScroll() {
      const now = performance.now();
      rawVelocity = Math.min(4000, Math.abs(window.scrollY - lastScrollY) / Math.max(0.016, (now - lastScrollTime) / 1000));
      lastScrollY = window.scrollY;
      lastScrollTime = now;
    }
    function frame(now: number) {
      const dt = Math.min(0.05, Math.max(0, now - lastFrame) / 1000);
      lastFrame = now;
      // Exponential damping remains stable when the browser drops frames.
      smoothVelocity += (rawVelocity - smoothVelocity) * (1 - Math.exp(-8 * dt));
      rawVelocity *= Math.exp(-8 * dt);
      if (copyWidth > 0) {
        x += baseVelocity * (1 + Math.min(3, smoothVelocity / 1000)) * dt;
        x = ((x % copyWidth) + copyWidth) % copyWidth - copyWidth;
        scroller!.style.transform = `translate3d(${x}px, 0, 0)`;
      }
      raf = requestAnimationFrame(frame);
    }
    function restart() {
      cancelAnimationFrame(raf);
      lastFrame = performance.now();
      rawVelocity = smoothVelocity = 0;
      lastScrollY = window.scrollY;
      lastScrollTime = lastFrame;
      if (visible && !document.hidden && !motion.matches) raf = requestAnimationFrame(frame);
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(first);
    const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; restart(); });
    visibilityObserver.observe(scroller.parentElement!);
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', restart);
    motion.addEventListener('change', restart);
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', restart);
      motion.removeEventListener('change', restart);
    };
  }, [text, baseVelocity, numCopies]);
  return <div className={`parallax ${className}`} aria-label={text}><div className="parallax"><div ref={ref} className="scroller" aria-hidden="true">{Array.from({ length: copies }, (_, i) => <span key={i}>{text + '\u00a0'}</span>)}</div></div></div>;
}
