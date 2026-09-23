'use client';
// Original Lenis options and GSAP ticker synchronization from ../плавный скролл.js.
import {useEffect} from 'react';
import Lenis from 'lenis';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import 'lenis/dist/lenis.css';
export default function SmoothScroll(){
  useEffect(()=>{gsap.registerPlugin(ScrollTrigger);const motion=window.matchMedia('(prefers-reduced-motion: reduce)');let lenis:Lenis|undefined;const targetWindow=window as Window&{__lenis?:Lenis};const update=(time:number)=>lenis?.raf(time*1000);
    function destroy(){gsap.ticker.remove(update);if(targetWindow.__lenis===lenis)delete targetWindow.__lenis;lenis?.destroy();lenis=undefined;}
    function start(){destroy();if(motion.matches)return;lenis=new Lenis({duration:1.35,easing:(t:number)=>1-Math.pow(1-t,4),smoothWheel:true,syncTouch:true,touchMultiplier:1.15,prevent:node=>!!node.closest('dialog, textarea, [data-lenis-prevent], .message-list, .conversation-composer, .prompt-input')});lenis.on('scroll',ScrollTrigger.update);gsap.ticker.add(update);gsap.ticker.lagSmoothing(0);targetWindow.__lenis=lenis;}
    motion.addEventListener('change',start);start();return()=>{motion.removeEventListener('change',start);destroy();};
  },[]);return null;
}
