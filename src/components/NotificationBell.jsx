import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '@/hooks/useNotifications'

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleOpen() {
    setOpen(p => !p)
    if (!open && unreadCount > 0) markAllRead()
  }

  function handleNotifClick(n) {
    markRead(n.id)
    setOpen(false)
    if (n.data?.catalog_id) navigate('/catalogs')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={handleOpen} style={{
        position: 'relative', background: 'none', border: 'none',
        cursor: 'pointer', padding: '6px', borderRadius: 8,
        color: 'var(--text2)', display: 'flex', alignItems: 'center',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--accent)', color: 'var(--accent-text)',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 320, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: 'var(--shadow)', zIndex: 500, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Notificaciones</span>
            {notifications.length > 0 && (
              <button onClick={markAllRead} style={{
                background: 'none', border: 'none', fontSize: 11,
                color: 'var(--text3)', cursor: 'pointer',
              }}>
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                Sin notificaciones
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} onClick={() => handleNotifClick(n)} style={{
                  padding: '12px 16px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: n.read ? 'transparent' : 'color-mix(in srgb, var(--accent) 6%, transparent)',
                  transition: 'background 0.15s',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-h)'}
                  onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'color-mix(in srgb, var(--accent) 6%, transparent)'}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>
                    {n.type === 'catalog_view' ? '👁' : '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                      {new Date(n.created_at).toLocaleDateString('es-UY', { day: '2-digit', month: 'short' })}
                      {' '}
                      {new Date(n.created_at).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!n.read && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
