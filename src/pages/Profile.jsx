import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { TopBar, Loader, Avatar } from '../components/UI'
import { fetchPlayers, fetchScores, computeStandings, bestEvents } from '../lib/scoring'
import { supabase } from '../lib/supabase'

export default function Profile() {
  const { profile, user, refreshProfile, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile?.name || '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([fetchPlayers(), fetchScores()]).then(([players, scores]) => {
      const s = computeStandings(players, scores)
      setMe(s.find((r) => r.player.id === profile?.id) || null)
      setLoading(false)
    })
  }, [profile])

  async function changePhoto(e) {
    const f = e.target.files?.[0]
    if (!f || !user) return
    setBusy(true)
    try {
      const ext = f.name.split('.').pop()
      const path = `${user.id}/avatar-${Date.now()}.${ext}`
      await supabase.storage.from('avatars').upload(path, f, { upsert: true })
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
      await refreshProfile()
    } finally { setBusy(false) }
  }

  async function saveName() {
    setBusy(true)
    await supabase.from('profiles').update({ name: name.trim() }).eq('id', user.id)
    await refreshProfile()
    setEditing(false); setBusy(false)
  }

  if (loading) return <div className="screen"><Loader label="Pulling your stats…" /></div>

  const best = me ? bestEvents(me).filter((e) => e.points > 0).slice(0, 3) : []

  return (
    <div className="screen">
      <TopBar title="my profile" />

      <div className="card rise rise-1 center" style={{ background: 'var(--teal)', color: 'var(--cream)' }}>
        <label style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}>
          <Avatar url={profile?.avatar_url} name={profile?.name} size={110} />
          <span style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--gold)', border: '2px solid var(--ink)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📷</span>
          <input type="file" accept="image/*" onChange={changePhoto} style={{ display: 'none' }} />
        </label>

        {editing ? (
          <div className="mt16">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ textAlign: 'center' }} />
            <div className="row mt8" style={{ gap: 8 }}>
              <button onClick={saveName} className="btn btn-gold btn-sm" style={{ flex: 1 }} disabled={busy}>Save</button>
              <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm" style={{ flex: 1, color: 'var(--cream)' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="postcard-title mt16" style={{ fontSize: 32, color: 'var(--cream)' }}>{profile?.name}</h1>
            {isAdmin && <span className="pill pill-coral mt8">🛠️ Admin</span>}
            <button onClick={() => { setName(profile?.name || ''); setEditing(true) }} className="btn btn-ghost btn-sm mt16" style={{ color: 'var(--cream)' }}>✏️ Edit name</button>
          </>
        )}
      </div>

      {/* Rank + score */}
      <div className="row mt16" style={{ gap: 12 }}>
        <div className="card-flat rise rise-2" style={{ flex: 1, textAlign: 'center', background: 'var(--gold)' }}>
          <div className="eyebrow">Rank</div>
          <div className="postcard-title" style={{ fontSize: 40 }}>{me ? `#${me.rank}` : '—'}</div>
        </div>
        <div className="card-flat rise rise-3" style={{ flex: 1, textAlign: 'center', background: 'var(--coral)', color: 'var(--cream)' }}>
          <div className="eyebrow" style={{ color: 'var(--sun)' }}>Points</div>
          <div className="postcard-title" style={{ fontSize: 40, color: 'var(--cream)' }}>{me?.total ?? 0}</div>
        </div>
      </div>

      {/* Best events */}
      <div className="card-flat rise rise-4 mt16">
        <div className="eyebrow">🌟 Your Best Events</div>
        {best.length ? (
          <div className="stack mt8">
            {best.map((e) => (
              <div key={e.key} className="between">
                <div className="row"><span style={{ fontSize: 24 }}>{e.emoji}</span><span className="display" style={{ fontSize: 15 }}>{e.name}</span></div>
                <span className="pill pill-gold">{e.points} pts</span>
              </div>
            ))}
          </div>
        ) : <p className="muted mt8">No event scores yet — your highlights will show up here.</p>}
      </div>

    </div>
  )
}
