'use client';
import { useEffect, useRef, type ButtonHTMLAttributes } from 'react';
import { createSpecularButton } from './prototype-specular';
import './prototype-controls.css';

/** Original get started button.html DOM + unchanged WebGL2 GLSL engine. */
export default function SpecularButton({ children, className = '', size = 'lg', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm'|'md'|'lg' }) {
  const button = useRef<HTMLButtonElement>(null);
  const fx = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!button.current || !fx.current) return;
    const destroy = createSpecularButton(button.current, fx.current, { radius:18, lineColor:'#ffffff', baseColor:'#525252', intensity:1, shineSize:10, shineFade:40, thickness:1, speed:0.35, followMouse:true, proximity:250, autoAnimate:false });
    const canvas = fx.current.querySelector('canvas');
    return () => { destroy(); canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, []);
  return <button {...props} ref={button} type={props.type || 'button'} className={`specular-button specular-button--${size} ${className}`}><span ref={fx} className="specular-button__fx" aria-hidden="true" /><span className="specular-button__label">{children}</span></button>;
}
