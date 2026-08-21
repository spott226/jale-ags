import Link from "next/link";

const jobs=["Carga y descarga mañana","Meseros para este sábado","Ayuda para una mudanza","Limpieza por un día","Apoyo en un evento"];
const humanPhrases=["A veces la lana no alcanza","Tengo tiempo libre mañana","Ocupo completar para la renta","Quiero ganar un extra esta semana","Busco algo rápido y claro","Quiero sacar adelante a mi familia","Hoy sí puedo jalar"];

export default function Home(){return <main className="landing-modern">
  <section className="landing-stage">
    <div className="landing-glow landing-glow-one"/><div className="landing-glow landing-glow-two"/>
    <div className="ambient-phrases" aria-hidden="true">{humanPhrases.map((phrase,index)=><span key={phrase} style={{animationDelay:`${index*3.4}s`}}>{phrase}</span>)}</div>
    <div className="shell relative z-10 grid min-h-[calc(100svh-4rem)] place-items-center py-10 md:py-16"><div className="w-full max-w-5xl text-center">
      <div className="landing-kicker animate-in"><span className="live-dot"/> Jales eventuales en Aguascalientes</div>
      <h1 className="landing-title animate-in">Hoy buscas.<br/><span>Mañana jalas.</span></h1>
      <p className="landing-copy animate-in">Trabajo por horas o días. Pago visible desde el inicio.<br className="hide-mobile"/> Sin CV, entrevistas eternas ni largas esperas.</p>
      <div className="phrase-stage animate-in" aria-label="Ejemplos de jales"><span className="phrase-label">Ahora se busca</span><div className="phrase-window">{jobs.map((phrase,index)=><span key={phrase} style={{animationDelay:`${index*2.4}s`}}>{phrase}</span>)}</div></div>
      <div className="landing-actions animate-in">
        <Link href="/auth?role=worker&amp;mode=signup" className="choice-card choice-worker"><span className="choice-icon">$</span><span><small>CREAR CUENTA PARA GANAR DINERO</small><strong>BUSCO JALE</strong><em>Registrarme como trabajador →</em></span></Link>
        <Link href="/auth?role=employer&amp;mode=signup" className="choice-card choice-employer"><span className="choice-icon">+</span><span><small>CREAR CUENTA PARA CONTRATAR</small><strong>OCUPO GENTE</strong><em>Registrarme como empleador →</em></span></Link>
      </div>
      <div className="landing-proof animate-in"><span>✓ Buscar es gratis</span><span>✓ Pago siempre visible</span><span>✓ Máximo 2 semanas</span></div>
    </div></div>
    <div className="marquee"><div>{[...jobs,...jobs].map((x,i)=><span key={`${x}-${i}`}>✦ {x}</span>)}</div></div>
  </section>
  <section className="commitment-section"><div className="shell">
    <div className="commitment-intro"><span>NUESTRO COMPROMISO</span><h2>Una oportunidad clara puede cambiarte la semana.</h2><p>Jale nació para acercar trabajos eventuales a quienes necesitan un ingreso extra y manos confiables a quienes necesitan resolver algo hoy, sin CV ni procesos eternos.</p></div>
    <div className="commitment-grid"><article><b>01</b><h3>Pago claro</h3><p>El monto se muestra antes de que alguien diga “Me interesa”. Sin promesas escondidas.</p></article><article><b>02</b><h3>Decisiones rápidas</h3><p>Jales por horas, días o hasta dos semanas; con selección y confirmación dentro de la plataforma.</p></article><article><b>03</b><h3>Comunidad responsable</h3><p>Calificaciones, reportes, no-shows y revisión administrativa para detectar conductas que dañan la confianza.</p></article></div>
    <div className="impact-note"><strong>¿Por qué lo hacemos?</strong><p>En Aguascalientes, el INEGI estimó más de <b>14 mil personas subocupadas</b> durante el segundo trimestre de 2025: personas con necesidad y disponibilidad para trabajar más horas. Queremos que encontrar ese ingreso adicional sea más directo y digno.</p><a href="https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2025/enoe/enoe2025_08_Ags.pdf" target="_blank" rel="noreferrer">Consultar fuente oficial del INEGI ↗</a></div>
    <div className="about-jale"><div><span>ACERCA DE NOSOTROS</span><h2>Hecho en Aguascalientes.</h2></div><p>Jale es una iniciativa desarrollada por <b>Mercadía</b> en Aguascalientes. Construimos tecnología sencilla para conectar necesidades reales, proteger la información y hacer más claro cada acuerdo.</p></div>
  </div></section>
</main>}
