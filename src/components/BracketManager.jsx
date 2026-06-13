import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Avatar } from './UI'
import {
  generateAirHockeyBracket, generateTeamBracket,
  buildRandomHorseshoesTeams, advanceBracket,
  getCurrentMatch, getAllMatches,
} from '../lib/bracket'

const BRACKET_EVENTS = [
  { key: 'air_hockey', label: 'Air Hockey',         emoji: '🏒', type: 'player8'      },
  { key: 'redneck_hs', label: 'Redneck Horseshoes', emoji: '🍺', type: 'team4_random' },
]

export default function BracketManager({ players }) {
  const [activeEvent, setActiveEvent] = useState('air_hockey')
  const [bracketState, setBracketState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [msg, setMsg] = useState('')
  const ev = BRACKET_EVENTS.find(e => e.key === activeEvent)

  useEffect(() => { loadBracket() }, [activeEvent])

  async function loadBracket() {
    setLoading(true)
    setBracketState(null)
    const { data } = await supabase.from('brackets').select('state').eq('event_key', activeEvent).single()
    setBracketState(data?.state || null)
    setLoading(false)
  }

  async function saveBracket(state) {
    await supabase.from('brackets').upsert({ event_key: activeEvent, state, updated_at: new Date().toISOString() }, { onConflict: 'event_key' })
    setBracketState(state)

    // When bracket finishes, auto-write placements to scores table
    if (state.phase === 'complete') {
      await writeBracketScores(state, activeEvent)
    }
  }

  async function writeBracketScores(state, eventKey) {
    // placements: { participantId: place }
    // For air_hockey: participantId = player.id directly
    // For horseshoes: participantId = team id — need to expand to playerIds
    await supabase.from('scores').delete().eq('event_key', eventKey)
    const rows = []
    for (const [id, place] of Object.entries(state.placements)) {
      // find the participant to get playerIds
      const allMatches = getAllMatches(state)
      let playerIds = [id] // default: treat id as player id
      for (const m of allMatches) {
        if (m.a?.id === id && m.a.playerIds) { playerIds = m.a.playerIds; break }
        if (m.b?.id === id && m.b.playerIds) { playerIds = m.b.playerIds; break }
      }
      for (const pid of playerIds) {
        rows.push({ event_key: eventKey, player_id: pid, place, raw_score: null })
      }
    }
    if (rows.length) await supabase.from('scores').insert(rows)
    await supabase.from('results').upsert({ event_key: eventKey, completed: true }, { onConflict: 'event_key' })
  }

  async function generate() {
    let state
    if (ev.type === 'player8') {
      state = generateAirHockeyBracket(players)
    } else {
      const teams = buildRandomHorseshoesTeams(players)
      state = generateTeamBracket(teams, activeEvent)
    }
    await saveBracket(state)
    setScoreA(''); setScoreB('')
  }

  async function submitResult(winnerId, loserId) {
    if (!bracketState) return
    const match = getCurrentMatch(bracketState)
    if (!match) return
    // for 7th/8th tiebreak matches, require scores
    const needsScores = bracketState.type === 'air_hockey' && match.round === 'Losers Bracket'
    if (needsScores && (scoreA === '' || scoreB === '')) {
      setMsg('⚠️ Enter scores for this match — needed to determine 7th vs 8th place.')
      setTimeout(() => setMsg(''), 3000); return
    }
    const sA = needsScores ? Number(scoreA) : null
    const sB = needsScores ? Number(scoreB) : null
    const newState = advanceBracket(bracketState, match.id, winnerId, loserId, sA, sB)
    await saveBracket(newState)
    setScoreA(''); setScoreB('')
    if (newState.phase === 'complete') setMsg('🎉 Bracket complete! Saving final standings…')
  }

  async function resetBracket() {
    await supabase.from('brackets').delete().eq('event_key', activeEvent)
    setBracketState(null)
    setMsg('')
  }

  const match = bracketState ? getCurrentMatch(bracketState) : null
  const allMatches = bracketState ? getAllMatches(bracketState) : []
  const done = allMatches.filter(m => m.complete)
  const needsScores = bracketState?.type === 'air_hockey' && match?.round === 'Losers Bracket'

  return (
    <div>
      {/* Event switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {BRACKET_EVENTS.map(e => (
          <button key={e.key} onClick={() => setActiveEvent(e.key)}
            className={`btn btn-sm ${activeEvent === e.key ? 'btn-coral' : 'btn-ghost'}`}
            style={{ flex: 1, fontSize: 12, padding: '8px 4px' }}>
            {e.emoji} {e.label.split(' ')[0]}
          </button>
        ))}
      </div>

      {loading && <div className="card-flat muted center" style={{ fontSize: 13 }}>Loading bracket…</div>}

      {!loading && !bracketState && (
        <NoBracket ev={ev} players={players} onGenerate={generate} />
      )}

      {!loading && bracketState && (
        <div className="stack">
          {/* Phase indicator */}
          <PhaseBar state={bracketState} />

          {/* Current match */}
          {match && (
            <div className="card" style={{ background: 'var(--teal)', color: 'var(--cream)' }}>
              <div className="eyebrow" style={{ color: 'var(--sun)', marginBottom: 8 }}>
                ▶ {match.round} — Match {match.matchNo}
              </div>
              <MatchCard
                match={match}
                players={players}
                needsScores={needsScores}
                scoreA={scoreA} scoreB={scoreB}
                onScoreA={setScoreA} onScoreB={setScoreB}
                onWin={submitResult}
              />
            </div>
          )}

          {/* Complete */}
          {bracketState.phase === 'complete' && (
            <PlacementsCard state={bracketState} players={players} />
          )}

          {/* Match history */}
          {done.length > 0 && (
            <div className="card-flat">
              <div className="eyebrow" style={{ marginBottom: 10 }}>📋 Match History</div>
              <div className="stack">
                {done.map(m => <HistoryRow key={m.id} match={m} players={players} />)}
              </div>
            </div>
          )}

          {/* 7th/8th info */}
          {bracketState.seventhEighth && bracketState.phase !== 'complete' && (
            <div className="card-flat" style={{ background: 'var(--powder)', fontSize: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>7th / 8th Place</div>
              <p className="muted">After the Losers Bracket games, 7th and 8th place will be decided automatically by who scored more points in their Round 2 game.</p>
            </div>
          )}

          {/* Reset */}
          <button onClick={resetBracket} className="btn btn-ghost btn-sm" style={{ opacity: .7, marginTop: 4 }}>🗑️ Reset Bracket</button>
        </div>
      )}

      {msg && <div className="pill pill-gold mt8" style={{ width: '100%', justifyContent: 'center' }}>{msg}</div>}
    </div>
  )
}

// ---------- Sub-components ----------

function NoBracket({ ev, players, onGenerate }) {
  return (
    <div className="card center" style={{ background: 'var(--cream-soft)' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>{ev.emoji}</div>
      <div className="postcard-title" style={{ fontSize: 22 }}>{ev.label}</div>
      <p className="muted mt8" style={{ fontSize: 13, lineHeight: 1.5 }}>
        {ev.type === 'player8'
          ? `Randomly seeds all ${players.length} players into a bracket. Round 1 matchups are generated fresh each time.`
          : 'Randomly pairs 8 players into 4 teams and generates a bracket. New pairs every time.'}
      </p>
      <button onClick={onGenerate} className="btn btn-coral mt16">
        🎲 Generate Bracket
      </button>
    </div>
  )
}

function PhaseBar({ state }) {
  const phases = state.type === 'air_hockey'
    ? ['round1','round2','round3','complete']
    : ['round1','round2','complete']
  const labels = state.type === 'air_hockey'
    ? ['Round 1','Round 2','Round 3','Done']
    : ['Round 1','Finals','Done']
  const cur = phases.indexOf(state.phase)
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 4 }}>
      {phases.map((p, i) => (
        <div key={p} style={{
          flex: 1, textAlign: 'center', padding: '8px 4px',
          background: i <= cur ? 'var(--gold)' : 'rgba(255,255,255,.3)',
          borderTop: `3px solid ${i <= cur ? 'var(--ink)' : 'rgba(31,58,61,.2)'}`,
          borderBottom: `3px solid ${i <= cur ? 'var(--ink)' : 'rgba(31,58,61,.2)'}`,
          borderLeft: '2px solid ' + (i <= cur ? 'var(--ink)' : 'rgba(31,58,61,.2)'),
          borderRight: i === phases.length - 1 ? '3px solid ' + (i <= cur ? 'var(--ink)' : 'rgba(31,58,61,.2)') : 'none',
          borderRadius: i === 0 ? '10px 0 0 10px' : i === phases.length - 1 ? '0 10px 10px 0' : 0,
        }}>
          <div className="display" style={{ fontSize: 10, color: i <= cur ? 'var(--ink)' : 'var(--ink-soft)' }}>{labels[i]}</div>
        </div>
      ))}
    </div>
  )
}

