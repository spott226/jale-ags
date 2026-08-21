import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name:"Jale",short_name:"Jale",description:"Hoy buscas. Mañana jalas.",start_url:"/",display:"standalone",background_color:"#f7f6ff",theme_color:"#5b45e0",lang:"es-MX",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"},{src:"/icon-maskable.svg",sizes:"any",type:"image/svg+xml",purpose:"maskable"}] };
}
