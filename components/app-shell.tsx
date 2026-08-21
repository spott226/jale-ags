import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { MobileNav } from "@/components/mobile-nav";
import { JaleGuide } from "@/components/jale-guide";
export function AppShell({role,name,children}:{role:"worker"|"employer"|"admin";name:string;children:React.ReactNode}){
  const nav=role==="worker"?[["/worker","⚡","Descubrir"],["/worker/applications","✋","Postulaciones"],["/worker/profile","👤","Perfil"],["/support","🛠","Reportar error"]]:role==="employer"?[["/employer","📋","Mis jales"],["/employer/jobs/new","＋","Publicar"],["/support","🛠","Reportar error"]]:[["/admin","📊","Resumen"],["/admin?tab=payments","💳","Pagos"],["/admin/billing","⚙","Reglas de cobro"],["/admin?tab=employers","🏢","Empleadores"],["/admin?tab=workers","👷","Trabajadores"],["/admin?tab=jobs","🧤","Jales"],["/admin?tab=goals","🎯","Metas"],["/admin?tab=reports","⚠","Reportes personas"],["/admin?tab=system","🛠","Errores sistema"]];
  return <main className="app-layout"><aside className="app-rail"><Link href="/" className="rail-brand">JALE<span>.</span></Link><div className="rail-person"><small>Hola</small><strong>{name}</strong></div><nav aria-label="Navegación del panel">{nav.map(([href,icon,label])=><Link key={href} href={href}><b>{icon}</b><span>{label}</span></Link>)}</nav><form action={signOutAction}><button className="rail-logout">↗ <span>Salir</span></button></form></aside><div className="app-content">{children}</div><MobileNav role={role}/>{role!=="admin"&&<JaleGuide role={role}/>}</main>
}
