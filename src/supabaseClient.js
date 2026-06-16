import { createClient } from '@supabase/supabase-js'

function cleanUrl(raw) {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith('http')) return null
  try {
    const { origin } = new URL(trimmed)
    return origin
  } catch {
    return null
  }
}

const supabaseUrl     = cleanUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim() || null

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] Variables d\'environnement manquantes.\n' +
    '  VITE_SUPABASE_URL     :', supabaseUrl     ? '✓' : '✗ MANQUANT',
    '\n  VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗ MANQUANT',
    '\nVérifiez votre fichier .env ou les settings Vercel.'
  )
}

export const supabase = createClient(
  supabaseUrl     ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key'
)
