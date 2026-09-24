import { Link } from 'react-router-dom'
import LegalPage from '@/components/LegalPage'

export default function Privacy() {
  return (
    <LegalPage title="Política de privacidad" updated="14 de septiembre de 2026">
      <p>
        En Potato recolectamos la información mínima necesaria para operar el Servicio. Esta política
        explica qué datos guardamos y cómo los usamos.
      </p>

      <h2 style={h2}>1. Qué datos recolectamos</h2>
      <ul style={ul}>
        <li>Datos de cuenta: email y contraseña (la contraseña se guarda encriptada, nunca en texto plano).</li>
        <li>Datos de tu empresa: nombre, logo, marcas y número de WhatsApp donde recibís pedidos.</li>
        <li>Datos de productos y catálogos que cargás para armar tus catálogos.</li>
        <li>Estadísticas de uso: cuándo se abrió un catálogo público y cuántas veces (sin identificar a la persona que lo abrió).</li>
        <li>Si te suscribís a un plan pago: los datos del pago los procesa Mercado Pago directamente — Potato nunca ve ni almacena el número de tu tarjeta.</li>
      </ul>

      <h2 style={h2}>2. Cómo usamos tus datos</h2>
      <p>
        Usamos tus datos para operar el Servicio (mostrar tus catálogos, procesar pedidos, gestionar tu
        suscripción) y para comunicarnos con vos sobre tu cuenta. No vendemos tus datos a terceros.
      </p>

      <h2 style={h2}>3. Dónde se guardan tus datos</h2>
      <p>
        Los datos se almacenan en Supabase (infraestructura sobre PostgreSQL), un proveedor externo que
        actúa como encargado del tratamiento de datos en nuestro nombre.
      </p>

      <h2 style={h2}>4. Tus derechos</h2>
      <p>
        Podés acceder, corregir o eliminar tus datos en cualquier momento desde tu cuenta, o
        solicitándolo desde la página de <Link to="/contacto" style={{ color: "var(--accent)" }}>contacto</Link>. Al eliminar tu cuenta, tus catálogos
        públicos dejan de estar disponibles.
      </p>

      <h2 style={h2}>5. Uruguay — Ley N° 18.331</h2>
      <p>
        Como usuaria/o en Uruguay, tenés los derechos de acceso, rectificación y supresión de datos
        personales previstos en la Ley N° 18.331 de Protección de Datos Personales.
      </p>
    </LegalPage>
  )
}

const h2 = { fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 28, marginBottom: 10 }
const ul = { paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }
