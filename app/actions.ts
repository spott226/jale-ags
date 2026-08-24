"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient,createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const s=(fd:FormData,key:string)=>String(fd.get(key)??"").trim();
const fail=(path:string,message:string):never=>redirect(`${path}${path.includes("?")?"&":"?"}error=${encodeURIComponent(message)}`);
const safeNext=(value:string)=>value.startsWith("/")&&!value.startsWith("//")&&!value.includes("\\")?value:"/dashboard";
const idList=(value:string)=>value.split(",").map(Number).filter(id=>Number.isInteger(id)&&id>0).slice(0,20);
const cleanCode=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,24);
const promoterPassword=()=>`Jale-${randomBytes(4).toString("hex")}-${randomBytes(2).toString("hex").toUpperCase()}`;
const skillItems=(fd:FormData)=>{
  try{
    const parsed=JSON.parse(s(fd,"skill_items")) as Array<{skill_id:unknown;level:unknown}>;
    if(!Array.isArray(parsed))return [];
    return parsed.filter(x=>Number.isInteger(Number(x.skill_id))&&["helper","capable","experienced"].includes(String(x.level))).slice(0,80).map(x=>({skill_id:Number(x.skill_id),level:String(x.level)}));
  }catch{return []}
};

export async function signInAction(fd:FormData) {
  const supabase=await createClient();
  const {data,error}=await supabase.auth.signInWithPassword({email:s(fd,"email"),password:s(fd,"password")});
  if(error) fail("/auth", "Correo o contraseña incorrectos");
  const requested=safeNext(s(fd,"next"));
  if(requested!=="/dashboard")redirect(requested);
  const {data:profiles}=await supabase.rpc("get_my_profile");
  const role=profiles?.[0]?.role;
  if(role==="admin"||role==="worker"||role==="employer"||role==="promoter")redirect(`/${role}`);
  const intended=data.user?.user_metadata?.intended_role==="employer"?"employer":"worker";
  redirect(`/onboarding?role=${intended}`);
}
export async function signUpAction(fd:FormData) {
  const supabase=await createClient();
  const role=s(fd,"role")==="employer"?"employer":"worker";
  if(s(fd,"accept_legal")!=="true") fail(`/auth?role=${role}&mode=signup`,"Debes aceptar los Términos y el Aviso de Privacidad para crear tu cuenta");
  const acceptedAt=new Date().toISOString();
  const referralCode=cleanCode(s(fd,"ref"));
  const {data,error}=await supabase.auth.signUp({email:s(fd,"email"),password:s(fd,"password"),options:{data:{intended_role:role,legal_version:"2026-08-20",legal_accepted_at:acceptedAt,referral_code:role==="employer"?referralCode:""}}});
  if(error) fail(`/auth?role=${role}&mode=signup`,error.message);
  if(!data.session) redirect(`/auth?role=${role}&mode=login&message=${encodeURIComponent("Revisa tu correo para confirmar la cuenta y después inicia sesión.")}`);
  redirect(`/onboarding?role=${role}`);
}
export async function signOutAction() { const supabase=await createClient(); await supabase.auth.signOut(); redirect("/"); }

