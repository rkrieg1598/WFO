import { TopBar } from '../components/UI'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'

const DAYS = [
  {
    day: 'Monday',
    date: 'Day 1',
    color: 'var(--coral)',
    textColor: 'var(--cream)',
    emoji: '🌅',
    events: [
      { key: 'bowling',    emoji: '🎳', name: 'Bowling',        where: 'Splitsville Orlando',          note: 'Lunch included — no food fights.' },
      { key: 'scavenger', emoji: '🔍', name: 'Scavenger Hunt', where: 'Monorail Reso
