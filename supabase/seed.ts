import { createClient, type User } from "@supabase/supabase-js";
import { candidateLimit } from "../lib/config";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const password=process.env.DEMO_PASSWORD;
if(!url||!key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
if(!password||password.length<12) throw new Error("Define DEMO_PASSWORD con al menos 12 caracteres. No se guarda en el repositorio.");
const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});

async function demoUser(email:string,role:"worker"|"employer"|"admin") {
  const {data:list,error:listError}=await db.auth.admin.listUsers({perPage:1000}); if(listError)throw listError;
  let user=list.users.find(u=>u.email===email);
  if(!user){const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{intended_role:role}});if(error)throw error;user=data.user;}
  return user as User;
}
const date=(offset:number)=>{const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)};

async function main(){
  const admin=await demoUser(process.env.DEMO_ADMIN_EMAIL??"admin.demo@jale.local","admin");
  await db.from("profiles").upsert({id:admin.id,full_name:"Administración Jale",phone:"4490000000",role:"admin",municipality:"Aguascalientes"});
  const workerNames=["Ana López","Brenda Martínez","Carlos Hernández","Diana García","Eduardo Ramírez","Fernanda Ortiz","Gabriel Flores","Hilda Chávez","Iván Torres","Julia Reyes","Kevin Cruz","Laura Díaz","Mario Vázquez","Nadia Soto","Óscar Medina","Paola Ríos","Raúl Luna","Sofía Campos","Tomás Navarro","Valeria Silva"];
  const categories=["Mudanzas","Limpieza","Eventos","Carga y descarga","Construcción","Mesero","Almacén","Inventarios","Pintura","Jardinería","Ayudante general","Campo"];
  const workers:User[]=[];
  for(let i=0;i<20;i++){const u=await demoUser(`worker${i+1}.demo@jale.local`,"worker");workers.push(u);await db.from("profiles").upsert({id:u.id,full_name:workerNames[i],phone:`449100${String(i+1).padStart(4,"0")}`,role:"worker",municipality:i%5===0?"Jesús María":"Aguascalientes"});await db.from("workers").upsert({profile_id:u.id,age:20+(i%28),zone:i%3===0?"Centro":i%3===1?"Ojocaliente":"Morelos",categories:[categories[i%categories.length],"Ayudante general"],availability:i%2?"Entre semana por la mañana":"Fines de semana",opportunity_score:55+(i%8)*5,completed_jobs:i%5,no_show_count:i===7?1:0,rating_average:i%4===0?null:4+(i%10)/10,attendance_rate:i%4===0?null:90+(i%10)});}
  const employerNames=["Mudanzas El Rayo","Eventos La Feria","Abarrotes Lupita","Jardines del Centro","Carlos Particular"];
  const employers:User[]=[];
  for(let i=0;i<5;i++){const u=await demoUser(`employer${i+1}.demo@jale.local`,"employer");employers.push(u);await db.from("profiles").upsert({id:u.id,full_name:employerNames[i],phone:`449200${String(i+1).padStart(4,"0")}`,role:"employer",municipality:"Aguascalientes"});await db.from("employers").upsert({profile_id:u.id,employer_type:i===4?"Persona":"Negocio",free_posts_used:2,rating_average:4.2+(i/10)});}
  const specs=[
    ["Ayuda para mudanza en Centro","Mudanzas",3,700,1,"open"],["Carga de cajas en bodega","Carga y descarga",4,550,2,"open"],["Meseros para evento familiar","Mesero",5,800,3,"candidates_available"],["Limpieza después de evento","Limpieza",3,650,4,"open"],["Apoyo para inventario","Inventarios",6,600,5,"filled"],
    ["Pintar una barda","Pintura",2,900,6,"open"],["Ayudantes para jardín","Jardinería",2,650,7,"awaiting_payment"],["Montaje de mesas y sillas","Eventos",5,700,2,"filled"],["Descarga de material","Construcción",4,750,3,"open"],["Cosecha por dos días","Campo",8,1200,5,"candidates_available"],
    ["Ordenar mercancía","Almacén",3,600,-5,"completed"],["Ayuda general en local","Ayudante general",2,500,-4,"completed"],["Mudanza corta en Morelos","Mudanzas",2,650,-3,"completed"],["Limpieza de patio","Limpieza",1,450,8,"awaiting_payment"],["Carga para feria","Carga y descarga",10,850,9,"open"]
  ] as const;
  await db.from("ratings").delete().like("comment","Demo:%");
  await db.from("applications").delete().in("worker_id",workers.map(w=>w.id));
  await db.from("payments").delete().in("employer_id",employers.map(e=>e.id));
  await db.from("jobs").delete().in("employer_id",employers.map(e=>e.id));
  const jobIds:string[]=[];
  for(let i=0;i<specs.length;i++){const [title,category,needed,pay,offset,status]=specs[i];const {data,error}=await db.from("jobs").insert({employer_id:employers[i%5].id,title,category,description:`Jale demo: ${title.toLowerCase()}. Actividad clara y eventual.`,workers_needed:needed,municipality:i%4===0?"Jesús María":"Aguascalientes",zone:i%3===0?"Centro":i%3===1?"Ojocaliente":"Morelos",job_date:date(offset),start_time:i%2?"09:00":"08:00",duration_hours:status==="completed"?4:6,pay_amount:pay,payment_method:i%2?"transferencia":"efectivo",status,paid:status!=="awaiting_payment",candidate_limit:candidateLimit(needed),published_at:status!=="awaiting_payment"?new Date().toISOString():null,filled_at:["filled","completed"].includes(status)?new Date().toISOString():null}).select("id").single();if(error)throw error;jobIds.push(data.id);}
  for(let i=0;i<jobIds.length;i++){const status=specs[i][5];const appCount=status==="filled"?specs[i][2]:status==="completed"?specs[i][2]:status==="candidates_available"?3:Math.min(1,specs[i][2]);if(status==="awaiting_payment")continue;for(let a=0;a<appCount;a++){const finalStatus=status==="completed"?"completed":status==="filled"?"confirmed":"interested";const completed=finalStatus==="completed";const {data,error}=await db.from("applications").insert({job_id:jobIds[i],worker_id:workers[(i*2+a)%workers.length].id,status:finalStatus,opportunity_score_at_apply:60+(a*5),confirmed_at:finalStatus!=="interested"?new Date().toISOString():null,worker_completed_at:completed?new Date().toISOString():null,employer_completed_at:completed?new Date().toISOString():null,presented:completed?true:null,paid_as_agreed:completed?true:null,completed_at:completed?new Date().toISOString():null}).select("id,worker_id").single();if(error)throw error;if(completed){await db.from("ratings").insert([{application_id:data.id,rater_id:employers[i%5].id,rated_id:data.worker_id,direction:"employer_to_worker",score:4+(a%2),comment:"Demo: buen trabajo"},{application_id:data.id,rater_id:data.worker_id,rated_id:employers[i%5].id,direction:"worker_to_employer",score:5,comment:"Demo: pago acordado"}]);}}}
  for(const i of [6,13])await db.from("payments").insert({job_id:jobIds[i],employer_id:employers[i%5].id,reference:`JALE-DEMO${i}`,amount:50,status:"reported"});
  console.log("Seed listo: 20 trabajadores, 5 empleadores, 15 jales y 1 admin.");
  console.log(`Admin: ${process.env.DEMO_ADMIN_EMAIL??"admin.demo@jale.local"}`);console.log("Trabajador: worker1.demo@jale.local");console.log("Empleador: employer1.demo@jale.local");console.log("Contraseña: la definida en DEMO_PASSWORD.");
}
main().catch(error=>{console.error(error);process.exit(1)});
