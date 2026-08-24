import { AppShell } from "@/components/app-shell";
import { Notice } from "@/components/notice";
import { requireUser } from "@/lib/auth";
import { money } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

type ClientRow={name:string;type:string;attributed_at:string;purchases:number;spent:number;last_purchase:string|null};
type CommissionRow={id:string;client:string;gross_amount:number;commission_amount:number;status:string;earned_at:string;paid_at:string|null;payout_reference:string|null};
type PromoterData={promoter:{id:string;code:string;status:string};summary:{clients:number;sales:number;pending:number;paid:number};clients:ClientRow[];commissions:CommissionRow[]};

export default async function PromoterPage() {
  const {profile}=await requireUser("promoter");
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("promoter_dashboard");
  const info=data as PromoterData|null;
  const site=(process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000").replace(/\/$/,"");
  return <AppShell role="promoter" name={profile.full_name}>
    <section className="admin-hero"><div><span>PANEL PROMOTOR</span><h1>Tu cartera,<br/>clara.</h1><p>Clientes referidos, compras confirmadas y comisiones pendientes.</p></div><div className="admin-live"><i/> $50 o $100 por venta</div></section>
    {error&&<div className="mb-4"><Notice type="error">No se pudo cargar tu panel: {error.message}</Notice></div>}
    {info&&<><div className="admin-kpis"><Kpi tone="cyan" label="Clientes en cartera" value={String(info.summary.clients)} note="Empleadores ligados a tu código"/><Kpi tone="blue" label="Ventas generadas" value={money(info.summary.sales)} note="Pagos confirmados"/><Kpi tone="pink" label="Comisión pendiente" value={money(info.summary.pending)} note="Pendiente de transferir"/><Kpi tone="navy" label="Comisión pagada" value={money(info.summary.paid)} note="Historial liquidado"/></div>
      <section className="admin-section"><div className="admin-section-head"><div><small>MI CÓDIGO</small><h2>{info.promoter.code}</h2></div><span>{info.promoter.status}</span></div><div className="card p-5"><p className="muted">Comparte este enlace con negocios o personas que ocupan gente:</p><p className="private-data mt-3"><b>{site}/r/{info.promoter.code}</b></p></div></section>
      <section className="admin-section"><div className="admin-section-head"><div><small>MIS CLIENTES</small><h2>Mi cartera</h2></div><span>{info.clients.length} clientes</span></div><div className="admin-list">{info.clients.map(client=><article className="person-card billing-person" key={`${client.name}-${client.attributed_at}`}><div><div className="person-avatar company">{client.type==="Negocio"?"🏢":"👤"}</div><div className="person-name"><b>{client.name}</b><span>{client.type} · alta {new Date(client.attributed_at).toLocaleDateString("es-MX")}</span></div><div className="person-highlight"><b>{client.purchases}</b><span>compras</span></div></div><div className="detail-grid mt-4"><Metric label="Gasto total" value={money(client.spent)}/><Metric label="Última compra" value={client.last_purchase?new Date(client.last_purchase).toLocaleDateString("es-MX"):"—"}/></div></article>)}{!info.clients.length&&<Empty title="Sin clientes todavía" text="Cuando alguien se registre con tu enlace, aparecerá aquí."/>}</div></section>
      <section className="admin-section"><div className="admin-section-head"><div><small>MIS COMISIONES</small><h2>Comisión por compra</h2></div><span>{info.commissions.length} movimientos</span></div><div className="admin-list">{info.commissions.map(c=><article className="person-card billing-person" key={c.id}><div><div className="person-avatar">💵</div><div className="person-name"><b>{c.client}</b><span>{new Date(c.earned_at).toLocaleDateString("es-MX")} · compra {money(c.gross_amount)}</span></div><span className={c.status==="paid"?"billing-badge free":"billing-badge"}>{c.status==="paid"?"Pagada":"Pendiente"}</span></div><div className="detail-grid mt-4"><Metric label="Comisión" value={money(c.commission_amount)}/><Metric label="Referencia" value={c.payout_reference??"—"}/></div></article>)}{!info.commissions.length&&<Empty title="Sin comisiones" text="Las comisiones aparecen cuando admin confirma pagos de tus clientes."/>}</div></section></>}
  </AppShell>;
}

function Kpi({label,value,note,tone}:{label:string;value:string;note:string;tone:string}){return <article className={`admin-kpi ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function Metric({label,value}:{label:string;value:string|number}){return <div className="admin-metric"><strong>{value}</strong><span>{label}</span></div>}
function Empty({title,text}:{title:string;text:string}){return <div className="card p-7 text-center"><h3 className="font-black text-xl">{title}</h3><p className="muted mt-1">{text}</p></div>}
