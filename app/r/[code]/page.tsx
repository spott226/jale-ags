import { redirect } from "next/navigation";

export default async function ReferralPage({params}:{params:Promise<{code:string}>}) {
  const {code}=await params;
  const clean=code.replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,24);
  redirect(`/auth?role=employer&mode=signup&ref=${encodeURIComponent(clean)}`);
}
