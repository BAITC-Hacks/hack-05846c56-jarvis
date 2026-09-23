'use client';
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { ChevronDown, FileText, Globe2, Grid2X2, LoaderCircle, Mic, Plus, ShoppingBag, Sparkles, Upload, X } from 'lucide-react';
import type { Attachment, Locale } from '@/lib/types';
import { copy } from '@/lib/i18n';
import './prototype-controls.css';

type RecognitionResult = {results:ArrayLike<ArrayLike<{transcript:string}>>};
type Recognition = {lang:string;interimResults:boolean;continuous:boolean;onresult:((event:RecognitionResult)=>void)|null;onend:(()=>void)|null;onerror:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
type RecognitionWindow = Window & { SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition };
type Props={locale:Locale;input:string;onInput:(text:string)=>void;attachments:Attachment[];onRemoveAttachment:(index:number)=>void;onSubmit:(text:string)=>void;onStop:()=>void;onAttach:()=>void;onNavigate:(view:'catalog'|'cart')=>void;sending:boolean;uploading:boolean;textareaRef:RefObject<HTMLTextAreaElement|null>};
type MenuKind='at'|'model'|'effort'|'slash'|null;
type MenuRow={key:string;name:string;description?:string;tag?:string;icon?:React.ReactNode;action?:()=>void};
const ARROW_UP=[12,4.5,18.5,11,14.25,11,14.25,19.5,9.75,19.5,9.75,11,5.5,11];
const SQUARE=[12,6,18,6,18,12,18,18,6,18,6,12,6,6];
function pathAt(a:number[],b:number[],t:number){let d='';for(let i=0;i<a.length;i+=2)d+=`${i?'L':'M'}${(a[i]+(b[i]-a[i])*t).toFixed(2)} ${(a[i+1]+(b[i+1]-a[i+1])*t).toFixed(2)}`;return d+'Z';}

/**
 * Faithful React port of the supplied Prompt Bar.html: original DOM/classes,
 * token menus, arrow-to-stop path morph, five-position track and spark physics.
 * Demonstration model/effort controls are connected to real customer intent and
 * an explicit per-unit budget; file upload and dictation use real user input.
 */
export default function PromptBar({locale,input,onInput,attachments,onRemoveAttachment,onSubmit,onStop,onAttach,onNavigate,sending,uploading,textareaRef}:Props){
  const t=copy[locale],ru=locale==='ru';
  const rootRef=useRef<HTMLDivElement>(null),canvasRef=useRef<HTMLCanvasElement>(null),pathRef=useRef<SVGPathElement>(null),recognitionRef=useRef<Recognition|null>(null);
  const [menu,setMenu]=useState<MenuKind>(null),[dismissed,setDismissed]=useState(false),[cursor,setCursor]=useState(0),[intent,setIntent]=useState(0),[budgetIndex,setBudgetIndex]=useState(4),[budgetTouched,setBudgetTouched]=useState(false),[pressed,setPressed]=useState(false),[listening,setListening]=useState(false),[speechAvailable,setSpeechAvailable]=useState(false),[speechError,setSpeechError]=useState('');
  const budgets=[5000,20000,50000,100000,null];
  const budgetLabels=ru?['До 5 тыс.','До 20 тыс.','До 50 тыс.','До 100 тыс.','Без лимита']:['5 мыңға дейін','20 мыңға дейін','50 мыңға дейін','100 мыңға дейін','Шектеусіз'];
  const intentNames=ru?['Подбор','Аналоги','Сравнение','Условия']:['Таңдау','Баламалар','Салыстыру','Шарттар'];
  const tokenMatch=/(^|\s)([@/])([\w-]*)$/.exec(input);
  const token=!dismissed&&tokenMatch?{kind:tokenMatch[2]==='@'?'at':'slash',query:tokenMatch[3].toLowerCase(),start:tokenMatch.index+tokenMatch[1].length}:null;
  const activeMenu=menu||(token?.kind as MenuKind)||null;
  const closeMenus=()=>{setMenu(null);setCursor(0);};
  const fillCommand=(text:string)=>{onInput((token?input.slice(0,token.start):'')+text);closeMenus();setDismissed(true);textareaRef.current?.focus();};
  const sourceRows:MenuRow[]=[
    {key:'files',name:ru?'Фото и файлы':'Фото және файлдар',description:ru?'С этого устройства':'Осы құрылғыдан',icon:<Upload size={15}/>,action:()=>{if(token)onInput(input.slice(0,token.start));onAttach();}},
    {key:'catalog',name:t.catalog,description:ru?'Товары, цены, остатки':'Тауарлар, бағалар, қор',icon:<Grid2X2 size={15}/>,action:()=>onNavigate('catalog')},
    {key:'docs',name:ru?'Спецификация':'Сипаттізім',description:'PDF, DOCX, XLSX',icon:<FileText size={15}/>,action:()=>{if(token)onInput(input.slice(0,token.start));onAttach();}},
    {key:'cart',name:t.cart,description:ru?'Ваш текущий проект':'Ағымдағы жобаңыз',icon:<ShoppingBag size={15}/>,action:()=>onNavigate('cart')},
  ];
  const commands:MenuRow[]=[{key:'select',name:'/select',description:t.select,action:()=>fillCommand(t.selectPrompt)},{key:'compare',name:'/compare',description:t.compare,action:()=>fillCommand(ru?'Сравни товары: ':'Тауарларды салыстыр: ')},{key:'analog',name:'/analog',description:t.analog,action:()=>fillCommand(ru?'Подбери аналог товара: ':'Тауарға балама таңда: ')}];
  const modelRows:MenuRow[]=intentNames.map((name,index)=>({key:String(index),name,tag:index===intent?'✓':'',action:()=>setIntent(index)}));
  const rows=activeMenu==='model'?modelRows:activeMenu==='at'?sourceRows.filter(row=>!token||row.name.toLowerCase().includes(token.query)||row.key.startsWith(token.query)):activeMenu==='slash'?commands.filter(row=>row.key.startsWith(token?.query||'')):[];
  const maxed=budgetTouched&&budgetIndex===4;
  const armed=sending||input.trim().length>0||attachments.length>0;

  useEffect(()=>{
    const element=textareaRef.current;if(!element)return;const LINE=22;element.style.height='0px';const max=LINE*5;element.style.height=Math.min(element.scrollHeight,max)+'px';element.style.overflowY=element.scrollHeight>max?'auto':'hidden';
  },[input,textareaRef]);
  useEffect(()=>{
    const onOutside=(event:PointerEvent)=>{if(rootRef.current&&!rootRef.current.contains(event.target as Node)){setMenu(null);setDismissed(true);}};
    document.addEventListener('pointerdown',onOutside);const win=window as RecognitionWindow;setSpeechAvailable(Boolean(win.SpeechRecognition||win.webkitSpeechRecognition));
    return()=>{document.removeEventListener('pointerdown',onOutside);recognitionRef.current?.abort();};
  },[]);
  useEffect(()=>{
    const start=performance.now(),duration=240;let frame=0;
    function step(now:number){const t=Math.min(1,(now-start)/duration),eased=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;pathRef.current?.setAttribute('d',pathAt(ARROW_UP,SQUARE,sending?eased:1-eased));if(t<1)frame=requestAnimationFrame(step);}
    frame=requestAnimationFrame(step);return()=>cancelAnimationFrame(frame);
  },[sending]);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const context=canvas.getContext('2d');if(!context)return;
    type Spark={x:number;y:number;r:number;vy:number;sway:number;phase:number;life:number;span:number};let parts:Spark[]=[],raf=0,last=performance.now(),due=0;
    function resize(){if(!canvas||!context)return;const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);context.setTransform(dpr,0,0,dpr,0,0);}
    function spawn(w:number,h:number,burst:boolean){parts.push({x:Math.random()*w,y:burst?h*(.2+Math.random()*.8):h+3,r:.9+Math.random()*1.1,vy:-(7+Math.random()*9),sway:(Math.random()-.5)*10,phase:Math.random()*Math.PI*2,life:burst?Math.random()*1.2:0,span:2.4+Math.random()*2.4});}
    function tick(now:number){if(!canvas||!context)return;raf=requestAnimationFrame(tick);if(!maxed){if(parts.length){parts=[];context.clearRect(0,0,canvas.width,canvas.height);}return;}const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dt=Math.min(.05,(now-last)/1000);last=now;due+=dt;while(due>.14){due-=.14;if(parts.length<30)spawn(w,h,false);}context.clearRect(0,0,w,h);context.fillStyle='#b39dff';context.shadowColor='#b39dff';context.shadowBlur=8;for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life+=dt;if(p.life>p.span){parts.splice(i,1);continue;}const k=p.life/p.span,twinkle=.7+.3*Math.sin(now/160+p.phase);p.y+=p.vy*dt;if(p.y<-4){p.y=h+3;p.x=Math.random()*w;}const edge=Math.min(1,Math.max(0,p.y/14),Math.max(0,(h-p.y)/14));context.globalAlpha=Math.min(1,Math.sin(k*Math.PI)*.9*twinkle)*edge;context.beginPath();context.arc(p.x+Math.sin(now/900+p.phase)*p.sway,p.y,p.r*twinkle,0,Math.PI*2);context.fill();}context.globalAlpha=1;}
    resize();const observer=new ResizeObserver(resize);observer.observe(canvas);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)raf=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(raf);observer.disconnect();};
  },[maxed]);
  function pick(row:MenuRow){row.action?.();closeMenus();setDismissed(true);textareaRef.current?.focus();}
  function toggle(kind:MenuKind){setMenu(menu===kind?null:kind);setDismissed(true);setCursor(kind==='model'?intent:0);textareaRef.current?.focus();}
  function setBudget(index:number){setBudgetIndex(Math.max(0,Math.min(4,index)));setBudgetTouched(true);}
  function budgetPointer(event:React.PointerEvent<HTMLDivElement>){const rect=event.currentTarget.getBoundingClientRect(),k=(event.clientX-rect.left-11)/Math.max(1,rect.width-22);setBudget(Math.round(k*4));}
  function submit(){if(sending){onStop();return;}if(!armed||uploading)return;let text=input.trim();if(intent!==0)text=(ru?['','Найди аналоги. ','Сравни товары. ','Объясни условия покупки. ']:['','Баламаларды тап. ','Тауарларды салыстыр. ','Сатып алу шарттарын түсіндір. '])[intent]+text;const budget=budgets[budgetIndex];if(budgetTouched&&budget!==null)text+='\n'+(ru?`Бюджет: до ${budget} тенге за единицу`:`Бюджет: бірлік үшін ${budget} теңгеге дейін`);onSubmit(text);closeMenus();setDismissed(true);textareaRef.current?.focus();}
  function dictate(){
    if(listening){recognitionRef.current?.stop();setListening(false);return;}const win=window as RecognitionWindow,Constructor=win.SpeechRecognition||win.webkitSpeechRecognition;if(!Constructor)return;const recognition=new Constructor();recognitionRef.current=recognition;recognition.lang=ru?'ru-RU':'kk-KZ';recognition.interimResults=false;recognition.continuous=false;setSpeechError('');recognition.onresult=event=>{const transcript=Array.from(event.results).map(result=>result[0].transcript).join(' ');onInput(input.trim()?input.trimEnd()+' '+transcript:transcript);};recognition.onend=()=>setListening(false);recognition.onerror=()=>{setListening(false);setSpeechError(ru?'Не удалось распознать речь. Проверьте доступ к микрофону.':'Сөйлеуді тану мүмкін болмады. Микрофонға рұқсатты тексеріңіз.');};try{recognition.start();setListening(true);}catch{setSpeechError(ru?'Микрофон недоступен.':'Микрофон қолжетімсіз.');}
  }
  return <div className={`prompt-bar ${maxed?'maxed':''}`} ref={rootRef}>
    <div className={`prompt-bar__menu ${activeMenu?'open':''}`} data-kind={activeMenu}>
      {activeMenu==='effort'?<><div className="prompt-bar__effort-head"><span className="prompt-bar__effort-title">{ru?'За единицу':'Бірлік үшін'}</span><span className="prompt-bar__effort-level">{budgetLabels[budgetIndex]}</span><span className="prompt-bar__effort-help" title={ru?'Ограничивает цену предлагаемых товаров':'Ұсынылатын тауарлардың бағасын шектейді'}>₸</span></div><div className="prompt-bar__effort-ends"><span>{ru?'До 5 000 ₸':'5 000 ₸ дейін'}</span><span>{ru?'Без лимита':'Шектеусіз'}</span></div><div className="prompt-bar__effort-track" style={{'--pb-fill':`${budgetIndex===4?100:budgetIndex/4*100+3}%`,'--pb-x':`${budgetIndex/4*100}%`} as CSSProperties} role="slider" aria-label={ru?'Бюджет за единицу':'Бірлік үшін бюджет'} aria-valuemin={0} aria-valuemax={4} aria-valuenow={budgetIndex} aria-valuetext={budgetLabels[budgetIndex]} tabIndex={0} onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowUp'){event.preventDefault();setBudget(budgetIndex+1);}if(event.key==='ArrowLeft'||event.key==='ArrowDown'){event.preventDefault();setBudget(budgetIndex-1);}if(event.key==='Escape')closeMenus();}} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);budgetPointer(event);}} onPointerMove={event=>{if(event.buttons&1)budgetPointer(event);}}><span className="prompt-bar__effort-fill"/>{budgets.map((_,i)=><i key={i} className="prompt-bar__effort-dot" style={{left:`${i/4*100}%`}}/>)}<span className="prompt-bar__effort-thumb"/></div></>:rows.length?rows.map((row,index)=><button type="button" className={`prompt-bar__row ${index===cursor?'active':''}`} key={row.key} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setCursor(index)} onClick={()=>pick(row)}>{row.icon&&<span className="prompt-bar__row-icon">{row.icon}</span>}<span className="prompt-bar__row-name">{row.name}</span>{row.description&&<span className="prompt-bar__row-desc">{row.description}</span>}{activeMenu==='model'&&<><span className="prompt-bar__row-tag">{row.tag}</span><span className={`prompt-bar__row-check ${index===intent?'on':''}`}>✓</span></>}</button>):<div className="prompt-bar__empty">{ru?'Совпадений нет':'Сәйкестік жоқ'}</div>}
    </div>
    <div className="prompt-bar__field" onClick={event=>{if(event.target===event.currentTarget)textareaRef.current?.focus();}}>
      <canvas className="prompt-bar__sparks" ref={canvasRef} aria-hidden="true"/>
      <div className="prompt-bar__chips" style={{display:attachments.length?'flex':'none'}}>{attachments.map((file,index)=><span className="prompt-bar__chip" key={`${file.name}-${index}`}><FileText size={12}/><span className="prompt-bar__chip-name">{file.name}</span><button type="button" className="prompt-bar__chip-x" onClick={()=>onRemoveAttachment(index)} aria-label={`${t.fileRemove}: ${file.name}`}><X size={12}/></button></span>)}</div>
      <textarea lang={/[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(input) ? 'kk' : locale} className="prompt-bar__input" ref={textareaRef} rows={1} value={input} maxLength={8000} placeholder={listening?(ru?'Слушаю…':'Тыңдап тұрмын…'):t.placeholder} aria-label={t.placeholder} onChange={event=>{onInput(event.target.value);setDismissed(false);closeMenus();}} onKeyDown={event=>{if(activeMenu!=='effort'&&activeMenu&&rows.length){if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setCursor((cursor+(event.key==='ArrowDown'?1:rows.length-1))%rows.length);return;}if((event.key==='Enter'&&!event.shiftKey)||event.key==='Tab'){event.preventDefault();pick(rows[Math.min(cursor,rows.length-1)]);return;}}if(event.key==='Escape'){event.preventDefault();if(activeMenu){setDismissed(true);closeMenus();}else if(sending)onStop();return;}if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(!sending)submit();}}}/>
      <div className="prompt-bar__bar">
        <button type="button" className={`prompt-bar__tool ${menu==='at'?'on':''}`} onMouseDown={event=>event.preventDefault()} onClick={()=>toggle('at')} aria-label={t.attach} aria-expanded={menu==='at'} disabled={uploading||sending}>{uploading?<LoaderCircle size={16} className="spin"/>:<Plus size={16}/>}</button>
        <button type="button" className={`prompt-bar__pick ${menu==='model'?'on':''}`} onMouseDown={event=>event.preventDefault()} onClick={()=>toggle('model')} aria-label={ru?'Выбрать задачу':'Міндетті таңдау'} aria-expanded={menu==='model'}><span>{intentNames[intent]}</span><ChevronDown size={12}/></button>
        <button type="button" className={`prompt-bar__pick ${menu==='effort'?'on':''} ${maxed?'max':''}`} onMouseDown={event=>event.preventDefault()} onClick={()=>toggle('effort')} aria-label={ru?'Выбрать бюджет':'Бюджетті таңдау'} aria-expanded={menu==='effort'}><Sparkles size={13}/><span>{budgetTouched?budgetLabels[budgetIndex]:(ru?'Бюджет':'Бюджет')}</span></button>
        <span className="prompt-bar__spacer"/>
        <button type="button" className={`prompt-bar__tool ${listening?'on':''}`} onMouseDown={event=>event.preventDefault()} onClick={dictate} disabled={!speechAvailable||sending} aria-label={listening?(ru?'Остановить диктовку':'Диктовканы тоқтату'):(ru?'Диктовка':'Диктовка')} title={speechAvailable?(ru?'Голосовой ввод':'Дауыспен енгізу'):(ru?'Голосовой ввод не поддерживается в этом браузере':'Бұл браузерде дауыспен енгізу қолжетімсіз')}>{listening?<span className="prompt-bar__eq"><i/><i/><i/></span>:<Mic size={15}/>}</button>
        <button type="button" className={`prompt-bar__send ${armed?'armed':''} ${pressed?'pressed':''}`} disabled={!armed||uploading} aria-label={sending?t.stop:t.send} onMouseDown={event=>event.preventDefault()} onPointerDown={()=>setPressed(true)} onPointerUp={()=>setPressed(false)} onPointerLeave={()=>setPressed(false)} onClick={submit}><svg className="prompt-bar__glyph" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path ref={pathRef} d="M12 4.5L18.5 11L14.25 11L14.25 19.5L9.75 19.5L9.75 11L5.5 11Z"/></svg></button>
      </div>
    </div>
    {speechError&&<p className="prompt-bar__speech-error" role="alert">{speechError}</p>}
  </div>;
}
