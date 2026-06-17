import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Avatar } from './UI'
import {
  generateAirHockeyBracketManual, generateTeamBracket,
  buildRandomHorseshoesTeams, advanceBracket,
  getCurrentMatch, getAllMatches,
} from '../lib/bracket'

const BRACKET_EVENTS = [
  { key: 'air_hockey', label: 'Air Hockey',         emoji: '\uD83C\uDFD2', type: 'player8'      },
  { key: 'redneck_hs', label: 'Redneck Horseshoes', emoji: '\uD83C\uDF7A', type: 'team4_random' },
]

// ---- Empty seeding state ----
function emptySeeding() {
  return {
    r1: [
      { a: null, b: null },
      { a: null, b: null },
      { a: null, b: null },
      { a: null, b: null },
    ],
    r2w: [
      { a: null, b: null },
      { a: null, b: null },
    ],
    r2l: [
      { a: null, b: null },
      { a: null, b: null },
    ],
  }
}

export default function BracketManager({ players }) {
  const [activeEvent, setActiveEvent] = useState('air_hockey')
  const [bracketState, setBracketState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(emptySeeding())
  const [seedingStep, setSeedingStep] = useState('r1') // 'r1' | 'r2'
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [msg, setMsg] = useState('')
  const ev = BRACKET_EVENTS.find(e => e.key === activeEvent)

  useEffect(() => { loadBracket() }, [activeEvent])

  async function loadBracket() {
    setLoading(true)
    setBracketState(null)
    setSeeding(emptySeeding())
    setSeedingStep('r1')
    const { data } = await supabase.from('brackets').select('state').eq('event_key', activeEvent).single()
    setBracketState(data?.state || null)
    setLoading(false)
  }

  async function saveBracket(state) {
    await supabase.from('brackets').upsert(
      { event_key: activeEvent, state, updated_at: new Date().toISOString() },
      { onConflict: 'event_key' }
    )
    setBracketState(state)
    if (state.phase === 'complete') await writeBracketScores(state, activeEvent)
  }

  async function writeBracketScores(state, eventKey) {
    await supabase.from('scores').delete().eq('event_key', eventKey)
    const rows = []
    const allMatches = getAllMatches(state)
    for (const [id, place] of Object.entries(state.placements)) {
      let playerIds = [id]
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

  // ---- Seeding helpers ----
  function setSlot(round, matchIdx, side, player) {
    setSeeding(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next[round][matchIdx][side] = player
      return next
    })
  }

  function r1Complete() {
    return seeding.r1.every(m => m.a && m.b)
  }

  function r2Complete() {
    return seeding.r2w.every(m => m.a && m.b) && seeding.r2l.every(m => m.a && m.b)
  }

  function usedInR1(playerId) {
    return seeding.r1.some(m => m.a?.id === playerId || m.b?.id === playerId)
  }

  function usedInR2(round, matchIdx, side, playerId) {
    const allSlots = [
      ...seeding.r2w.map((m, i) => [{ ...m.a, _r: 'r2w', _i: i, _s: 'a' }, { ...m.b, _r: 'r2w', _i: i, _s: 'b' }]),
      ...seeding.r2l.map((m, i) => [{ ...m.a, _r: 'r2l', _i: i, _s: 'a' }, { ...m.b, _r: 'r2l', _i: i, _s: 'b' }]),
    ].flat()
    return allSlots.some(s => s?.id === playerId && !(s._r === round && s._i === matchIdx && s._s === side))
  }

  async function generateBracket() {
    if (!r1Complete() || !r2Complete()) return
    const state = generateAirHockeyBracketManual(seeding.r1, { winners: seeding.r2w, losers: seeding.r2l })
    await saveBracket(state)
    setMsg('\uD83C\uDFBC Bracket created! Play Round 1 first.')
    setTimeout(() => setMsg(''), 2500)
  }

  async function generateHorseshoes() {
    const teams = buildRandomHorseshoesTeams(players)
    const state = generateTeamBracket(teams, activeEvent)
    await saveBracket(state)
  }

  async function submitResult(winnerId, loserId) {
    if (!bracketState) return
    const match = getCurrentMatch(bracketState)
    if (!match) return
    const needsScores = bracketState.type === 'air_hockey' && match.round === 'Losers Bracket'
    if (needsScores && (scoreA === '' || scoreB === '')) {
      setMsg('\u26A0\uFE0F Enter scores for this match.')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    const sA = needsScores ? Number(scoreA) : null
    const sB = needsScores ? Number(scoreB) : null
    const newState = advanceBracket(bracketState, match.id, winnerId, loserId, sA, sB)
    await saveBracket(newState)
    setScoreA(''); setScoreB('')
    if (newState.phase === 'complete') setMsg('\uD83C\uDF89 Bracket complete! Final standings saved.')
  }

  async function resetBracket() {
    await supabase.from('brackets').delete().eq('event_key', activeEvent)
    setBracketState(null)
    setSeeding(emptySeeding())
    setSeedingStep('r1')
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

      {/* AIR HOCKEY — manual seeding */}
      {!loading && !bracketState && activeEvent === 'air_hockey' && (
        <ManualSeeding
          players={players}
          seeding={seeding}
          seedingStep={seedingStep}
          setSeedingStep={setSeedingStep}
          setSlot={setSlot}
          usedInR1={usedInR1}
          usedInR2={usedInR2}
          r1Complete={r1Complete}
          r2Complete={r2Complete}
          onGenerate={generateBracket}
        />
      )}

      {/* HORSESHOES — random generate */}
      {!loading && !bracketState && activeEvent === 'redneck_hs' && (
        <div className="card center" style={{ background: 'var(--cream-soft)' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>{ev.emoji}</div>
          <div className="postcard-title" style={{ fontSize: 22 }}>{ev.label}</div>
          <p className="muted mt8" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Randomly pairs 8 players into 4 teams and generates a bracket.
          </p>
          <button onClick={generateHorseshoes} className="btn btn-coral mt16">
            \uD83C\uDFB2 Generate Bracket
          </button>
        </div>
      )}

      {/* Active bracket */}
      {!loading && bracketState && (
        <div className="stack">
          <PhaseBar state={bracketState} />

          {match && (
            <div className="card" style={{ background: 'var(--teal)', color: 'var(--cream)' }}>
              <div className="eyebrow" style={{ color: 'var(--sun)', marginBottom: 8 }}>
                \u25B6 {match.round} — Match {match.matchNo}
              </div>
              <MatchCard
                match={match}
                needsScores={needsScores}
                scoreA={scoreA} scoreB={scoreB}
                onScoreA={setScoreA} onScoreB={setScoreB}
                onWin={submitResult}
              />
            </div>
          )}

          {bracketState.phase === 'complete' && (
            <PlacementsCard state={bracketState} players={players} />
          )}

          {done.length > 0 && (
            <div className="card-flat">
              <div className="eyebrow" style={{ marginBottom: 10 }}>Match History</div>
              <div className="stack">
                {done.map(m => <HistoryRow key={m.id} match={m} />)}
              </div>
            </div>
          )}

          <button onClick={resetBracket} className="btn btn-ghost btn-sm" style={{ opacity: .7, marginTop: 4 }}>
            \uD83D\uDDD1\uFE0F Reset Bracket
          </button>
        </div>
      )}

      {msg && <div className="pill pill-gold mt8" style={{ width: '100%', justifyContent: 'center' }}>{msg}</div>}
    </div>
  )
}

// ---- MANUAL SEEDING COMPONENT ----
function ManualSeeding({ players, seeding, seedingStep, setSeedingStep, setSlot, usedInR1, usedInR2, r1Complete, r2Complete, onGenerate }) {
  return (
    <div className="stack">
      <div className="card" style={{ background: 'var(--cream-soft)', textAlign: 'center', padding: 14 }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>{'\uD83C\uDFD2'}</div>
        <div className="postcard-title" style={{ fontSize: 22 }}>Air Hockey Bracket</div>
        <p className="muted mt8" style={{ fontSize: 12, lineHeight: 1.5 }}>
          Set up all matchups manually before the bracket begins.
        </p>
      </div>

      {/* Step tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setSeedingStep('r1')}
          className={`btn btn-sm ${seedingStep === 'r1' ? 'btn-coral' : 'btn-ghost'}`}
          style={{ flex: 1 }}>
          Round 1 {r1Complete() ? '\u2705' : ''}
        </button>
        <button
          onClick={() => { if (r1Complete()) setSeedingStep('r2') }}
          className={`btn btn-sm ${seedingStep === 'r2' ? 'btn-coral' : 'btn-ghost'}`}
          style={{ flex: 1, opacity: r1Complete() ? 1 : 0.4 }}>
          Round 2 {r2Complete() ? '\u2705' : ''}
        </button>
      </div>

      {/* Round 1 */}
      {seedingStep === 'r1' && (
        <div className="stack">
          <div className="eyebrow" style={{ marginBottom: 4 }}>Round 1 — 4 Matches</div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Pick who plays who in each first-round game.</p>
          {seeding.r1.map((match, i) => (
            <MatchPicker
              key={i}
              label={`Match ${i + 1}`}
              players={players}
              valueA={match.a}
              valueB={match.b}
              onA={(p) => setSlot('r1', i, 'a', p)}
              onB={(p) => setSlot('r1', i, 'b', p)}
              disabledFn={(p, side) => {
                const other = side === 'a' ? match.b : match.a
                if (other?.id === p.id) return true
                const otherMatches = seeding.r1.filter((_, j) => j !== i)
                return otherMatches.some(m => m.a?.id === p.id || m.b?.id === p.id)
              }}
            />
          ))}
          {r1Complete() && (
            <button className="btn btn-teal" onClick={() => setSeedingStep('r2')}>
              Next: Set Round 2 \u2192
            </button>
          )}
        </div>
      )}

      {/* Round 2 */}
      {seedingStep === 'r2' && (
        <div className="stack">
          <div className="eyebrow" style={{ marginBottom: 4 }}>Round 2 — Winners Bracket</div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Who plays who in the winners bracket?</p>
          {seeding.r2w.map((match, i) => (
            <MatchPicker
              key={i}
              label={`Winners Match ${i + 1}`}
              players={players}
              valueA={match.a}
              valueB={match.b}
              onA={(p) => setSlot('r2w', i, 'a', p)}
              onB={(p) => setSlot('r2w', i, 'b', p)}
              disabledFn={(p, side) => {
                const other = side === 'a' ? match.b : match.a
                if (other?.id === p.id) return true
                return usedInR2('r2w', i, side, p.id)
              }}
              accent="var(--teal)"
            />
          ))}

          <div className="eyebrow" style={{ marginBottom: 4, marginTop: 8 }}>Round 2 — Losers Bracket</div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Who plays who in the losers bracket?</p>
          {seeding.r2l.map((match, i) => (
            <MatchPicker
              key={i}
              label={`Losers Match ${i + 1}`}
              players={players}
              valueA={match.a}
              valueB={match.b}
              onA={(p) => setSlot('r2l', i, 'a', p)}
              onB={(p) => setSlot('r2l', i, 'b', p)}
              disabledFn={(p, side) => {
                const other = side === 'a' ? match.b : match.a
                if (other?.id === p.id) return true
                return usedInR2('r2l', i, side, p.id)
              }}
              accent="var(--coral)"
            />
          ))}

          {r1Complete() && r2Complete() && (
            <button className="btn btn-gold" onClick={onGenerate}>
              \uD83C\uDFBC Start Bracket!
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---- MATCH PICKER — two dropdowns side by side ----
function MatchPicker({ label, players, valueA, valueB, onA, onB, disabledFn, accent }) {
  const color = accent || 'var(--gold)'
  return (
    <div className="card-flat" style={{ borderLeft: `4px solid ${color}`, padding: '10px 12px' }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8, color: 'var(--ink-soft)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <PlayerSelect
          players={players}
          value={valueA}
          onChange={onA}
          disabledFn={(p) => disabledFn(p, 'a')}
          placeholder="Player A"
        />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, flexShrink: 0, color: 'var(--ink-soft)' }}>VS</div>
        <PlayerSelect
          players={players}
          value={valueB}
          onChange={onB}
          disabledFn={(p) => disabledFn(p, 'b')}
          placeholder="Player B"
        />
      </div>
    </div>
  )
}

function PlayerSelect({ players, value, onChange, disabledFn, placeholder }) {
  return (
    <select
      className="input"
      style={{ flex: 1, fontSize: 12 }}
      value={value?.id || ''}
      onChange={(e) => {
        const p = players.find(pl => pl.id === e.target.value) || null
        onChange(p)
      }}
    >
      <option value="">{placeholder}</option>
      {players.map(p => (
        <option key={p.id} value={p.id} disabled={disabledFn(p)}>
          {disabledFn(p) ? `${p.name} (taken)` : p.name}
        </option>
      ))}
    </select>
  )
}

// ---- Phase bar ----
function PhaseBar({ state }) {
  const phases = state.type === 'air_hockey'
    ? ['round1', 'round2', 'round3', 'complete']
    : ['round1', 'round2', 'complete']
  const labels = state.type === 'air_hockey'
    ? ['Round 1', 'Round 2', 'Round 3', 'Done']
    : ['Round 1', 'Finals', 'Done']
  const cur = phases.indexOf(state.phase)
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 4 }}>
      {phases.map((p, i) => (
        <div key={p} style={{
          flex: 1, textAlign: 'center', padding: '8px 4px',
          background: i <= cur ? 'var(--gold)' : 'rgba(255,255,255,.3)',
          border: `2px solid ${i <= cur ? 'var(--ink)' : 'rgba(31,58,61,.2)'}`,
          borderRadius: i === 0 ? '10px 0 0 10px' : i === phases.length - 1 ? '0 10px 10px 0' : 0,
        }}>
          <div className="display" style={{ fontSize: 10, color: i <= cur ? 'var(--ink)' : 'var(--ink-soft)' }}>{labels[i]}</div>
        </div>
      ))}
    </div>
  )
}

// ---- Match card (who won?) ----
function MatchCard({ match, needsScores, scoreA, scoreB, onScoreA, onScoreB, onWin }) {
  const nameA = match.a?.label || '?'
  const nameB = match.b?.label || '?'
  return (
    <div>
      {needsScores && (
        <div className="card-flat mt8" style={{ background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.4)', marginBottom: 12 }}>
          <div style={{ color: 'var(--sun)', fontFamily: 'var(--font-display)', fontSize: 11, marginBottom: 8 }}>
            ENTER SCORES (for 7th/8th tiebreak)
          </div>
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
          {'\uD83C\uDFC6'} {nameA}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--sun)', fontFamily: 'var(--font-display)', fontSize: 14 }}>VS</div>
        <button onClick={() => onWin(match.b.id, match.a.id)} style={{
          flex: 1, fontFamily: 'var(--font-display)', fontSize: 14,
          background: 'var(--cream)', color: 'var(--ink)',
          border: '3px solid var(--ink)', borderRadius: 12, padding: '14px 8px',
          cursor: 'pointer', boxShadow: '3px 3px 0 rgba(31,58,61,.6)',
          lineHeight: 1.2, textAlign: 'center',
        }}>
          {'\uD83C\uDFC6'} {nameB}
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
        <span style={{ fontWeight: 700, color: 'var(--teal-deep)' }}>{'\u2713'} {winner?.label}</span>
        <span className="muted"> vs {loser?.label}</span>
      </div>
      {match.scoreA !== null && (
        <span className="muted" style={{ fontSize: 11 }}>{match.scoreA}–{match.scoreB}</span>
      )}
    </div>
  )
}

function PlacementsCard({ state, players }) {
  const placeEmoji = p => ['\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49','4\uFE0F\u20E3','5\uFE0F\u20E3','6\uFE0F\u20E3','7\uFE0F\u20E3','8\uFE0F\u20E3'][p-1] || p
  const sorted = Object.entries(state.placements).sort((a, b) => a[1] - b[1])
  const allM = getAllMatches(state)
  return (
    <div className="card" style={{ background: 'var(--gold)' }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Final Placements</div>
      <div className="stack">
        {sorted.map(([id, place]) => {
          const p = players.find(pl => pl.id === id)
          let label = id
          for (const m of allM) {
            if (m.a?.id === id) { label = m.a.label; break }
            if (m.b?.id === id) { label = m.b.label; break }
          }
          return (
            <div key={id} className="between">
              <div className="row">
                <span style={{ fontSize: 20, width: 30 }}>{placeEmoji(place)}</span>
                {p && <Avatar url={p.avatar_url} name={p.name} size={30} />}
                <span className="display" style={{ fontSize: 14 }}>{p ? p.name : label}</span>
              </div>
              <span className="pill pill-coral" style={{ fontSize: 10 }}>Place {place}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
