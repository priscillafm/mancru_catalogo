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
- **Superadministración** (`/admin/super`, migración 007): pestañas Resumen (números clave, embudo de activación y oportunidades de mejora detectadas solas), Empresas (uso agregado y cambio de plan) y Soporte (bandeja de las consultas del formulario con estados). Funciona con funciones SQL que solo aceptan al super_admin y devuelven cantidades y nombres de empresa, nunca mails, productos ni precios de clientes.
- **Catálogo público:** buscador por nombre o SKU (sin distinguir tildes) y filtro por categoría cuando hay 6 o más productos. Guardar cambios de un catálogo ya compartido ya no lo vuelve a borrador (antes cortaba el link público).
- **Privacidad:** la eliminación de cuenta se solicita desde Perfil ("Datos y privacidad") o el formulario de contacto, y se procesa en 30 días; la política de privacidad lo describe así.
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

## Auditorías externas y decisiones (24 de septiembre)
- Priscilla pegó dos auditorías de uso. Cada hallazgo se verificó contra el código: se corrigió lo real (WhatsApp faltante, precio que no se precargaba, importador mudo con filas inválidas, buscador ausente, eliminación de cuenta sin flujo, textos contradictorios) y se aclaró lo que no lo era (el contador de vistas sí funcionaba; el texto de invitación de usuarios sí existía).
- Además se encontraron problemas que las auditorías no vieron: guardar un catálogo compartido lo volvía a borrador y cortaba el link; Sincronizar pisaba datos con las columnas ausentes; el encabezado `Código` con tilde no se reconocía al importar.
- Decisiones de producto: el precio se muestra en dólares como referencia y se cobra en pesos; tipografía Inter (el catálogo público usa la fuente del sistema en Apple); rol "Colaborador" en vez de "Vendedor"; la eliminación de cuenta se pide por formulario y se procesa en 30 días.
- Formulario de contacto conectado a Resend (mail de destino: el de Priscilla) y bandeja de soporte en `/admin/super`. Login de Supabase probado: registro y recuperación de contraseña funcionan en `potatoui.com`.
- Fotos: hoy por URL en el Excel (columna `imagen_url`) o de a una desde Productos; la carga masiva por SKU queda para cuando un cliente grande la pida.

## Panel usable en celular + guía de uso (24 de septiembre, continuación)
- **Texto chico en escritorio:** Priscilla reportó que el texto se veía chico en toda la app (no en celular). Causa: casi todo el panel de admin usa tamaños de fuente fijos en píxeles por componente, no relativos, así que no alcanzaba con subir el tamaño base. Se subió ~1px cada tamaño de fuente en todo el panel de admin, el armador de catálogo y el modal de PDF (no se tocó la vista de tarjetas de Productos en celular ni la mini-preview de portada del PDF, que tiene que quedar a escala real), y el tamaño base de la página sube de 14px a 15px en pantallas de escritorio.
- **"Compartir no funciona" en celular:** el bug real estaba en `/catalogs` (Mis catálogos), una página fuera del layout de Admin que nunca se adaptó a celular — barra lateral fija de 248px y el modal de "Preparar catálogo" desbordaba (el botón "Descargar PDF" quedaba afuera de la pantalla, sin forma de tocarlo). Se corrigió esa página y el modal; probado de punta a punta en una vista de 375px: guardar catálogo, compartir, copiar link y abrir el link público, todo funcionando.
- **Repaso completo del panel en celular:** Marcas, Sincronizar, Importar, Usuarios, Config y Superadmin — padding y encabezados se acomodan a pantallas angostas; las tablas con columnas que no entraban (Usuarios, el detalle de cambios de Sincronizar) ahora scrollean horizontal en lugar de recortar botones.
- **Guía de uso** (`/admin/guide`): nueva sección en el menú de Admin que explica cada parte de la app con una captura real de la propia app (no un mockup) en cada paso — capturada inyectando la librería `modern-screenshot` en el navegador y guardando el PNG real en `public/guide/`.
- **Recorrido guiado:** al entrar a Admin por primera vez en escritorio aparecen globitos que van señalando cada opción del menú. No se repite solo (se guarda en `localStorage`); se puede volver a ver desde el botón en la Guía. En celular no se muestra automático (el menú vive en un drawer que hay que abrir a mano) pero la página de Guía sí está disponible.
- **Repo:** GitHub renombró `mancru_catalogo` a `potato` (`github.com/priscillafm/potato`); el remoto viejo sigue redirigiendo pero conviene actualizar la URL localmente.

## Armador de catálogo: productos sin marca invisibles + estado vacío (24 de septiembre)
- **Qué encontró Priscilla:** cargó un producto sin asignarle marca y no le aparecía en ningún lado al armar un catálogo. Tuvo que crear una marca para que el producto se pudiera usar.
- **Causa real:** el armador de catálogo (`/app`) organiza todo por marca — sin marca seleccionada en el panel izquierdo no se pide ningún producto, y el panel solo lista marcas reales. Un producto con `brand_id` vacío no tenía ninguna marca para "vivir" ahí, así que quedaba inalcanzable aunque estuviera cargado y activo.
- **Corrección:** el panel izquierdo suma una entrada "Sin marca" (solo si hay al menos un producto sin marca) que filtra por `brand_id is null`, igual que ya hacía el PDF al agrupar el borrador.
- **De paso:** el estado vacío del armador ahora distingue "no cargaste ningún producto todavía" (con botones directos a Productos e Importar) de "elegí una marca para empezar" (cuando ya hay productos pero ninguno seleccionado) — antes mostraba siempre el mismo texto de instrucciones sin mirar si la cuenta tenía productos o no.

## Cómo seguir desde otra computadora
Clonar el repositorio, crear el archivo `.env` con las dos variables públicas de Supabase y abrir Claude Code en la carpeta: lee `CLAUDE.md` (reglas y método de trabajo) y este historial. La conversación textual no se guarda en el repositorio porque contiene claves; este archivo y `CLAUDE.md` resumen lo importante sin datos sensibles.

## Dónde mirar cada cosa
- Visitas a la web y DNS: Cloudflare (Web Analytics, Domains).
- Usuarios, tablas, fotos y logs de funciones: Supabase (Authentication, Table Editor, Storage, Edge Functions).
- Pagos: Mercado Pago (Actividad) y la tabla `company_subscriptions`.
- Resumen del negocio: ruta `/admin/super` dentro de la app (solo super administrador).

## Pendientes
- Renovar la clave de Resend que se compartió en un chat y pasar los mails de Supabase Auth por Resend con el dominio.
- Probar un pago real con otra persona y devolverlo; probar en iPhone y Android reales.
- Dar de baja Vercel; pasar el repositorio a privado; renombrar el proyecto de Supabase; actualizar el remoto local a `github.com/priscillafm/potato`.
- Decidir el texto de "soporte prioritario" y del alcance del precio de lanzamiento.
- Borrar (o dejar) las cuentas de prueba QA creadas durante el trabajo (`qa-claude-test-0916@potato-test.dev`, `qa-mobile-0924@potato-test.dev`, `qa-emptystate-0924@potato-test.dev`), cada una con una empresa y datos de ejemplo.
- Ideas para después: vista previa del mensaje de WhatsApp, fotos por ZIP nombradas por SKU, cobro en dólares con otro proveedor, redirección de `www` al dominio principal.
