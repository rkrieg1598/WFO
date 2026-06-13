import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const SLIDES = [
  {
    emoji: '🌴',
    bg: 'var(--teal)',
    accent: 'var(--sun)',
    title: 'Welcome to the\nWhite Family\nOlympics',
    body: "You've been selected to compete in the most prestigious athletic competition in White family history. Don't panic. Well — you can panic a little. The competition is real and the points are absolutely being tracked.",
    label: 'Welcome',
  },
  {
    emoji: '🗓️',
    bg: 'var(--coral)',
    accent: 'var(--sun)',
    title: 'The Events',
    body: "Nine events stand between you and glory. Mini Golf, Bowling, Skee Ball, Air Hockey, Arcade Basketball, Redneck Horseshoes, Family Game Night, and the Scavenger Hunt. Each one an opportunity. Each one a chance to surprise yourself. Each one also a chance to embarrass yourself in front of the people who will remember it forever.",
    events: ['⛳️','🎳','🎯','🏒','🏀','🍺','🎲','🔍'],
    label: 'The Events',
  },
  {
    emoji: '🏆',
    bg: 'var(--teal-dark)',
    accent: 'var(--gold)',
    title: 'How Scoring Works',
    body: "Every event awards championship points based on where you finish. First place earns 8 points, second earns 7, all the way down to 1 point for eighth. Team events split the points equally between partners — winning together, losing together, exactly as nature intended. The player with the most total points at the end of all nine events wins the whole thing.",
    scoring: [
      { place: '🥇 1st', pts: 8 },
      { place: '🥈 2nd', pts: 7 },
      { place: '🥉 3rd', pts: 6 },
      { place: '4th', pts: 5 },
      { place: '5th–8th', pts: '4–1' },
    ],
    label: 'Scoring',
  },
  {
    emoji: '📋',
    bg: 'var(--gold-deep)',
    accent: 'var(--cream)',
    title: 'The Ground Rules',
    body: "Compete hard, behave yourselves, and read the instructions for each event before you play — they're in the app for a reason. Scores are entered by the admin after each event and update live on the leaderboard. No disputing the scores. No blaming the equipment. No asking the admin to reconsider. The admin is always right. This has been decided.",
    rules: [
      { icon: '☰', text: 'Navigate with the menu button — always visible top right' },
      { icon: '📸', text: 'Upload photos to the Photo Wall — memories are mandatory' },
      { icon: '🔍', text: 'Scavenger Hunt page unlocks when the admin says so' },
      { icon: '🌴', text: 'Check your profile for your rank, points, and best events' },
    ],
    label: 'The Rules',
  },
  {
    emoji: '☀️',
    bg: 'var(--coral)',
    accent: 'var(--sun)',
    title: "Let's Go",
    body: "The leaderboard is live, the events are coming, and somewhere in this family there is a champion waiting to be crowned. It might be you. It might be the person you least expect. It is definitely not going to be decided without a fight. Good luck. Play fair. Have the time of your life.",
    cta: true,
    label: "Let's Go",
  },
]

