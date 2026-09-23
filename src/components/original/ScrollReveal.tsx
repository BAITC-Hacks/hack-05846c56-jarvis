'use client';
// Same three ScrollTrigger timelines and word DOM as ../Scroll Reveal.html.
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
export interface ScrollRevealProps { text:string;className?:string;enableBlur?:boolean;baseOpacity?:number;baseRotation?:number;blurStrength?:number;rotationEnd?:string;wordAnimationEnd?:string }
export default function ScrollReveal({text,className='',enableBlur=true,baseOpacity=0,baseRotation=5,blurStrength=10,rotationEnd='bottom bottom',wordAnimationEnd='bottom bottom'}:ScrollRevealProps){
  const ref=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{const el=ref.current;if(!el)return;gsap.registerPlugin(ScrollTrigger);const motion=gsap.matchMedia();motion.add('(prefers-reduced-motion: no-preference)',()=>{
    gsap.fromTo(el,{transformOrigin:'0% 50%',rotate:baseRotation},{ease:'none',rotate:0,scrollTrigger:{trigger:el,scroller:window,start:'top bottom',end:rotationEnd,scrub:true}});
    const words=el.querySelectorAll('.word');
    gsap.fromTo(words,{opacity:baseOpacity,willChange:'opacity'},{ease:'none',opacity:1,stagger:0.05,scrollTrigger:{trigger:el,scroller:window,start:'top bottom-=20%',end:wordAnimationEnd,scrub:true}});
    if(enableBlur)gsap.fromTo(words,{filter:`blur(${blurStrength}px)`},{ease:'none',filter:'blur(0px)',stagger:0.05,scrollTrigger:{trigger:el,scroller:window,start:'top bottom-=20%',end:wordAnimationEnd,scrub:true}});
  },el);return()=>motion.revert();},[text,enableBlur,baseOpacity,baseRotation,blurStrength,rotationEnd,wordAnimationEnd]);
  return <h2 ref={ref} className={`scroll-reveal ${className}`}><p className="scroll-reveal-text">{text.split(/(\s+)/).map((word,index)=>/^\s+$/.test(word)?word:<span className="word" key={index}>{word}</span>)}</p></h2>;
}
