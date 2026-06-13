import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Loader({ label = 'Loading…' }) {
  return (
    <div className="loader">
      <div className="sun-spin" />
      <div className="display" style={{ color: 'var(--cream)' }}>{label}</div>
    </div>
  )
}

export function Avatar({ url, name, size = 44 }) {
  const initials = (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      border: '2px solid var(--ink)', overflow: 'hidden',
      background: 'var(--sky)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontSize: size * 0.36, color: 'var(--ink)',
      boxShadow: '2px 2px 0 rgba(31,58,61,0.55)',
    }}>
      {url ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </div>
  )
}

export function TopBar({ title }) {
  const [open, setOpen] = useState(false)
  const { isAdmin, signOut } = useAuth()
  const nav = useNavigate()

  return (
    <>
      <div className="between page-pad" style={{ marginBottom: 14, paddingRight: 56 }}>
        <div className="script" style={{ color: 'var(--cream)', fontSize: 22, textShadow: '2px 2px 0 var(--teal-dark)' }}>
          {title}
        </div>
      </div>

      {/* Always-visible floating menu button */}
      <button onClick={() => setOpen(true)} aria-label="Menu" style={{
        position: 'fixed', top: 16, right: 'max(16px, calc(50vw - 244px))', zIndex: 50,
        background: 'var(--gold)', border: '3px solid var(--ink)', borderRadius: 12,
        width: 46, height: 46, fontSize: 21, cursor: 'pointer',
        boxShadow: '3px 3px 0 rgba(31,58,61,0.85)',
      }}>☰</button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(13,92,87,.55)', zIndex: 60,
          backdropFilter: 'blur(2px)',
        }}>
          <div onClick={(e) => e.stopPropagation()} className="rise" style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(82%,320px)',
            background: 'var(--cream-soft)', borderLeft: '3px solid var(--ink)', padding: 20,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div className="between">
              <span className="postcard-title" style={{ fontSize: 24 }}>Menu</span>
              <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div className="divider" />
            {[
              { to: '/', icon: '🏠', label: 'Home' },
              { to: '/standings', icon: '🏆', label: 'Progress Tracker' },
              { to: '/instructions', icon: '📋', label: 'Instructions & Maps' },
              { to: '/gallery', icon: '📸', label: 'Photo Gallery' },
              { to: '/profile', icon: '🌴', label: 'My Profile' },
              { to: '/scavenger', icon: '🔍', label: 'Scavenger Hunt' },
            ].map((m) => (
              <button key={m.to} onClick={() => { setOpen(false); nav(m.to) }} className="btn btn-sky" style={{ justifyContent: 'flex-start' }}>
                <span style={{ fontSize: 20 }}>{m.icon}</span> {m.label}
              </button>
            ))}
            {isAdmin && (
              <button onClick={() => { setOpen(false); nav('/admin') }} className="btn btn-coral" style={{ justifyContent: 'flex-start' }}>
                <span style={{ fontSize: 20 }}>🛠️</span> Admin Panel
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={() => { setOpen(false); signOut() }} className="btn btn-ghost">Sign Out</button>
          </div>
        </div>
      )}
    </>
  )
}
