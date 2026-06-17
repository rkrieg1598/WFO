// ============================================================
//  BRACKET ENGINE
//  Handles Air Hockey (8 players), Horseshoes (4 teams)
// ============================================================

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---- BUILD FROM FULLY MANUAL SEEDING ----
// r1matchups: [{a: player, b: player}, ...] x4
// r2matchups: { winners: [{a,b},{a,b}], losers: [{a,b},{a,b}] }
//   each participant is a player object {id, name}
export function generateAirHockeyBracketManual(r1matchups, r2matchups) {
  const toP = (p) => ({ id: p.id, label: p.name, playerIds: [p.id] })

  const round1 = r1matchups.map((m, i) =>
    makeMatch(`r1m${i + 1}`, toP(m.a), toP(m.b), 'Round 1', i + 1)
  )

  const round2Winners = r2matchups.winners.map((m, i) =>
    makeMatch(`r2w${i + 1}`, toP(m.a), toP(m.b), 'Winners Bracket', i + 1)
  )

  const round2Losers = r2matchups.losers.map((m, i) =>
    makeMatch(`r2l${i + 1}`, toP(m.a), toP(m.b), 'Losers Bracket', i + 1)
  )

  return {
    type: 'air_hockey',
    phase: 'round1',
    manualSeeded: true,
    currentMatchIdx: 0,
    round1,
    round2Winners,
    round2Losers,
    round3: [],
    placements: {},
    finishedMatches: [],
  }
}

// ---- RANDOM bracket (kept for horseshoes) ----
export function generateAirHockeyBracket(players) {
  const shuffled = shuffle(players.map(p => ({ id: p.id, label: p.name, playerIds: [p.id] })))
  const r1 = [
    makeMatch('r1m1', shuffled[0], shuffled[1], 'Round 1', 1),
    makeMatch('r1m2', shuffled[2], shuffled[3], 'Round 1', 2),
    makeMatch('r1m3', shuffled[4], shuffled[5], 'Round 1', 3),
    makeMatch('r1m4', shuffled[6], shuffled[7], 'Round 1', 4),
  ]
  return {
    type: 'air_hockey',
    phase: 'round1',
    currentMatchIdx: 0,
    round1: r1,
    round2Winners: [],
    round2Losers: [],
    round3: [],
    placements: {},
    finishedMatches: [],
  }
}

// ---- 4-TEAM BRACKET ----
export function generateTeamBracket(teams, eventKey) {
  const shuffled = shuffle([...teams])
  const r1 = [
    makeMatch('r1m1', shuffled[0], shuffled[1], 'Round 1', 1),
    makeMatch('r1m2', shuffled[2], shuffled[3], 'Round 1', 2),
  ]
  return {
    type: eventKey,
    phase: 'round1',
    currentMatchIdx: 0,
    round1: r1,
    round2: [],
    placements: {},
    finishedMatches: [],
  }
}

export function buildRandomHorseshoesTeams(players) {
  const shuffled = shuffle([...players])
  return [
    { id: 'hs_team1', label: `${shuffled[0].name} & ${shuffled[1].name}`, playerIds: [shuffled[0].id, shuffled[1].id] },
    { id: 'hs_team2', label: `${shuffled[2].name} & ${shuffled[3].name}`, playerIds: [shuffled[2].id, shuffled[3].id] },
    { id: 'hs_team3', label: `${shuffled[4].name} & ${shuffled[5].name}`, playerIds: [shuffled[4].id, shuffled[5].id] },
    { id: 'hs_team4', label: `${shuffled[6].name} & ${shuffled[7].name}`, playerIds: [shuffled[6].id, shuffled[7].id] },
  ]
}

// ---- ADVANCE BRACKET ----
export function advanceBracket(state, matchId, winnerId, loserId, scoreA, scoreB) {
  const s = JSON.parse(JSON.stringify(state))
  const match = findMatch(s, matchId)
  if (!match) return s
  match.winnerId = winnerId
  match.loserId = loserId
  match.scoreA = scoreA ?? null
  match.scoreB = scoreB ?? null
  match.complete = true
  s.finishedMatches.push(matchId)

  if (s.type === 'air_hockey') return advanceAirHockey(s)
  return advanceTeamBracket(s)
}

