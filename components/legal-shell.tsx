import Link from "next/link";

export function LegalShell({eyebrow,title,updated,children}:{eyebrow:string;title:string;updated:string;children:React.ReactNode}){
  return <main className="legal-stage"><div className="legal-wrap"><Link href="/" className="legal-back">← Volver a Jale</Link><header className="legal-hero"><span>{eyebrow}</span><h1>{title}</h1><p>Última actualización: {updated}</p></header><div className="legal-grid"><aside><b>Documentos legales</b><Link href="/legal/terms">Términos y condiciones</Link><Link href="/legal/privacy">Aviso de privacidad</Link><Link href="/legal/safety">Seguridad y comunidad</Link></aside><article className="legal-document">{children}</article></div></div></main>;
}

export function LegalSection({title,children}:{title:string;children:React.ReactNode}){return <section><h2>{title}</h2>{children}</section>}
