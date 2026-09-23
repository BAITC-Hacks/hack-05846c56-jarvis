'use client';
import { useEffect, useRef } from 'react';
import './prototype-controls.css';

type NavItem = { id:string; label:string; href:string };
/** Direct port of навигация.html: original DOM, particle generator, timing and effects. */
export default function GooeyNav({ items, active, onSelect }: { items: NavItem[]; active:string; onSelect:(id:string)=>void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const initialized = useRef(false);
  const labels = items.map(item=>`${item.id}:${item.label}`).join('|');
  useEffect(() => {
    const container = containerRef.current, filterEl = filterRef.current, textEl = textRef.current;
    if (!container || !filterEl || !textEl) return;
    const activeLi = Array.from(container.querySelectorAll('li')).find(li => li.dataset.id === active);
    if (!activeLi) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const frames: number[] = [];
    const animationTime = 600, particleCount = 15, particleDistances = [90,10], particleR = 100, timeVariance = 300, colors = [1,2,3,1,2,3,1,4];
    function noise(n = 1) { return n / 2 - Math.random() * n; }
    function getXY(distance:number, pointIndex:number, totalPoints:number) { const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180); return [distance * Math.cos(angle), distance * Math.sin(angle)]; }
    function createParticle(i:number, time:number, distances:number[], r:number) { const rotate = noise(r / 10); return { start:getXY(distances[0],particleCount-i,particleCount),end:getXY(distances[1]+noise(7),particleCount-i,particleCount),time,scale:1+noise(0.2),color:colors[Math.floor(Math.random()*colors.length)],rotate:rotate>0?(rotate+r/20)*10:(rotate-r/20)*10 }; }
    function updateEffectPosition() {
      if (!container || !activeLi || !filterEl || !textEl) return;
      const containerRect=container.getBoundingClientRect(),pos=activeLi.getBoundingClientRect();
      const styles={left:`${pos.x-containerRect.x}px`,top:`${pos.y-containerRect.y}px`,width:`${pos.width}px`,height:`${pos.height}px`};
      Object.assign(filterEl.style,styles); Object.assign(textEl.style,styles); textEl.innerText=activeLi.innerText;
    }
    function makeParticles(element:HTMLElement) {
      const bubbleTime=animationTime*2+timeVariance; element.style.setProperty('--time',`${bubbleTime}ms`);
      for(let i=0;i<particleCount;i++) {
        const time=animationTime*2+noise(timeVariance*2),p=createParticle(i,time,particleDistances,particleR); element.classList.remove('active');
        timers.push(setTimeout(()=>{
          const particle=document.createElement('span'),point=document.createElement('span'); particle.classList.add('particle');
          particle.style.setProperty('--start-x',`${p.start[0]}px`);particle.style.setProperty('--start-y',`${p.start[1]}px`);particle.style.setProperty('--end-x',`${p.end[0]}px`);particle.style.setProperty('--end-y',`${p.end[1]}px`);particle.style.setProperty('--time',`${p.time}ms`);particle.style.setProperty('--scale',`${p.scale}`);particle.style.setProperty('--color',`var(--color-${p.color}, white)`);particle.style.setProperty('--rotate',`${p.rotate}deg`);
          point.classList.add('point');particle.appendChild(point);element.appendChild(particle);frames.push(requestAnimationFrame(()=>element.classList.add('active')));timers.push(setTimeout(()=>particle.remove(),time));
        },30));
      }
    }
    updateEffectPosition();
    filterEl.querySelectorAll('.particle').forEach(p=>p.remove());
    textEl.classList.remove('active');void textEl.offsetWidth;textEl.classList.add('active');
    if(initialized.current && !matchMedia('(prefers-reduced-motion: reduce)').matches) makeParticles(filterEl);
    initialized.current=true;
    const observer=new ResizeObserver(updateEffectPosition);observer.observe(container);
    return ()=>{observer.disconnect();timers.forEach(clearTimeout);frames.forEach(cancelAnimationFrame);filterEl.querySelectorAll('.particle').forEach(p=>p.remove());};
  }, [active, labels]);
  return <div className="gooey-nav-container" ref={containerRef}><nav><ul>{items.map(item=><li key={item.id} data-id={item.id} className={active===item.id?'active':''}><a href={item.href} aria-current={active===item.id?'page':undefined} onClick={event=>{event.preventDefault();onSelect(item.id);}} onKeyDown={event=>{if(event.key===' '){event.preventDefault();onSelect(item.id);}}}>{item.label}</a></li>)}</ul></nav><span className="effect filter" ref={filterRef} aria-hidden="true"/><span className="effect text" ref={textRef} aria-hidden="true"/></div>;
}
