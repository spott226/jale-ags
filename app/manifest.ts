import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name:"Jale — Hoy buscas. Mañana jalas.",short_name:"Jale",description:"Jales eventuales en Aguascalientes. Sin CV y con pago visible.",id:"/",start_url:"/",scope:"/",display:"standalone",orientation:"portrait-primary",background_color:"#f7f6ff",theme_color:"#30247c",lang:"es-MX",icons:[{src:"/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},{src:"/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},{src:"/icon-maskable-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}] };
}
