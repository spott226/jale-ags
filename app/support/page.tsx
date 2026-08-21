import { redirect } from "next/navigation";
import { createSupportTicketAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const statusLabel:Record<string,string>={open:"Recibido",in_progress:"En revisión",waiting_user:"Falta información",resolved:"Resuelto",closed:"Cerrado"};
const categoryLabel:Record<string,string>={interface:"Interfaz o diseño",system_error:"Error del sistema",account:"Cuenta o acceso",payment:"Pago o publicación",notifications:"Avisos",other:"Otro"};

export default async function Support({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const {profile}=await requireUser(); if(profile.role==="admin")redirect("/admin?tab=system"); const q=await searchParams; const supabase=await createClient();
  const {data:tickets}=await supabase.from("support_tickets").select("*").order("created_at",{ascending:false}).limit(30);
  return <AppShell role={profile.role} name={profile.full_name}>
    <section className="support-hero"><div><span>SOPORTE DE JALE</span><h1>¿Algo no funciona?</h1><p>Cuéntanos exactamente qué ocurrió. Esto crea un ticket técnico; no es un reporte contra otra persona.</p></div><b>🛠</b></section>
    {q.error&&<div className="mb-4"><Notice type="error">{q.error}</Notice></div>}{q.message&&<div className="mb-4"><Notice type="success">✓ {q.message}</Notice></div>}
    <div className="support-grid"><form action={createSupportTicketAction} className="card support-form"><div><span className="pill">NUEVO TICKET</span><h2 className="section-title mt-3">Reportar un error</h2><p className="muted text-sm mt-2">No incluyas contraseñas, códigos ni datos bancarios.</p></div><label className="label">¿Qué está fallando?<select className="field" name="category" required><option value="">Elige una opción</option><option value="interface">Interfaz o diseño</option><option value="system_error">Error del sistema</option><option value="account">Cuenta o inicio de sesión</option><option value="payment">Pago o publicación</option><option value="notifications">Avisos o notificaciones</option><option value="other">Otro</option></select></label><label className="label">Resumen<input className="field" name="title" required minLength={5} maxLength={120} placeholder="Ej. No puedo guardar mi perfil"/></label><label className="label">¿Qué pasó?<textarea className="field min-h-36" name="description" required minLength={10} maxLength={1200} placeholder="Qué intentaste hacer, qué esperabas y qué apareció en pantalla"/></label><label className="label">¿En qué parte ocurrió?<select className="field" name="page_context"><option value="">No estoy seguro</option><option>Inicio o panel</option><option>Mi perfil</option><option>Jales disponibles</option><option>Postulaciones</option><option>Publicar un jale</option><option>Pago de publicación</option><option>Otra sección</option></select></label><label className="blocking-check"><input type="checkbox" name="blocking" value="true"/><span><b>Esto me impide usar Jale</b><small>El ticket se marcará con prioridad alta.</small></span></label><SubmitButton pending="Enviando ticket…">ENVIAR TICKET</SubmitButton></form>
      <section><div className="support-list-title"><span className="pill">SEGUIMIENTO</span><h2 className="section-title mt-3">Mis tickets</h2></div><div className="grid gap-3 mt-4">{tickets?.map(t=><article className="ticket-card" key={t.id}><div className="ticket-top"><span>#{t.id.slice(0,6).toUpperCase()}</span><b className={`ticket-status ${t.status}`}>{statusLabel[t.status]??t.status}</b></div><h3>{t.title}</h3><p>{categoryLabel[t.category]??t.category} · {new Date(t.created_at).toLocaleDateString("es-MX")}</p><div className="ticket-description">{t.description}</div>{t.admin_notes&&<div className="ticket-answer"><b>Respuesta de Jale</b><p>{t.admin_notes}</p></div>}</article>)}{!tickets?.length&&<div className="empty-soft"><p className="text-3xl">✓</p><h3 className="font-black mt-2">No has reportado errores</h3><p className="text-sm muted mt-1">Tus tickets aparecerán aquí con su estado.</p></div>}</div></section>
    </div>
  </AppShell>;
}
