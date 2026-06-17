import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const ADMIN_EMAIL = 'regankrieg@gmail.com'

export const EVENTS = [
  { key: 'bowling',      name: 'Bowling',            emoji: '\uD83C\uDFB3', team: false, lowWins: false, scoreLabel: 'Pin count'     },
  { key: 'scavenger',   name: 'Scavenger Hunt',     emoji: '\uD83D\uDD0D', team: true,  lowWins: false, scoreLabel: 'Team place'    },
  { key: 'mini_golf',   name: 'Mini Golf',          emoji: '\u26F3',       team: false, lowWins: true,  scoreLabel: 'Total strokes' },
  { key: 'arcade_bball',name: 'Arcade Basketball',  emoji: '\uD83C\uDFC0', team: false, lowWins: false, scoreLabel: 'Point total'   },
  { key: 'air_hockey',  name: 'Air Hockey',         emoji: '\uD83C\uDFD2', team: false, lowWins: false, scoreLabel: 'Goals scored'  },
  { key: 'skee_ball',   name: 'Skee Ball',          emoji: '\uD83C\uDFAF', team: false, lowWins: false, scoreLabel: 'Point total'   },
  { key: 'space_ranger',name: 'Space Ranger Spin',  emoji: '\uD83D\uDE80', team: false, lowWins: false, scoreLabel: 'Buzz score'    },
  { key: 'redneck_hs',  name: 'Redneck Horseshoes', emoji: '\uD83C\uDF7A', team: true,  lowWins: false, scoreLabel: 'Team place'    },
  { key: 'game_night',  name: 'Family Game Night',  emoji: '\uD83C\uDFB2', team: false, lowWins: false, scoreLabel: 'Final score'   },
]

export const INDIVIDUAL_POINTS = [8, 7, 6, 5, 4, 3, 2, 1]
export const TEAM_POINTS = [8, 6, 4, 2]

export const eventByKey = (k) => EVENTS.find((e) => e.key === k)
