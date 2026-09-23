'use client';
// Faithful React lifecycle port of the supplied ../логотип.html.
import { useEffect, useRef, type CSSProperties } from 'react';

export interface DepthLogoProps { text?: string; className?: string; fontSize?: string }
const clamp = (v:number,min:number,max:number) => Math.min(Math.max(v,min),max);
const getTransform = (rx:number,ry:number) => `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
export default function DepthLogo({text='Jarvis',className='',fontSize='clamp(3rem, 12vw, 7rem)'}:DepthLogoProps) {
  const rootRef=useRef<HTMLSpanElement>(null);
  const stageRef=useRef<HTMLSpanElement>(null);
  const layers=34,depth=2.4,tilt=7.5,smoothing=0.14,orbitSpeed=0.35;
  useEffect(()=>{
    const root=rootRef.current,stage=stageRef.current;if(!root||!stage)return;
    const baseRotation={x:-tilt*0.32,y:tilt*0.42};
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer=window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let activePointer=false,rafId=0;
    const startTime=performance.now(),current={...baseRotation},target={...baseRotation};
    function handlePointerMove(event:PointerEvent){if(motion.matches||!finePointer)return;const rect=root!.getBoundingClientRect();if(!rect.width||!rect.height)return;activePointer=true;const x=clamp((event.clientX-(rect.left+rect.width/2))/(rect.width*0.8),-1,1);const y=clamp((event.clientY-(rect.top+rect.height/2))/(rect.height*0.8),-1,1);target.x=baseRotation.x-y*tilt;target.y=baseRotation.y+x*tilt;}
    function handlePointerLeave(){activePointer=false;target.x=baseRotation.x;target.y=baseRotation.y;}
    function tick(now:number){if(motion.matches)return;if(!finePointer||!activePointer){const elapsed=(now-startTime)/1000,orbit=elapsed*orbitSpeed*Math.PI*2,fallbackAmount=finePointer?0.18:0.55;target.x=baseRotation.x+Math.sin(orbit)*tilt*fallbackAmount;target.y=baseRotation.y+Math.cos(orbit*0.85)*tilt*fallbackAmount;}current.x+=(target.x-current.x)*smoothing;current.y+=(target.y-current.y)*smoothing;stage!.style.transform=getTransform(current.x,current.y);rafId=requestAnimationFrame(tick);}
    function start(){cancelAnimationFrame(rafId);stage!.style.transform=getTransform(baseRotation.x,baseRotation.y);if(!motion.matches)rafId=requestAnimationFrame(tick);}
    window.addEventListener('pointermove',handlePointerMove);window.addEventListener('pointerleave',handlePointerLeave);window.addEventListener('blur',handlePointerLeave);motion.addEventListener('change',start);start();
    return()=>{cancelAnimationFrame(rafId);window.removeEventListener('pointermove',handlePointerMove);window.removeEventListener('pointerleave',handlePointerLeave);window.removeEventListener('blur',handlePointerLeave);motion.removeEventListener('change',start);};
  },[]);
  const style={'--depth-text-perspective':'900px','--depth-text-font-size':fontSize,'--depth-text-font-weight':900,'--depth-text-face-color':'#f8fafc','--depth-text-depth-color':'#7c3aed','--depth-text-shadow':'0 22px 34px color-mix(in srgb, #7c3aed 36%, transparent), 0 4px 8px rgba(0, 0, 0, 0.28)'} as CSSProperties;
  return <span ref={rootRef} className={`depth-text ${className}`} style={style}><span ref={stageRef} className="depth-text__stage">{Array.from({length:layers},(_,layerIndex)=>{const index=layers-layerIndex,progress=index/layers,faceMix=Math.round((1-progress*progress)*72+4);return <span key={index} className="depth-text__layer" aria-hidden="true" style={{color:`color-mix(in srgb, #f8fafc ${faceMix}%, #7c3aed)`,transform:`translateZ(${-index*depth}px)`}}>{text}</span>;})}<span className="depth-text__face">{text}</span></span></span>;
}
