import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

export async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: rpcProfiles, error: rpcError } = await supabase.rpc("get_my_profile");
  let profile=(rpcProfiles?.[0]??null) as Profile|null;
  if(rpcError){
    const {data:fallback}=await supabase.from("profiles").select("id,full_name,phone,role,status,municipality").eq("id",user.id).maybeSingle();
    profile=fallback as Profile|null;
  }
  return { user, profile };
}

export async function requireUser(role?: Role) {
  const session = await currentUser();
  if (!session) redirect(`/auth?next=${role ? `/${role}` : "/dashboard"}`);
  if (!session.profile) {
    const intended=session.user.user_metadata?.intended_role==="employer"?"employer":"worker";
    redirect(`/onboarding?role=${intended}`);
  }
  if (session.profile.status !== "active") redirect("/account-restricted");
  if (role && session.profile.role !== role && session.profile.role !== "admin") redirect("/dashboard");
  return { user: session.user, profile: session.profile };
}
