import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions";

export async function AuthHeader(){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return <Link className="login-link" href="/auth?mode=login">INICIAR SESIÓN</Link>;
  return <nav className="flex items-center gap-2"><Link className="btn btn-soft !min-h-10 !px-4" href="/dashboard">Mi panel</Link><form action={signOutAction}><button className="btn btn-primary !min-h-10 !px-4">Salir</button></form></nav>;
}
