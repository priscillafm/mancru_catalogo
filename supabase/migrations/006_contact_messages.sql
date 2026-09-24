-- Consultas del formulario público de contacto (/contacto).
-- Las inserta únicamente la Edge Function `contact-form` con la service-role key;
-- RLS queda habilitado sin policies, así que ningún cliente puede leer ni escribir directo.

CREATE TABLE IF NOT EXISTS contact_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  company     text,
  plan        text,
  message     text NOT NULL,
  emailed     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_email_created ON contact_messages(email, created_at DESC);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
