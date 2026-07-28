import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined);
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
const mode = (import.meta.env.MODE as string | undefined) ?? process.env.NODE_ENV ?? 'development';

// In non-test modes, require the env vars at build time so production builds fail fast.
if ((!supabaseUrl || !supabaseAnonKey) && mode !== 'test') {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set at build time.');
}

// Provide safe fallbacks for tests so importing this module doesn't throw.
const url = supabaseUrl ?? 'http://localhost';
const anonKey = supabaseAnonKey ?? 'test-anon-key';

export const supabase: SupabaseClient = createClient(url, anonKey);

export default supabase;