export async function requestPasswordResetAction(fd:FormData) {
  const email=s(fd,"email").toLowerCase();
  const supabase=await createClient();
  const site=(process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000").replace(/\/$/,"");
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${site}/auth/callback?next=/auth/reset-password`});
  if(error) fail("/auth/forgot","No pudimos enviar el enlace en este momento. Espera un minuto e inténtalo nuevamente");
  redirect(`/auth/forgot?message=${encodeURIComponent("Si existe una cuenta con ese correo, recibirás un enlace para crear una contraseña nueva.")}`);
}

export async function updatePasswordAction(fd:FormData) {
  const password=s(fd,"password"); const confirmation=s(fd,"confirmation");
  if(password.length<8) fail("/auth/reset-password","La contraseña debe tener al menos 8 caracteres");
  if(password!==confirmation) fail("/auth/reset-password","Las contraseñas no coinciden");
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user) fail("/auth/forgot","El enlace venció o ya fue utilizado. Solicita uno nuevo");
  const {error}=await supabase.auth.updateUser({password});
  if(error) fail("/auth/reset-password","No pudimos cambiar la contraseña. Solicita un enlace nuevo");
  await supabase.auth.signOut();
  redirect(`/auth?mode=login&message=${encodeURIComponent("Contraseña actualizada. Ya puedes iniciar sesión.")}`);
}

export async function onboardingAction(fd:FormData) {
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/auth");
  const role=s(fd,"role")==="employer"?"employer":"worker";
  const {data:existing}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(existing) redirect("/dashboard");
  const categories=fd.getAll("categories").map(String);
  if(role==="worker"&&categories.length===0) fail("/onboarding?role=worker","Elige al menos una categoría de jale");
  const {error}=await supabase.rpc("complete_onboarding",{p_name:s(fd,"full_name"),p_phone:s(fd,"phone"),p_role:role,p_municipality:s(fd,"municipality"),p_age:role==="worker"?Number(s(fd,"age")):null,p_zone:role==="worker"?s(fd,"zone"):null,p_categories:role==="worker"?fd.getAll("categories").map(String):null,p_availability:role==="worker"?s(fd,"availability"):null,p_employer_type:role==="employer"?s(fd,"employer_type"):null});
  if(error) fail(`/onboarding?role=${role}`,error.message);
  if(role==="worker")await supabase.rpc("replace_my_worker_skills",{p_items:skillItems(fd),p_category_names:categories});
  if(role==="employer"&&user.user_metadata?.referral_code){
    const {error:referralError}=await supabase.rpc("claim_referral",{p_code:String(user.user_metadata.referral_code)});
    if(referralError) fail("/onboarding?role=employer",referralError.message);
  }
  const {error:legalError}=await supabase.rpc("accept_current_legal",{p_version:String(user.user_metadata.legal_version??"2026-08-20")});
  if(legalError) fail(`/onboarding?role=${role}`,legalError.message);
  revalidatePath("/dashboard");
  redirect(`/${role}?welcome=1`);
}

export async function updateWorkerProfileAction(fd:FormData) {
  await requireUser("worker");
  const categories=fd.getAll("categories").map(String);
  if(categories.length===0) fail("/worker/profile","Elige al menos una categoría de jale");
  const supabase=await createClient();
  const {error}=await supabase.rpc("update_worker_profile",{p_name:s(fd,"full_name"),p_phone:s(fd,"phone"),p_municipality:s(fd,"municipality"),p_age:Number(s(fd,"age")),p_zone:s(fd,"zone"),p_categories:categories,p_availability:s(fd,"availability")});
  if(error) fail("/worker/profile",error.message);
  const {error:skillsError}=await supabase.rpc("replace_my_worker_skills",{p_items:skillItems(fd),p_category_names:categories});
  if(skillsError)console.warn("replace_my_worker_skills skipped:",skillsError.message);
  revalidatePath("/worker"); revalidatePath("/worker/profile");
  redirect(`/worker/profile?message=${encodeURIComponent("Perfil actualizado correctamente")}`);
}

export async function createJobAction(fd:FormData) {
  await requireUser("employer"); const supabase=await createClient();
  const {data,error}=await supabase.rpc("create_job",{p_title:s(fd,"title"),p_category:s(fd,"category"),p_description:s(fd,"description"),p_workers_needed:Number(s(fd,"workers_needed")),p_municipality:s(fd,"municipality"),p_zone:s(fd,"zone"),p_job_date:s(fd,"job_date"),p_start_time:s(fd,"start_time"),p_duration_hours:Number(s(fd,"duration_hours")),p_pay_amount:Number(s(fd,"pay_amount")),p_payment_method:s(fd,"payment_method"),p_notes:s(fd,"notes")||null});
  if(error) fail("/employer/jobs/new",error.message);
  const ids=idList(s(fd,"job_skill_ids"));
  if(ids.length){
    const {error:skillsError}=await supabase.rpc("replace_job_skills",{p_job_id:data.id,p_skill_ids:ids});
    if(skillsError)console.warn("replace_job_skills skipped:",skillsError.message);
  }
  revalidatePath("/employer");
  revalidatePath(`/employer/jobs/${data.id}`);
  redirect(`/employer/jobs/${data.id}?created=1`);
}
export async function reportPaymentAction(fd:FormData) { await requireUser("employer"); const supabase=await createClient(); const id=s(fd,"job_id"); const posts=Number(s(fd,"package_posts")||"1"); const {error}=await supabase.rpc("report_package_payment",{p_job_id:id,p_package_posts:posts}); if(error) fail(`/employer/jobs/${id}`,error.message); revalidatePath(`/employer/jobs/${id}`); redirect(`/employer/jobs/${id}?message=${encodeURIComponent("Transferencia reportada con su referencia. La revisaremos pronto.")}`); }
export async function applyAction(fd:FormData) { await requireUser("worker"); const supabase=await createClient(); const id=s(fd,"job_id"); const {error}=await supabase.rpc("apply_to_job",{p_job_id:id}); if(error) fail(`/jobs/${id}`,error.message); revalidatePath(`/jobs/${id}`); redirect(`/jobs/${id}?message=${encodeURIComponent("¡Listo! Avisaremos si te seleccionan.")}`); }
export async function withdrawAction(fd:FormData) { await requireUser("worker"); const supabase=await createClient(); const {error}=await supabase.rpc("withdraw_application",{p_application_id:s(fd,"application_id")}); if(error) fail("/worker/applications",error.message); revalidatePath("/worker/applications"); }
export async function selectApplicationAction(fd:FormData) { await requireUser("employer"); const supabase=await createClient(); const job=s(fd,"job_id"); const {error}=await supabase.rpc("select_application",{p_application_id:s(fd,"application_id")}); if(error) fail(`/employer/jobs/${job}`,error.message); revalidatePath(`/employer/jobs/${job}`); }
export async function respondSelectionAction(fd:FormData) { await requireUser("worker"); const supabase=await createClient(); const {error}=await supabase.rpc("respond_to_selection",{p_application_id:s(fd,"application_id"),p_accept:s(fd,"accept")==="true"}); if(error) fail("/worker/applications",error.message); revalidatePath("/worker/applications"); }
export async function workerFinishAction(fd:FormData) { await requireUser("worker"); const supabase=await createClient(); const {error}=await supabase.rpc("worker_finish_application",{p_application_id:s(fd,"application_id"),p_paid:s(fd,"paid")==="true",p_rating:Number(s(fd,"rating")),p_comment:s(fd,"comment")||null}); if(error) fail("/worker/applications",error.message); revalidatePath("/worker/applications"); }
export async function employerFinishAction(fd:FormData) { await requireUser("employer"); const supabase=await createClient(); const job=s(fd,"job_id"); const {error}=await supabase.rpc("employer_finish_application",{p_application_id:s(fd,"application_id"),p_presented:s(fd,"presented")==="true",p_rating:Number(s(fd,"rating")),p_comment:s(fd,"comment")||null}); if(error) fail(`/employer/jobs/${job}`,error.message); revalidatePath(`/employer/jobs/${job}`); }
export async function createReportAction(fd:FormData) { await requireUser("worker"); const supabase=await createClient(); const job=s(fd,"job_id"); const {error}=await supabase.rpc("create_report",{p_job_id:job,p_reason:s(fd,"reason"),p_details:s(fd,"details")||null}); if(error) fail(`/jobs/${job}`,error.message); redirect(`/jobs/${job}?message=${encodeURIComponent("Reporte enviado para revisión.")}`); }
export async function adminPaymentAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const confirm=s(fd,"confirm")==="true"; const {error}=await supabase.rpc("admin_review_payment",{p_payment_id:s(fd,"payment_id"),p_confirm:confirm,p_reason:s(fd,"reason")||null}); if(error) fail("/admin?tab=payments",error.message); revalidatePath("/admin"); redirect(`/admin?tab=payments&message=${encodeURIComponent(confirm?"Pago confirmado y jale publicado":"Pago rechazado")}`); }
export async function adminGoalsAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const {error}=await supabase.rpc("admin_update_goals",{p_monthly_revenue:Number(s(fd,"monthly_revenue")),p_monthly_completed_jobs:Number(s(fd,"monthly_completed_jobs")),p_total_users:Number(s(fd,"total_users")),p_monthly_paid_posts:Number(s(fd,"monthly_paid_posts"))}); if(error) fail("/admin?tab=goals",error.message); revalidatePath("/admin"); redirect(`/admin?tab=goals&message=${encodeURIComponent("Metas actualizadas")}`); }
export async function adminBillingSettingsAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const {error}=await supabase.rpc("admin_update_billing_settings",{p_charging_enabled:s(fd,"charging_enabled")==="true",p_free_posts:Number(s(fd,"free_posts")),p_founding_limit:Number(s(fd,"founding_limit")),p_apply_founders:s(fd,"apply_founders")==="true"}); if(error) fail("/admin/billing",error.message); revalidatePath("/admin/billing"); redirect(`/admin/billing?message=${encodeURIComponent("Reglas de cobro actualizadas")}`); }
export async function adminSavePackageAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const {error}=await supabase.rpc("admin_upsert_publication_package",{p_original_posts:s(fd,"original_posts")?Number(s(fd,"original_posts")):null,p_posts:Number(s(fd,"posts")),p_price:Number(s(fd,"price")),p_label:s(fd,"label")}); if(error) fail("/admin/billing",error.message); revalidatePath("/admin/billing"); redirect(`/admin/billing?message=${encodeURIComponent("Plan guardado")}`); }
export async function adminDeletePackageAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const {error}=await supabase.rpc("admin_delete_publication_package",{p_posts:Number(s(fd,"posts"))}); if(error) fail("/admin/billing",error.message); revalidatePath("/admin/billing"); redirect(`/admin/billing?message=${encodeURIComponent("Plan eliminado")}`); }
export async function adminEmployerBillingAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const {error}=await supabase.rpc("admin_update_employer_billing",{p_employer_id:s(fd,"employer_id"),p_billing_exempt:s(fd,"billing_exempt")==="true",p_free_post_credits:Number(s(fd,"free_post_credits")),p_reason:s(fd,"reason")||null}); if(error) fail("/admin/billing",error.message); revalidatePath("/admin/billing"); redirect(`/admin/billing?message=${encodeURIComponent("Beneficio del empleador actualizado")}`); }
export async function adminCreatePromoterAction(fd:FormData) {
  await requireUser("admin");
  const fullName=s(fd,"full_name"); const phone=s(fd,"phone"); const requestedCode=cleanCode(s(fd,"referral_code"));
  if(fullName.length<2)fail("/admin?tab=promoters","Escribe el nombre del promotor");
  if(!/^[0-9+ ()-]{10,20}$/.test(phone))fail("/admin?tab=promoters","Teléfono inválido");
  const code=requestedCode||cleanCode(fullName.split(/\s+/).slice(0,2).join("")+randomBytes(2).toString("hex"));
  if(code.length<4)fail("/admin?tab=promoters","El código debe tener mínimo 4 letras o números");
  const email=(s(fd,"email")||`promotor.${code.toLowerCase()}@jale.local`).toLowerCase();
  const password=s(fd,"password")||promoterPassword();
  if(password.length<8)fail("/admin?tab=promoters","La contraseña debe tener mínimo 8 caracteres");
  let authUserId="";
  try{
    const admin=createAdminClient();
    const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{intended_role:"promoter"}});
    if(createError||!created.user)throw new Error(createError?.message||"No se pudo crear el usuario");
    authUserId=created.user.id;
    const {error:profileError}=await admin.from("profiles").insert({id:authUserId,full_name:fullName,phone,role:"promoter",municipality:"Aguascalientes"});
    if(profileError)throw profileError;
    const {error:promoterError}=await admin.from("promoters").insert({user_id:authUserId,referral_code:code,status:"active"});
    if(promoterError)throw promoterError;
  }catch(error){
    if(authUserId){
      try{await createAdminClient().auth.admin.deleteUser(authUserId)}catch{}
    }
    fail("/admin?tab=promoters",error instanceof Error?error.message:"No se pudo crear el promotor");
  }
  revalidatePath("/admin");
  redirect(`/admin?tab=promoters&message=${encodeURIComponent(`Promotor creado. Usuario: ${email} | Contraseña: ${password} | Código: ${code}`)}`);
}
export async function adminPromoterStatusAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const {error}=await supabase.rpc("admin_update_promoter_status",{p_promoter_id:s(fd,"promoter_id"),p_status:s(fd,"status")}); if(error) fail("/admin?tab=promoters",error.message); revalidatePath("/admin"); redirect(`/admin?tab=promoters&message=${encodeURIComponent("Promotor actualizado")}`); }
export async function adminMarkCommissionsPaidAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const ids=fd.getAll("commission_ids").map(String).filter(Boolean); const {error}=await supabase.rpc("admin_mark_commissions_paid",{p_commission_ids:ids,p_reference:s(fd,"payout_reference"),p_notes:s(fd,"notes")||null}); if(error) fail("/admin?tab=promoters",error.message); revalidatePath("/admin"); redirect(`/admin?tab=promoters&message=${encodeURIComponent("Comisiones marcadas como pagadas")}`); }
export async function createSupportTicketAction(fd:FormData) { const {profile}=await requireUser(); if(profile.role==="admin") redirect("/admin?tab=system"); const supabase=await createClient(); const {error}=await supabase.rpc("create_support_ticket",{p_category:s(fd,"category"),p_title:s(fd,"title"),p_description:s(fd,"description"),p_page_context:s(fd,"page_context")||null,p_blocking:s(fd,"blocking")==="true"}); if(error) fail("/support",error.message); revalidatePath("/support"); redirect(`/support?message=${encodeURIComponent("Ticket enviado. Ya puedes consultar su seguimiento aquí.")}`); }
export async function adminSupportTicketAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const {error}=await supabase.rpc("admin_update_support_ticket",{p_ticket_id:s(fd,"ticket_id"),p_status:s(fd,"status"),p_priority:s(fd,"priority"),p_admin_notes:s(fd,"admin_notes")||null}); if(error) fail("/admin?tab=system",error.message); revalidatePath("/admin"); revalidatePath("/support"); redirect(`/admin?tab=system&message=${encodeURIComponent("Ticket actualizado")}`); }
export async function adminUserStatusAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const {error}=await supabase.rpc("admin_set_user_status",{p_user_id:s(fd,"user_id"),p_status:s(fd,"status")}); if(error) fail("/admin?tab=users",error.message); revalidatePath("/admin"); }
export async function adminJobStatusAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const {error}=await supabase.rpc("admin_set_job_status",{p_job_id:s(fd,"job_id"),p_status:s(fd,"status")}); if(error) fail("/admin?tab=jobs",error.message); revalidatePath("/admin"); }
export async function adminReportAction(fd:FormData) { await requireUser("admin"); const supabase=await createClient(); const {error}=await supabase.rpc("admin_review_report",{p_report_id:s(fd,"report_id"),p_status:s(fd,"status"),p_notes:s(fd,"notes")||null,p_remove_no_show:s(fd,"remove_no_show")==="true"}); if(error) fail("/admin?tab=reports",error.message); revalidatePath("/admin"); }
export async function cancelJobAction(fd:FormData) { await requireUser("employer"); const supabase=await createClient(); const {error}=await supabase.rpc("cancel_own_job",{p_job_id:s(fd,"job_id")}); if(error) fail(`/employer/jobs/${s(fd,"job_id")}`,error.message); revalidatePath("/employer"); redirect("/employer"); }
