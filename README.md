# Jale

MVP móvil/PWA de jales eventuales en Aguascalientes. **Hoy buscas. Mañana jalas.**

Incluye trabajador, empleador y administración; Supabase Auth/PostgreSQL; límites de candidatos; máximo de tres postulaciones activas; publicaciones gratuitas y excepciones configurables; paquetes de publicaciones con pago manual y referencia única; selección, confirmación con choques de horario, finalización bilateral, ratings, no-shows, reportes, métricas, RLS y datos demo.

## 1. Requisitos

- Node.js 22+
- npm 10+
- Un proyecto de Supabase
- Una cuenta de Railway para publicar la aplicación

Supabase es la fuente única de Auth y PostgreSQL. No cree otra base PostgreSQL en Railway: dividir Auth y datos causaría conflictos innecesarios.

## 2. Configurar Supabase

1. Cree un proyecto en Supabase.
2. Abra **SQL Editor** y ejecute, en orden, todos los archivos de `supabase/migrations/`, del `202608200001_initial.sql` al `202608200011_work_catalog_data.sql`.
3. En **Authentication → URL Configuration**, agregue:
   - Local: `http://localhost:3000/**`
   - Railway: `https://SU-DOMINIO.up.railway.app/**`
4. Para una prueba rápida entre dos celulares puede desactivar temporalmente la confirmación de correo. Para producción, manténgala activa y configure SMTP.
5. Copie `.env.example` a `.env.local` y rellene los valores.

Variables públicas necesarias:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_BANK_NAME=...
NEXT_PUBLIC_BANK_ACCOUNT=...
NEXT_PUBLIC_BANK_BENEFICIARY=...
NEXT_PUBLIC_POST_PRICE_MXN=50
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=una-clave-base64-estable-de-32-bytes
```

`SUPABASE_SERVICE_ROLE_KEY` sólo se usa para cargar el demo localmente. Nunca debe llevar el prefijo `NEXT_PUBLIC_`, llegar al navegador ni quedar en Git. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` debe ser el mismo en todas las réplicas del mismo entorno, especialmente en Railway.

## 3. Datos demo

### Activar la cuenta superadmin

1. Crea y confirma una cuenta exclusiva desde Jale y termina sus datos básicos.
2. Ejecuta todas las migraciones, incluida `supabase/migrations/202608200004_admin_console.sql`.
3. En Supabase SQL Editor ejecuta, reemplazando el correo:

```sql
select public.bootstrap_superadmin('tu-correo-admin@dominio.com');
```

La función sólo puede ejecutarse desde SQL Editor; la aplicación pública no tiene permiso para promover administradores. Cierra sesión y vuelve a entrar. `/dashboard` abrirá la consola superadmin.

El seed crea 20 trabajadores, 5 empleadores, 15 jales y un admin. Exige una contraseña elegida por usted; el repositorio no contiene contraseñas reutilizables.

```powershell
$env:DEMO_PASSWORD="una-frase-larga-y-unica"
$env:DEMO_ADMIN_EMAIL="su-correo-admin@dominio.com"
npm run seed
```

Cuentas resultantes:

- Admin: el correo de `DEMO_ADMIN_EMAIL`
- Trabajador: `worker1.demo@jale.local`
- Empleador: `employer1.demo@jale.local`
- Contraseña: la definida en `DEMO_PASSWORD`

En producción cambie la contraseña del admin, elimine cuentas demo que no necesite y no defina `SUPABASE_SERVICE_ROLE_KEY` en Vercel/Railway.

## 4. Desarrollo y validación

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

La migración concentra las transiciones sensibles en funciones transaccionales `security definer`; la interfaz no decide cupos, publicaciones gratis, límites, horarios ni permisos. `supabase/tests/rls_verification.sql` contiene verificaciones pgTAP de políticas y fórmula de cupos para una base de pruebas con pgTAP habilitado.

## 5. Publicar en Railway

1. Cree un servicio desde este repositorio, no un servicio PostgreSQL separado.
2. Railway usará `Dockerfile` y `railway.toml`; Next escucha el `PORT` dinámico mediante su servidor standalone.
3. Agregue las mismas variables públicas que en Vercel y use el dominio Railway para `NEXT_PUBLIC_SITE_URL`.
4. Agregue ese dominio a Supabase Auth. Railway comprobará `/api/health`.

Railway aloja Next.js; Supabase conserva autenticación y base de datos. No es necesario pagar ni mantener un segundo despliegue en Vercel.

## 6. Configuración funcional

Los parámetros editables están en `app_settings`:

