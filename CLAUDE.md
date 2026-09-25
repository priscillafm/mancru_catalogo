# Potato — contexto para Claude Code

SaaS para distribuidores/mayoristas de Latam: cargan productos (Excel o a mano), generan un catálogo en PDF o link público (`/c/:id`) y el cliente manda el pedido por WhatsApp. Historial de decisiones, incidentes y pendientes: `docs/HISTORIAL.md` (leerlo al empezar).

## Stack e infraestructura
- Front: React 19 + Vite, React Query, Zustand, jsPDF (el PDF se genera en el navegador, tipografía Inter en `public/fonts`). Lint: `npx oxlint src`. Páginas con carga diferida en `src/App.jsx`.
- Backend: Supabase (proyecto `wmzqpblqorfuawubryvt`): Auth, Postgres con RLS, Storage (`product-images`), Edge Functions en `supabase/functions` (`mp-create-preference`, `mp-webhook`, `contact-form`, `img-proxy`, `create-user`, `delete-user`).
- Hosting: Cloudflare Workers con assets estáticos (`wrangler.jsonc`, carpeta `dist`, fallback de SPA). Se despliega solo al pushear a `main`. Variables de build `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Cloudflare (Settings → Builds); al cambiarlas hay que reconstruir. Dominio `potatoui.com` (Cloudflare Registrar, DNS, Email Routing). Google Search Console verificado por TXT (no borrarlo).
- Cobro: Mercado Pago Checkout Pro en pesos uruguayos, credenciales de producción y webhook cargados. La web muestra el precio en USD como referencia (`USD_RATE = 40` en `PricingCards.jsx`).
- Email: `contact-form` guarda en `contact_messages` y envía con Resend (secretos `RESEND_API_KEY` y `CONTACT_TO_EMAIL` ya cargados en Supabase; el remitente es el de prueba de Resend). Los mails de Supabase Auth salen por el servicio compartido de Supabase (pendiente pasarlos a Resend con el dominio).
- Superadmin: `/admin/super` (solo `super_admin`) con Resumen, Empresas y Soporte, alimentado por funciones SQL (`admin_companies`, `admin_support_list`, `admin_support_set_status`, migración 007) que devuelven solo agregados y nombres de empresa.
- Guía: `/admin/guide` explica cada sección con capturas reales (`public/guide/*.png`). Recorrido guiado (`AdminTour.jsx` + `store/tour.store.js`) se muestra solo la primera vez en escritorio (guarda un flag en `localStorage`), y se repite desde el botón en la Guía.
- Migraciones en `supabase/migrations` (`npx supabase db push --dry-run` primero, luego `--yes`). Las funciones se despliegan a mano: `npx supabase functions deploy <nombre>` (`--no-verify-jwt` para `mp-webhook` y `contact-form`).

## Entorno local
- `.env` NO está en el repo. Necesita `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (clave publishable). Nunca poner la clave `sb_secret_` en variables `VITE_` ni en Cloudflare.
- `npm install`, `npm run dev` (puerto 5173), `npm run build`. CLI de Supabase: `npx supabase login` y `npx supabase link --project-ref wmzqpblqorfuawubryvt`.

## Reglas de trabajo con Priscilla
- Español rioplatense, respuestas claras y directas. Priscilla no es programadora avanzada: explicar en pasos numerados, con la ruta exacta de los menús y los comandos en bloques de código. Preguntar solo cuando falta un dato que únicamente ella tiene (claves, decisiones de negocio); si no, decidir y avanzar.
- Hacer commit y push al terminar cada tanda de cambios. Los commits NO llevan `Co-Authored-By` de Claude ni "Generated with Claude Code".
- Nada del proyecto debe llevar el nombre del cliente original con el que nació (código, comentarios, archivos, ejemplos; Priscilla sabe cuál es). Usar nombres genéricos como "Distribuidora Demo".
- No guardar claves ni secretos en archivos, memoria ni repo: pedírselas en cada conversación cuando hagan falta, usarlas en el comando y no escribirlas. No usar la clave de servicio de Supabase.
- No agregar funciones que no pidió. Íconos en SVG (`src/components/Icon.jsx`), nunca emojis. Tipografía Inter.
- Operaciones sobre producción (deploy de funciones, cambios en la base, secretos): pueden ser bloqueadas por el sistema de permisos; darle a Priscilla el comando o SQL exacto y verificar después desde acá.

## Cómo razonamos (mantener este método)
1. **Verificar antes de afirmar.** Leer el código y comprobar el estado real antes de dar algo por hecho o por roto: `curl` al sitio, `npx supabase functions list` y `secrets list`, RDAP del dominio, contenido del bundle publicado. No confiar en la memoria: puede estar vieja.
2. **Las auditorías que pega Priscilla traen aciertos y errores.** Contrastar cada hallazgo con el código: corregir lo real, explicar lo que no lo es y contar si en el camino apareció algo peor (por ejemplo, guardar un catálogo compartido lo despublicaba).
3. **Buscar la causa raíz, no el síntoma.** Ejemplos: el botón muerto era un overlay sin `pointer-events: none`; Sincronizar borró productos por el encabezado `SKU` y por tratar el Excel como lista completa.
4. **Probar de verdad y mostrar la evidencia.** Generar PDFs reales y mirarlos página por página, probar rutas con `curl`, armar un Excel de prueba para el importador, emular celular, correr lint y build antes de cada commit. Decir con honestidad qué no se pudo probar (lo que exige iniciar sesión).
5. **Cambios chicos, reversibles y explicados.** Antes de tocar datos reales, plan de recuperación (borrado lógico, consultas SQL de restauración).
6. **Ser honesta con la incertidumbre** (precios y términos de terceros, límites de planes gratuitos) y proponer la opción más simple para lanzar, dejando lo grande para cuando haya un cliente que lo pida.
7. **Cerrar cada tarea** con un resumen corto de qué cambió, qué verificamos y qué le toca a Priscilla; actualizar este archivo y `docs/HISTORIAL.md` con lo aprendido.

## Caja de herramientas
- El servidor de desarrollo se cae cuando se reinicia la sesión: revisar `curl localhost:5173` y relanzar `npm run dev`.
- Probar el PDF: en el navegador embebido importar `/src/utils/pdf.js`, interceptar `URL.createObjectURL` para capturar el blob y devolverlo en base64 (las respuestas grandes se guardan en un archivo que se decodifica con node), y renderizar con poppler (`winget install oschwartz10612.Poppler`, `pdftoppm -png`).
- Verificar producción: `curl -sI https://potatoui.com`, comprobar que el bundle contiene la URL de Supabase y no `sb_secret_`, y que `/contacto` y `/c/<id>` responden 200.
- El navegador embebido no abre mercadopago.com y las capturas fallan si la ventana está oculta (`tabs_select`). Crear cuentas o pagar no se hace desde acá.
- En Git Bash de Windows, scripts largos con comillas por heredoc se pueden truncar: escribir el script con Write y ejecutarlo. Las respuestas gigantes del navegador quedan en un archivo JSON que se puede leer con node.
- Captura de pantalla real de una página (para la Guía en `public/guide/`, no para el PDF): inyectar `modern-screenshot` desde `cdn.jsdelivr.net` en la consola del navegador embebido (`domToPng(document.body)`), no `html2canvas` — no soporta `color-mix()`, que la interfaz usa para el estado activo del menú. El data-URI grande se guarda igual que el del PDF (archivo + decode).
- Repo movido de `github.com/priscillafm/mancru_catalogo` a `github.com/priscillafm/potato` (24 de septiembre). El remoto viejo redirige solo, conviene `git remote set-url origin` a la nueva URL.

## Cosas que ya mordieron
- Sincronizar (`src/utils/sync`): los productos que faltan en el Excel quedan excluidos y solo se eliminan si el usuario los incluye y confirma; un dato vacío nunca pisa lo guardado; reconoce `SKU`.
- El WhatsApp del vendedor se copia en `snapshot_data` de cada catálogo; al cambiarlo en el perfil se actualizan los existentes y al compartir se refresca.
- Guardar cambios de un catálogo compartido no cambia su estado.
- El rol interno `vendor` se muestra como "Colaborador".
- El PDF usa tarjetas verticales cuando menos de la mitad de los productos tiene descripción.
- Una página nueva de nivel superior (fuera de `AdminLayout`, como `/catalogs` o el armador de catálogo) no hereda el layout responsive de Admin: necesita su propio `useIsMobile()` desde el día uno. Así se rompió "Compartir link" en celular — `/catalogs` tenía una barra lateral fija de 248px y el modal de PDF desbordaba, el botón de descargar quedaba literalmente afuera de la pantalla.

## Pendientes conocidos
- Probar un pago real con otra persona y devolverlo; probar en iPhone y Android reales.
- Pasar los mails de Supabase Auth por Resend con el dominio; renovar la clave de Resend que se compartió en un chat.
- Dar de baja Vercel; repositorio privado; renombrar el proyecto de Supabase.
- Definir el texto de "soporte prioritario" y la vigencia del precio de lanzamiento; conseguir fotos para la demo.
- Ideas: carga masiva de fotos por SKU (con reducción de tamaño), vista previa del mensaje de WhatsApp, entrar "como" una empresa desde el superadmin, cobro en dólares con otro proveedor.
