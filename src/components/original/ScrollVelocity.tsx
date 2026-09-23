'use client';
// Original nested .parallax/.scroller DOM and velocity integration from ../бегущая строка.html.
import { useEffect, useRef } from 'react';
export interface ScrollVelocityProps { text:string;baseVelocity?:number;numCopies?:number;className?:string }
export default function ScrollVelocity({text,baseVelocity=100,numCopies=6,className=''}:ScrollVelocityProps){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const scroller=ref.current,first=scroller?.querySelector('span');if(!scroller||!first)return;const motion=window.matchMedia('(prefers-reduced-motion: reduce)');let copyWidth=first.offsetWidth,x=0,direction=baseVelocity<0?-1:1;const speed=Math.abs(baseVelocity);let lastScrollY=window.scrollY,lastT=performance.now(),rawVelocity=0,smoothVelocity=0,velocityFactor=0;const stiffness=400;let last=performance.now(),rafId=0;
    function resize(){copyWidth=first!.offsetWidth;}
    function onScroll(){const now=performance.now(),dt=Math.max(1,now-lastT);rawVelocity=(window.scrollY-lastScrollY)/(dt/1000);lastScrollY=window.scrollY;lastT=now;}
    function wrap(min:number,max:number,v:number){const range=max-min;return(((v-min)%range)+range)%range+min;}
    function tick(delta:number){const dt=Math.min(delta,50)/1000,accel=(stiffness*(rawVelocity-smoothVelocity))*dt;smoothVelocity+=accel*dt*10;smoothVelocity+=(rawVelocity-smoothVelocity)*Math.min(1,dt*6);rawVelocity*=0.9;velocityFactor=Math.max(-5,Math.min(5,smoothVelocity/1000*5));let moveBy=direction*speed*dt;if(velocityFactor<0)direction=-1;else if(velocityFactor>0)direction=1;moveBy+=direction*moveBy*velocityFactor;x+=moveBy;const px=copyWidth?wrap(-copyWidth,0,x):0;scroller!.style.transform=`translateX(${px}px)`;}
    function loop(t:number){const delta=t-last;last=t;tick(delta);rafId=requestAnimationFrame(loop);}
    function restart(){cancelAnimationFrame(rafId);last=performance.now();if(!motion.matches)rafId=requestAnimationFrame(loop);else scroller!.style.transform='translateX(0px)';}
    const observer=new ResizeObserver(resize);observer.observe(first);window.addEventListener('resize',resize);window.addEventListener('scroll',onScroll,{passive:true});motion.addEventListener('change',restart);restart();
    return()=>{cancelAnimationFrame(rafId);observer.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('scroll',onScroll);motion.removeEventListener('change',restart);};
  },[text,baseVelocity,numCopies]);
  return <div className={`parallax ${className}`} aria-label={text}><div className="parallax"><div ref={ref} className="scroller" aria-hidden="true">{Array.from({length:Math.max(1,numCopies)},(_,i)=><span key={i}>{text+'\u00a0'}</span>)}</div></div></div>;
}
