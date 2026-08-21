import Link from "next/link";
import { formatDate, money } from "@/lib/config";
import type { Job } from "@/lib/types";
import { StatusPill } from "./status-pill";
export function JobCard({job,href=`/jobs/${job.id}`}:{job:Job;href?:string}) {
  const count=job.candidate_count??0;
  return <article className="card animate-in p-5 grid gap-3 overflow-hidden relative">
    <div className="flex items-start justify-between gap-3"><span className="pill">{job.category}</span><StatusPill status={job.status}/></div>
    <div><h3 className="text-xl font-black leading-tight">{job.title}</h3><p className="mt-1 muted">{job.zone}, {job.municipality}</p></div>
    <div className="rounded-2xl bg-gradient-to-r from-[#e9ffc2] to-[#f8ffdc] p-3"><p className="text-xs font-black uppercase tracking-wide text-[#087443]">Pago visible</p><p className="text-3xl font-black text-[#087443]">{money(job.pay_amount)} <span className="text-sm muted">por persona</span></p></div>
    <div className="grid grid-cols-2 gap-2 text-sm"><span>📅 {formatDate(job.job_date)}</span><span>🕐 {job.start_time.slice(0,5)}</span><span>⏱ {job.duration_hours} h aprox.</span><span>👷 {job.workers_needed} persona{job.workers_needed===1?"":"s"}</span></div>
    {job.status!=="awaiting_payment"&&<p className="text-sm font-bold">{Math.max(0,job.candidate_limit-count)} de {job.candidate_limit} lugares para interesados</p>}
    <Link className="btn btn-primary w-full" href={href}>VER JALE</Link>
  </article>;
}
