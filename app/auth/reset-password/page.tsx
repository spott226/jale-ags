import Link from "next/link";
import { updatePasswordAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";

export default async function ResetPassword({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const q=await searchParams;
  return <main className="auth-stage"><div className="shell py-8 md:py-12"><Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-white/70">← Volver al inicio</Link><div className="mx-auto mt-5 max-w-xl"><section className="auth-card animate-in"><p className="auth-eyebrow">Nueva contraseña</p><h1 className="section-title mt-2">Crea una contraseña segura</h1><p className="muted mt-2 text-sm">Usa al menos ocho caracteres y no reutilices una contraseña de otra aplicación.</p>{q.error&&<div className="mt-4"><Notice type="error">{q.error}</Notice></div>}<form action={updatePasswordAction} className="grid gap-4 mt-6"><label className="label">Contraseña nueva<input className="field" name="password" type="password" autoComplete="new-password" minLength={8} required/></label><label className="label">Repite la contraseña<input className="field" name="confirmation" type="password" autoComplete="new-password" minLength={8} required/></label><SubmitButton>GUARDAR CONTRASEÑA NUEVA</SubmitButton></form></section></div></div></main>;
}
