import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader } from '../components/UI'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function pickPhoto(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoFile(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  async function uploadAvatar(userId) {
    if (!photoFile) return null
    const ext = photoFile.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, photoFile, { upsert: true })
    if (error) throw error
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }

  async function submit() {
    setErr(''); setBusy(true)
    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Please enter your name.')
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        const user = data.user
        if (user) {
          let avatarUrl = null
          try { avatarUrl = await uploadAvatar(user.id) } catch (_) { /* storage optional at signup */ }
          await supabase.from('profiles').upsert({
            id: user.id, email, name: name.trim(), avatar_url: avatarUrl,
          })
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e) {
      setErr(e.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (busy) return <div className="screen"><Loader label={mode === 'signup' ? 'Creating your pass…' : 'Checking in…'} /></div>

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="center rise rise-1" style={{ marginBottom: 8 }}>
        <div className="eyebrow" style={{ color: 'var(--sun)' }}>Welcome to the</div>
        <h1 className="postcard-title rise rise-2">White Family<br />Olympics</h1>
        <div className="script rise rise-3" style={{ color: 'var(--cream)', fontSize: 20, marginTop: 6 }}>est. summer of champions ☀️</div>
      </div>

      <div className="card rise rise-4" style={{ marginTop: 18 }}>
        <div className="row" style={{ marginBottom: 14, gap: 8 }}>
          <button onClick={() => setMode('login')} className={`btn btn-sm ${mode === 'login' ? 'btn-coral' : 'btn-ghost'}`} style={{ flex: 1 }}>Log In</button>
          <button onClick={() => setMode('signup')} className={`btn btn-sm ${mode === 'signup' ? 'btn-coral' : 'btn-ghost'}`} style={{ flex: 1 }}>Sign Up</button>
        </div>

        {mode === 'signup' && (
          <>
            <div className="field center">
              <label className="label" style={{ textAlign: 'center' }}>Profile Photo</label>
              <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                <div style={{
                  width: 96, height: 96, borderRadius: '50%', margin: '0 auto',
                  border: '3px dashed var(--ink)', overflow: 'hidden', background: 'var(--powder)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
                }}>
                  {photoPreview ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📷'}
                </div>
                <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: 'none' }} />
              </label>
            </div>
            <div className="field">
              <label className="label">Your Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Reagan White" />
            </div>
          </>
        )}

        <div className="field">
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoCapitalize="none" />
        </div>
        <div className="field">
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>

        {err && <div className="pill pill-coral" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>{err}</div>}

        <button onClick={submit} className="btn btn-gold">
          {mode === 'signup' ? '🎟️ Get My Pass' : '🌴 Enter the Park'}
        </button>
      </div>

      <p className="center muted rise rise-5" style={{ color: 'var(--cream)', fontSize: 12, marginTop: 16 }}>
        One universal invite — anyone with the link can join the games.
      </p>
    </div>
  )
}
