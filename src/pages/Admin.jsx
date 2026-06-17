import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TopBar, Loader, Avatar } from '../components/UI'
import { EVENTS, supabase } from '../lib/supabase'
import { fetchPlayers, assignPlaces, pointsForPlace } from '../lib/scoring'
import BracketManager from '../components/BracketManager'

const TABS = [
  { key: 'scores',    label: '🏅 Scores'    },
  { key: 'rules',     label: '📋 Rules'     },
  { key: 'teams',     label: '👯 Teams'     },
  { key: 'scavenger', label: '🔍 Scavenger' },
  { key: 'settings',  label: '⚙️ Settings'  },
]

export default function Admin() {
  const { isAdmin, loading: authLoading } = useAuth()
  const [tab, setTab] = useState('scores')
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchPlayers().then((p) => { setPlayers(p); setLoading(false) }) }, [])

  if (authLoading || loading) return <div className="screen"><Loader /></div>
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="screen">
      <TopBar title="admin panel" />
      <div className="center rise rise-1" style={{ marginBottom: 12 }}>
        <h1 className="postcard-title" style={{ fontSize: 32 }}>🛠️ Control Room</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`btn btn-sm ${tab === t.key ? 'btn-coral' : 'btn-ghost'}`} style={{ whiteSpace: 'nowrap', width: '100%', fontSize: 11, padding: '8px 4px' }}>{t.label}</button>
        ))}
      </div>

      {tab === 'scores'    && <ScoresTab players={players} />}
      {tab === 'rules'     && <RulesTab />}
      {tab === 'teams'     && <TeamsTab  players={players} />}
      {tab === 'scavenger' && <ScavengerTab />}
      {tab === 'settings'  && <SettingsTab />}

    </div>
  )
}

/* ---------- SCORES ---------- */
const BRACKET_EVENT_KEYS = ['redneck_hs']
const TEAM_PLACE_EVENT_KEYS = ['scavenger']
const BONUS_KEY = '__bonus__'

