import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader } from '../components/UI'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function submit() {
    setErr('')
    if (!password) { setErr('Please enter a new password.'); return }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setErr("Passwords don't match."); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setErr(error.message); setBusy(false) }
    else navigate('/')
  }

  if (!ready) return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
      <Loader label="Verifying your reset link…" />
    </div>
  )

  if (busy) return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
      <Loader label="Updating your password…" />
    </div>
  )

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="center rise rise-1" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🔐</div>
        <h1 className="postcard-title rise rise-2" style={{ fontSize: 32 }}>New Password</h1>
        <div className="script rise rise-3" style={{ color: 'var(--cream)', fontSize: 18, marginTop: 6 }}>
          Make it a good one
        </div>
      </div>
      <div className="card rise rise-4" style={{ marginTop: 18 }}>
        <div className="field">
          <label className="label">New Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
        </div>
        <div className="field">
          <label className="label">Confirm Password</label>
          <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" />
        </div>
        {err && <div className="pill pill-coral" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>{err}</div>}
        <button onClick={submit} className="btn btn-gold">🔐 Set New Password</button>
      </div>
    </div>
  )
}
