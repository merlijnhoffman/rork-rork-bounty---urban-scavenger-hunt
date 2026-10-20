import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // GDPR / Apple account-deletion: remove EVERY user-owned row.
    // Child rows first so FK constraints cannot block the auth-user delete.
    // Errors on individual tables are ignored (table may not exist yet).
    await adminClient.from('tickets').delete().eq('user_id', userId);
    await adminClient.from('connection_codes').delete().eq('user_id', userId);
    await adminClient.from('hunter_locations').delete().eq('user_id', userId);
    await adminClient.from('push_tokens').delete().eq('user_id', userId);
    await adminClient.from('user_sessions').delete().eq('user_id', userId);
    // Player connections: the user can appear on either side of the pair.
    await adminClient
      .from('player_connections')
      .delete()
      .or(`generator_user_id.eq.${userId},scanner_user_id.eq.${userId}`);
    // Profile row last before the auth user.
    await adminClient.from('profiles').delete().eq('id', userId);

    // Removes the auth user and all auth sessions (auth.sessions) server-side.
    // Tip: also enable "Delete account after delay" in Supabase Auth settings
    // so the anonymized user row is purged from auth.users automatically.
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteErr) {
      return new Response(JSON.stringify({ error: deleteErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
