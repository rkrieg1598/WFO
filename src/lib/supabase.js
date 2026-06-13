import { createClient } from '@supabase/supabase-js'

// ⚠️ Fill these in with your own Supabase project values.
// Find them in your Supabase dashboard → Project Settings → API.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// The one and only admin
export const ADMIN_EMAIL = 'regankrieg@gmail.com'

// Pre-planned events in competition order. `team` = scored as 4 teams of 2. `lowWins` = lowest score wins (golf).
export const EVENTS = [
  { key: 'bowling',      name: 'Bowling',             emoji: '🎳', team: false, lowWins: false, scoreLabel: 'Pin count'     },  // Mon 12pm
  { key: 'scavenger',   name: 'Scavenger Hunt',      emoji: '🔍', team: true,  lowWins: false, scoreLabel: 'Team place'    },  // Mon
  { key: 'mini_golf',   name: 'Mini Golf',           emoji: '⛳️', team: false, lowWins: true,  scoreLabel: 'Total strokes' },  // Tue 2pm
  { key: 'arcade_bball',name: 'Arcade Basketball',   emoji: '🏀', team: false, lowWins: false, scoreLabel: 'Point total'   },  // Tue
  { key: 'air_hockey',  name: 'Air Hockey',          emoji: '🏒', team: false, lowWins: false, scoreLabel: 'Goals scored'  },  // Tue
  { key: 'skee_ball',   name: 'Skee Ball',           emoji: '🎯', team: false, lowWins: false, scoreLabel: 'Point total'   },  // Tue
  { key: 'redneck_hs',  name: 'Redneck Horseshoes',  emoji: '🍺', team: true,  lowWins: false, scoreLabel: 'Team place'    },  // Thu
  { key: 'game_night',  name: 'Family Game Night',   emoji: '🎲', team: false, lowWins: false, scoreLabel: 'Final score'   },  // Thu
]

// Points by finishing place
export const INDIVIDUAL_POINTS = [8, 7, 6, 5, 4, 3, 2, 1] // 1st..8th
export const TEAM_POINTS = [8, 6, 4, 2]                     // 1st..4th team

export const eventByKey = (k) => EVENTS.find((e) => e.key === k)
