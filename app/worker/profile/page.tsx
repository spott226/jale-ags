import { AppShell } from "@/components/app-shell";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { updateWorkerProfileAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MUNICIPALITIES } from "@/lib/config";
import { getCatalogCategories,type SkillSelection } from "@/lib/work-catalog";
import { WorkerSkillPicker } from "@/components/worker-skill-picker";

type WorkerDetails={profile_id:string;age:number;zone:string;categories:string[];availability:string;completed_jobs:number;rating_average:number|null;attendance_rate:number|null};

export default async function WorkerProfile({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const {profile}=await requireUser("worker"); const q=await searchParams; const supabase=await createClient();
  const [{data:workerRows,error:workerError},{data:ratings},{data:savedSkills},categories]=await Promise.all([
    supabase.rpc("get_my_worker_profile"),
    supabase.from("ratings").select("id,score,comment,created_at").eq("rated_id",profile.id).eq("direction","employer_to_worker").order("created_at",{ascending:false}).limit(10),
    supabase.from("worker_skills").select("skill_id,level").eq("worker_id",profile.id).limit(80),
    getCatalogCategories(),
  ]);
  let w=(workerRows?.[0]??null) as WorkerDetails|null;
  if(workerError){const {data:fallback}=await supabase.from("workers").select("profile_id,age,zone,categories,availability,completed_jobs,rating_average,attendance_rate").eq("profile_id",profile.id).maybeSingle();w=fallback as WorkerDetails|null;}
  return <AppShell role="worker" name={profile.full_name}>
    {q.error&&<div className="mb-4"><Notice type="error">{q.error}</Notice></div>}{q.message&&<div className="mb-4"><Notice type="success">✓ {q.message}</Notice></div>}{!w&&<div className="mb-4"><Notice type="error">No pudimos leer tus datos laborales. Tu información sigue segura en Supabase.</Notice></div>}
    <section className="dashboard-hero profile-hero p-6 md:p-8 mb-6 animate-in"><div className="relative z-10 flex items-center gap-4"><div className="profile-avatar">{profile.full_name.split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase()}</div><div><span className="eyebrow">MI REPUTACIÓN</span><h2 className="text-3xl font-black tracking-[-.04em]">{profile.full_name}</h2><p className="text-white/70">{w?.categories?.slice(0,2).join(" · ")||"Trabajador nuevo"}</p></div></div></section>
    <section className="grid grid-cols-3 gap-3 mb-6"><div className="stat-card text-center"><p className="text-3xl font-black text-[#ff8a45]">{w?.rating_average??"—"}</p><p className="text-xs muted font-bold">Calificación</p></div><div className="stat-card text-center"><p className="text-3xl font-black text-[#5b45e0]">{w?.completed_jobs??0}</p><p className="text-xs muted font-bold">Terminados</p></div><div className="stat-card text-center"><p className="text-3xl font-black text-[#10a6a6]">{w?.attendance_rate?`${w.attendance_rate}%`:"—"}</p><p className="text-xs muted font-bold">Asistencia</p></div></section>
    <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
      <section className="card p-6 animate-in"><div><span className="pill">TUS DATOS</span><h2 className="section-title mt-3">Editar mi perfil</h2><p className="text-sm muted mt-2">Lo que guardes aquí aparecerá de inmediato.</p></div><form action={updateWorkerProfileAction} className="grid gap-5 mt-6"><label className="label">Nombre<input className="field" name="full_name" defaultValue={profile.full_name} required minLength={2}/></label><div className="grid grid-cols-2 gap-4"><label className="label">Teléfono<input className="field" name="phone" defaultValue={profile.phone??""} required pattern="[0-9+ ()-]{10,20}"/></label><label className="label">Edad<input className="field" name="age" type="number" defaultValue={w?.age??""} min="18" max="90" required/></label></div><div className="grid grid-cols-2 gap-4"><label className="label">Municipio<select className="field" name="municipality" defaultValue={profile.municipality??""} required>{MUNICIPALITIES.map(x=><option key={x}>{x}</option>)}</select></label><label className="label">Colonia o zona<input className="field" name="zone" defaultValue={w?.zone??""} required/></label></div><WorkerSkillPicker categories={categories} initialCategories={w?.categories??[]} initialSkills={(savedSkills??[]) as SkillSelection[]}/><label className="label">Mi disponibilidad<textarea className="field min-h-24" name="availability" defaultValue={w?.availability??""} placeholder="Ej. Por las tardes y fines de semana" required/></label><SubmitButton>GUARDAR CAMBIOS</SubmitButton></form></section>
      <aside className="grid content-start gap-5"><section className="card p-5 animate-in"><h2 className="font-black text-xl">Vista del perfil</h2><div className="profile-facts"><div><small>Edad</small><b>{w?.age?`${w.age} años`:"—"}</b></div><div><small>Zona</small><b>{w?.zone||"—"}</b></div></div><div className="mt-4 flex flex-wrap gap-2">{w?.categories?.map((x:string)=><span className="pill" key={x}>{x}</span>)}</div><p className="mt-5 text-sm"><b>Disponibilidad</b><br/><span className="muted">{w?.availability||"Sin especificar"}</span></p><p className="privacy-note">🔒 Tu teléfono sólo se comparte cuando un empleador te selecciona.</p></section><section className="card p-5 animate-in"><h2 className="font-black text-xl">Calificaciones recibidas</h2>{ratings?.length?<div className="grid gap-3 mt-4">{ratings.map(r=><div className="rating-item" key={r.id}><p className="font-black text-[#ff8a45]">{"★".repeat(r.score)}<span className="text-[#d7d9e5]">{"★".repeat(5-r.score)}</span></p>{r.comment&&<p className="text-sm mt-1">{r.comment}</p>}<p className="text-xs muted mt-2">{new Date(r.created_at).toLocaleDateString("es-MX")}</p></div>)}</div>:<div className="empty-soft mt-4"><p className="text-3xl">⭐</p><p className="font-black mt-2">Aún no tienes calificaciones</p><p className="text-sm muted mt-1">Aparecerán cuando termines tu primer jale.</p></div>}</section></aside>
    </div>
  </AppShell>;
}
