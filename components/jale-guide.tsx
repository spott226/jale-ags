"use client";

import { useEffect,useState } from "react";

const guides={
  worker:[
    ["Hola, soy Jali","Te voy a acompañar para que encuentres un jale rápido y uses Jale con seguridad."],
    ["Explora oportunidades","En Descubrir verás pago, horario, zona y duración antes de mostrar interés."],
    ["Elige con calma","Puedes tener hasta tres postulaciones activas. Confirma sólo cuando estés seguro de poder ir."],
    ["Construye confianza","Después del jale, confirma si recibiste el pago y califica honestamente a la otra persona."],
    ["Tu seguridad primero","No envíes dinero para conseguir trabajo. Si algo sale mal, repórtalo desde la publicación o Soporte."],
  ],
  employer:[
    ["Hola, soy Jali","Te voy a ayudar a publicar un jale claro y encontrar manos sin procesos largos."],
    ["Publica lo necesario","Describe tarea, pago, horario, duración y zona. Las primeras dos publicaciones son gratuitas."],
    ["Elige y espera confirmación","Revisa candidatos, selecciona a quienes necesites y espera a que confirmen que van."],
    ["Cierra bien el jale","Al terminar, confirma asistencia y califica con honestidad. Paga siempre lo anunciado."],
    ["Aquí estoy para ayudarte","Puedes abrirme otra vez desde este botón o reportar una falla en Soporte."],
  ],
};

export function JaleGuide({role}:{role:"worker"|"employer"}){
  const storageKey=`jale-guide-v1-${role}`;
  const [ready,setReady]=useState(false);
  const [open,setOpen]=useState(false);
  const [step,setStep]=useState(0);
  const items=guides[role];
  useEffect(()=>{const timer=window.setTimeout(()=>{const seen=window.localStorage.getItem(storageKey);setOpen(!seen);setReady(true)},0);return()=>window.clearTimeout(timer)},[storageKey]);
  if(!ready)return null;
  const close=()=>{window.localStorage.setItem(storageKey,"seen");setOpen(false)};
  if(!open)return <button className="guide-minimized" onClick={()=>{setStep(0);setOpen(true)}} aria-label="Abrir tutorial de Jale"><Jali/><span><b>Aquí estoy</b><small>para ayudarte</small></span></button>;
  return <section className="guide-card" role="dialog" aria-modal="false" aria-label="Tutorial de Jale">
    <div className="guide-top"><Jali/><div><small>GUÍA DE JALE</small><b>{items[step][0]}</b></div><button onClick={close} aria-label="Omitir tutorial">×</button></div>
    <p>{items[step][1]}</p>
    <div className="guide-progress" aria-label={`Paso ${step+1} de ${items.length}`}>{items.map((_,i)=><i key={i} className={i===step?"active":""}/>)}</div>
    <div className="guide-actions"><button onClick={close}>Omitir</button>{step>0&&<button onClick={()=>setStep(step-1)}>Anterior</button>}<button className="guide-next" onClick={()=>step===items.length-1?close():setStep(step+1)}>{step===items.length-1?"Entendido":"Siguiente"}</button></div>
  </section>;
}

function Jali(){return <span className="jali" aria-hidden="true"><i/><i/><b>⌣</b></span>}
