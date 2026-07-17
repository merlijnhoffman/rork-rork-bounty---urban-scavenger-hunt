import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

type UpdateRequest = {
  accessCode: string;
  eventId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  deactivate?: boolean;
};

/**
 * Validates the bounty access code for an event and upserts the bounty's
 * live GPS position into `bounty_locations`. Only the service role writes;
 * clients must supply the per-event `bounty_access_code` to authenticate.
 *
 * The `bounty_access_code` is stored on the `events` row by the admin and
 * shared privately with the bounty person before the hunt begins.
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as UpdateRequest;
    const { accessCode, eventId, latitude, longitude, accuracy, heading, speed, deactivate } = body;

    if (!accessCode || !eventId || latitude == null || longitude == null) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Verify the access code matches the event
    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id, status, bounty_access_code')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) {
      console.error('[update-bounty-location] Error fetching event:', eventError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!eventRow) {
      return new Response(
        JSON.stringify({ success: false, error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!eventRow.bounty_access_code || eventRow.bounty_access_code !== accessCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid access code' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Only allow updates while the event is live (or starting)
    if (eventRow.status === 'completed') {
      return new Response(
        JSON.stringify({ success: false, error: 'This hunt has ended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const now = new Date().toISOString();
    const isActive = deactivate ? false : true;

    // 3. Upsert the bounty location (one row per event)
    const { error: upsertError } = await supabase
      .from('bounty_locations')
      .upsert(
        {
          event_id: eventId,
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
          is_active: isActive,
          updated_at: now,
        },
        { onConflict: 'event_id' },
      );

    if (upsertError) {
      console.error('[update-bounty-location] Error upserting location:', upsertError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update location' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, isActive, updatedAt: now }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[update-bounty-location] Error:', message);
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
 * 1. Add bounty_access_code column to events and create the bounty_locations table:
 *
 *    ALTER TABLE events ADD COLUMN IF NOT EXISTS bounty_access_code TEXT;
 *
 *    CREATE TABLE IF NOT EXISTS bounty_locations (
 *      event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
 *      latitude DOUBLE PRECISION NOT NULL,
 *      longitude DOUBLE PRECISION NOT NULL,
 *      accuracy DOUBLE PRECISION,
 *      heading DOUBLE PRECISION,
 *      speed DOUBLE PRECISION,
 *      is_active BOOLEAN NOT NULL DEFAULT TRUE,
 *      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *    );
 *
 *    -- Realtime publication
 *    ALTER PUBLICATION supabase_realtime ADD TABLE bounty_locations;
 *
 *    -- RLS: players (authenticated) can READ bounty locations so the distance
 *    -- meter works. Only the edge function (service role) writes.
 *    ALTER TABLE bounty_locations ENABLE ROW LEVEL SECURITY;
 *
 *    CREATE POLICY "Authenticated users read bounty locations" ON bounty_locations
 *      FOR SELECT TO authenticated USING (true);
 *
 * 2. Admin sets a unique bounty_access_code per event before the hunt:
 *
 *    UPDATE events SET bounty_access_code = 'BOUNTY-AMSTERDAM-7F3K9' WHERE id = '...';
 *
 *    Share this code privately with the bounty person. They enter it in the
 *    app's Bounty Mode screen to start broadcasting their location.
 * =============================================================================
 */
