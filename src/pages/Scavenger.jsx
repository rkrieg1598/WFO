import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { TopBar, Loader } from '../components/UI'
import { supabase } from '../lib/supabase'

const DIFF_META = {
  easy:   { label: 'Easy',   emoji: '\uD83D\uDFE2' },
  medium: { label: 'Medium', emoji: '\uD83D\uDFE1' },
  hard:   { label: 'Hard',   emoji: '\uD83D\uDD34' },
}
const PLACES = ['Grand Floridian', 'Contemporary', 'Polynesian']
const TEAM_NAMES  = ['Team 1', 'Team 2', 'Team 3', 'Team 4']
const TEAM_COLORS = ['var(--coral)', 'var(--teal)', 'var(--gold)', 'var(--sky-deep)']

export default function Scavenger() {
  const { profile, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [items, setItems] = useState([])
  const [assignments, setAssignments] = useState([])
  const [checks, setChecks] = useState([])

  const teamNo = profile?.team_no || null

  async function load() {
    const [unlockRes, itemsRes, assignRes, checksRes] = await Promise.all([
      supabase.from('settings').select('*').eq('key', 'scavenger_unlocked').single(),
      supabase.from('scavenger_items').select('*'),
      supabase.from('scavenger_assignments').select('*'),
      supabase.from('scavenger_checks').select('*'),
    ])
    setUnlocked(unlockRes.data?.value === 'true')
    setItems(itemsRes.data || [])
    setAssignments(assignRes.data || [])
    setChecks(checksRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('scavenger-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scavenger_checks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scavenger_assignments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function toggleCheck(assignmentId, currentlyChecked) {
    const existing = checks.find((c) => c.assignment_id === assignmentId)
    if (existing) {
      await supabase.from('scavenger_checks').update({
        checked: !currentlyChecked,
        checked_by: user?.id || null,
        checked_at: !currentlyChecked ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabase.from('scavenger_checks').insert({
        assignment_id: assignmentId,
        team_no: teamNo,
        checked: !currentlyChecked,
        checked_by: user?.id || null,
        checked_at: !currentlyChecked ? new Date().toISOString() : null,
      })
    }
    load()
  }

  if (loading) return <div className="screen"><Loader label="Checking the vault\u2026" /></div>

  // --- Locked ---
  if (!unlocked) {
    return (
      <div className="screen">
        <TopBar title="scavenger hunt" />
        <div className="card rise rise-1 center" style={{ marginTop: 40, background: 'var(--cream-soft)' }}>
          <div style={{ fontSize: 72, animation: 'swayy 2s ease-in-out infinite' }}>{'\uD83D\uDD12'}</div>
          <h1 className="postcard-title mt16" style={{ fontSize: 30 }}>Locked!</h1>
          <p className="muted mt8" style={{ lineHeight: 1.5 }}>
            The Scavenger Hunt hasn't started yet. This page will unlock when the admin
            kicks off the hunt. Get your camera ready! {'\uD83D\uDD0D'}
          </p>
          <div className="pill pill-teal mt16">{'\uD83D\uDC6F'} 4 teams of 2 \u00B7 8 / 6 / 4 / 2 pts</div>
        </div>
      </div>
    )
  }

  // --- No team assigned ---
  if (!teamNo) {
    return (
      <div className="screen">
        <TopBar title="scavenger hunt" />
        <div className="card rise rise-1 center" style={{ marginTop: 40, background: 'var(--cream-soft)' }}>
          <div style={{ fontSize: 64 }}>{'\uD83E\uDD14'}</div>
          <h1 className="postcard-title mt16" style={{ fontSize: 28 }}>No Team Yet</h1>
          <p className="muted mt8" style={{ lineHeight: 1.5 }}>
            You haven't been assigned to a Scavenger Hunt team. Ask the admin to add you
            in the Teams tab!
          </p>
        </div>
      </div>
    )
  }

  // --- My team's items ---
  const myAssignments = assignments.filter((a) => a.team_no === teamNo)

  if (myAssignments.length === 0) {
    return (
      <div className="screen">
        <TopBar title="scavenger hunt" />
        <div className="card rise rise-1 center" style={{ marginTop: 40, background: 'var(--cream-soft)' }}>
          <div style={{ fontSize: 64 }}>{'\uD83C\uDFB2'}</div>
          <h1 className="postcard-title mt16" style={{ fontSize: 28 }}>Not Distributed Yet</h1>
          <p className="muted mt8" style={{ lineHeight: 1.5 }}>
            The hunt is unlocked, but items haven't been distributed to teams yet.
            Hang tight \u2014 your list will appear here as soon as the admin distributes!
          </p>
        </div>
      </div>
    )
  }

  function isChecked(assignmentId) {
    const c = checks.find((ch) => ch.assignment_id === assignmentId)
    return c ? c.checked : false
  }
  function itemById(id) {
    return items.find((i) => i.id === id)
  }

  const totalCount = myAssignments.length
  const doneCount = myAssignments.filter((a) => isChecked(a.id)).length
  const teamColor = TEAM_COLORS[teamNo - 1]

  return (
    <div className="screen">
      <TopBar title="scavenger hunt" />

      <div className="center rise rise-1" style={{ marginBottom: 14 }}>
        <h1 className="postcard-title" style={{ fontSize: 32 }}>{'\uD83D\uDD0D'} The Hunt</h1>
        <div className="pill mt8" style={{ background: teamColor, color: 'var(--cream)' }}>
          {TEAM_NAMES[teamNo - 1]}
        </div>
      </div>

      {/* Progress */}
      <div className="card rise rise-2" style={{ background: teamColor, color: 'var(--cream)', marginBottom: 14 }}>
        <div className="between">
          <div>
            <div className="eyebrow" style={{ color: 'var(--sun)' }}>Progress</div>
            <div className="postcard-title" style={{ fontSize: 32, color: 'var(--cream)' }}>
              {doneCount} / {totalCount}
            </div>
          </div>
          <div style={{ fontSize: 44 }}>{doneCount === totalCount ? '\uD83C\uDFC6' : '\uD83D\uDD0E'}</div>
        </div>
        <div style={{
          marginTop: 10, height: 10, borderRadius: 999, background: 'rgba(255,255,255,.25)',
          border: '2px solid var(--ink)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%`,
            background: 'var(--sun)', transition: 'width .3s ease',
          }} />
        </div>
      </div>

      {/* Items grouped by place */}
      {PLACES.map((place) => {
        const placeAssignments = myAssignments.filter((a) => a.place === place)
        if (!placeAssignments.length) return null
        const placeDone = placeAssignments.filter((a) => isChecked(a.id)).length

        return (
          <div key={place} className="card-flat rise" style={{ marginBottom: 12 }}>
            <div className="between" style={{ marginBottom: 10 }}>
              <span className="display" style={{ fontSize: 15 }}>{place}</span>
              <span className="pill pill-teal" style={{ fontSize: 9 }}>{placeDone}/{placeAssignments.length}</span>
            </div>
            <div className="stack">
              {placeAssignments.map((a) => {
                const item = itemById(a.item_id)
                const diffMeta = DIFF_META[a.difficulty]
                const checked = isChecked(a.id)
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleCheck(a.id, checked)}
                    style={{
                      all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 12,
                      background: checked ? 'rgba(27,163,156,.12)' : 'rgba(255,255,255,.6)',
                      border: `2px solid ${checked ? 'var(--teal)' : 'rgba(31,58,61,.15)'}`,
                      boxSizing: 'border-box', width: '100%',
                    }}
                  >
                    {/* checkbox */}
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                      border: `2px solid ${checked ? 'var(--ink)' : 'rgba(31,58,61,.35)'}`,
                      background: checked ? 'var(--teal)' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--cream)', fontFamily: 'var(--font-display)', fontSize: 13,
                    }}>
                      {checked ? '\u2713' : ''}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                        <span className="pill" style={{
                          fontSize: 8, background: '#fff',
                          textDecoration: checked ? 'line-through' : 'none',
                        }}>
                          {diffMeta.emoji} {diffMeta.label}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 13, lineHeight: 1.45,
                        textDecoration: checked ? 'line-through' : 'none',
                        color: checked ? 'var(--ink-soft)' : 'var(--ink)',
                      }}>
                        {item ? item.text : '(item unavailable)'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {doneCount === totalCount && (
        <div className="card center" style={{ background: 'var(--gold)', marginTop: 4 }}>
          <div style={{ fontSize: 48 }}>{'\uD83C\uDF89'}</div>
          <div className="postcard-title mt8" style={{ fontSize: 22 }}>Hunt Complete!</div>
          <p className="muted mt8" style={{ fontSize: 13 }}>
            Your team found every item \u2014 nice work! Let the admin know you're done.
          </p>
        </div>
      )}
    </div>
  )
}
