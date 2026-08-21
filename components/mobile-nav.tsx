"use client";
import Link from "next/link";
import { usePathname,useSearchParams } from "next/navigation";

type Role="worker"|"employer"|"admin";
const items:Record<Role,Array<{href:string;icon:string;label:string}>>={
  worker:[{href:"/worker",icon:"⚡",label:"Jales"},{href:"/worker/applications",icon:"✋",label:"Postulaciones"},{href:"/worker/profile",icon:"👤",label:"Mi perfil"},{href:"/support",icon:"🛠",label:"Soporte"}],
  employer:[{href:"/employer",icon:"📋",label:"Mis jales"},{href:"/employer/jobs/new",icon:"＋",label:"Publicar"},{href:"/support",icon:"🛠",label:"Soporte"}],
  admin:[{href:"/admin",icon:"📊",label:"Resumen"},{href:"/admin?tab=payments",icon:"💳",label:"Pagos"},{href:"/admin?tab=reports",icon:"⚠",label:"Reportes"},{href:"/admin?tab=system",icon:"🛠",label:"Errores"}],
};
export function MobileNav({role}:{role:Role}){const pathname=usePathname();const search=useSearchParams();return <nav className="mobile-nav" aria-label="Navegación principal">{items[role].map(item=>{const [path,query]=item.href.split("?");const wanted=query?new URLSearchParams(query).get("tab"):null;const active=pathname===path&&(wanted?search.get("tab")===wanted:!search.get("tab"));return <Link key={item.href} href={item.href} className={active?"active":""}><span>{item.icon}</span><span>{item.label}</span></Link>})}</nav>}
