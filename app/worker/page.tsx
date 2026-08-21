import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { JobCard } from "@/components/job-card";
import { Notice } from "@/components/notice";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES,MUNICIPALITIES } from "@/lib/config";
import type { Job } from "@/lib/types";

export default async function WorkerHome({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const {profile}=await requireUser("worker");
  const q=await searchParams;
  const supabase=await createClient();
  let query=supabase.from("jobs").select("*").in("status",["open","candidates_available"]).gte("job_date",new Date().toISOString().slice(0,10)).order("job_date").order("start_time");
  if(q.category)query=query.eq("category",q.category);
  if(q.municipality)query=query.eq("municipality",q.municipality);
  const today=new Date(); const tomorrow=new Date(today); tomorrow.setDate(today.getDate()+1);
  if(q.when==="today")query=query.eq("job_date",today.toISOString().slice(0,10));
  if(q.when==="tomorrow")query=query.eq("job_date",tomorrow.toISOString().slice(0,10));
  if(q.when==="week"){const end=new Date(today);end.setDate(today.getDate()+7);query=query.lte("job_date",end.toISOString().slice(0,10));}
  const [{data:jobs},{data:workerRows},{data:applications}]=await Promise.all([
    query,
    supabase.rpc("get_my_worker_profile"),
    supabase.from("applications").select("status").in("status",["interested","selected","confirmed"]),
  ]);
  const worker=Array.isArray(workerRows)?workerRows[0]:workerRows;
  const ids=(jobs??[]).map(j=>j.id);
  const {data:counts}=ids.length?await supabase.rpc("get_candidate_counts",{p_job_ids:ids}):{data:[]};
  const countMap=new Map((counts??[]).map((row:{job_id:string;candidate_count:number|string})=>[row.job_id,Number(row.candidate_count)]));
  const jobsWithCounts=(jobs??[]).map(job=>({...job,candidate_count:countMap.get(job.id)??0}));
  const active=applications?.length??0;
  const selected=applications?.filter(a=>a.status==="selected").length??0;
  const profileItems=[profile.full_name,profile.municipality,worker?.availability,worker?.categories?.length].filter(Boolean).length;
  const profilePercent=Math.min(100,Math.round(profileItems/4*100));
  return <AppShell role="worker" name={profile.full_name}>
    {q.welcome&&<div className="mb-5 animate-in"><Notice type="success">🎉 Tu cuenta quedó lista. Ya puedes encontrar tu primer jale.</Notice></div>}
    <section className="dashboard-hero animate-in p-6 md:p-9 mb-6">
      <div className="relative z-10 max-w-2xl">
        <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black">TU PANEL DE JALES</span>
        <h2 className="mt-4 text-3xl md:text-5xl font-black tracking-[-.05em] leading-[.98]">Encuentra una oportunidad<br/><span className="text-[#ffd166]">para esta semana.</span></h2>
        <p className="mt-4 text-white/75 max-w-xl">Pago claro, trabajos cortos y sin CV. Revisa los detalles y di “Me interesa”.</p>
        <div className="mt-6 flex flex-wrap gap-3"><a href="#jales" className="btn bg-[#ffd166] text-[#261b57]">VER JALES DISPONIBLES ↓</a><Link href="/worker/profile" className="btn bg-white/12 text-white">REVISAR MI PERFIL</Link></div>
      </div>
    </section>
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
      <div className="stat-card"><p className="text-3xl font-black text-[#5b45e0]">{active}<span className="text-base muted">/3</span></p><p className="text-xs font-bold muted">Postulaciones activas</p></div>
      <div className="stat-card"><p className="text-3xl font-black text-[#7259ff]">{selected}</p><p className="text-xs font-bold muted">Esperan tu respuesta</p></div>
      <div className="stat-card"><p className="text-3xl font-black">{worker?.completed_jobs??0}</p><p className="text-xs font-bold muted">Jales terminados</p></div>
      <div className="stat-card"><p className="text-3xl font-black">{worker?.rating_average??"—"}</p><p className="text-xs font-bold muted">Tu calificación</p></div>
    </section>
    {selected>0&&<Link href="/worker/applications" className="mb-6 flex items-center justify-between rounded-2xl bg-[#fff0e5] border border-[#ffd0b0] p-4 animate-in"><div><p className="font-black text-[#a7430e]">🎉 Un empleador te seleccionó</p><p className="text-sm text-[#854421]">Entra y confirma si vas.</p></div><span className="text-2xl">→</span></Link>}
    {profilePercent<100&&<section className="card p-5 mb-7 animate-in"><div className="flex justify-between gap-3"><div><h3 className="font-black">Haz más fuerte tu perfil</h3><p className="text-sm muted mt-1">Tus datos ayudan a mostrarte jales compatibles.</p></div><b>{profilePercent}%</b></div><div className="progress-track mt-4"><div className="progress-bar" style={{width:`${profilePercent}%`}}/></div><Link className="mt-4 inline-block text-sm font-black text-[#5b45e0] underline" href="/worker/profile">Revisar mi perfil →</Link></section>}
    <section id="jales" className="scroll-mt-24">
      <div className="flex items-end justify-between gap-3 mb-4"><div><span className="pill">OPORTUNIDADES</span><h2 className="section-title mt-2">Jales disponibles</h2><p className="muted text-sm mt-1">El pago siempre se muestra antes de postularte.</p></div></div>
      <form className="filter-card mb-5 grid grid-cols-2 md:grid-cols-4 gap-3"><label className="label">Cuándo<select className="field" name="when" defaultValue={q.when??""}><option value="">Próximos</option><option value="today">Hoy</option><option value="tomorrow">Mañana</option><option value="week">Esta semana</option></select></label><label className="label">Categoría<select className="field" name="category" defaultValue={q.category??""}><option value="">Todas</option>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label><label className="label">Municipio<select className="field" name="municipality" defaultValue={q.municipality??""}><option value="">Todos</option>{MUNICIPALITIES.map(x=><option key={x}>{x}</option>)}</select></label><div className="filter-actions"><button className="btn btn-primary">APLICAR</button>{(q.when||q.category||q.municipality)&&<Link href="/worker#jales" className="filter-clear">Limpiar</Link>}</div></form>
      {jobsWithCounts.length?<div className="grid-cards">{(jobsWithCounts as Job[]).map(job=><JobCard key={job.id} job={job}/>)}</div>:<div className="card p-9 text-center animate-in"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#efffdc] text-4xl">🧤</div><h3 className="font-black text-xl mt-4">Todavía no hay jales con esos filtros</h3><p className="muted mt-2 max-w-md mx-auto">Cuando los empleadores publiquen, aparecerán aquí. Prueba otra fecha o categoría.</p></div>}
    </section>
  </AppShell>;
}
