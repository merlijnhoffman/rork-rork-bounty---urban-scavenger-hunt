import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Haversine distance in meters between two lat/lon points.
 */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const MAX_DISTANCE_METERS = 100;
const CODE_TTL_MINUTES = 5;

type VerifyRequest = {
  code: string;
  scannerUserId: string;
  scannerLatitude: number;
  scannerLongitude: number;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, scannerUserId, scannerLatitude, scannerLongitude } =
      (await req.json()) as VerifyRequest;

    if (!code || !scannerUserId || scannerLatitude == null || scannerLongitude == null) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Look up the connection code
    const { data: codeRow, error: codeError } = await supabase
      .from('connection_codes')
      .select('*')
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (codeError) {
      console.error('[verify-connection] Error fetching code:', codeError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!codeRow) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Can't connect to yourself
    if (codeRow.user_id === scannerUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "You can't connect to yourself" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Check both users have active tickets for the same event
    const { data: scannerTicket } = await supabase
      .from('tickets')
      .select('id')
      .eq('user_id', scannerUserId)
      .eq('event_id', codeRow.event_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!scannerTicket) {
      return new Response(
        JSON.stringify({ success: false, error: 'You need an active ticket for this event' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: generatorTicket } = await supabase
      .from('tickets')
      .select('id')
      .eq('user_id', codeRow.user_id)
      .eq('event_id', codeRow.event_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!generatorTicket) {
      return new Response(
        JSON.stringify({ success: false, error: 'The other hunter no longer has a valid ticket' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Check they haven't already connected during this event
    const { data: existingConnection } = await supabase
      .from('player_connections')
      .select('id')
      .eq('event_id', codeRow.event_id)
      .or(
        `and(generator_user_id.eq.${codeRow.user_id},scanner_user_id.eq.${scannerUserId}),and(generator_user_id.eq.${scannerUserId},scanner_user_id.eq.${codeRow.user_id})`,
      )
      .maybeSingle();

    if (existingConnection) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'You’ve already connected with this hunter. You can only connect with each hunter once per game.',
          code: 'ALREADY_CONNECTED',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 5. Proximity check — both must be within MAX_DISTANCE_METERS
    const distance = haversineMeters(
      scannerLatitude,
      scannerLongitude,
      codeRow.latitude,
      codeRow.longitude,
    );

    if (distance > MAX_DISTANCE_METERS) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `You are ${Math.round(distance)}m apart. Get within ${MAX_DISTANCE_METERS}m to connect.`,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 6. Create the connection record
    const connectionKey = `${codeRow.user_id.slice(0, 8)}-${scannerUserId.slice(0, 8)}-${Date.now()}`;
    const { error: insertError } = await supabase.from('player_connections').insert({
      connection_key: connectionKey,
      generator_user_id: codeRow.user_id,
      scanner_user_id: scannerUserId,
      event_id: codeRow.event_id,
      distance: Math.round(distance),
    });

    if (insertError) {
      // Race condition: two simultaneous scans both passed the duplicate check
      // before either INSERT landed. The unique index catches it here.
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'You’ve already connected with this hunter. You can only connect with each hunter once per game.',
            code: 'ALREADY_CONNECTED',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      console.error('[verify-connection] Error inserting connection:', insertError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create connection' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 7. Invalidate the code so it can't be reused
    await supabase
      .from('connection_codes')
      .delete()
      .eq('id', codeRow.id);

    return new Response(
      JSON.stringify({
        success: true,
        distance: Math.round(distance),
        eventId: codeRow.event_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[verify-connection] Error:', message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

/*
 * =============================================================================
 * SUPABASE SETUP
 * =============================================================================
 *
 * Run these in your Supabase SQL editor:
 *
 * CREATE TABLE IF NOT EXISTS connection_codes (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   code TEXT NOT NULL UNIQUE,
 *   user_id TEXT NOT NULL,
 *   event_id TEXT NOT NULL,
 *   latitude DOUBLE PRECISION NOT NULL,
 *   longitude DOUBLE PRECISION NOT NULL,
 *   expires_at TIMESTAMPTZ NOT NULL,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE INDEX idx_connection_codes_code ON connection_codes(code);
 * CREATE INDEX idx_connection_codes_user_event ON connection_codes(user_id, event_id);
 * ALTER TABLE connection_codes ENABLE ROW LEVEL SECURITY;
 *
 * -- Users can read/insert/delete their own codes
 * CREATE POLICY "Users manage own connection codes" ON connection_codes
 *   FOR ALL USING (auth.uid()::text = user_id);
 *
 * CREATE TABLE IF NOT EXISTS player_connections (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   connection_key TEXT NOT NULL,
 *   generator_user_id TEXT NOT NULL,
 *   scanner_user_id TEXT NOT NULL,
 *   event_id TEXT NOT NULL,
 *   distance INTEGER NOT NULL,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE INDEX idx_player_connections_event ON player_connections(event_id);
 * CREATE INDEX idx_player_connections_users ON player_connections(generator_user_id, scanner_user_id);
 *
 * -- Prevent duplicate connections between the same pair per event
 * -- (handles race condition: two simultaneous scans that both pass the
 * -- SELECT check before either INSERT lands). LEAST/GREATEST normalise
 * -- the pair so (A→B) and (B→A) are treated as the same connection.
 * CREATE UNIQUE INDEX idx_player_connections_unique_pair
 *   ON player_connections (
 *     event_id,
 *     LEAST(generator_user_id, scanner_user_id),
 *     GREATEST(generator_user_id, scanner_user_id)
 *   );
 *
 * ALTER TABLE player_connections ENABLE ROW LEVEL SECURITY;
 *
 * -- Users can read connections they are part of
 * CREATE POLICY "Users read own connections" ON player_connections
 *   FOR SELECT USING (
 *     auth.uid()::text = generator_user_id OR auth.uid()::text = scanner_user_id
 *   );
 *
 * -- Only the edge function (service role) inserts connections
 * CREATE POLICY "Service role inserts connections" ON player_connections
 *   FOR INSERT WITH CHECK (true);
 * =============================================================================
 */
