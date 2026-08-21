import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { JobCard } from "@/components/job-card";
import { Notice } from "@/components/notice";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/types";

type EmployerBilling={free_posts_used:number;free_post_credits?:number;billing_exempt?:boolean;early_access?:boolean};
export default async function EmployerHome({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const {profile}=await requireUser("employer"); const q=await searchParams; const supabase=await createClient();
const [employerResult,jobsResult,settingsResult]=await Promise.all([
  supabase.from("employers").select("*").single(),
  supabase.from("jobs").select("*").order("created_at",{ascending:false}),
  supabase.from("app_settings").select("key,value").in("key",["free_posts","billing_config"])
]);

const employer=employerResult.data;
const jobs=jobsResult.data;
const settings=settingsResult.data;  const account=employer as EmployerBilling|null; const freeLimit=Number(settings?.find(x=>x.key==="free_posts")?.value??2); const config=settings?.find(x=>x.key==="billing_config")?.value as {charging_enabled?:boolean}|undefined;
  const charging=config?.charging_enabled??true; const baseRemaining=Math.max(0,freeLimit-(account?.free_posts_used??0)); const credits=account?.free_post_credits??0; const unlimited=!charging||Boolean(account?.billing_exempt); const remaining=unlimited?"∞":String(baseRemaining+credits);
  const open=jobs?.filter(j=>["open","candidates_available"].includes(j.status)).length??0; const filled=jobs?.filter(j=>["filled","completed"].includes(j.status)).length??0;
  return <AppShell role="employer" name={profile.full_name}>
    {q.welcome&&<div className="mb-5 animate-in"><Notice type="success">🎉 Tu cuenta está lista. Ya puedes publicar tu primer jale.</Notice></div>}
    <section className="dashboard-hero p-6 md:p-9 mb-6 animate-in"><div className="relative z-10 max-w-2xl"><span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black">PANEL DEL EMPLEADOR</span><h2 className="mt-4 text-3xl md:text-5xl font-black tracking-[-.05em] leading-[.98]">¿Te falta gente<br/><span className="text-[#dffc77]">para mañana?</span></h2><p className="mt-4 text-white/75">Publica el trabajo, el pago y el horario. Las personas disponibles podrán interesarse de inmediato.</p><Link className="btn bg-[#dffc77] text-[#073d26] mt-6" href="/employer/jobs/new">＋ PUBLICAR UN JALE</Link></div></section>
    {(account?.early_access||account?.billing_exempt)&&<div className="mb-5"><Notice type="success">{account?.early_access?"Tienes beneficio de empleador fundador.":"Tu cuenta tiene publicaciones gratis autorizadas por Jale."}</Notice></div>}
    <section className="grid grid-cols-3 gap-3 mb-7"><div className="stat-card"><p className="text-3xl font-black text-[#087443]">{remaining}</p><p className="text-xs font-bold muted">Publicaciones disponibles</p></div><div className="stat-card"><p className="text-3xl font-black text-[#7259ff]">{open}</p><p className="text-xs font-bold muted">Jales abiertos</p></div><div className="stat-card"><p className="text-3xl font-black text-[#ff7a2f]">{filled}</p><p className="text-xs font-bold muted">Cubiertos</p></div></section>
    <div className="flex justify-between items-end gap-3 mb-4"><div><span className="pill">ACTIVIDAD</span><h2 className="section-title mt-2">Mis jales</h2><p className="text-sm muted mt-1">Abre un jale para revisar y seleccionar personas.</p></div><Link className="btn btn-primary hide-mobile" href="/employer/jobs/new">＋ PUBLICAR</Link></div>
    {jobs?.length?<div className="grid-cards">{(jobs as Job[]).map(job=><JobCard key={job.id} job={job} href={`/employer/jobs/${job.id}`}/>)}</div>:<div className="card p-9 text-center animate-in"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#efffdc] text-4xl">🧤</div><h3 className="font-black text-xl mt-4">Todavía no publicas un jale</h3><p className="muted mt-2">Publica y el sistema aplicará automáticamente tus beneficios disponibles.</p><Link href="/employer/jobs/new" className="btn btn-primary mt-5">PUBLICAR MI PRIMER JALE</Link></div>}
  </AppShell>;
}
