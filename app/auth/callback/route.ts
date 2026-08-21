import { NextResponse,type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request:NextRequest){
  const url=new URL(request.url); const code=url.searchParams.get("code");
  const requested=url.searchParams.get("next"); const next=requested==="/auth/reset-password"?requested:"/dashboard";
  if(code){const supabase=await createClient();const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(next,url.origin));}
  return NextResponse.redirect(new URL(`/auth/forgot?error=${encodeURIComponent("El enlace venció o no es válido. Solicita uno nuevo")}`,url.origin));
}