function ScoresTab({ players }) {
  const [eventKey, setEventKey] = useState(EVENTS[0].key)
  const [rawScores, setRawScores] = useState({})
  const [bracketPlacements, setBracketPlacements] = useState(null)
  const [teamPlaces, setTeamPlaces] = useState({ 1: '', 2: '', 3: '', 4: '' })
  const [bonuses, setBonuses] = useState({})
  const [savedBonuses, setSavedBonuses] = useState([])
  const [msg, setMsg] = useState('')

  const isBonus = eventKey === BONUS_KEY
  const isBracketEvent = BRACKET_EVENT_KEYS.includes(eventKey)
  const isTeamPlaceEvent = TEAM_PLACE_EVENT_KEYS.includes(eventKey)
  const ev = EVENTS.find((e) => e.key === eventKey)

  useEffect(() => {
    setRawScores({})
    setBracketPlacements(null)
    setTeamPlaces({ 1: '', 2: '', 3: '', 4: '' })
    setBonuses({})

    if (isBonus) {
      supabase.from('bonus_points')
        .select('*').order('created_at', { ascending: false })
        .then(({ data }) => setSavedBonuses(data || []))
    } else if (isBracketEvent) {
      supabase.from('scores').select('*').eq('event_key', eventKey).then(({ data }) => {
        const m = {}
        ;(data || []).forEach((s) => { m[s.player_id] = s.place })
        setBracketPlacements(Object.keys(m).length > 0 ? m : null)
      })
    } else if (isTeamPlaceEvent) {
      // load existing team placements from scores
      supabase.from('scores').select('*').eq('event_key', eventKey).then(({ data }) => {
        if (!data || data.length === 0) return
        // find one row per team_no and get its place
        const seen = {}
        data.forEach((s) => {
          const p = players.find((pl) => pl.id === s.player_id)
          if (p?.team_no && !seen[p.team_no]) seen[p.team_no] = s.place
        })
        setTeamPlaces((prev) => ({ ...prev, ...seen }))
      })
    } else {
      supabase.from('scores').select('*').eq('event_key', eventKey).then(({ data }) => {
        const m = {}
        ;(data || []).forEach((s) => { m[s.player_id] = s.raw_score ?? s.place })
        setRawScores(m)
      })
    }
  }, [eventKey])

  const preview = (!isBonus && !isBracketEvent) ? assignPlaces(eventKey, rawScores) : []
  const placeOf = (pid) => preview.find((r) => r.player_id === pid)?.place
  const medal = (pl) => pl === 1 ? '🥇' : pl === 2 ? '🥈' : pl === 3 ? '🥉' : pl ? `#${pl}` : '—'

  async function saveScores() {
    const ranked = assignPlaces(eventKey, rawScores)
    if (ranked.length === 0) { setMsg('⚠️ Enter at least one score first.'); return }
    setMsg('Saving…')
    const del = await supabase.from('scores').delete().eq('event_key', eventKey)
    if (del.error) { setMsg('❌ ' + del.error.message); return }
    const ins = await supabase.from('scores').insert(
      ranked.map(({ player_id, raw_score, place }) => ({ event_key: eventKey, player_id, raw_score, place }))
    )
    if (ins.error) { setMsg('❌ ' + ins.error.message); return }
    const res = await supabase.from('results').upsert({ event_key: eventKey, completed: true }, { onConflict: 'event_key' })
    if (res.error) { setMsg('❌ ' + res.error.message); return }
    setMsg('✅ Scores saved — places auto-assigned!')
    setTimeout(() => setMsg(''), 2500)
  }

  async function saveTeamPlaces() {
    const entries = Object.entries(teamPlaces).filter(([, v]) => v !== '' && v !== null)
    if (entries.length === 0) { setMsg('\u26A0\uFE0F Assign at least one team place first.'); return }
    setMsg('Saving\u2026')
    const del = await supabase.from('scores').delete().eq('event_key', eventKey)
    if (del.error) { setMsg('\u274C ' + del.error.message); return }
    // build one row per player on each team
    const rows = []
    entries.forEach(([teamNo, place]) => {
      const teamPlayers = players.filter((p) => p.team_no === Number(teamNo))
      teamPlayers.forEach((p) => {
        rows.push({ event_key: eventKey, player_id: p.id, place: Number(place), raw_score: null })
      })
    })
    if (rows.length === 0) { setMsg('\u26A0\uFE0F No players found for the selected teams. Make sure teams are assigned.'); return }
    const ins = await supabase.from('scores').insert(rows)
    if (ins.error) { setMsg('\u274C ' + ins.error.message); return }
    const res = await supabase.from('results').upsert({ event_key: eventKey, completed: true }, { onConflict: 'event_key' })
    if (res.error) { setMsg('\u274C ' + res.error.message); return }
    setMsg('\u2705 Scavenger Hunt places saved!')
    setTimeout(() => setMsg(''), 2500)
  }

  async function saveBonuses() {
    const entries = Object.entries(bonuses).filter(([, v]) => v.points && Number(v.points) !== 0)
    if (entries.length === 0) { setMsg('⚠️ Enter at least one bonus point value.'); return }
    setMsg('Saving…')
    const ins = await supabase.from('bonus_points').insert(
      entries.map(([player_id, v]) => ({
        player_id, points: Number(v.points), reason: v.reason?.trim() || null,
      }))
    )
    if (ins.error) { setMsg('❌ ' + ins.error.message); return }
    const { data } = await supabase.from('bonus_points').select('*').order('created_at', { ascending: false })
    setSavedBonuses(data || [])
    setBonuses({})
    setMsg('✅ Bonus points saved!')
    setTimeout(() => setMsg(''), 2500)
  }

  async function deleteBonus(id) {
    await supabase.from('bonus_points').delete().eq('id', id)
    const { data } = await supabase.from('bonus_points').select('*').order('created_at', { ascending: false })
    setSavedBonuses(data || [])
  }

  // group saved bonuses by player for display
  const bonusByPlayer = {}
  savedBonuses.forEach((b) => {
    if (!bonusByPlayer[b.player_id]) bonusByPlayer[b.player_id] = { total: 0, entries: [] }
    bonusByPlayer[b.player_id].total += b.points
    bonusByPlayer[b.player_id].entries.push(b)
  })

  return (
    <div className="stack">
      {/* Dropdown */}
      <div className="card-flat">
        <label className="label">Event</label>
        <select className="input" value={eventKey} onChange={(e) => setEventKey(e.target.value)}>
          {EVENTS.map((e) => (
            <option key={e.key} value={e.key}>{e.emoji} {e.name}{e.team ? ' (teams)' : ''}</option>
          ))}
          <option value={BONUS_KEY}>⭐ Bonus Points</option>
        </select>

        {isBonus ? (
          <div className="pill pill-gold mt8" style={{ fontSize: 11 }}>
            ⭐ Bonus points are added directly to each player's total — no ranking
          </div>
        ) : isBracketEvent ? (
          <div className="pill pill-gold mt8" style={{ fontSize: 11 }}>
            🎯 Bracket event — scores filled automatically from bracket results
          </div>
        ) : isTeamPlaceEvent ? (
          <div className="pill pill-teal mt8" style={{ fontSize: 11 }}>
            👯 Team event — assign 1st/2nd/3rd/4th place to each team manually
          </div>
        ) : (
          <div className="pill pill-teal mt8" style={{ fontSize: 11 }}>
            {ev?.lowWins ? '⬇️ Lowest score wins' : '⬆️ Highest score wins'} · Enter {ev?.scoreLabel?.toLowerCase() || 'score'} per player
          </div>
        )}
      </div>

      {/* ── BONUS POINTS VIEW ── */}
      {isBonus && (
        <>
          {/* Input row per player */}
          {players.map((p) => (
            <div key={p.id} className="card-flat" style={{ gap: 10 }}>
              <div className="between" style={{ marginBottom: 8 }}>
                <div className="row">
                  <Avatar url={p.avatar_url} name={p.name} size={36} />
                  <span className="display" style={{ fontSize: 14 }}>{p.name}</span>
                </div>
                {bonusByPlayer[p.id] && (
                  <span className="pill pill-gold" style={{ fontSize: 10 }}>
                    +{bonusByPlayer[p.id].total} saved
                  </span>
                )}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  type="number"
                  placeholder="+pts"
                  style={{ width: 80, textAlign: 'center' }}
                  value={bonuses[p.id]?.points ?? ''}
                  onChange={(e) => setBonuses({ ...bonuses, [p.id]: { ...bonuses[p.id], points: e.target.value } })}
                />
                <input
                  className="input"
                  placeholder="Reason (e.g. Strike chain)"
                  style={{ flex: 1, fontSize: 13 }}
                  value={bonuses[p.id]?.reason ?? ''}
                  onChange={(e) => setBonuses({ ...bonuses, [p.id]: { ...bonuses[p.id], reason: e.target.value } })}
                />
              </div>
            </div>
          ))}

          <button onClick={saveBonuses} className="btn btn-gold">⭐ Save Bonus Points</button>

          {/* History of saved bonuses */}
          {savedBonuses.length > 0 && (
            <div className="card-flat">
              <div className="eyebrow" style={{ marginBottom: 10 }}>📋 Bonus History</div>
              {players.filter(p => bonusByPlayer[p.id]).map((p) => (
                <div key={p.id} style={{ marginBottom: 14 }}>
                  <div className="between" style={{ marginBottom: 6 }}>
                    <div className="row">
                      <Avatar url={p.avatar_url} name={p.name} size={28} />
                      <span className="display" style={{ fontSize: 13 }}>{p.name}</span>
                    </div>
                    <span className="pill pill-gold" style={{ fontSize: 10 }}>+{bonusByPlayer[p.id].total} pts total</span>
                  </div>
                  {bonusByPlayer[p.id].entries.map((b) => (
                    <div key={b.id} className="between" style={{
                      padding: '7px 10px', background: 'var(--powder)',
                      borderRadius: 10, marginBottom: 5, border: '1.5px solid var(--ink)',
                    }}>
                      <div>
                        <span className="display" style={{ fontSize: 12, color: 'var(--teal-deep)' }}>+{b.points} pts</span>
                        {b.reason && <span className="muted" style={{ fontSize: 12 }}> · {b.reason}</span>}
                      </div>
                      <button onClick={() => deleteBonus(b.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: .6,
                      }}>🗑️</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {msg && <div className="pill pill-gold" style={{ width: '100%', justifyContent: 'center' }}>{msg}</div>}
        </>
      )}

      {/* ── TEAM PLACE EVENT VIEW (Scavenger Hunt) ── */}
      {isTeamPlaceEvent && (
        <>
          {[1, 2, 3, 4].map((teamNo) => {
            const teamPlayers = players.filter((p) => p.team_no === teamNo)
            const pts = teamPlaces[teamNo] ? [8, 6, 4, 2][Number(teamPlaces[teamNo]) - 1] : null
            return (
              <div key={teamNo} className="card-flat between" style={{ gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div className="display" style={{ fontSize: 13, marginBottom: 4 }}>
                    Team {teamNo}
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {teamPlayers.length > 0
                      ? teamPlayers.map((p) => p.name).join(' & ')
                      : 'No players assigned'}
                  </div>
                </div>
                <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                  <select
                    className="input"
                    style={{ width: 110, fontSize: 12 }}
                    value={teamPlaces[teamNo] ?? ''}
                    onChange={(e) => setTeamPlaces({ ...teamPlaces, [teamNo]: e.target.value })}
                  >
                    <option value="">-- Place --</option>
                    <option value="1">🥇 1st</option>
                    <option value="2">🥈 2nd</option>
                    <option value="3">🥉 3rd</option>
                    <option value="4">4th</option>
                  </select>
                  {pts !== null && (
                    <span className="pill pill-gold" style={{ fontSize: 10 }}>{pts} pts</span>
                  )}
                </div>
              </div>
            )
          })}
          <button onClick={saveTeamPlaces} className="btn btn-coral">💾 Save Scavenger Places</button>
          {msg && <div className="pill pill-gold" style={{ width: '100%', justifyContent: 'center' }}>{msg}</div>}
        </>
      )}

      {/* ── BRACKET EVENT VIEW ── */}
      {isBracketEvent && (
        <>
          {bracketPlacements ? (
            <>
              <div className="card-flat" style={{ background: 'var(--powder)' }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>✅ Auto-filled from bracket</div>
                {players
                  .filter(p => bracketPlacements[p.id])
                  .sort((a, b) => bracketPlacements[a.id] - bracketPlacements[b.id])
                  .map(p => (
                    <div key={p.id} className="between" style={{ marginBottom: 8 }}>
                      <div className="row">
                        <span style={{ fontSize: 20, width: 30 }}>{medal(bracketPlacements[p.id])}</span>
                        <Avatar url={p.avatar_url} name={p.name} size={34} />
                        <span className="display" style={{ fontSize: 13 }}>{p.name}</span>
                      </div>
                      <span className="pill pill-coral" style={{ fontSize: 10 }}>
                        {pointsForPlace(eventKey, bracketPlacements[p.id])} pts
                      </span>
                    </div>
                  ))}
              </div>
              <div className="card-flat muted" style={{ fontSize: 12, textAlign: 'center' }}>
                To change these results, reset the bracket in the 👯 Teams tab and run it again.
              </div>
            </>
          ) : (
            <div className="card center" style={{ background: 'var(--cream-soft)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
              <div className="display" style={{ fontSize: 14 }}>No bracket results yet</div>
              <p className="muted mt8" style={{ fontSize: 12, lineHeight: 1.4 }}>
                Run the bracket for this event in the <b>👯 Teams</b> tab. Once complete, placements appear here automatically.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── MANUAL EVENT VIEW ── */}
      {!isBonus && !isBracketEvent && (
        <>
          {players.map((p) => {
            const pl = placeOf(p.id)
            return (
              <div key={p.id} className="card-flat between" style={{ gap: 10 }}>
                <div className="row" style={{ flex: 1, minWidth: 0 }}>
                  <Avatar url={p.avatar_url} name={p.name} size={38} />
                  <span className="display" style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                </div>
                <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                  <input
                    className="input" type="number" min="0" placeholder="Score"
                    style={{ width: 90, textAlign: 'center' }}
                    value={rawScores[p.id] ?? ''}
                    onChange={(e) => setRawScores({ ...rawScores, [p.id]: e.target.value })}
                  />
                  <span className="display" style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{medal(pl)}</span>
                </div>
              </div>
            )
          })}
          {players.length === 0 && <div className="card muted center">No players have signed up yet.</div>}

          <div className="card-flat mt8" style={{ background: 'var(--powder)', fontSize: 13 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>👀 Live Place Preview</div>
            {preview.length === 0
              ? <span className="muted">Enter scores above to see auto-ranked places.</span>
              : preview.map((r) => {
                  const p = players.find((pl) => pl.id === r.player_id)
                  return (
                    <div key={r.player_id} className="between" style={{ marginBottom: 6 }}>
                      <div className="row">
                        <span style={{ width: 28, fontSize: 18 }}>{medal(r.place)}</span>
                        <span className="display" style={{ fontSize: 13 }}>{p?.name}</span>
                      </div>
                      <span className="muted" style={{ fontSize: 12 }}>{r.raw_score} → {pointsForPlace(eventKey, r.place)} pts</span>
                    </div>
                  )
                })}
          </div>

          <button onClick={saveScores} className="btn btn-coral">💾 Save & Auto-Rank</button>
          {msg && <div className="pill pill-gold" style={{ width: '100%', justifyContent: 'center' }}>{msg}</div>}
        </>
      )}
    </div>
  )
}

/* ---------- RULES ---------- */
function RulesTab() {
  const [eventKey, setEventKey] = useState(EVENTS[0].key)
  const [body, setBody] = useState('')
  const [mapEmbed, setMapEmbed] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('instructions').select('*').eq('event_key', eventKey).single().then(({ data }) => {
      setBody(data?.body || ''); setMapEmbed(data?.map_embed || ''); setImageUrl(data?.image_url || '')
    })
  }, [eventKey])

  async function uploadImage(e) {
    const f = e.target.files?.[0]; if (!f) return
    setMsg('Uploading image…')
    const path = `instructions/${eventKey}-${Date.now()}.${f.name.split('.').pop()}`
    await supabase.storage.from('photos').upload(path, f, { upsert: true })
    setImageUrl(supabase.storage.from('photos').getPublicUrl(path).data.publicUrl)
    setMsg('Image ready — remember to save!')
  }

  async function save() {
    setMsg('Saving…')
    await supabase.from('instructions').upsert({
      event_key: eventKey, body, map_embed: mapEmbed, image_url: imageUrl,
    }, { onConflict: 'event_key' })
    setMsg('✅ Saved!'); setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className="stack">
      <div className="card-flat">
        <label className="label">Event</label>
        <select className="input" value={eventKey} onChange={(e) => setEventKey(e.target.value)}>
          {EVENTS.map((e) => <option key={e.key} value={e.key}>{e.emoji} {e.name}</option>)}
        </select>
      </div>
      <div className="card-flat">
        <label className="label">Instructions</label>
        <textarea className="textarea" style={{ minHeight: 140 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="How to play, scoring, rules…" />
      </div>
      <div className="card-flat">
        <label className="label">Photo</label>
        {imageUrl && <img src={imageUrl} alt="" style={{ width: '100%', borderRadius: 10, border: '2px solid var(--ink)', marginBottom: 10 }} />}
        <label className="btn btn-sky btn-sm" style={{ cursor: 'pointer' }}>
          📷 Upload Photo<input type="file" accept="image/*" onChange={uploadImage} style={{ display: 'none' }} />
        </label>
      </div>
      <div className="card-flat">
        <label className="label">Google Maps Embed</label>
        <textarea className="textarea" value={mapEmbed} onChange={(e) => setMapEmbed(e.target.value)} placeholder='Paste the <iframe …> embed code from Google Maps → Share → Embed a map' />
        <p className="muted mt8" style={{ fontSize: 11 }}>In Google Maps: search the location → Share → “Embed a map” → Copy HTML → paste here.</p>
      </div>
      <button onClick={save} className="btn btn-coral">💾 Save Instructions</button>
      {msg && <div className="pill pill-gold center" style={{ width: '100%', justifyContent: 'center' }}>{msg}</div>}
    </div>
  )
}

/* ---------- TEAMS ---------- */
function TeamsTab({ players }) {
  const TEAM_COLORS = ['var(--coral)', 'var(--teal)', 'var(--gold)', 'var(--sky-deep)']
  const TEAM_NAMES  = ['Team 1', 'Team 2', 'Team 3', 'Team 4']

  // teams: { 1: [pid, pid], 2: [pid, pid], 3: [pid, pid], 4: [pid, pid] }
  const [teams, setTeams] = useState({ 1: [null, null], 2: [null, null], 3: [null, null], 4: [null, null] })
  const [msg, setMsg] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('id,team_no,team_slot').then(({ data }) => {
      if (!data) return
      const t = { 1: [null, null], 2: [null, null], 3: [null, null], 4: [null, null] }
      data.forEach((p) => {
        if (p.team_no && p.team_slot !== null && p.team_slot !== undefined) {
          t[p.team_no][p.team_slot] = p.id
        }
      })
      setTeams(t)
    })
  }, [])

  // all player ids currently assigned somewhere
  const assigned = new Set(Object.values(teams).flat().filter(Boolean))
  const unassigned = players.filter((p) => !assigned.has(p.id))
  const allAssigned = unassigned.length === 0 && players.length === 8

  function setSlot(teamNo, slot, pid) {
    // if this player is already assigned elsewhere, clear that slot first
    const next = { ...teams }
    for (let t = 1; t <= 4; t++) {
      next[t] = [...next[t]]
      next[t].forEach((id, s) => { if (id === pid && !(t === teamNo && s === slot)) next[t][s] = null })
    }
    next[teamNo] = [...next[teamNo]]
    next[teamNo][slot] = pid || null
    setTeams(next)
    setSaved(false)
  }

  function clearAll() {
    setTeams({ 1: [null, null], 2: [null, null], 3: [null, null], 4: [null, null] })
    setSaved(false)
  }

  async function save() {
    // validate: each team must have exactly 2 players
    for (let t = 1; t <= 4; t++) {
      if (teams[t].some((id) => !id)) {
        setMsg('⚠️ Every team needs exactly 2 players before saving.')
        setTimeout(() => setMsg(''), 3000)
        return
      }
    }
    setMsg('Saving…')
    // clear all team assignments first
    const clear = await supabase.from('profiles').update({ team_no: null, team_slot: null }).neq('id', '00000000-0000-0000-0000-000000000000')
    if (clear.error) { setMsg('❌ ' + clear.error.message); return }
    // save each slot
    for (let t = 1; t <= 4; t++) {
      for (let s = 0; s < 2; s++) {
        const pid = teams[t][s]
        if (pid) {
          const upd = await supabase.from('profiles').update({ team_no: t, team_slot: s }).eq('id', pid)
          if (upd.error) { setMsg('❌ ' + upd.error.message); return }
        }
      }
    }
    setSaved(true)
    setMsg('✅ Teams saved!')
    setTimeout(() => setMsg(''), 2500)
  }

  const playerById = (id) => players.find((p) => p.id === id)

  return (
    <div className="stack">
      <div className="card-flat" style={{ background: 'var(--powder)' }}>
        <div className="eyebrow">🔍 Scavenger Hunt Teams</div>
        <p className="muted mt8" style={{ fontSize: 13 }}>
          Assign all 8 players into 4 teams of 2. Each player can only be on one team.
          {players.length < 8 && <span style={{ color: 'var(--coral-deep)', display: 'block', marginTop: 4 }}>
            ⚠️ Only {players.length}/8 players have signed up yet.
          </span>}
        </p>
      </div>

      {[1, 2, 3, 4].map((teamNo) => (
        <div key={teamNo} className="card" style={{ padding: 14, borderColor: TEAM_COLORS[teamNo - 1], background: 'var(--cream-soft)' }}>
          <div className="between" style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: TEAM_COLORS[teamNo - 1], border: '2px solid var(--ink)' }} />
              <span className="display" style={{ fontSize: 16 }}>{TEAM_NAMES[teamNo - 1]}</span>
            </div>
            <span className="pill" style={{
              background: teams[teamNo].every(Boolean) ? TEAM_COLORS[teamNo - 1] : '#fff',
              color: teams[teamNo].every(Boolean) ? 'var(--cream)' : 'var(--ink-soft)',
              fontSize: 10,
            }}>
              {teams[teamNo].filter(Boolean).length}/2 players
            </span>
          </div>

          {[0, 1].map((slot) => {
            const pid = teams[teamNo][slot]
            const p = pid ? playerById(pid) : null
            // options: unassigned players + current occupant of this slot
            const opts = players.filter((pl) => !assigned.has(pl.id) || pl.id === pid)
            return (
              <div key={slot} className="between" style={{
                padding: '10px 12px', marginBottom: slot === 0 ? 8 : 0,
                background: p ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.35)',
                borderRadius: 12, border: `2px dashed ${p ? TEAM_COLORS[teamNo - 1] : 'rgba(31,58,61,.25)'}`,
              }}>
                <div className="row" style={{ gap: 10 }}>
                  {p
                    ? <><Avatar url={p.avatar_url} name={p.name} size={34} />
                        <span className="display" style={{ fontSize: 13 }}>{p.name}</span></>
                    : <span className="muted" style={{ fontSize: 13 }}>Player {slot + 1}</span>
                  }
                </div>
                <select
                  className="input"
                  style={{ width: 130, fontSize: 12 }}
                  value={pid || ''}
                  onChange={(e) => setSlot(teamNo, slot, e.target.value)}
                >
                  <option value="">— assign —</option>
                  {opts.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                  {pid && !opts.find(o => o.id === pid) && (
                    <option value={pid}>{playerById(pid)?.name}</option>
                  )}
                </select>
              </div>
            )
          })}
        </div>
      ))}

      {unassigned.length > 0 && (
        <div className="card-flat" style={{ background: 'var(--powder)' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>⏳ Not Yet Assigned</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {unassigned.map((p) => (
              <div key={p.id} className="row" style={{ gap: 6, background: '#fff', border: '2px solid var(--ink)', borderRadius: 999, padding: '4px 10px' }}>
                <Avatar url={p.avatar_url} name={p.name} size={24} />
                <span className="display" style={{ fontSize: 12 }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 10 }}>
        <button onClick={clearAll} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>🗑️ Clear All</button>
        <button onClick={save} className="btn btn-coral" style={{ flex: 2 }}>💾 Save Teams</button>
      </div>
      {msg && <div className="pill pill-gold" style={{ width: '100%', justifyContent: 'center' }}>{msg}</div>}

      {/* Divider */}
      <hr className="divider" style={{ margin: '20px 0 8px' }} />
      <div className="eyebrow" style={{ marginBottom: 12, textAlign: 'center' }}>🎯 Air Hockey & Horseshoes Brackets</div>
      <BracketManager players={players} />
    </div>
  )
}

/* ---------- SETTINGS ---------- */
function SettingsTab() {
  const [unlocked, setUnlocked] = useState(false)
  const [results, setResults] = useState([])
  const [msg, setMsg] = useState('')

  async function load() {
    const s = await supabase.from('settings').select('value').eq('key', 'scavenger_unlocked').single()
    setUnlocked(!!(s.data && s.data.value === 'true'))
    const r = await supabase.from('results').select('event_key, completed')
    setResults(r.data || [])
  }
  useEffect(() => { load() }, [])

  async function toggleScavenger() {
    const v = unlocked ? 'false' : 'true'
    await supabase.from('settings').upsert({ key: 'scavenger_unlocked', value: v }, { onConflict: 'key' })
    setUnlocked(!unlocked)
    setMsg('✅ Updated!'); setTimeout(() => setMsg(''), 1500)
  }

  async function toggleComplete(key, completed) {
    await supabase.from('results').upsert({ event_key: key, completed: !completed }, { onConflict: 'event_key' })
    load()
  }

  const completedSet = new Set(results.filter((r) => r.completed).map((r) => r.event_key))

  return (
    <div className="stack">
      {/* Scavenger unlock */}
      <div className="card-flat between">
        <div>
          <div className="display" style={{ fontSize: 15 }}>🔍 Scavenger Hunt</div>
          <div className="muted" style={{ fontSize: 12 }}>{unlocked ? 'Unlocked for players' : 'Locked'}</div>
        </div>
        <button onClick={toggleScavenger} className={'btn btn-sm ' + (unlocked ? 'btn-gold' : 'btn-teal')}>
          {unlocked ? '🔓 Unlocked' : '🔒 Locked'}
        </button>
      </div>

      {/* Mark events complete — in schedule order */}
      <div className="card-flat">
        <div className="eyebrow" style={{ marginBottom: 6 }}>🗓️ Event Schedule</div>
        <p className="muted" style={{ fontSize: 11, marginBottom: 12 }}>
          Check off each event as it finishes. Controls "Previous Event" and "Coming Up Next" on the home screen.
        </p>
        {EVENTS.map((ev, i) => {
          const done = completedSet.has(ev.key)
          const prevDone = i === 0 || completedSet.has(EVENTS[i - 1].key)
          const current = !done && prevDone
          return (
            <div
              key={ev.key}
              onClick={() => toggleComplete(ev.key, done)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 12px', marginBottom: 6,
                cursor: 'pointer',
                background: done ? 'var(--powder)' : current ? '#fff' : 'rgba(255,255,255,.45)',
                borderRadius: 12,
                border: '2px solid ' + (done ? 'var(--ink)' : current ? 'var(--teal)' : 'rgba(31,58,61,.2)'),
                opacity: done || current ? 1 : 0.65,
                transition: 'all .15s ease',
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                border: '2px solid ' + (done ? 'var(--ink)' : 'rgba(31,58,61,.35)'),
                background: done ? 'var(--teal)' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--cream)', fontFamily: 'var(--font-display)', fontSize: 13,
              }}>
                {done ? '✓' : ''}
              </div>
              <span style={{ fontSize: 20 }}>{ev.emoji}</span>
              <div style={{ flex: 1 }}>
                <div className="display" style={{ fontSize: 13, textDecoration: done ? 'line-through' : 'none' }}>
                  {ev.name}
                </div>
                <div className="muted" style={{ fontSize: 10 }}>
                  {done ? 'Completed ✅' : current ? '▶ Up next' : 'Upcoming'}
                </div>
              </div>
              <span className="pill" style={{
                fontSize: 9,
                background: done ? 'var(--teal)' : current ? 'var(--teal)' : 'rgba(31,58,61,.08)',
                color: done || current ? 'var(--cream)' : 'var(--ink-soft)',
                border: '2px solid ' + (done || current ? 'var(--ink)' : 'rgba(31,58,61,.2)'),
              }}>
                {done ? 'Done' : current ? 'Now' : 'Soon'}
              </span>
            </div>
          )
        })}
      </div>

      {msg && <div className="pill pill-gold" style={{ width: '100%', justifyContent: 'center' }}>{msg}</div>}
    </div>
  )
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n] || 'th'}`

/* ---------- SCAVENGER ---------- */
const SCAV_PLACES = ['Grand Floridian', 'Contemporary', 'Polynesian']
const SCAV_DIFFICULTIES = [
  { key: 'easy',   label: 'Easy',   emoji: '🟢' },
  { key: 'medium', label: 'Medium', emoji: '🟡' },
  { key: 'hard',   label: 'Hard',   emoji: '🔴' },
]
const SCAV_NEEDED = { easy: 2, medium: 3, hard: 1 } // per place, per team
const TEAM_NAMES_SCAV = ['Team 1', 'Team 2', 'Team 3', 'Team 4']
const TEAM_COLORS_SCAV = ['var(--coral)', 'var(--teal)', 'var(--gold)', 'var(--sky-deep)']

function ScavengerTab() {
  const [items, setItems] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [place, setPlace] = useState(SCAV_PLACES[0])
  const [difficulty, setDifficulty] = useState('easy')
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const [filterPlace, setFilterPlace] = useState('all')

  async function load() {
    const [{ data: itemData }, { data: assignData }] = await Promise.all([
      supabase.from('scavenger_items').select('*').order('place').order('difficulty').order('created_at'),
      supabase.from('scavenger_assignments').select('*'),
    ])
    setItems(itemData || [])
    setAssignments(assignData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addItem() {
    if (!text.trim()) { setMsg('⚠️ Enter the riddle/item text first.'); setTimeout(() => setMsg(''), 2500); return }
    await supabase.from('scavenger_items').insert({ place, difficulty, text: text.trim() })
    setText('')
    setMsg('✅ Item added!')
    setTimeout(() => setMsg(''), 1500)
    load()
  }

  async function deleteItem(id) {
    await supabase.from('scavenger_items').delete().eq('id', id)
    load()
  }

  // counts per place/difficulty
  function countFor(p, d) {
    return items.filter((i) => i.place === p && i.difficulty === d).length
  }

  // can we distribute? need at least SCAV_NEEDED * 4 teams of each place/difficulty
  const shortages = []
  SCAV_PLACES.forEach((p) => {
    SCAV_DIFFICULTIES.forEach(({ key }) => {
      const needed = SCAV_NEEDED[key] * 4
      const have = countFor(p, key)
      if (have < needed) shortages.push({ place: p, difficulty: key, have, needed })
    })
  })
  const canDistribute = shortages.length === 0
  const alreadyDistributed = assignments.length > 0

  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  async function distribute() {
    if (!canDistribute) return
    setMsg('🎲 Distributing…')

    // For each place + difficulty, shuffle items and deal out the needed amount per team
    const rows = []
    for (let teamNo = 1; teamNo <= 4; teamNo++) {
      SCAV_PLACES.forEach((p) => {
        SCAV_DIFFICULTIES.forEach(({ key }) => {
          const pool = shuffle(items.filter((i) => i.place === p && i.difficulty === key))
          const need = SCAV_NEEDED[key]
          for (let n = 0; n < need; n++) {
            const item = pool[(teamNo - 1) * need + n]
            if (item) rows.push({ team_no: teamNo, item_id: item.id, place: p, difficulty: key })
          }
        })
      })
    }

    await supabase.from('scavenger_assignments').delete().neq('id', 0)
    if (rows.length) await supabase.from('scavenger_assignments').insert(rows)
    setMsg('🎉 Distributed to all 4 teams!')
    setTimeout(() => setMsg(''), 2500)
    load()
  }

  async function clearDistribution() {
    await supabase.from('scavenger_assignments').delete().neq('id', 0)
    setMsg('Distribution cleared.')
    setTimeout(() => setMsg(''), 1500)
    load()
  }

  if (loading) return <div className="card-flat muted center" style={{ fontSize: 13 }}>Loading…</div>

  const itemById = (id) => items.find((i) => i.id === id)
  const filteredItems = filterPlace === 'all' ? items : items.filter((i) => i.place === filterPlace)

  return (
    <div className="stack">

      {/* Add new item */}
      <div className="card-flat" style={{ background: 'var(--powder)' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>🔍 Add Riddle / Item</div>

        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <select className="input" style={{ flex: 1, fontSize: 12 }} value={place} onChange={(e) => setPlace(e.target.value)}>
            {SCAV_PLACES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input" style={{ flex: 1, fontSize: 12 }} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {SCAV_DIFFICULTIES.map((d) => <option key={d.key} value={d.key}>{d.emoji} {d.label}</option>)}
          </select>
        </div>

        <textarea
          className="textarea"
          placeholder="Enter the riddle or item description…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ marginBottom: 8 }}
        />

        <button onClick={addItem} className="btn btn-coral">➕ Add to Item Bank</button>
      </div>

      {/* Progress / shortages */}
      <div className="card-flat">
        <div className="eyebrow" style={{ marginBottom: 8 }}>📊 Item Bank Status</div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          Each team gets {SCAV_NEEDED.easy} easy + {SCAV_NEEDED.medium} medium + {SCAV_NEEDED.hard} hard per place
          ({SCAV_NEEDED.easy + SCAV_NEEDED.medium + SCAV_NEEDED.hard} items × {SCAV_PLACES.length} places = {(SCAV_NEEDED.easy + SCAV_NEEDED.medium + SCAV_NEEDED.hard) * SCAV_PLACES.length} per team).
        </p>
        {SCAV_PLACES.map((p) => (
          <div key={p} style={{ marginBottom: 8 }}>
            <div className="display" style={{ fontSize: 12, marginBottom: 4 }}>{p}</div>
            <div className="row" style={{ gap: 6 }}>
              {SCAV_DIFFICULTIES.map(({ key, label, emoji }) => {
                const have = countFor(p, key)
                const needed = SCAV_NEEDED[key] * 4
                const ok = have >= needed
                return (
                  <span key={key} className="pill" style={{
                    background: ok ? 'var(--teal)' : 'var(--coral)',
                    color: 'var(--cream)', fontSize: 9,
                  }}>
                    {emoji} {label}: {have}/{needed}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Distribute */}
      <div className="card" style={{ background: alreadyDistributed ? 'var(--gold)' : 'var(--teal)', color: alreadyDistributed ? 'var(--ink)' : 'var(--cream)' }}>
        <div className="eyebrow" style={{ color: alreadyDistributed ? 'var(--coral-deep)' : 'var(--sun)', marginBottom: 8 }}>
          {alreadyDistributed ? '✅ Already Distributed' : '🎲 Distribute to Teams'}
        </div>
        {!canDistribute && !alreadyDistributed && (
          <p style={{ fontSize: 12, marginBottom: 10 }}>
            ⚠️ Not enough items yet. Add more to the item bank above (see shortages highlighted in red).
          </p>
        )}
        {canDistribute && !alreadyDistributed && (
          <p style={{ fontSize: 12, marginBottom: 10 }}>
            Ready! Each of the 4 teams will randomly receive {SCAV_NEEDED.easy} easy, {SCAV_NEEDED.medium} medium, and {SCAV_NEEDED.hard} hard item per place.
          </p>
        )}
        {alreadyDistributed && (
          <p style={{ fontSize: 12, marginBottom: 10 }}>
            Items have been randomly assigned to all 4 teams. Re-distributing will reshuffle and replace the current assignments.
          </p>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button onClick={distribute} disabled={!canDistribute} className="btn btn-gold" style={{ flex: 2, opacity: canDistribute ? 1 : 0.5 }}>
            {alreadyDistributed ? '🔁 Re-Distribute' : '🎲 Distribute Now'}
          </button>
          {alreadyDistributed && (
            <button onClick={clearDistribution} className="btn btn-ghost btn-sm" style={{ flex: 1, color: alreadyDistributed ? 'var(--ink)' : 'var(--cream)' }}>🗑️ Clear</button>
          )}
        </div>
      </div>

      {/* Distributed assignments preview */}
      {alreadyDistributed && (
        <div className="card-flat">
          <div className="eyebrow" style={{ marginBottom: 10 }}>📋 Team Assignments</div>
          <div className="stack">
            {[1, 2, 3, 4].map((teamNo) => {
              const teamItems = assignments.filter((a) => a.team_no === teamNo)
              return (
                <div key={teamNo} className="card" style={{ padding: 12, borderColor: TEAM_COLORS_SCAV[teamNo - 1] }}>
                  <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: TEAM_COLORS_SCAV[teamNo - 1], border: '2px solid var(--ink)' }} />
                    <span className="display" style={{ fontSize: 13 }}>{TEAM_NAMES_SCAV[teamNo - 1]}</span>
                  </div>
                  {SCAV_PLACES.map((p) => {
                    const placeItems = teamItems.filter((a) => a.place === p)
                    if (!placeItems.length) return null
                    return (
                      <div key={p} style={{ marginBottom: 8 }}>
                        <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{p}</div>
                        {placeItems.map((a) => {
                          const item = itemById(a.item_id)
                          const diffMeta = SCAV_DIFFICULTIES.find((d) => d.key === a.difficulty)
                          return (
                            <div key={a.id} className="row" style={{ gap: 6, marginBottom: 3, alignItems: 'flex-start' }}>
                              <span style={{ fontSize: 12, flexShrink: 0 }}>{diffMeta?.emoji}</span>
                              <span style={{ fontSize: 12, lineHeight: 1.4 }}>{item ? item.text : '(deleted item)'}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Item bank list */}
      <div className="card-flat">
        <div className="between" style={{ marginBottom: 10 }}>
          <div className="eyebrow">📚 Item Bank ({items.length})</div>
          <select className="input" style={{ width: 140, fontSize: 11 }} value={filterPlace} onChange={(e) => setFilterPlace(e.target.value)}>
            <option value="all">All Places</option>
            {SCAV_PLACES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {filteredItems.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No items yet — add some above!</p>}
        <div className="stack">
          {filteredItems.map((item) => {
            const diffMeta = SCAV_DIFFICULTIES.find((d) => d.key === item.difficulty)
            return (
              <div key={item.id} className="between" style={{ padding: '8px 10px', background: 'rgba(255,255,255,.6)', borderRadius: 10, border: '1.5px solid rgba(31,58,61,.15)', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6, marginBottom: 3 }}>
                    <span className="pill pill-teal" style={{ fontSize: 8 }}>{item.place}</span>
                    <span className="pill" style={{ fontSize: 8, background: '#fff' }}>{diffMeta?.emoji} {diffMeta?.label}</span>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>{item.text}</div>
                </div>
                <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.6, flexShrink: 0 }}>🗑️</button>
              </div>
            )
          })}
        </div>
      </div>

      {msg && <div className="pill pill-gold" style={{ width: '100%', justifyContent: 'center' }}>{msg}</div>}
    </div>
  )
}