function advanceAirHockey(s) {
  const r1done = s.round1.every(m => m.complete)

  if (!r1done) {
    s.phase = 'round1'
    return s
  }

  // If manually seeded, round2Winners/Losers already exist — skip building them
  if (!s.manualSeeded && s.round2Winners.length === 0) {
    const w = s.round1.map(m => participantById(s, m.winnerId))
    const l = s.round1.map(m => participantById(s, m.loserId))
    s.round2Winners = [
      makeMatch('r2w1', w[0], w[1], 'Winners Bracket', 1),
      makeMatch('r2w2', w[2], w[3], 'Winners Bracket', 2),
    ]
    s.round2Losers = [
      makeMatch('r2l1', l[0], l[1], 'Losers Bracket', 1),
      makeMatch('r2l2', l[2], l[3], 'Losers Bracket', 2),
    ]
  }

  s.phase = 'round2'

  const r2all = [...s.round2Winners, ...s.round2Losers]
  const r2done = r2all.every(m => m.complete)
  if (!r2done) return s

  // Build round 3
  if (s.round3.length === 0) {
    const r2w1 = findMatch(s, 'r2w1'), r2w2 = findMatch(s, 'r2w2')
    const r2l1 = findMatch(s, 'r2l1'), r2l2 = findMatch(s, 'r2l2')

    const champA = participantById(s, r2w1.winnerId)
    const champB = participantById(s, r2w2.winnerId)
    const thirdA = participantById(s, r2w1.loserId)
    const thirdB = participantById(s, r2w2.loserId)
    const fifthA = participantById(s, r2l1.winnerId)
    const fifthB = participantById(s, r2l2.winnerId)

    s.round3 = [
      makeMatch('r3champ', champA, champB, '\uD83C\uDFC6 Championship', 1),
      makeMatch('r3third', thirdA, thirdB, '\uD83E\uDD49 3rd Place', 2),
      makeMatch('r3fifth', fifthA, fifthB, '5th Place', 3),
    ]

    const l7a = participantById(s, r2l1.loserId)
    const l7b = participantById(s, r2l2.loserId)
    s.seventhEighth = { a: l7a, b: l7b }
    s.phase = 'round3'
    return s
  }

  const r3done = s.round3.every(m => m.complete)
  if (!r3done) { s.phase = 'round3'; return s }

  const champ = findMatch(s, 'r3champ')
  const third = findMatch(s, 'r3third')
  const fifth = findMatch(s, 'r3fifth')

  s.placements[champ.winnerId] = 1
  s.placements[champ.loserId]  = 2
  s.placements[third.winnerId] = 3
  s.placements[third.loserId]  = 4
  s.placements[fifth.winnerId] = 5
  s.placements[fifth.loserId]  = 6

  const r2l1 = findMatch(s, 'r2l1'), r2l2 = findMatch(s, 'r2l2')
  const scoresMap = {}
  if (r2l1) { scoresMap[r2l1.a.id] = r2l1.scoreA || 0; scoresMap[r2l1.b.id] = r2l1.scoreB || 0 }
  if (r2l2) { scoresMap[r2l2.a.id] = r2l2.scoreA || 0; scoresMap[r2l2.b.id] = r2l2.scoreB || 0 }
  const se = s.seventhEighth
  if (se) {
    const aScore = scoresMap[se.a?.id] || 0
    const bScore = scoresMap[se.b?.id] || 0
    s.placements[se.a.id] = aScore >= bScore ? 7 : 8
    s.placements[se.b.id] = aScore >= bScore ? 8 : 7
  }

  s.phase = 'complete'
  return s
}

function advanceTeamBracket(s) {
  const r1done = s.round1.every(m => m.complete)
  if (!r1done) { s.phase = 'round1'; return s }

  if (s.round2.length === 0) {
    const w = s.round1.map(m => teamById(s, m.winnerId))
    const l = s.round1.map(m => teamById(s, m.loserId))
    s.round2 = [
      makeMatch('r2champ', w[0], w[1], '\uD83C\uDFC6 Championship', 1),
      makeMatch('r2third', l[0], l[1], '\uD83E\uDD49 3rd Place', 2),
    ]
    s.phase = 'round2'
    return s
  }

  const r2done = s.round2.every(m => m.complete)
  if (!r2done) { s.phase = 'round2'; return s }

  const champ = findMatch(s, 'r2champ')
  const third = findMatch(s, 'r2third')
  s.placements[champ.winnerId] = 1
  s.placements[champ.loserId]  = 2
  s.placements[third.winnerId] = 3
  s.placements[third.loserId]  = 4
  s.phase = 'complete'
  return s
}

function makeMatch(id, a, b, round, matchNo) {
  return { id, a, b, round, matchNo, winnerId: null, loserId: null, scoreA: null, scoreB: null, complete: false }
}

function findMatch(s, id) {
  return getAllMatches(s).find(m => m.id === id) || null
}

function participantById(s, id) {
  if (!id) return null
  for (const m of getAllMatches(s)) {
    if (m.a?.id === id) return m.a
    if (m.b?.id === id) return m.b
  }
  return null
}

function teamById(s, id) {
  if (!id) return null
  for (const m of [...(s.round1 || []), ...(s.round2 || [])]) {
    if (m.a?.id === id) return m.a
    if (m.b?.id === id) return m.b
  }
  return null
}

export function getCurrentMatch(s) {
  if (!s || s.phase === 'complete') return null
  const pool = {
    round1: s.round1 || [],
    round2: [...(s.round2Winners || []), ...(s.round2Losers || []), ...(s.round2 || [])],
    round3: s.round3 || [],
  }[s.phase] || []
  return pool.find(m => !m.complete) || null
}

export function getAllMatches(s) {
  if (!s) return []
  return [
    ...(s.round1 || []),
    ...(s.round2Winners || []),
    ...(s.round2Losers || []),
    ...(s.round2 || []),
    ...(s.round3 || []),
  ]
}
