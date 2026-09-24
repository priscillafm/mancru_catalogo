# Historial de Potato

Resumen de lo trabajado, decidido y aprendido. No contiene claves ni datos de clientes. Para el contexto general y las reglas de trabajo ver `CLAUDE.md`.

## Puesta en marcha (24 de septiembre de 2026)

### Infraestructura y cobro
- **Dominio:** `potatoui.com`, comprado en Cloudflare Registrar (US$10,46 al año, renovación automática). Se pensaba comprar `potatouy.com` pero se registró "ui"; se decidió quedarse con ese porque no ata la marca a Uruguay.
- **Hosting:** Cloudflare Workers con assets estáticos (`wrangler.jsonc`). Se despliega solo al pushear a `main`. Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se cargan en Cloudflare (Settings → Builds) y hay que reconstruir después de cambiarlas, porque quedan incluidas en el build. Se pasó del hosting anterior (Vercel), que queda para dar de baja.
- **HTTPS:** "Always Use HTTPS" activado. `robots.txt` y `sitemap.xml` publicados; Google Search Console verificado por DNS (no borrar el registro TXT). El sitemap excluye `/c/` (catálogos compartidos con clientes) y las zonas privadas.
- **Mercado Pago:** credenciales de producción activadas, Access Token y secreto del webhook cargados como secretos de Supabase, webhook en modo productivo con el evento "Pagos (legacy)". Solo cobra en pesos uruguayos; la web muestra el precio en dólares como referencia (`USD_RATE = 40` en `PricingCards.jsx`). Falta probar un pago real con otra persona y devolverlo.
- **Supabase:** el historial de migraciones remoto se reparó (001-005 marcadas como aplicadas) para poder usar `supabase db push`. La migración 006 creó `contact_messages`. Auth: Site URL y Redirect URLs apuntan a `potatoui.com`.
- **Formulario de contacto** (`/contacto`): guarda en `contact_messages` y avisa por email con Resend cuando estén los secretos `RESEND_API_KEY` y `CONTACT_TO_EMAIL` (pendiente).

### Producto
- **PDF:** rediseño ajustado al detalle; tipografía Inter; portada con estilos Bloom, Spotlight y Mesh además de los anteriores; logo por upload directo (recomendado PNG sin fondo); si la mayoría de los productos no tiene descripción se usan tarjetas verticales (4x2 horizontal, 3x3 vertical); las fotos no se deforman.
- **Onboarding:** paso nuevo "Tu empresa" con nombre editable y WhatsApp validado (con código de país). Aviso al compartir un catálogo sin WhatsApp configurado.
- **Catálogos:** "Guardar borrador" contra "Compartir link" con modal propio; el WhatsApp se refresca en los catálogos existentes al cambiarlo; los precios guardados de cada producto se precargan al armar un catálogo; las vistas cuentan una por dispositivo cada 30 minutos.
- **Panel:** tarjeta de "Preparación de tu catálogo" (empresa, WhatsApp, productos, fotos, precios, link público); alta manual de productos y de categorías; campo de precio; rol "Vendedor" renombrado a "Colaborador".
- **Importar Excel:** vista previa con mapeo de columnas, muestra de filas, filas omitidas descargables, SKU repetidos y columna de foto por URL (`imagen_url`). Encabezados con tilde reconocidos.
- **Interfaz:** íconos SVG en lugar de emojis, textos en singular/plural, carga diferida de páginas (el paquete inicial bajó de 2,4 MB a 510 KB), metadatos para compartir.
- **Nombre del cliente original:** se sacó de scripts, seeds, documentación y comentarios.

## Incidente: Sincronizar borró productos (24 de septiembre)
- **Qué pasó:** se subió un Excel con el encabezado `SKU`, pero Sincronizar solo conocía `Código`. Ninguna fila tuvo SKU, no se pudo emparejar nada y los 4 productos existentes se marcaron como eliminados (borrado lógico, con `deleted_at`).
- **Causa de fondo:** el Excel se trataba como la lista completa, así que todo lo que faltaba se eliminaba por defecto, y los datos ausentes (descripción, precio, stock, marca, foto) pisaban lo guardado.
- **Corrección:** los productos que faltan en el archivo quedan excluidos y solo se eliminan si el usuario los incluye y confirma; un dato vacío nunca modifica lo guardado; Sincronizar reconoce `SKU`; si ninguna fila tiene SKU se detiene con un mensaje claro.
- **Cómo se recuperó** (reemplazar el id por el de la sincronización que borró, que se ve en `sync_executions`):
```sql
UPDATE products p SET deleted_at = NULL, updated_at = now()
FROM sync_diff_rows d, sync_executions e
WHERE e.id = 'ID_DE_LA_SINCRONIZACION' AND d.execution_id = e.id AND d.change_type = 'deleted'
  AND p.company_id = e.company_id AND upper(p.sku) = upper(d.sku);
```

## Dónde mirar cada cosa
- Visitas a la web y DNS: Cloudflare (Web Analytics, Domains).
- Usuarios, tablas, fotos y logs de funciones: Supabase (Authentication, Table Editor, Storage, Edge Functions).
- Pagos: Mercado Pago (Actividad) y la tabla `company_subscriptions`.
- Resumen del negocio: ruta `/admin/super` dentro de la app (solo super administrador).

## Pendientes
- Conectar Resend (API key y mail de destino) y probar el formulario.
- Probar un pago real con otra persona y devolverlo; probar en iPhone y Android reales.
- Dar de baja Vercel; pasar el repositorio a privado; renombrar el proyecto de Supabase.
- Decidir el texto de "soporte prioritario" y del alcance del precio de lanzamiento.
- Ideas para después: vista previa del mensaje de WhatsApp, fotos por ZIP nombradas por SKU, cobro en dólares con otro proveedor, redirección de `www` al dominio principal.
