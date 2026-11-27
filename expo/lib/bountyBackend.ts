// The Bounty app's own Supabase project (owner-managed, ref jmlqcdcegejeunblzemh).
//
// The Rork platform also provisions a managed Supabase database for this
// project and points the shared EXPO_PUBLIC_SUPABASE_URL / ANON_KEY envs at
// it. The Bounty app must keep talking to its own project (schema, auth
// users, edge functions, storage), so it reads these dedicated envs and
// falls back to the known project URL.

const fallbackUrl = 'https://jmlqcdcegejeunblzemh.supabase.co';

export const BOUNTY_SUPABASE_URL =
  process.env.EXPO_PUBLIC_BOUNTY_SUPABASE_URL || fallbackUrl;

export const BOUNTY_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_BOUNTY_SUPABASE_ANON_KEY || '';
