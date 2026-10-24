import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL=https://notvphnydzpskbniznqg.supabase.co;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY=sb_publishable_Kkoyhy9RIPFiW3P5Efy7IQ_P9VBADc_;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

export const isSupabaseConfigured = supabase !== null;
