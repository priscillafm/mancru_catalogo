import { useTourStore } from '@/store/tour.store'

const SECTIONS = [
  {
    title: 'Resumen',
    text: 'Al entrar a Admin ves el estado de tu cuenta: qué te falta cargar (empresa, WhatsApp, productos, fotos, precios) y un acceso directo a cada cosa pendiente, más tus números clave.',
    img: '/guide/dashboard.png',
  },
  {
    title: 'Marcas',
    text: 'Las marcas son los proveedores o líneas de producto que manejás. Cada marca arranca en una página nueva del catálogo (en el PDF y en el link público), y le podés poner un color propio.',
    img: '/guide/brands.png',
  },
  {
    title: 'Productos',
    text: 'Cargá productos a mano con el botón "+ Agregar producto", o subí varios juntos desde Excel con Importar. Cada producto tiene SKU, nombre, marca, categoría, stock, precio y foto.',
    img: '/guide/products.png',
  },
  {
    title: 'Armar un catálogo',
    text: 'Desde el catálogo elegís una marca a la izquierda, hacés clic en los productos que querés incluir y ajustás el precio para ese cliente si hace falta. Después lo guardás como borrador.',
    img: '/guide/catalog.png',
  },
  {
    title: 'Compartir o descargar',
    text: 'Con "Preparar catálogo" elegís el estilo de portada, los colores y qué datos mostrar. Desde ahí descargás el PDF o activás "Compartir link" para mandarle a tu cliente una página que puede abrir desde el celular.',
    img: '/guide/pdf-modal.png',
  },
  {
    title: 'Lo que ve tu cliente',
    text: 'El link público muestra tus productos con foto y precio. Tu cliente elige lo que quiere, ajusta cantidades y te manda el pedido por WhatsApp (o email si no configuraste WhatsApp).',
    img: '/guide/public-catalog.png',
  },
  {
    title: 'Sincronizar',
    text: 'Cuando ya tenés productos cargados y querés actualizar precios o stock desde un Excel nuevo, usá Sincronizar: te muestra qué cambió antes de aplicar nada, y nunca borra un producto sin que lo confirmes.',
    img: '/guide/sync.png',
  },
  {
    title: 'Usuarios',
    text: 'Invitá a tu equipo con un rol de administrador o colaborador. Se crean con una contraseña inicial que después pueden cambiar.',
    img: '/guide/users.png',
  },
  {
    title: 'Configuración',
    text: 'Tu logo, el nombre de la empresa y el WhatsApp donde querés recibir los pedidos. Sin WhatsApp configurado, tus clientes solo van a poder mandarte el pedido por email.',
    img: '/guide/settings.png',
  },
]

export default function Guide() {
  const startTour = useTourStore(s => s.start)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 60px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Guía de uso</h1>
          <button onClick={startTour} style={btnSecondary}>
            ↻ Repasar el recorrido guiado
          </button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 0, marginBottom: 32 }}>
          Cómo funciona Potato, paso a paso, con capturas reales de la app.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {SECTIONS.map((s, i) => (
            <section key={s.title}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent)', color: 'var(--accent-text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>{i + 1}</span>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{s.title}</h2>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.55, margin: '0 0 14px 34px' }}>{s.text}</p>
              <div style={{ marginLeft: 34, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
                <img src={s.img} alt={s.title} style={{ width: '100%', display: 'block' }} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

const btnSecondary = {
  padding: '8px 16px', background: 'var(--surface-h)', color: 'var(--text2)',
  border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer',
}
