// ============================================================
//  BRACKET ENGINE
//  Handles Air Hockey (8 players), Horseshoes & Scavenger (4 teams)
// ============================================================

// Shuffle array randomly (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// A "participant" is either a player or a team
// { id, label, playerIds[] }

// ---- 8-PLAYER BRACKET (Air Hockey) ----
export function generateAirHockeyBracket(players) {
  const shuffled = shuffle(players.map(p => ({ id: p.id, label: p.name, playerIds: [p.id] })))
  // Round 1: 4 matches
  const r1 = [
    makeMatch('r1m1', shuffled[0], shuffled[1], 'Round 1', 1),
    makeMatch('r1m2', shuffled[2], shuffled[3], 'Round 1', 2),
    makeMatch('r1m3', shuffled[4], shuffled[5], 'Round 1', 3),
    makeMatch('r1m4', shuffled[6], shuffled[7], 'Round 1', 4),
  ]
  return {
    type: 'air_hockey',
    phase: 'round1',          // round1 | round2 | round3 | complete
    currentMatchIdx: 0,        // index into activeMatches
    round1: r1,
    round2Winners: [],         // filled after round1 complete
    round2Losers: [],
    round3: [],                // championship, 3rd, 5th/6th
    placements: {},            // { playerId: place }
    finishedMatches: [],
  }
}

// ---- 4-TEAM BRACKET (Horseshoes random, Scavenger pre-assigned) ----
export function generateTeamBracket(teams, eventKey) {
  // teams: [{ id, label, playerIds[] }]  — already built externally
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
    round2: [],                // championship + 3rd place
    placements: {},            // { teamId: place }
    finishedMatches: [],
  }
}

// ---- Build random Horseshoes teams from 8 players ----
export function buildRandomHorseshoesTeams(players) {
  const shuffled = shuffle([...players])
  return [
    { id: 'hs_team1', label: `${shuffled[0].name} & ${shuffled[1].name}`, playerIds: [shuffled[0].id, shuffled[1].id] },
    { id: 'hs_team2', label: `${shuffled[2].name} & ${shuffled[3].name}`, playerIds: [shuffled[2].id, shuffled[3].id] },
    { id: 'hs_team3', label: `${shuffled[4].name} & ${shuffled[5].name}`, playerIds: [shuffled[4].id, shuffled[5].id] },
    { id: 'hs_team4', label: `${shuffled[6].name} & ${shuffled[7].name}`, playerIds: [shuffled[6].id, shuffled[7].id] },
  ]
}

// ---- Advance bracket after a match result ----
// Returns new state. scoreA/scoreB only needed for 7th/8th tiebreak match.
export function advanceBracket(state, matchId, winnerId, loserId, scoreA, scoreB) {
  const s = JSON.parse(JSON.stringify(state)) // deep clone

  // mark match complete
  const match = findMatch(s, matchId)
  if (!match) return s
  match.winnerId = winnerId
  match.loserId = loserId
  match.scoreA = scoreA ?? null
  match.scoreB = scoreB ?? null
  match.complete = true
  s.finishedMatches.push(matchId)

  if (s.type === 'air_hockey') return advanceAirHockey(s)
  else return advanceTeamBracket(s)
}