function MatchCard({ match, players, needsScores, scoreA, scoreB, onScoreA, onScoreB, onWin }) {
  const nameA = match.a?.label || '?'
  const nameB = match.b?.label || '?'
  return (
    <div>
      {needsScores && (
        <div className="card-flat mt8" style={{ background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.4)', marginBottom: 12 }}>
          <div style={{ color: 'var(--sun)', fontFamily: 'var(--font-display)', fontSize: 11, marginBottom: 8 }}>ENTER FINAL SCORES (used for 7th/8th tiebreak)</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--cream)', fontSize: 12, marginBottom: 4, fontWeight: 700 }}>{nameA}</div>
              <input className="input" type="number" min="0" placeholder="Score" value={scoreA} onChange={e => onScoreA(e.target.value)} style={{ textAlign: 'center' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--cream)', fontSize: 12, marginBottom: 4, fontWeight: 700 }}>{nameB}</div>
              <input className="input" type="number" min="0" placeholder="Score" value={scoreB} onChange={e => onScoreB(e.target.value)} style={{ textAlign: 'center' }} />
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', textAlign: 'center', marginBottom: 10 }}>
        Who won this match?
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => onWin(match.a.id, match.b.id)} style={{
          flex: 1, fontFamily: 'var(--font-display)', fontSize: 14,
          background: 'var(--cream)', color: 'var(--ink)',
          border: '3px solid var(--ink)', borderRadius: 12, padding: '14px 8px',
          cursor: 'pointer', boxShadow: '3px 3px 0 rgba(31,58,61,.6)',
          lineHeight: 1.2, textAlign: 'center',
        }}>
          🏆 {nameA}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--sun)', fontFamily: 'var(--font-display)', fontSize: 14 }}>VS</div>
        <button onClick={() => onWin(match.b.id, match.a.id)} style={{
          flex: 1, fontFamily: 'var(--font-display)', fontSize: 14,
          background: 'var(--cream)', color: 'var(--ink)',
          border: '3px solid var(--ink)', borderRadius: 12, padding: '14px 8px',
          cursor: 'pointer', boxShadow: '3px 3px 0 rgba(31,58,61,.6)',
          lineHeight: 1.2, textAlign: 'center',
        }}>
          🏆 {nameB}
        </button>
      </div>
    </div>
  )
}

function HistoryRow({ match }) {
  const winner = match.a?.id === match.winnerId ? match.a : match.b
  const loser  = match.a?.id === match.loserId  ? match.a : match.b
  return (
    <div className="between" style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(31,58,61,.1)' }}>
      <div>
        <span className="display" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{match.round} #{match.matchNo} · </span>
        <span style={{ fontWeight: 700, color: 'var(--teal-deep)' }}>✓ {winner?.label}</span>
        <span className="muted"> vs {loser?.label}</span>
      </div>
      {match.scoreA !== null && (
        <span className="muted" style={{ fontSize: 11 }}>{match.scoreA}–{match.scoreB}</span>
      )}
    </div>
  )
}

function PlacementsCard({ state, players }) {
  const placeEmoji = p => ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'][p-1] || p
  const sorted = Object.entries(state.placements).sort((a,b) => a[1]-b[1])
  const playerById = id => players.find(p => p.id === id)
  return (
    <div className="card" style={{ background: 'var(--gold)' }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>🎉 Final Placements</div>
      <div className="stack">
        {sorted.map(([id, place]) => {
          const p = playerById(id)
          const label = p ? p.name : state.placements[id] ? id : id
          // try to find the label from match history
          const allM = getAllMatches(state)
          let displayLabel = id
          for (const m of allM) {
            if (m.a?.id === id) { displayLabel = m.a.label; break }
            if (m.b?.id === id) { displayLabel = m.b.label; break }
          }
          return (
            <div key={id} className="between">
              <div className="row">
                <span style={{ fontSize: 20, width: 30 }}>{placeEmoji(place)}</span>
                {p && <Avatar url={p.avatar_url} name={p.name} size={30} />}
                <span className="display" style={{ fontSize: 14 }}>{p ? p.name : displayLabel}</span>
              </div>
              <span className="pill pill-coral" style={{ fontSize: 10 }}>Place {place}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
