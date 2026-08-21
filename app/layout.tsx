import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { AuthHeader } from "@/components/auth-header";
import { Suspense } from "react";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Jale — Hoy buscas. Mañana jalas.", template: "%s | Jale" },
  description: "Jales eventuales en Aguascalientes. Sin CV. Pago visible. Oportunidades rápidas.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url:"/favicon-32.png",sizes:"32x32",type:"image/png" },{ url:"/icon-192.png",sizes:"192x192",type:"image/png" }],
    shortcut: "/favicon-32.png",
    apple: [{ url:"/apple-touch-icon.png",sizes:"180x180",type:"image/png" }],
  },
  openGraph: { title: "Jale", description: "Hoy buscas. Mañana jalas.", type: "website", locale: "es_MX" },
};
export const viewport: Viewport = { themeColor: "#30247c", width: "device-width", initialScale:1, maximumScale:1, userScalable:false, viewportFit:"cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>
    <header className="site-header border-b border-[#e7e4f2] bg-white/95 sticky top-0 z-20">
      <div className="shell flex min-h-16 items-center justify-between gap-4">
        <Link href="/" className="text-2xl font-black tracking-[-.06em]">JALE<span className="brand-dot">.</span></Link>
        <Suspense fallback={<span/>}><AuthHeader/></Suspense>
      </div>
    </header>
    {children}<PwaRegister/>
    <footer className="site-footer"><div className="shell footer-inner"><div><b>JALE<span className="brand-dot">.</span></b><p>Hoy buscas. Mañana jalas.</p></div><nav aria-label="Información legal"><Link href="/legal/terms">Términos</Link><Link href="/legal/privacy">Privacidad</Link><Link href="/legal/safety">Seguridad</Link></nav><small>Desarrollado por Mercadía · Aguascalientes, México</small></div></footer>
  </body></html>;
}
