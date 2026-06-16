import { createClient } from '@supabase/supabase-js'

const FALLBACK_URL = 'https://kuyvkmscqvmhgqrgzqhd.supabase.co'
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eXZrbXNjcXZtaGdxcmd6cWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODc2NzUsImV4cCI6MjA5NTY2MzY3NX0.qA_6Yc4jFDV3epvRoH8-A_f4GXeHT6XjN9O4sqmRJ0Y'

// Nettoie l'URL : retire tout path éventuel (/rest/v1/, etc.) et espaces
function cleanUrl(raw) {
  if (!raw || typeof raw !== 'string') return FALLBACK_URL
  const trimmed = raw.trim()
  if (!trimmed.startsWith('http')) return FALLBACK_URL
  try {
    const { origin } = new URL(trimmed)
    return origin  // garde uniquement https://xxx.supabase.co
  } catch {
    return FALLBACK_URL
  }
}

const supabaseUrl    = cleanUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim() || FALLBACK_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
