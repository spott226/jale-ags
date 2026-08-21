"use client";

import { useEffect,useState } from "react";
import { createJobAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { MUNICIPALITIES,money } from "@/lib/config";
import type { CatalogCategory,CatalogSkill } from "@/lib/work-catalog";

type FormState={title:string;category:string;description:string;workers_needed:string;municipality:string;zone:string;job_date:string;start_time:string;duration_hours:string;pay_amount:string;payment_method:string;notes:string};

export function JobForm({categories}:{categories:CatalogCategory[]}){
  const [review,setReview]=useState(false);
  const [skills,setSkills]=useState<CatalogSkill[]>([]);
  const [selectedSkills,setSelectedSkills]=useState<number[]>([]);
  const [form,setForm]=useState<FormState>({title:"",category:categories[0]?.name??"Ayudante general",description:"",workers_needed:"1",municipality:"Aguascalientes",zone:"",job_date:"",start_time:"08:00",duration_hours:"4",pay_amount:"",payment_method:"efectivo",notes:""});
  const update=(name:keyof FormState,value:string)=>setForm(current=>({...current,[name]:value}));

  useEffect(()=>{
    const category=categories.find(x=>x.name===form.category);
    if(!category?.id)return;
    const controller=new AbortController();
    fetch(`/api/catalog/skills?categoryId=${category.id}`,{signal:controller.signal})
      .then(response=>response.json()).then((body:{skills:CatalogSkill[]})=>setSkills(body.skills))
      .catch(()=>setSkills([]));
    return()=>controller.abort();
  },[categories,form.category]);

  const fields=Object.entries(form);
  if(review)return <div className="grid gap-5">
    <div className="rounded-2xl bg-[#edf0ff] p-6"><p className="font-black">Ocupo {form.workers_needed} persona{form.workers_needed==="1"?"":"s"}</p><h2 className="text-2xl font-black mt-2">{form.title}</h2><div className="grid gap-2 mt-4"><p>📍 {form.zone}, {form.municipality}</p><p>📅 {form.job_date}</p><p>🕐 {form.start_time}</p><p>⏱ Aproximadamente {form.duration_hours} horas</p><p className="text-2xl font-black text-[#5b45e0]">💰 {money(form.pay_amount)} por persona</p></div>{selectedSkills.length>0&&<div className="mt-4 flex flex-wrap gap-2">{skills.filter(x=>selectedSkills.includes(x.id)).map(x=><span className="pill" key={x.id}>{x.name}</span>)}</div>}</div>
    <form action={createJobAction} className="grid gap-3">{fields.map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>) }<input type="hidden" name="job_skill_ids" value={selectedSkills.join(",")}/><SubmitButton>PUBLICAR JALE</SubmitButton><button type="button" className="btn btn-soft" onClick={()=>setReview(false)}>CAMBIAR DATOS</button></form>
  </div>;

  return <form onSubmit={event=>{event.preventDefault();if(event.currentTarget.reportValidity())setReview(true)}} className="grid gap-5">
    <label className="label">Título<input className="field" value={form.title} onChange={e=>update("title",e.target.value)} minLength={5} maxLength={100} placeholder="Ej. Ayuda para una mudanza" required/></label>
    <label className="label">Categoría<select className="field" value={form.category} onChange={e=>{update("category",e.target.value);setSelectedSkills([]);setSkills([])}}>{categories.map(x=><option key={x.slug} value={x.name}>{x.name}</option>)}</select></label>
    <fieldset className="grid gap-2"><legend className="label">Actividades concretas <span className="muted">(opcional)</span></legend><p className="text-sm muted">Elige hasta 20 para que las personas entiendan exactamente qué necesitas.</p><div className="job-skill-grid">{skills.map(skill=><label key={skill.id}><input type="checkbox" checked={selectedSkills.includes(skill.id)} onChange={e=>setSelectedSkills(current=>e.target.checked?[...current,skill.id].slice(0,20):current.filter(id=>id!==skill.id))}/><span>{skill.name}{skill.requires_verification&&<small> Requiere experiencia</small>}</span></label>)}</div></fieldset>
    <label className="label">Descripción corta<textarea className="field min-h-28" value={form.description} onChange={e=>update("description",e.target.value)} minLength={10} maxLength={600} placeholder="Explica claramente qué hay que hacer" required/></label>
    <div className="grid grid-cols-2 gap-4"><label className="label">Personas necesarias<input className="field" type="number" value={form.workers_needed} onChange={e=>update("workers_needed",e.target.value)} min="1" max="50" required/></label><label className="label">Pago por persona<input className="field" type="number" inputMode="decimal" value={form.pay_amount} onChange={e=>update("pay_amount",e.target.value)} min="1" step="1" required/></label></div>
    <div className="grid md:grid-cols-2 gap-4"><label className="label">Municipio<select className="field" value={form.municipality} onChange={e=>update("municipality",e.target.value)}>{MUNICIPALITIES.map(x=><option key={x}>{x}</option>)}</select></label><label className="label">Colonia o zona<input className="field" value={form.zone} onChange={e=>update("zone",e.target.value)} required/></label></div>
    <div className="grid grid-cols-2 gap-4"><label className="label">Fecha<input className="field" type="date" value={form.job_date} min={new Date().toISOString().slice(0,10)} onChange={e=>update("job_date",e.target.value)} required/></label><label className="label">Hora de inicio<input className="field" type="time" value={form.start_time} onChange={e=>update("start_time",e.target.value)} required/></label></div>
    <div className="grid grid-cols-2 gap-4"><label className="label">Duración (horas)<input className="field" type="number" value={form.duration_hours} onChange={e=>update("duration_hours",e.target.value)} min="0.5" max="336" step="0.5" required/></label><label className="label">Forma de pago<select className="field" value={form.payment_method} onChange={e=>update("payment_method",e.target.value)}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select></label></div>
    <label className="label">Notas opcionales<textarea className="field" value={form.notes} onChange={e=>update("notes",e.target.value)} maxLength={500}/></label><button type="submit" className="btn btn-primary">REVISAR ANTES DE PUBLICAR</button>
  </form>;
}
