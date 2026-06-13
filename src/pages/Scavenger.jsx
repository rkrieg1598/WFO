import { useEffect, useState } from 'react'
import { TopBar, Loader } from '../components/UI'
import { supabase } from '../lib/supabase'

export default function Scavenger() {
  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('*').eq('key', 'scavenger_unlocked').single()
      .then(({ data }) => { setUnlocked(data?.value === 'true'); setLoading(false) })
  }, [])

  if (loading) return <div className="screen"><Loader label="Checking the vault…" /></div>

  return (
    <div className="screen">
      <TopBar title="scavenger hunt" />

      {!unlocked ? (
        <div className="card rise rise-1 center" style={{ marginTop: 40, background: 'var(--cream-soft)' }}>
          <div style={{ fontSize: 72, animation: 'swayy 2s ease-in-out infinite' }}>🔒</div>
          <h1 className="postcard-title mt16" style={{ fontSize: 30 }}>Locked!</h1>
          <p className="muted mt8" style={{ lineHeight: 1.5 }}>
            The Scavenger Hunt hasn’t started yet. This page will unlock when the admin
            kicks off the hunt. Get your camera ready! 🔍
          </p>
          <div className="pill pill-teal mt16">👯 4 teams of 2 · 8 / 6 / 4 / 2 pts</div>
        </div>
      ) : (
        <div className="card rise rise-1 center" style={{ marginTop: 24 }}>
          <div style={{ fontSize: 64 }}>🔍</div>
          <h1 className="postcard-title mt16" style={{ fontSize: 28 }}>Hunt Unlocked!</h1>
          <p className="muted mt8">
            Photo upload &amp; item verification is coming soon. This page is reserved to be
            built out — teams will upload their found-item photos here for the admin to verify.
          </p>
          <div className="card-flat mt16" style={{ background: 'var(--powder)', width: '100%' }}>
            <div className="eyebrow">🚧 Placeholder</div>
            <p className="mt8" style={{ fontSize: 13 }}>Upload grid · caption per item · admin ✅ / ❌ verification — to be built.</p>
          </div>
        </div>
      )}

    </div>
  )
}
