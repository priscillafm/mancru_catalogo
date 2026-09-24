# Potato — contexto para Claude Code

SaaS para distribuidores/mayoristas de Latam: cargan productos (Excel o a mano), generan un catálogo en PDF o link público (`/c/:id`) y el cliente manda el pedido por WhatsApp.

## Stack e infraestructura
- Front: React 19 + Vite, React Query, Zustand, jsPDF (PDF se genera en el navegador). Lint: `npx oxlint src`.
- Backend: Supabase (proyecto `wmzqpblqorfuawubryvt`): Auth, Postgres con RLS, Storage (`product-images`), Edge Functions en `supabase/functions` (`mp-create-preference`, `mp-webhook`, `contact-form`, `img-proxy`, `create-user`, `delete-user`).
- Hosting: Cloudflare Workers con assets estáticos (`wrangler.jsonc`, carpeta `dist`, fallback de SPA). Se despliega solo al pushear a `main`. Variables de build `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` cargadas en Cloudflare (Settings → Builds). Dominio: `potatoui.com` (Cloudflare Registrar, DNS y email routing).
- Cobro: Mercado Pago Checkout Pro en pesos uruguayos (la web muestra el precio en USD como referencia, 40 UYU por USD en `PricingCards.jsx`).
- Email de consultas: Edge Function `contact-form` guarda en `contact_messages` y envía con Resend si existen los secretos `RESEND_API_KEY` y `CONTACT_TO_EMAIL` (pendiente de cargar).
- Migraciones en `supabase/migrations` (`npx supabase db push --yes`). Las funciones se despliegan a mano: `npx supabase functions deploy <nombre>` (`--no-verify-jwt` para `mp-webhook` y `contact-form`).

## Entorno local
- `.env` NO está en el repo. Necesita `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (clave publishable). Nunca poner la clave `sb_secret_` en variables `VITE_` ni en Cloudflare.
- `npm install`, `npm run dev` (puerto 5173), `npm run build`. Para el CLI de Supabase: `npx supabase login` y `npx supabase link --project-ref wmzqpblqorfuawubryvt`.

## Reglas de trabajo con Priscilla
- Hablar en español rioplatense, respuestas cortas y directas; ella prefiere que se tomen decisiones técnicas y se avance sin preguntar de más.
- Hacer commit y push al terminar cada tanda de cambios.
- Los commits NO llevan la línea `Co-Authored-By` de Claude ni "Generated with Claude Code".
- Nada del proyecto debe llevar el nombre "mancru" (código, comentarios, archivos, ejemplos). Usar nombres genéricos como "Distribuidora Demo".
- No agregar funciones no pedidas. Iconos siempre en SVG (`src/components/Icon.jsx`), nunca emojis. Tipografía Inter.
- Operaciones sobre producción (deploy de funciones, cambios en la base, secretos) las corre Priscilla o requieren su aprobación.

## Cosas que ya mordieron
- Sincronizar (`src/utils/sync`): un producto que falta en el Excel se marca como eliminado; hoy queda excluido por defecto y pide confirmación. Un dato vacío en el Excel nunca pisa lo guardado.
- El WhatsApp del vendedor se copia dentro de `snapshot_data` de cada catálogo al guardarlo/compartirlo; al cambiarlo en el perfil se actualizan los catálogos existentes.
- El rol interno `vendor` se muestra como "Colaborador".

## Pendientes conocidos
- Conectar Resend (API key + mail de destino).
- Probar un pago real de punta a punta con otra persona y devolverlo.
- Dar de baja Vercel cuando todo esté probado en `potatoui.com`; pasar el repo a privado; renombrar el proyecto de Supabase.
