import { TopBar } from '../components/UI'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'

const DAYS = [
  {
    day: 'Monday',
    date: 'Day 1',
    color: 'var(--coral)',
    textColor: 'var(--cream)',
    emoji: '\uD83C\uDF05',
    events: [
      { key: 'bowling',   emoji: '\uD83C\uDFB3', name: 'Bowling',        where: 'Splitsville Orlando', note: 'Lunch included - no food fights.' },
      { key: 'scavenger', emoji: '\uD83D\uDD0D', name: 'Scavenger Hunt', where: 'Monorail Resorts',    note: '4 teams - photo verification - bonus Mickeys' },
    ],
  },
  {
    day: 'Tuesday',
    date: 'Day 2',
    color: 'var(--teal)',
    textColor: 'var(--cream)',
    emoji: '\u2600\uFE0F',
    events: [
      { key: 'mini_golf',    emoji: '\u26F3',       name: 'Mini Golf',         where: 'Fantasia Gardens Mini Golf', note: 'Lowest score wins' },
      { key: 'arcade_bball', emoji: '\uD83C\uDFC0', name: 'Arcade Basketball', where: 'The Contemporary',          note: 'Highest score wins' },
      { key: 'air_hockey',   emoji: '\uD83C\uDFD2', name: 'Air Hockey',        where: 'The Contemporary',          note: '8-player bracket - 1st through 8th place' },
      { key: 'skee_ball',    emoji: '\uD83C\uDFAF', name: 'Skee Ball',         where: 'The Contemporary',          note: 'Highest score wins - perfect round bonus' },
    ],
  },
  {
    day: 'Thursday',
    date: 'Day 3',
    color: 'var(--gold)',
    textColor: 'var(--ink)',
    emoji: '\uD83C\uDFC6',
    events: [
      { key: 'redneck_hs', emoji: '\uD83C\uDF7A', name: 'Redneck Horseshoes', where: 'Orange Lake Resort', note: '4 random teams - first to 21 wins' },
      { key: 'game_night', emoji: '\uD83C\uDFB2', name: 'Family Game Night',  where: 'Orange Lake Resort', note: 'Gifted on Netflix - 3 games combined' },
    ],
  },
]

const POINTS_NOTE = [
  { place: '1st', pts: '8 pts' },
  { place: '2nd', pts: '7 pts' },
  { place: '3rd', pts: '6 pts' },
  { place: '4th-8th', pts: '5-1 pts' },
  { place: 'Team events', pts: '8 / 6 / 4 / 2' },
]

export default function Schedule() {
  const [completedSet, setCompletedSet] = useState(new Set())

  useEffect(() => {
    supabase.from('results').select('event_key, completed').then(({ data }) => {
      setCompletedSet(new Set((data || []).filter(r => r.completed).map(r => r.event_key)))
    })
  }, [])

  return (
    <div className="screen">
      <TopBar title="the schedule" />

      <div className="center rise rise-1" style={{ marginBottom: 20 }}>
        <h1 className="postcard-title" style={{ fontSize: 36 }}>Event Schedule</h1>
        <div className="script" style={{ color: 'var(--cream)', fontSize: 18, marginTop: 4 }}>
          three days of glory
        </div>
      </div>

      {DAYS.map((day, di) => (
        <div key={day.day} className={'card rise rise-' + (di + 2)} style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{
            background: day.color,
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '3px solid var(--ink)',
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22, color: day.textColor,
                textTransform: 'uppercase', letterSpacing: 1,
                textShadow: day.textColor === 'var(--cream)' ? '1px 1px 0 rgba(31,58,61,.4)' : 'none',
              }}>{day.day}</div>
              <div style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11, fontWeight: 700,
                color: day.textColor, opacity: .75,
                textTransform: 'uppercase', letterSpacing: 2,
              }}>{day.date}</div>
            </div>
            <div style={{ fontSize: 36 }}>{day.emoji}</div>
          </div>

          <div style={{ padding: '6px 0' }}>
            {day.events.map((ev, ei) => {
              const done = completedSet.has(ev.key)
              const isLast = ei === day.events.length - 1
              return (
                <div key={ev.key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '12px 18px',
                  borderBottom: isLast ? 'none' : '1px dashed rgba(31,58,61,.15)',
                  background: done ? 'rgba(27,163,156,.06)' : 'transparent',
                  opacity: done ? 0.7 : 1,
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                    background: done ? 'var(--teal)' : day.color,
                    border: '2px solid var(--ink)',
                    boxShadow: done ? 'none' : '1px 1px 0 rgba(31,58,61,.3)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 20 }}>{ev.emoji}</span>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: 15,
                        textDecoration: done ? 'line-through' : 'none',
                        color: done ? 'var(--ink-soft)' : 'var(--ink)',
                      }}>{ev.name}</span>
                      {done && (
                        <span style={{
                          fontFamily: 'var(--font-display)', fontSize: 9,
                          background: 'var(--teal)', color: 'var(--cream)',
                          border: '1.5px solid var(--ink)', borderRadius: 999,
                          padding: '2px 7px', letterSpacing: 1,
                        }}>DONE</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 2 }}>
                      {ev.where}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', opacity: .75, fontStyle: 'italic' }}>
                      {ev.note}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="card-flat rise rise-5" style={{ background: 'var(--powder)', marginBottom: 8 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Championship Points Key</div>
        {POINTS_NOTE.map((r, i) => (
          <div key={i} className="between" style={{
            padding: '6px 0',
            borderBottom: i < POINTS_NOTE.length - 1 ? '1px solid rgba(31,58,61,.1)' : 'none',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 12 }}>{r.place}</span>
            <span className="pill pill-gold" style={{ fontSize: 10 }}>{r.pts}</span>
          </div>
        ))}
      </div>

      <div className="card-flat rise rise-6" style={{ marginBottom: 8 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Bonus Points</div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
          Bonus points can be awarded by the admin for special achievements - strike chains in bowling, a perfect skee ball round, and any Hidden Mickey found on the Scavenger Hunt.
        </div>
      </div>
    </div>
  )
}
