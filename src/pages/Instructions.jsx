import { useEffect, useState } from 'react'
import { TopBar, Loader } from '../components/UI'
import { EVENTS, supabase } from '../lib/supabase'

export default function Instructions() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({})       // keyed by event_key
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    supabase.from('instructions').select('*').then(({ data }) => {
      const map = {}
      ;(data || []).forEach((r) => { map[r.event_key] = r })
      setData(map)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="screen"><Loader label="Unfolding the rule book…" /></div>

  // Detail view
  if (selected) {
    const ev = EVENTS.find((e) => e.key === selected)
    const info = data[selected] || {}
    return (
      <div className="screen">
        <TopBar title="instructions" />
        <button onClick={() => setSelected(null)} className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>← All Events</button>

        <div className="card rise rise-1">
          <div className="row" style={{ gap: 12 }}>
            <span style={{ fontSize: 44 }}>{ev.emoji}</span>
            <div>
              <h1 className="postcard-title" style={{ fontSize: 30 }}>{ev.name}</h1>
              {ev.team && <span className="pill pill-teal mt8">👯 4 teams of 2</span>}
            </div>
          </div>
        </div>

        {info.image_url && (
          <img src={info.image_url} alt={ev.name} className="rise rise-2 mt16" style={{ width: '100%', borderRadius: 'var(--radius)', border: '3px solid var(--ink)', boxShadow: 'var(--shadow-hard)' }} />
        )}

        <div className="card-flat rise rise-3 mt16">
          <div className="eyebrow">How to Play</div>
          <p className="mt8" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {info.body || 'Instructions for this event haven’t been added yet. Check back soon!'}
          </p>
        </div>

        {info.map_embed && (
          <div className="card rise rise-4 mt16" style={{ padding: 8 }}>
            <div className="eyebrow" style={{ padding: '4px 8px' }}>📍 Where it goes down</div>
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid var(--ink)', marginTop: 6 }}
                 dangerouslySetInnerHTML={{ __html: makeResponsive(info.map_embed) }} />
          </div>
        )}

      </div>
    )
  }

  // List view
  return (
    <div className="screen">
      <TopBar title="instructions & maps" />
      <div className="center rise rise-1" style={{ marginBottom: 16 }}>
        <h1 className="postcard-title" style={{ fontSize: 34 }}>The Rule Book</h1>
        <p className="muted" style={{ color: 'var(--cream)' }}>Tap an event to see how to play.</p>
      </div>

      <div className="stack">
        {EVENTS.map((ev, i) => (
          <button key={ev.key} onClick={() => setSelected(ev.key)} className={`card rise rise-${Math.min(i + 1, 6)}`} style={{
            all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
            padding: 16, boxSizing: 'border-box', background: 'var(--cream-soft)',
            border: '3px solid var(--ink)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-hard)',
          }}>
            <span style={{ fontSize: 36 }}>{ev.emoji}</span>
            <div style={{ flex: 1 }}>
              <div className="display" style={{ fontSize: 18 }}>{ev.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {data[ev.key]?.body ? 'Rules ready' : 'Coming soon'} · {ev.team ? 'Teams' : 'Individual'}
              </div>
            </div>
            <span style={{ fontSize: 22, color: 'var(--coral)' }}>→</span>
          </button>
        ))}
      </div>

    </div>
  )
}

// Force any pasted Google Maps iframe to be full-width & responsive
function makeResponsive(embed) {
  if (!embed) return ''
  return embed
    .replace(/width="\d+"/, 'width="100%"')
    .replace(/height="\d+"/, 'height="220"')
    .replace(/style="[^"]*"/, 'style="border:0;display:block"')
}
