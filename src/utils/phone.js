// Normaliza un WhatsApp ingresado a mano a solo dígitos con código de país (formato wa.me).
export function normalizeWhatsapp(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return { ok: true, value: null }
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0') || digits.length < 10 || digits.length > 15) {
    return { ok: false, error: 'Incluí el código de país, sin 0 inicial. Uruguay: 598 + número, ej: 59899123456.' }
  }
  return { ok: true, value: digits }
}
