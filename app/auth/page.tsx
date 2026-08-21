import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction,signUpAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { currentUser } from "@/lib/auth";

export default async function AuthPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const session=await currentUser();
  if(session?.profile)redirect("/dashboard");
  if(session?.user)redirect(`/onboarding?role=${session.user.user_metadata?.intended_role??"worker"}`);
  const q=await searchParams; const role=q.role==="employer"?"employer":"worker"; const login=q.mode==="login";
  return <main className="auth-stage"><div className="shell py-8 md:py-12">
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-white/70">← Volver al inicio</Link>
    <div className="auth-grid mt-5"><section className="auth-story">
      <span className="landing-kicker !mx-0">{login?"YA TENGO CUENTA":role==="worker"?"QUIERO BUSCAR JALE":"NECESITO GENTE"}</span>
      <h1>{login?<>Regresa a<br/><span>tu panel.</span></>:role==="worker"?<>Tu próximo jale<br/><span>puede ser mañana.</span></>:<>Publica hoy.<br/><span>Resuelve rápido.</span></>}</h1>
      <p>{login?"Tus jales, postulaciones y datos siguen aquí.":role==="worker"?"Pago visible, trabajos cortos y oportunidades reales. Nunca pagas por buscar.":"Tus primeros dos jales son gratis. Tú eliges a las personas y ellas confirman."}</p>
      <div className="auth-points"><span>✓ Sin CV</span><span>✓ Sin procesos largos</span><span>✓ Datos protegidos</span></div>
    </section><section className="auth-card animate-in">
      <div className="flex items-start justify-between gap-3"><div><p className="auth-eyebrow">Bienvenido a Jale</p><h2 className="section-title mt-2">{login?"Inicia sesión":"Crea tu cuenta"}</h2></div><span className="text-3xl">{login?"↗":role==="worker"?"⚡":"✦"}</span></div>
      {q.error&&<div className="mt-4"><Notice type="error">{q.error}</Notice></div>}{q.message&&<div className="mt-4"><Notice type="success">{q.message}</Notice></div>}
      {login?<><form action={signInAction} className="grid gap-4 mt-6"><input type="hidden" name="next" value={q.next??""}/><label className="label">Correo<input className="field" name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required/></label><label className="label">Contraseña<input className="field" name="password" type="password" autoComplete="current-password" placeholder="••••••••" minLength={8} required/></label><SubmitButton>ENTRAR A MI PANEL</SubmitButton></form><p className="auth-switch">¿Aún no tienes cuenta? <Link href="/">Elige Busco jale u Ocupo gente</Link></p></>:<><form action={signUpAction} className="grid gap-4 mt-6"><input type="hidden" name="role" value={role}/><label className="label">Correo<input className="field" name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required/></label><label className="label">Crea una contraseña<input className="field" name="password" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" minLength={8} required/></label><label className="legal-consent"><input type="checkbox" name="accept_legal" value="true" required/><span>He leído y acepto los <Link href="/legal/terms" target="_blank">Términos y condiciones</Link> y el <Link href="/legal/privacy" target="_blank">Aviso de privacidad</Link>. Entiendo que Jale conecta personas y no garantiza el pago del jale.</span></label><SubmitButton className="btn btn-primary w-full">{role==="worker"?"CREAR CUENTA PARA BUSCAR":"CREAR CUENTA PARA PUBLICAR"}</SubmitButton></form><p className="auth-switch">¿Ya tienes cuenta? <Link href="/auth?mode=login">Iniciar sesión</Link></p><p className="mt-3 text-center text-sm"><Link className="font-black text-[#2f6df6] underline" href={`/auth?role=${role==="worker"?"employer":"worker"}&mode=signup`}>{role==="worker"?"Cambiar a empleador":"Cambiar a trabajador"}</Link></p></>}
      {login&&<p className="mt-3 text-center text-sm"><Link className="font-black text-[#2f6df6] underline" href="/auth/forgot">¿Olvidaste tu contraseña?</Link></p>}
    </section></div>
  </div></main>;
}