export default function Onboarding({ onDone }) {
  const { user } = useAuth()
  const [slide, setSlide] = useState(0)
  const [exiting, setExiting] = useState(false)
  const touchStart = useRef(null)
  const s = SLIDES[slide]

  function next() {
    if (slide < SLIDES.length - 1) setSlide(slide + 1)
  }
  function prev() {
    if (slide > 0) setSlide(slide - 1)
  }

  async function finish() {
    setExiting(true)
    if (user) {
      // Write to localStorage immediately — most reliable
      localStorage.setItem(`wfo_onboarded_${user.id}`, 'true')
      // Also try to write to Supabase (best effort — won't block)
      supabase.from('profiles').update({ onboarded: true }).eq('id', user.id).then(() => {})
    }
    setTimeout(onDone, 400)
  }

  // swipe support
  function onTouchStart(e) { touchStart.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) { diff > 0 ? next() : prev() }
    touchStart.current = null
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: s.bg,
        display: 'flex', flexDirection: 'column',
        transition: 'background .4s ease',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'scale(1.04)' : 'scale(1)',
        transitionProperty: 'background, opacity, transform',
        transitionDuration: '.4s',
      }}
    >
      {/* halftone dots */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(255,255,255,.13) 1.5px, transparent 1.6px)',
        backgroundSize: '22px 22px',
      }} />

      {/* skip */}
      {slide < SLIDES.length - 1 && (
        <button onClick={finish} style={{
          position: 'absolute', top: 18, right: 18, zIndex: 10,
          background: 'rgba(31,58,61,.3)', border: '2px solid rgba(255,255,255,.4)',
          borderRadius: 999, color: 'var(--cream)', fontFamily: 'var(--font-display)',
          fontSize: 12, padding: '6px 14px', cursor: 'pointer', letterSpacing: 1,
        }}>SKIP</button>
      )}

      {/* slide content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 28px 20px', maxWidth: 480, margin: '0 auto', width: '100%',
      }}>
        <div key={slide} style={{ animation: 'rise .45s cubic-bezier(.2,.8,.2,1) both', width: '100%' }}>

          {/* emoji */}
          <div style={{ fontSize: 64, textAlign: 'center', marginBottom: 16,
            filter: 'drop-shadow(2px 4px 0 rgba(31,58,61,.4))' }}>{s.emoji}</div>

          {/* title */}
          <h1 style={{
            fontFamily: 'var(--font-display)', textTransform: 'uppercase',
            color: 'var(--cream)', fontSize: 'clamp(28px, 8vw, 40px)',
            lineHeight: .95, textAlign: 'center', marginBottom: 18,
            textShadow: `2px 2px 0 rgba(31,58,61,.6)`,
            whiteSpace: 'pre-line',
          }}>{s.title}</h1>

          {/* body */}
          <p style={{
            color: 'var(--cream)', fontSize: 15, lineHeight: 1.55,
            textAlign: 'center', opacity: .92, marginBottom: 20,
          }}>{s.body}</p>

          {/* events grid */}
          {s.events && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              {s.events.map((e, i) => (
                <div key={i} style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'rgba(255,255,255,.18)', border: '2px solid rgba(255,255,255,.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>{e}</div>
              ))}
            </div>
          )}

          {/* scoring table */}
          {s.scoring && (
            <div style={{ background: 'rgba(31,58,61,.25)', borderRadius: 14, padding: '12px 16px', marginBottom: 8 }}>
              {s.scoring.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '5px 0', borderBottom: i < s.scoring.length - 1 ? '1px solid rgba(255,255,255,.15)' : 'none',
                }}>
                  <span style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)', fontSize: 13 }}>{r.place}</span>
                  <span style={{ fontFamily: 'var(--font-display)', color: s.accent, fontSize: 15 }}>{r.pts} pts</span>
                </div>
              ))}
            </div>
          )}

          {/* rules list */}
          {s.rules && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
              {s.rules.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'rgba(31,58,61,.25)', borderRadius: 12, padding: '10px 14px',
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{r.icon}</span>
                  <span style={{ color: 'var(--cream)', fontSize: 13, lineHeight: 1.4 }}>{r.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA button on last slide */}
          {s.cta && (
            <button onClick={finish} style={{
              width: '100%', marginTop: 8,
              fontFamily: 'var(--font-display)', fontSize: 18,
              background: 'var(--sun)', color: 'var(--ink)',
              border: '3px solid var(--ink)', borderRadius: 999,
              padding: '16px 24px', cursor: 'pointer',
              boxShadow: '4px 4px 0 rgba(31,58,61,.85)',
            }}>🌴 Let the Games Begin</button>
          )}
        </div>
      </div>

      {/* bottom nav row: dots + arrow */}
      <div style={{
        padding: '0 28px 40px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 480, margin: '0 auto', width: '100%',
      }}>
        {/* dot indicators */}
        <div style={{ display: 'flex', gap: 8 }}>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)} style={{
              width: i === slide ? 24 : 8, height: 8,
              borderRadius: 999, border: 'none', cursor: 'pointer',
              background: i === slide ? 'var(--cream)' : 'rgba(255,255,255,.35)',
              transition: 'width .25s ease',
              padding: 0,
            }} />
          ))}
        </div>

        {/* next / finish button */}
        {slide < SLIDES.length - 1 ? (
          <button onClick={next} style={{
            fontFamily: 'var(--font-display)', fontSize: 14,
            background: 'rgba(255,255,255,.2)', color: 'var(--cream)',
            border: '2px solid rgba(255,255,255,.5)', borderRadius: 999,
            padding: '10px 20px', cursor: 'pointer',
          }}>Next →</button>
        ) : (
          <div style={{ width: 80 }} />
        )}
      </div>
    </div>
  )
}
