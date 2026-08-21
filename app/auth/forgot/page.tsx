import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";

export default async function ForgotPassword({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const q=await searchParams;
  return <main className="auth-stage"><div className="shell py-8 md:py-12"><Link href="/auth?mode=login" className="inline-flex items-center gap-2 text-sm font-black text-white/70">← Volver a iniciar sesión</Link><div className="auth-grid mt-5"><section className="auth-story"><span className="landing-kicker !mx-0">RECUPERA TU ACCESO</span><h1>Olvidarla pasa.<br/><span>Volver es fácil.</span></h1><p>Te enviaremos un enlace seguro para crear una contraseña nueva. Nunca te pediremos tu contraseña anterior.</p><div className="auth-points"><span>✓ Enlace de un solo uso</span><span>✓ Datos protegidos</span></div></section><section className="auth-card animate-in"><p className="auth-eyebrow">Recuperar contraseña</p><h2 className="section-title mt-2">¿Cuál es tu correo?</h2><p className="muted mt-2 text-sm">Escribe el mismo correo con el que creaste tu cuenta.</p>{q.error&&<div className="mt-4"><Notice type="error">{q.error}</Notice></div>}{q.message&&<div className="mt-4"><Notice type="success">{q.message}</Notice></div>}<form action={requestPasswordResetAction} className="grid gap-4 mt-6"><label className="label">Correo<input className="field" name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required/></label><SubmitButton>ENVIAR ENLACE DE RECUPERACIÓN</SubmitButton></form><p className="auth-switch"><Link href="/auth?mode=login">Ya recordé mi contraseña</Link></p></section></div></div></main>;
}
