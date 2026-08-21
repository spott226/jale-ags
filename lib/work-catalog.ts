import { createClient } from "@/lib/supabase/server";

export type CatalogCategory={id:number|null;name:string;slug:string;featured:boolean};
export type CatalogSkill={id:number;category_id:number;name:string;requires_verification:boolean;trust_level:"standard"|"trusted"|"credentialed"};
export type SkillSelection={skill_id:number;level:"helper"|"capable"|"experienced"};

const FALLBACK_NAMES=[
  "Ayudante general","Carga y descarga","Mudanzas","Construcción","Pintura","Electricidad","Plomería",
  "Carpintería y muebles","Herrería y metal","Limpieza","Jardinería","Campo y actividades agrícolas",
  "Eventos","Mesero y servicio de alimentos","Barra y bebidas","Cocina","Almacén y bodega","Inventarios",
  "Tiendas y comercio","Promotores y activaciones","Repartos, mandados y diligencias","Chofer y traslado",
  "Oficina y captura","Tecnología y computación","Fotografía, video y contenido","Redes sociales y promoción digital",
  "Belleza y cuidado personal","Decoración","Florería","Mascotas","Lavado y limpieza de vehículos",
  "Mecánica y vehículos","Instalaciones y montaje","Audio, iluminación y eventos técnicos","Costura y textiles",
  "Empaque y producción","Ferias, mercados y tianguis","Restaurantes y comida rápida","Hoteles y hospedaje",
  "Lavandería","Escuelas, cursos y talleres","Logística","Volanteo y publicidad física",
  "Atención al cliente temporal","Cobro y caja","Seguridad y control de acceso",
  "Limpieza de terrenos y exteriores","Recolección y separación","Armado de pedidos y comercio electrónico",
  "Trabajos sencillos por encargo","Otro",
] as const;

const FEATURED=new Set([0,1,2,3,4,9,10,11,12,13,14,15,16,17,18,20,22,23,50]);
const slugify=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," y ").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

export const FALLBACK_CATALOG:CatalogCategory[]=FALLBACK_NAMES.map((name,index)=>({id:null,name,slug:slugify(name),featured:FEATURED.has(index)}));

export async function getCatalogCategories(){
  const supabase=await createClient();
  const {data,error}=await supabase.from("work_categories").select("id,name,slug,featured").eq("active",true).order("featured",{ascending:false}).order("sort_order").limit(100);
  return !error&&data?.length?data as CatalogCategory[]:FALLBACK_CATALOG;
}

