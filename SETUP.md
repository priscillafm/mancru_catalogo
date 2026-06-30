# Setup — Plataforma de Catálogos

## 1. Supabase — Aplicar schema

En el **SQL Editor** de tu proyecto Supabase, ejecutar en orden:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_storage_bucket.sql`
3. `supabase/seed_mancru.sql` (opcional — datos iniciales Mancru)

## 2. Variables de entorno

Crear `.env` en la raíz del proyecto:

```
VITE_SUPABASE_URL=https://wmzqpblqorfuawubryvt.supabase.co
VITE_SUPABASE_ANON_KEY=<tu anon key>
```

La anon key está en: Supabase Dashboard → Settings → API → `anon public`.

## 3. Crear primer usuario admin

En Supabase Dashboard → Authentication → Users → Invite User
(o Create User con email + contraseña).

Copiar el UUID del usuario creado y ejecutar en SQL Editor:

```sql
INSERT INTO user_memberships (user_id, company_id, role)
VALUES (
  '<uuid-del-usuario>',
  '00000000-0000-0000-0000-000000000001',  -- Mancru
  'company_admin'
);
```

## 4. Desarrollo local

```bash
npm install
npm run dev
```

## 5. Sincronizar productos

1. Ingresar con el usuario admin
2. Ir a Admin → Sincronizar
3. Subir el Excel `Mancru_Catalogos_Base.xlsx`
4. Revisar el diff
5. Aplicar cambios

## Estructura del proyecto

```
src/
  lib/           — Supabase client, auth helpers
  store/         — Zustand stores (auth)
  pages/
    Login.jsx
    Catalog.jsx  — Vista del vendedor
    admin/       — Panel de administración
  utils/
    connectors/  — Sistema de conectores (Excel, CSV, etc.)
    sync/        — Motor de diff y apply
    images/      — Resolución y upload de imágenes
supabase/
  migrations/    — SQL versionado
  seed_mancru.sql
```
