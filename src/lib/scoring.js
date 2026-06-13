import { supabase } from './supabase'
import { EVENTS, eventByKey } from './supabase'

/*
  scores table rows:
    { event_key, player_id, raw_score, place }
    place is now computed automatically from raw_score when saving,
    but also stored so the rest of the app can read it directly.
*/

export function pointsForPlace(eventKey, place) {
  const ev = eventByKey(eventKey)
  if (!ev) return 0
  const table = ev.team ? [8, 6, 4, 2] : [8, 7, 6, 5, 4, 3, 2, 1]
  return table[place - 1] || 0
}

// Given a map of { player_id -> raw_score } and the event,
// return a sorted array of { player_id, raw_score, place } with places auto-assigned.
// Ties share the same place (e.g. two players tied for 2nd both get place 2).
export function assignPlaces(eventKey, rawScores) {
  const ev = eventByKey(eventKey)
  if (!ev) return []
  const entries = Object.entries(rawScores)
    .filter(([, s]) => s !== '' && s !== null && s !== undefined && !isNaN(Number(s)))
    .map(([player_id, s]) => ({ player_id, raw_score: Number(s) }))

  // sort: low wins = ascending, high wins = descending
  entries.sort((a, b) => ev.lowWins
    ? a.raw_score - b.raw_score
    : b.raw_score - a.raw_score)

  // assign places with tie handling
  let lastScore = null, lastPlace = 0
  entries.forEach((e, i) => {
    if (e.raw_score !== lastScore) { lastPlace = i + 1; lastScore = e.raw_score }
    e.place = lastPlace
  })
  return entries
}

// Build standings: total points per player + per-event breakdown + bonus points
export function computeStandings(players, scores, bonuses = []) {
  const byPlayer = {}
  players.forEach((p) => {
    byPlayer[p.id] = { player: p, total: 0, events: {}, bonusTotal: 0, bonuses: [] }
  })
  scores.forEach((s) => {
    const rec = byPlayer[s.player_id]
    if (!rec) return
    const pts = pointsForPlace(s.event_key, s.place)
    rec.events[s.event_key] = { place: s.place, points: pts, raw_score: s.raw_score }
    rec.total += pts
  })
  bonuses.forEach((b) => {
    const rec = byPlayer[b.player_id]
    if (!rec) return
    rec.bonusTotal += b.points
    rec.total += b.points
    rec.bonuses.push(b)
  })
  const arr = Object.values(byPlayer).sort((a, b) => b.total - a.total)
  // assign overall rank with ties sharing a rank
  let lastPts = null, lastRank = 0
  arr.forEach((row, i) => {
    if (row.total !== lastPts) { lastRank = i + 1; lastPts = row.total }
    row.rank = lastRank
  })
  return arr
}

// A player's best events (highest points earned so far)
export function bestEvents(standingRow) {
  return Object.entries(standingRow.events)
    .map(([key, v]) => ({ key, ...v, name: eventByKey(key)?.name, emoji: eventByKey(key)?.emoji }))
    .sort((a, b) => b.points - a.points)
}

export async function fetchBonus() {
  const { data } = await supabase.from('bonus_points').select('*').order('created_at', { ascending: false })
  return data || []
}
export async function fetchPlayers() {
  const { data } = await supabase.from('profiles').select('*')
  return data || []
}
export async function fetchScores() {
  const { data } = await supabase.from('scores').select('*')
  return data || []
}
export async function fetchResults() {
  const { data } = await supabase.from('results').select('*')
  return data || []
}

// Determine ordering of events into past / next / upcoming
export function organizeSchedule(results) {
  const completedKeys = new Set(results.filter((r) => r.completed).map((r) => r.event_key))
  const ordered = [...EVENTS]
  const past = ordered.filter((e) => completedKeys.has(e.key))
  const remaining = ordered.filter((e) => !completedKeys.has(e.key))
  return {
    past,
    last: past[past.length - 1] || null,
    next: remaining[0] || null,
    remaining,
  }
}
