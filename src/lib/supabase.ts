import { createClient } from '@supabase/supabase-js';

const supabaseUrl = ((import.meta as any).env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/$/, '')
  .replace(/\/(rest|auth)\/v\d+$/, '');
const supabaseAnonKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Local storage will be used as fallback.');
}

// Ensure URL is valid for createClient
const validUrl = supabaseUrl && supabaseUrl.startsWith('http') 
  ? supabaseUrl 
  : 'https://placeholder.supabase.co';

export const supabase = createClient(
  validUrl,
  supabaseAnonKey || 'placeholder'
);