- `billing_config`: activa o pausa los cobros y define cuántos empleadores fundadores reciben publicaciones gratuitas
- `free_posts`: publicaciones base gratuitas para cada empleador
- `publication_packages`: paquetes de 1, 5 y 10 publicaciones y sus precios
- `max_active_applications`: 3
- `candidate_caps`: fórmula de cupos
- `opportunity_score`: pesos determinísticos

El superadmin cambia reglas, crea/edita/elimina planes, administra precios, excepciones y créditos desde **Reglas de cobro**. Cada transferencia usa una referencia `JALE-XXXXXXXX`; al confirmar un paquete, el jale actual se abre y las publicaciones restantes se acreditan al empleador.

## 7. Privacidad y seguridad

- Los teléfonos están en `profiles`, cuya lectura normal es sólo propia o admin.
- Un empleador obtiene teléfonos exclusivamente mediante `get_job_candidates` cuando ya seleccionó al trabajador.
- Un trabajador obtiene el contacto relacionado mediante `get_contact_for_application` sólo después de selección/confirmación.
- No hay escritura directa para roles, reputación, beneficios, jales, postulaciones ni pagos; se usan RPCs que vuelven a comprobar dueño, rol, estado y cupo bajo bloqueo de fila.
- Un empleador no puede gestionar jales ajenos y un trabajador no puede modificar publicaciones.
- Suspensiones y bloqueos siempre son manuales desde administración.

Antes de producción: active MFA para el admin, SMTP confiable, protección de contraseñas filtradas, backups/PITR según su plan, logs y alertas de Supabase, y revise los datos bancarios visibles.

### Documentos legales

La aplicación publica `/legal/terms`, `/legal/privacy` y `/legal/safety`; el registro obliga a aceptar los dos primeros y la base conserva fecha y versión. Antes del lanzamiento comercial es obligatorio:

- Sustituir en los documentos la identidad legal completa de Mercadía, RFC, domicilio y correo de privacidad.
- Encargar a un abogado mexicano la revisión final de los textos, del modelo de intermediación, la relación con usuarios y los mecanismos de queja.
- Definir y operar el procedimiento de derechos ARCO, conservación/eliminación de datos e incidentes de seguridad.
- Revisar con contabilidad la facturación, impuestos y comprobantes de las cuotas por publicación.

Las cláusulas de intermediación y limitación de responsabilidad no eliminan obligaciones legales irrenunciables ni cubren fallas directamente imputables a la plataforma.

## 8. Experiencia guiada y PWA

`Jali` presenta un tutorial distinto a trabajadores y empleadores. El usuario puede omitirlo y volver a abrirlo desde “Aquí estoy para ayudarte”; la preferencia se guarda sólo en su dispositivo. El manifest y los iconos usan la identidad azul-violeta y la interfaz contempla anchos móviles de 360 px en adelante.

## 9. Lista de aceptación (14 puntos)

1. `npm run typecheck` pasa.
2. `npm run lint` pasa.
3. `npm run build` pasa.
4. No quedan errores de las tres comprobaciones.
5. Pruebe: publicar → interesarse → seleccionar → confirmar.
6. En Android/Chrome compruebe 360 px, botones táctiles y “Instalar aplicación”.
7. Ejecute `supabase/tests/rls_verification.sql` en una base de pruebas.
8. Con dos empleadores, intente abrir/alterar el UUID ajeno: la RPC y RLS deben rechazarlo.
9. Verifique el número configurable de publicaciones gratuitas desde el panel superadmin.
10. Al agotarlas, el jale queda `awaiting_payment` y permite elegir un paquete con referencia `JALE-XXXXXXXX`.
11. Admin confirma: pago `confirmed`, jale `open`, `paid=true`, `confirmed_at` guardado.
12. Un trabajador con tres aplicaciones activas recibe rechazo al intentar la cuarta.
13. Compruebe cupos: 1→5, 2→6, 3→8, 4→8, 6→11, 11→17.
14. Empleador selecciona; trabajador confirma; después del horario ambos finalizan y califican. Un “No” en asistencia crea reporte/no-show; un “No” en pago crea reporte.

## Estructura

- `app/`: rutas, paneles y acciones del servidor
- `components/`: interfaz móvil reutilizable
- `lib/config.ts`: reglas legibles y pruebas unitarias
- `supabase/migrations/`: esquema, funciones, índices y RLS
- `supabase/seed.ts`: demo reproducible
- `supabase/tests/`: comprobaciones de políticas
- `tests/`: reglas determinísticas
