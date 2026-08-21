import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request:NextRequest){
  const categoryId=Number(request.nextUrl.searchParams.get("categoryId"));
  if(!Number.isInteger(categoryId)||categoryId<1)return NextResponse.json({skills:[]});
  const supabase=await createClient();
  const {data,error}=await supabase.from("work_skills")
    .select("id,category_id,name,requires_verification,trust_level")
    .eq("category_id",categoryId).eq("active",true).order("sort_order").limit(250);
  if(error)return NextResponse.json({skills:[]},{status:503});
  return NextResponse.json({skills:data??[]},{headers:{"Cache-Control":"public, max-age=300, s-maxage=86400, stale-while-revalidate=604800"}});
}

