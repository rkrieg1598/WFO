import { useEffect, useState } from 'react'
import { TopBar, Loader, Avatar } from '../components/UI'
import { fetchPlayers, fetchScores, fetchBonus, computeStandings } from '../lib/scoring'
import { EVENTS } from '../lib/supabase'
import { supabase } from '../lib/supabase'

export default function Standings() {
  const [loading, setLoading] = useState(true)
  const [standings, setStandings] = useState([])
  const [expanded, setExpanded] = useState(null)

  async function load() {
    const [players, scores, bonuses] = await Promise.all([fetchPlayers(), fetchScores(), fetchBonus()])
    setStandings(computeStandings(players, scores, bonuses))
    setLoading(false)
  }

  useEffect(() => {
    load()
    // live updates
    const ch = supabase.channel('scores-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_points' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  if (loading) return <div className="screen"><Loader label="Tallying the scores…" /></div>

  const medal = (rank) => (rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`)

  return (
    <div className="screen">
      <TopBar title="the leaderboard" />
      <div className="center rise rise-1" style={{ marginBottom: 14 }}>
        <h1 className="postcard-title" style={{ fontSize: 38 }}>Standings</h1>
        <div className="pill pill-gold mt8">🔴 Live — updates in real time</div>
      </div>

      <div className="stack">
        {standings.map((row, i) => {
          const isTop = row.rank === 1
          const open = expanded === row.player.id
          return (
            <div key={row.player.id} className={`card rise rise-${Math.min(i + 1, 6)}`} style={{
              padding: 0, overflow: 'hidden',
              background: isTop ? 'var(--gold)' : 'var(--cream-soft)',
            }}>
              <button onClick={() => setExpanded(open ? null : row.player.id)} style={{
                all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: 12, padding: 14, width: '100%', boxSizing: 'border-box',
              }}>
                <span className="display" style={{ fontSize: 22, width: 40, textAlign: 'center' }}>{medal(row.rank)}</span>
                <Avatar url={row.player.avatar_url} name={row.player.name} size={48} />
                <div style={{ flex: 1 }}>
                  <div className="display" style={{ fontSize: 16 }}>{row.player.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{Object.keys(row.events).length} events scored</div>
                </div>
                <div className="center">
                  <div className="postcard-title" style={{ fontSize: 26, color: isTop ? 'var(--ink)' : 'var(--coral-deep)' }}>{row.total}</div>
                  <div className="eyebrow" style={{ fontSize: 9 }}>points</div>
                </div>
              </button>
              {open && (
                <div style={{ padding: '0 14px 14px', borderTop: '2px dashed var(--ink)' }}>
                  <div className="rail" style={{ marginTop: 12 }}>
                    {EVENTS.map((ev) => {
                      const r = row.events[ev.key]
                      return (
                        <div key={ev.key} className="card-flat" style={{ minWidth: 96, textAlign: 'center', padding: 10, background: r ? 'var(--powder)' : '#fff', opacity: r ? 1 : 0.55 }}>
                          <div style={{ fontSize: 24 }}>{ev.emoji}</div>
                          <div className="display" style={{ fontSize: 10, margin: '4px 0' }}>{ev.name}</div>
                          {r ? <span className="pill pill-coral" style={{ fontSize: 10 }}>{r.points} pts</span>
                             : <span className="muted" style={{ fontSize: 10 }}>—</span>}
                        </div>
                      )
                    })}
                  </div>
                  {row.bonuses && row.bonuses.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div className="eyebrow" style={{ marginBottom: 6 }}>⭐ Bonus Points</div>
                      {row.bonuses.map((b, i) => (
                        <div key={i} className="between" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 13 }}>{b.reason || 'Bonus'}</span>
                          <span className="pill pill-gold" style={{ fontSize: 10 }}>+{b.points} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {standings.length === 0 && <div className="card center muted">No players have joined yet.</div>}
      </div>

    </div>
  )
}
