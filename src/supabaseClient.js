import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kuyvkmscqvmhgqrgzqhd.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eXZrbXNjcXZtaGdxcmd6cWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODc2NzUsImV4cCI6MjA5NTY2MzY3NX0.qA_6Yc4jFDV3epvRoH8-A_f4GXeHT6XjN9O4sqmRJ0Y'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