// ---- AIR HOCKEY advancement ----
function advanceAirHockey(s) {
  const r1done = s.round1.every(m => m.complete)

  if (!r1done) {
    s.currentMatchIdx = s.round1.findIndex(m => !m.complete)
    s.phase = 'round1'
    return s
  }

  // Build round 2 if not yet built
  if (s.round2Winners.length === 0) {
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
    s.phase = 'round2'
    s.currentMatchIdx = 0
    s._round2Queue = ['r2w1','r2w2','r2l1','r2l2']
    s._round2Done = []
    return s
  }

  const r2all = [...s.round2Winners, ...s.round2Losers]
  const r2done = r2all.every(m => m.complete)

  if (!r2done) {
    // next incomplete in order: r2w1, r2w2, r2l1, r2l2
    const order = ['r2w1','r2w2','r2l1','r2l2']
    const nextId = order.find(id => {
      const m = findMatch(s, id)
      return m && !m.complete
    })
    s._nextMatchId = nextId
    s.phase = 'round2'
    return s
  }

  // Build round 3 if not yet built
  if (s.round3.length === 0) {
    const r2w1 = findMatch(s,'r2w1'), r2w2 = findMatch(s,'r2w2')
    const r2l1 = findMatch(s,'r2l1'), r2l2 = findMatch(s,'r2l2')

    // Championship: r2w1 winner vs r2w2 winner
    const champA = participantById(s, r2w1.winnerId)
    const champB = participantById(s, r2w2.winnerId)
    // 3rd place: r2w1 loser vs r2w2 loser
    const thirdA = participantById(s, r2w1.loserId)
    const thirdB = participantById(s, r2w2.loserId)
    // 5th/6th: r2l1 winner vs r2l2 winner
    const fifthA = participantById(s, r2l1.winnerId)
    const fifthB = participantById(s, r2l2.winnerId)

    s.round3 = [
      makeMatch('r3champ', champA, champB, '🏆 Championship', 1),
      makeMatch('r3third', thirdA, thirdB, '🥉 3rd Place', 2),
      makeMatch('r3fifth', fifthA, fifthB, '5th Place', 3),
    ]

    // 7th/8th: decided by points in losers bracket games — store both losers
    const l7a = participantById(s, r2l1.loserId)
    const l7b = participantById(s, r2l2.loserId)
    s.seventhEighth = { a: l7a, b: l7b, r2l1ScoreA: r2l1.scoreA, r2l1ScoreB: r2l1.scoreB, r2l2ScoreA: r2l2.scoreA, r2l2ScoreB: r2l2.scoreB }

    s.phase = 'round3'
    return s
  }

  const r3done = s.round3.every(m => m.complete)
  if (!r3done) {
    s.phase = 'round3'
    return s
  }

  // All done — compute placements
  const champ = findMatch(s,'r3champ')
  const third = findMatch(s,'r3third')
  const fifth = findMatch(s,'r3fifth')

  s.placements[champ.winnerId] = 1
  s.placements[champ.loserId]  = 2
  s.placements[third.winnerId] = 3
  s.placements[third.loserId]  = 4
  s.placements[fifth.winnerId] = 5
  s.placements[fifth.loserId]  = 6

  // 7th/8th: by points scored in their Round 2 loser game
  // Each played in r2l1 or r2l2; the loser with higher score gets 7th
  const se = s.seventhEighth
  if (se) {
    // find which game each played in and what score they got
    const r2l1 = findMatch(s,'r2l1'), r2l2 = findMatch(s,'r2l2')
    const scoresMap = {}
    if (r2l1) {
      scoresMap[r2l1.a.id] = r2l1.scoreA || 0
      scoresMap[r2l1.b.id] = r2l1.scoreB || 0
    }
    if (r2l2) {
      scoresMap[r2l2.a.id] = r2l2.scoreA || 0
      scoresMap[r2l2.b.id] = r2l2.scoreB || 0
    }
    const aScore = scoresMap[se.a.id] || 0
    const bScore = scoresMap[se.b.id] || 0
    s.placements[se.a.id] = aScore >= bScore ? 7 : 8
    s.placements[se.b.id] = aScore >= bScore ? 8 : 7
  }

  s.phase = 'complete'
  return s
}

// ---- TEAM BRACKET advancement (Scavenger / Horseshoes) ----
function advanceTeamBracket(s) {
  const r1done = s.round1.every(m => m.complete)

  if (!r1done) {
    s.currentMatchIdx = s.round1.findIndex(m => !m.complete)
    s.phase = 'round1'
    return s
  }

  if (s.round2.length === 0) {
    const w = s.round1.map(m => teamById(s, m.winnerId))
    const l = s.round1.map(m => teamById(s, m.loserId))
    s.round2 = [
      makeMatch('r2champ', w[0], w[1], '🏆 Championship', 1),
      makeMatch('r2third', l[0], l[1], '🥉 3rd Place', 2),
    ]
    s.phase = 'round2'
    return s
  }

  const r2done = s.round2.every(m => m.complete)
  if (!r2done) { s.phase = 'round2'; return s }

  const champ = findMatch(s,'r2champ')
  const third = findMatch(s,'r2third')
  s.placements[champ.winnerId] = 1
  s.placements[champ.loserId]  = 2
  s.placements[third.winnerId] = 3
  s.placements[third.loserId]  = 4
  s.phase = 'complete'
  return s
}

// ---- Helpers ----
function makeMatch(id, a, b, round, matchNo) {
  return { id, a, b, round, matchNo, winnerId: null, loserId: null, scoreA: null, scoreB: null, complete: false }
}

function findMatch(s, id) {
  const allMatches = [
    ...(s.round1 || []),
    ...(s.round2Winners || []),
    ...(s.round2Losers || []),
    ...(s.round2 || []),
    ...(s.round3 || []),
  ]
  return allMatches.find(m => m.id === id) || null
}

function participantById(s, id) {
  if (!id) return null
  const allMatches = [
    ...(s.round1 || []),
    ...(s.round2Winners || []),
    ...(s.round2Losers || []),
    ...(s.round3 || []),
  ]
  for (const m of allMatches) {
    if (m.a?.id === id) return m.a
    if (m.b?.id === id) return m.b
  }
  return null
}

function teamById(s, id) {
  if (!id) return null
  const allMatches = [...(s.round1 || []), ...(s.round2 || [])]
  for (const m of allMatches) {
    if (m.a?.id === id) return m.a
    if (m.b?.id === id) return m.b
  }
  return null
}

// Get the current active match to display
export function getCurrentMatch(s) {
  if (!s || s.phase === 'complete') return null
  const allByPhase = {
    round1: s.round1 || [],
    round2: [...(s.round2Winners || []), ...(s.round2Losers || []), ...(s.round2 || [])],
    round3: s.round3 || [],
  }
  const pool = allByPhase[s.phase] || []
  return pool.find(m => !m.complete) || null
}

// Get all matches in display order
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
