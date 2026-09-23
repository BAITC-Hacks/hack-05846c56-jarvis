'use client';
// Exact defaults and canvas physics from the supplied ../фон.html.
import { useEffect, useId, useRef } from 'react';
type Dot={ax:number;ay:number;sx:number;sy:number;vx:number;vy:number;x:number;y:number};
export interface OriginalDotFieldProps { className?:string }
export default function OriginalDotField({className=''}:OriginalDotFieldProps){
  const containerRef=useRef<HTMLDivElement>(null),canvasRef=useRef<HTMLCanvasElement>(null),glowRef=useRef<SVGCircleElement>(null);
  const gradientId=useId().replace(/:/g,'');
  useEffect(()=>{
    const container=containerRef.current,canvas=canvasRef.current,glowEl=glowRef.current;if(!container||!canvas||!glowEl)return;
    const context=canvas.getContext('2d',{alpha:true});if(!context)return;const ctx=context;
    const TWO_PI=Math.PI*2;
    const props={dotRadius:1.5,dotSpacing:14,cursorRadius:500,cursorForce:0.1,bulgeOnly:true,bulgeStrength:67,glowRadius:160,sparkle:false,waveAmplitude:0,gradientFrom:'rgba(196, 160, 255, 0.75)',gradientTo:'rgba(220, 210, 240, 0.6)'};
    const dpr=Math.min(window.devicePixelRatio||1,2),motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let dots:Dot[]=[],size={w:0,h:0,offsetX:0,offsetY:0};
    const mouse={x:-9999,y:-9999,prevX:-9999,prevY:-9999,speed:0};
    let glowOpacity=0,engagement=0,frameCount=0,rafId=0,resizeTimer:ReturnType<typeof setTimeout>|undefined;
    function buildDots(w:number,h:number){const step=props.dotRadius+props.dotSpacing,cols=Math.floor(w/step),rows=Math.floor(h/step),padX=(w%step)/2,padY=(h%step)/2,arr:Dot[]=new Array(rows*cols);let idx=0;for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const ax=padX+col*step+step/2,ay=padY+row*step+step/2;arr[idx++]={ax,ay,sx:ax,sy:ay,vx:0,vy:0,x:ax,y:ay};}dots=arr;}
    function doResize(){const rect=container!.getBoundingClientRect(),w=rect.width,h=rect.height;canvas!.width=w*dpr;canvas!.height=h*dpr;canvas!.style.width=w+'px';canvas!.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);size={w,h,offsetX:rect.left+window.scrollX,offsetY:rect.top+window.scrollY};buildDots(w,h);if(motion.matches)draw();}
    function resize(){clearTimeout(resizeTimer);resizeTimer=setTimeout(doResize,100);}
    function onMouseMove(e:MouseEvent){if(motion.matches)return;mouse.x=e.pageX-size.offsetX;mouse.y=e.pageY-size.offsetY;}
    function onTouchMove(e:TouchEvent){if(motion.matches)return;if(e.touches&&e.touches[0]){mouse.x=e.touches[0].pageX-size.offsetX;mouse.y=e.touches[0].pageY-size.offsetY;}}
    function updateMouseSpeed(){const dx=mouse.prevX-mouse.x,dy=mouse.prevY-mouse.y,dist=Math.sqrt(dx*dx+dy*dy);mouse.speed+=(dist-mouse.speed)*0.5;if(mouse.speed<0.001)mouse.speed=0;mouse.prevX=mouse.x;mouse.prevY=mouse.y;}
    function draw(){frameCount++;const len=dots.length,{w,h}=size,t=frameCount*0.02;const targetEngagement=motion.matches?0:Math.min(mouse.speed/5,1);engagement+=(targetEngagement-engagement)*0.06;if(engagement<0.001)engagement=0;const eng=engagement;glowOpacity+=(eng-glowOpacity)*0.08;glowEl!.setAttribute('cx',String(mouse.x));glowEl!.setAttribute('cy',String(mouse.y));glowEl!.style.opacity=String(glowOpacity);ctx.clearRect(0,0,w,h);const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,props.gradientFrom);grad.addColorStop(1,props.gradientTo);ctx.fillStyle=grad;const cr=props.cursorRadius,crSq=cr*cr,rad=props.dotRadius/2,isBulge=props.bulgeOnly;ctx.beginPath();
      for(let i=0;i<len;i++){const d=dots[i],dx=mouse.x-d.ax,dy=mouse.y-d.ay,distSq=dx*dx+dy*dy;if(distSq<crSq&&eng>0.01){const dist=Math.sqrt(distSq);if(isBulge){const tt=1-dist/cr,push=tt*tt*props.bulgeStrength*eng,angle=Math.atan2(dy,dx);d.sx+=(d.ax-Math.cos(angle)*push-d.sx)*0.15;d.sy+=(d.ay-Math.sin(angle)*push-d.sy)*0.15;}else{const angle=Math.atan2(dy,dx),move=(500/Math.max(dist,0.001))*(mouse.speed*props.cursorForce);d.vx+=Math.cos(angle)*-move;d.vy+=Math.sin(angle)*-move;}}else if(isBulge){d.sx+=(d.ax-d.sx)*0.1;d.sy+=(d.ay-d.sy)*0.1;}if(!isBulge){d.vx*=0.9;d.vy*=0.9;d.x=d.ax+d.vx;d.y=d.ay+d.vy;d.sx+=(d.x-d.sx)*0.1;d.sy+=(d.y-d.sy)*0.1;}let drawX=d.sx,drawY=d.sy;if(props.waveAmplitude>0){drawY+=Math.sin(d.ax*0.03+t)*props.waveAmplitude;drawX+=Math.cos(d.ay*0.03+t*0.7)*props.waveAmplitude*0.5;}if(props.sparkle){const hash=((i*2654435761)^(frameCount>>3))>>>0;if((hash%100)<3){ctx.moveTo(drawX+rad*1.8,drawY);ctx.arc(drawX,drawY,rad*1.8,0,TWO_PI);}else{ctx.moveTo(drawX+rad,drawY);ctx.arc(drawX,drawY,rad,0,TWO_PI);}}else{ctx.moveTo(drawX+rad,drawY);ctx.arc(drawX,drawY,rad,0,TWO_PI);}}
      ctx.fill();
    }
    function tick(){draw();rafId=requestAnimationFrame(tick);}
    function restart(){cancelAnimationFrame(rafId);if(motion.matches){engagement=0;glowOpacity=0;buildDots(size.w,size.h);draw();}else rafId=requestAnimationFrame(tick);}
    const speedInterval=setInterval(updateMouseSpeed,20),observer=new ResizeObserver(resize);observer.observe(container);doResize();window.addEventListener('resize',resize);window.addEventListener('mousemove',onMouseMove,{passive:true});window.addEventListener('touchmove',onTouchMove,{passive:true});motion.addEventListener('change',restart);restart();
    return()=>{cancelAnimationFrame(rafId);clearInterval(speedInterval);clearTimeout(resizeTimer);observer.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('mousemove',onMouseMove);window.removeEventListener('touchmove',onTouchMove);motion.removeEventListener('change',restart);};
  },[]);
  return <div ref={containerRef} className={`dot-field-container ${className}`} aria-hidden="true"><canvas ref={canvasRef}/><svg><defs><radialGradient id={gradientId}><stop offset="0%" stopColor="#120F17"/><stop offset="100%" stopColor="transparent"/></radialGradient></defs><circle ref={glowRef} cx="-9999" cy="-9999" r="160" fill={`url(#${gradientId})`} style={{opacity:0}}/></svg></div>;
}
