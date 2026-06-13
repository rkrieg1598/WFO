import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TopBar, Loader, Avatar } from '../components/UI'
import Onboarding from '../components/Onboarding'
import { fetchPlayers, fetchScores, fetchResults, fetchBonus, computeStandings, organizeSchedule } from '../lib/scoring'

export default function Home() {
  const { profile, refreshProfile, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [standings, setStandings] = useState([])
  const [schedule, setSchedule] = useState({})
  const [me, setMe] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    Promise.all([fetchPlayers(), fetchScores(), fetchResults(), fetchBonus()]).then(([players, scores, results, bonuses]) => {
      const s = computeStandings(players, scores, bonuses)
      setStandings(s)
      setSchedule(organizeSchedule(results))
      setMe(s.find((r) => r.player.id === profile.id) || null)
      setLoading(false)
      const localKey = 'wfo_onboarded_' + (user ? user.id : '')
      const seenLocally = localStorage.getItem(localKey)
      const seenInDB = profile.onboarded === true
      if (!seenLocally && !seenInDB) setShowOnboarding(true)
    })
  }, [profile])

  async function handleOnboardingDone() {
    setShowOnboarding(false)
    if (user && user.id) localStorage.setItem('wfo_onboarded_' + user.id, 'true')
    await refreshProfile()
  }

  if (loading) return <div className="screen"><Loader label="Warming up the sunshine…" /></div>

  const podium = standings.slice(0, 3)
  const { last, next } = schedule

  return (
    <div className="screen">
      {showOnboarding && <Onboarding onDone={handleOnboardingDone} />}
      <TopBar title={'hey, ' + ((profile && profile.name) ? profile.name.split(' ')[0] : 'champ') + '!'} />

      {/* My score hero */}
      <div className="card rise rise-1" style={{ background: 'var(--coral)', color: 'var(--cream)', borderColor: 'var(--ink)' }}>
        <div className="between">
          <div>
            <div className="eyebrow" style={{ color: 'var(--sun)' }}>Your Standing</div>
            <div className="postcard-title" style={{ fontSize: 40, color: 'var(--cream)' }}>
              {me ? '#' + me.rank : '—'}
            </div>
            <div className="display" style={{ fontSize: 14 }}>{me ? me.total : 0} points</div>
          </div>
          <Avatar url={profile.avatar_url} name={profile.name} size={72} />
        </div>
      </div>

      {/* Podium */}
      <div className="card-flat rise rise-2 mt16">
        <div className="between" style={{ marginBottom: 10 }}>
          <span className="display" style={{ fontSize: 16 }}>🏆 Top of the Leaderboard</span>
          <Link to="/standings" className="pill pill-teal" style={{ textDecoration: 'none' }}>See all</Link>
        </div>
        <div className="stack">
          {podium.length === 0 && <div className="muted">No scores posted yet — let the games begin!</div>}
          {podium.map((row, i) => (
            <div key={row.player.id} className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row">
                <span style={{ fontSize: 22, width: 28 }}>{['🥇', '🥈', '🥉'][i]}</span>
                <Avatar url={row.player.avatar_url} name={row.player.name} size={36} />
                <span className="display" style={{ fontSize: 14 }}>{row.player.name}</span>
              </div>
              <span className="pill pill-gold">{row.total} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Last result */}
      <div className="card-flat rise rise-3 mt16" style={{ background: 'var(--powder)' }}>
        <div className="eyebrow">Previous Event</div>
        {last ? (
          <div className="row mt8" style={{ gap: 10 }}>
            <span style={{ fontSize: 30 }}>{last.emoji}</span>
            <div>
              <div className="display" style={{ fontSize: 18 }}>{last.name}</div>
              <Link to="/standings" className="muted" style={{ fontSize: 13 }}>View the final results →</Link>
            </div>
          </div>
        ) : <div className="muted mt8">No events completed yet.</div>}
      </div>

      {/* Next event */}
      <div className="card rise rise-4 mt16" style={{ background: 'var(--teal)', color: 'var(--cream)' }}>
        <div className="eyebrow" style={{ color: 'var(--sun)' }}>Coming Up Next</div>
        {next ? (
          <>
            <div className="row mt8" style={{ gap: 12 }}>
              <span style={{ fontSize: 44 }}>{next.emoji}</span>
              <div>
                <div className="postcard-title" style={{ fontSize: 28, color: 'var(--cream)' }}>{next.name}</div>
              </div>
            </div>
            <Link to="/instructions" className="btn btn-gold mt16">📋 Read the Rules</Link>
          </>
        ) : <div className="mt8">🎉 All events complete — check the final standings!</div>}
      </div>
    </div>
  )
}
