import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { PotatoMark } from '@/components/PotatoLogo'

// Mercado Pago vuelve acá después del checkout. El webhook puede tardar
// unos segundos en llegar, así que hacemos un polling corto a
// company_subscriptions antes de mandar a la persona al dashboard.
export default function CheckoutReturn() {
  const navigate = useNavigate()
  const { membership, loadMembership, session } = useAuthStore()
  const [status, setStatus] = useState('checking') // checking | active | pending

  useEffect(() => {
    if (!membership?.company_id) return
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      const { data } = await supabase
        .from('company_subscriptions')
        .select('status')
        .eq('company_id', membership.company_id)
        .single()

      if (data?.status === 'active') {
        clearInterval(interval)
        await loadMembership(session.user.id)
        setStatus('active')
        setTimeout(() => navigate('/app', { replace: true }), 1500)
      } else if (attempts >= 10) {
        clearInterval(interval)
        setStatus('pending')
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [membership?.company_id])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}><PotatoMark size={48} /></div>
        {status === 'checking' && (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Confirmando tu pago...</h1>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>Esto puede tardar unos segundos.</p>
          </>
        )}
        {status === 'active' && (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>¡Listo! Tu plan Pro está activo</h1>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>Te llevamos a tu panel...</p>
          </>
        )}
        {status === 'pending' && (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Tu pago está procesándose</h1>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
              Puede tardar un poco más de lo normal. Te vamos a avisar cuando esté listo — podés seguir
              usando Potato mientras tanto.
            </p>
            <button onClick={() => navigate('/app')} style={{
              padding: '10px 20px', background: 'var(--accent)', color: 'var(--accent-text)',
              border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              Ir a mi panel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
