import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
export default async function Dashboard(){const {profile}=await requireUser();redirect(`/${profile.role}`);}
