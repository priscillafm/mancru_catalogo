import LegalPage from '@/components/LegalPage'

export default function Terms() {
  return (
    <LegalPage title="Términos de uso" updated="14 de septiembre de 2026">
      <p>
        Estos términos rigen el uso de Potato ("el Servicio"), una plataforma para crear y compartir
        catálogos de productos, operada desde Uruguay.
      </p>

      <h2 style={h2}>1. Tu cuenta</h2>
      <p>
        Sos responsable de la información que cargás (productos, precios, marcas) y de mantener segura
        tu contraseña. Podés usar el plan gratuito indefinidamente, dentro de los límites publicados en
        la página de precios, o suscribirte a un plan pago para límites más altos.
      </p>

      <h2 style={h2}>2. Catálogos públicos</h2>
      <p>
        Los catálogos que compartís mediante un link público pueden ser vistos por cualquier persona que
        tenga ese link, sin necesidad de crear una cuenta. Sos responsable de la exactitud de los
        productos y precios que publicás, y del número de WhatsApp donde recibís los pedidos.
      </p>

      <h2 style={h2}>3. Planes pagos</h2>
      <p>
        Los planes pagos se cobran mensualmente a través de Mercado Pago, en pesos uruguayos. Podés
        cancelar tu suscripción cuando quieras; el acceso al plan pago continúa hasta el fin del período
        ya abonado. Los precios de lanzamiento son temporales y pueden ajustarse con aviso previo.
      </p>

      <h2 style={h2}>4. Uso aceptable</h2>
      <p>
        No podés usar Potato para publicar contenido ilegal, engañoso o que infrinja derechos de terceros.
        Nos reservamos el derecho de suspender cuentas que incumplan esto.
      </p>

      <h2 style={h2}>5. Disponibilidad</h2>
      <p>
        Hacemos un esfuerzo razonable para mantener el Servicio disponible, pero no garantizamos
        disponibilidad ininterrumpida. No somos responsables por pérdidas derivadas de interrupciones del
        servicio.
      </p>

      <h2 style={h2}>6. Contacto</h2>
      <p>Para consultas sobre estos términos, escribinos a través de los canales indicados en la app.</p>
    </LegalPage>
  )
}

const h2 = { fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 28, marginBottom: 10 }
