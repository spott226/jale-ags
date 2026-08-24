"use client";
import Link from "next/link";
import { usePathname,useSearchParams } from "next/navigation";

type Role="worker"|"employer"|"admin"|"promoter";
type IconName="home"|"hand"|"user"|"tool"|"jobs"|"plus"|"card"|"alert"|"users";
const items:Record<Role,Array<{href:string;icon:IconName;label:string}>>={
  worker:[{href:"/worker",icon:"home",label:"Jales"},{href:"/worker/applications",icon:"hand",label:"Solicitudes"},{href:"/worker/profile",icon:"user",label:"Perfil"},{href:"/support",icon:"tool",label:"Ayuda"}],
  employer:[{href:"/employer",icon:"jobs",label:"Mis jales"},{href:"/employer/jobs/new",icon:"plus",label:"Publicar"},{href:"/support",icon:"tool",label:"Ayuda"}],
  admin:[{href:"/admin",icon:"home",label:"Inicio"},{href:"/admin?tab=payments",icon:"card",label:"Pagos"},{href:"/admin?tab=promoters",icon:"users",label:"Promotores"},{href:"/admin?tab=system",icon:"tool",label:"Errores"}],
  promoter:[{href:"/promoter",icon:"users",label:"Cartera"}],
};
function NavIcon({name}:{name:IconName}){const paths:Record<IconName,React.ReactNode>={home:<><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-7h6v7"/></>,hand:<><path d="M8 11V5a2 2 0 0 1 4 0v5"/><path d="M12 9V4a2 2 0 0 1 4 0v7M16 9V6a2 2 0 0 1 4 0v7c0 5-3 8-8 8h-1c-3 0-5-2-7-5l-1-2a2 2 0 0 1 3-2l2 2"/></>,user:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,tool:<><path d="M14 6a4 4 0 0 0-5-4l2 3-3 3-3-2a4 4 0 0 0 5 5l8 8a2 2 0 0 0 3-3l-8-8"/><path d="m5 19 5-5"/></>,jobs:<><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M8 11h8M8 15h5"/></>,plus:<><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,card:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,alert:<><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>};return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>}
export function MobileNav({role}:{role:Role}){const pathname=usePathname();const search=useSearchParams();return <nav className="mobile-nav" aria-label="Navegación principal">{items[role].map(item=>{const [path,query]=item.href.split("?");const wanted=query?new URLSearchParams(query).get("tab"):null;const active=pathname===path&&(wanted?search.get("tab")===wanted:!search.get("tab"));return <Link key={item.href} href={item.href} className={active?"active":""} aria-current={active?"page":undefined}><NavIcon name={item.icon}/><span>{item.label}</span></Link>})}</nav>}
