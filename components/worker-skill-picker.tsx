"use client";

import { useMemo,useState } from "react";
import type { CatalogCategory,CatalogSkill,SkillSelection } from "@/lib/work-catalog";

const LEVELS=[
  {value:"helper",label:"Puedo ayudar"},
  {value:"capable",label:"Sé hacerlo"},
  {value:"experienced",label:"Tengo experiencia"},
] as const;

export function WorkerSkillPicker({categories,initialCategories=[],initialSkills=[]}:{categories:CatalogCategory[];initialCategories?:string[];initialSkills?:SkillSelection[]}){
  const [showAll,setShowAll]=useState(false);
  const [search,setSearch]=useState("");
  const [selectedCategories,setSelectedCategories]=useState(()=>new Set(initialCategories));
  const [skillsByCategory,setSkillsByCategory]=useState<Record<number,CatalogSkill[]>>({});
  const [loading,setLoading]=useState<number|null>(null);
  const [selectedSkills,setSelectedSkills]=useState<Record<number,SkillSelection["level"]>>(()=>Object.fromEntries(initialSkills.map(x=>[x.skill_id,x.level])));
  const visible=useMemo(()=>categories.filter(c=>search?c.name.toLowerCase().includes(search.toLowerCase()):showAll||c.featured||selectedCategories.has(c.name)),[categories,search,showAll,selectedCategories]);

  async function loadSkills(category:CatalogCategory){
    if(category.id===null||skillsByCategory[category.id])return;
    setLoading(category.id);
    try{
      const response=await fetch(`/api/catalog/skills?categoryId=${category.id}`);
      const body=await response.json() as {skills:CatalogSkill[]};
      setSkillsByCategory(current=>({...current,[category.id as number]:body.skills}));
    }finally{setLoading(null)}
  }

  function toggleCategory(category:CatalogCategory){
    const next=new Set(selectedCategories);
    if(next.has(category.name))next.delete(category.name);else next.add(category.name);
    setSelectedCategories(next);
    if(next.has(category.name))void loadSkills(category);
  }

  const skillItems=Object.entries(selectedSkills).map(([skill_id,level])=>({skill_id:Number(skill_id),level}));
  return <fieldset className="grid gap-3">
    <legend className="label">¿En qué sabes jalar?</legend>
    <p className="text-sm muted">Primero elige categorías. Las actividades se abren sólo cuando las necesitas.</p>
    <input type="hidden" name="skill_items" value={JSON.stringify(skillItems)}/>
    {[...selectedCategories].map(name=><input key={name} type="hidden" name="categories" value={name}/>) }
    <input className="field" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar categoría…"/>
    <div className="category-grid">
      {visible.map(category=><button type="button" key={category.slug} className={selectedCategories.has(category.name)?"catalog-choice selected":"catalog-choice"} onClick={()=>toggleCategory(category)} aria-pressed={selectedCategories.has(category.name)}><span>{selectedCategories.has(category.name)?"✓ ":""}{category.name}</span></button>)}
    </div>
    {!search&&<button type="button" className="text-sm font-black text-[#5b45e0] underline justify-self-start" onClick={()=>setShowAll(x=>!x)}>{showAll?"Ver las principales":"Ver todas las categorías"}</button>}
    {[...selectedCategories].map(name=>{
      const category=categories.find(x=>x.name===name); if(!category)return null;
      const skills=category.id===null?[]:skillsByCategory[category.id];
      return <details key={name} className="catalog-skill-group" onToggle={e=>{if(e.currentTarget.open)void loadSkills(category)}}>
        <summary>{name}<span>{skills?`${skills.length} actividades`:"Abrir"}</span></summary>
        <div className="grid gap-2 pt-3">
          {loading===category.id&&<p className="text-sm muted">Cargando actividades…</p>}
          {skills?.map(skill=>{
            const level=selectedSkills[skill.id];
            return <div className="catalog-skill" key={skill.id}><label><input type="checkbox" checked={Boolean(level)} onChange={e=>setSelectedSkills(current=>{const next={...current};if(e.target.checked)next[skill.id]="helper";else delete next[skill.id];return next})}/><span>{skill.name}{skill.requires_verification&&<small> Puede requerir comprobación</small>}</span></label>{level&&<select value={level} onChange={e=>setSelectedSkills(current=>({...current,[skill.id]:e.target.value as SkillSelection["level"]}))}>{LEVELS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>}</div>})}
          {skills&&skills.length===0&&<p className="text-sm muted">Puedes usar la categoría general. Agregaremos más actividades sin que tengas que cambiar tu perfil.</p>}
        </div>
      </details>;
    })}
  </fieldset>;
}

