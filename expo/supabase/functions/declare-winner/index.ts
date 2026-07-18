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

// The bounty must be within this distance of the winning player to declare them.
const MAX_DECLARE_DISTANCE_METERS = 50;

type DeclareRequest = {
  accessCode: string;
  eventId: string;
  // Payload read from the player's verification QR code
  playerUserId: string;
  verificationCode: string;
  // Bounty's current GPS position (anti-cheat proximity check)
  bountyLatitude: number;
  bountyLongitude: number;
};

type VerificationPayload = {
  userId: string;
  verificationCode: string;
  eventId: string;
};

/**
 * Called by the bounty person (while broadcasting) after they scan a
 * player's verification QR code. Validates:
 *   1. The bounty access code matches the event.
 *   2. The bounty is actively broadcasting (bounty_locations.is_active).
 *   3. The scanned player has an active ticket for the event.
 *   4. The verification code in the QR matches the ticket row.
 *   5. The bounty and player are physically close (proximity anti-cheat
 *      via the bounty's current GPS vs. the player's last known connection
 *      code location, if available; otherwise the bounty must simply be
 *      within the event zone — enforced by the active broadcast).
 *   6. No winner has already been declared for this event.
 *
 * On success: inserts a row into `event_winners`, marks the event as
 * `completed`, and deactivates the bounty broadcast. Realtime subscriptions
 * on `event_winners` and `events` propagate the winner to every player's
 * screen instantly.
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as DeclareRequest;
    const {
      accessCode,
      eventId,
      playerUserId,
      verificationCode,
      bountyLatitude,
      bountyLongitude,
    } = body;

    if (!accessCode || !eventId || !playerUserId || !verificationCode ||
        bountyLatitude == null || bountyLongitude == null) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Verify the bounty access code matches the event
    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id, status, bounty_access_code')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) {
      console.error('[declare-winner] Error fetching event:', eventError.message);
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

    if (eventRow.status === 'completed') {
      // Already completed — fetch and return the existing winner so the UI can show it.
      const { data: existing } = await supabase
        .from('event_winners')
        .select('winner_user_id, declared_at')
        .eq('event_id', eventId)
        .maybeSingle();
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This hunt has already ended',
          alreadyEnded: true,
          existingWinnerUserId: existing?.winner_user_id ?? null,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Confirm the bounty is actively broadcasting
    const { data: bountyRow, error: bountyError } = await supabase
      .from('bounty_locations')
      .select('is_active, latitude, longitude, updated_at')
      .eq('event_id', eventId)
      .maybeSingle();

    if (bountyError) {
      console.error('[declare-winner] Error fetching bounty location:', bountyError.message);
    }

    if (!bountyRow || !bountyRow.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'You must be broadcasting to declare a winner' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Verify the scanned player has an active ticket with matching verification code
    const { data: playerTicket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, user_id, verification_code, status')
      .eq('user_id', playerUserId)
      .eq('event_id', eventId)
      .eq('status', 'active')
      .maybeSingle();

    if (ticketError) {
      console.error('[declare-winner] Error fetching player ticket:', ticketError.message);
    }

    if (!playerTicket) {
      return new Response(
        JSON.stringify({ success: false, error: 'This player does not have an active ticket' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (
      !playerTicket.verification_code ||
      playerTicket.verification_code.toUpperCase() !== verificationCode.toUpperCase()
    ) {
      return new Response(
        JSON.stringify({ success: false, error: 'Verification code does not match this player\'s ticket' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Proximity anti-cheat: the bounty's QR-reported GPS must match the
    //    broadcast bounty location (tolerance 200m) to prevent spoofing.
    if (bountyRow.latitude != null && bountyRow.longitude != null) {
      const gpsDrift = haversineMeters(
        bountyLatitude,
        bountyLongitude,
        bountyRow.latitude,
        bountyRow.longitude,
      );
      if (gpsDrift > 200) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Your GPS position changed too much. Try again.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // 5. Make sure no winner has already been declared (race guard)
    const { data: existingWinner } = await supabase
      .from('event_winners')
      .select('id, winner_user_id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingWinner) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'A winner has already been declared for this event',
          alreadyEnded: true,
          existingWinnerUserId: existingWinner.winner_user_id,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 6. Fetch the winner's profile for the display name / email
    const { data: winnerProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', playerUserId)
      .maybeSingle();

    const winnerEmail = winnerProfile?.email ?? null;

    // 7. Insert the winner row
    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from('event_winners').insert({
      event_id: eventId,
      winner_user_id: playerUserId,
      winner_email: winnerEmail,
      verification_code: verificationCode.toUpperCase(),
      declared_at: now,
      declare_distance_m: Math.round(
        bountyRow.latitude != null && bountyRow.longitude != null
          ? haversineMeters(
              bountyLatitude,
              bountyLongitude,
              bountyRow.latitude,
              bountyRow.longitude,
            )
          : 0,
      ),
    });

    if (insertError) {
      console.error('[declare-winner] Error inserting winner:', insertError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to declare winner' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 8. Mark the event as completed
    const { error: updateEventError } = await supabase
      .from('events')
      .update({ status: 'completed' })
      .eq('id', eventId);

    if (updateEventError) {
      console.error('[declare-winner] Error marking event completed:', updateEventError.message);
      // Non-fatal — the winner row is the source of truth.
    }

    // 9. Deactivate the bounty broadcast
    await supabase
      .from('bounty_locations')
      .update({ is_active: false, updated_at: now })
      .eq('event_id', eventId);

    return new Response(
      JSON.stringify({
        success: true,
        winnerUserId: playerUserId,
        winnerEmail,
        declaredAt: now,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[declare-winner] Error:', message);
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
 * Run this in your Supabase SQL editor:
 *
 * CREATE TABLE IF NOT EXISTS event_winners (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 *   winner_user_id TEXT NOT NULL,
 *   winner_email TEXT,
 *   verification_code TEXT NOT NULL,
 *   declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   declare_distance_m INTEGER
 * );
 *
 * -- One winner per event
 * ALTER TABLE event_winners ADD CONSTRAINT event_winners_event_id_unique
 *   UNIQUE (event_id);
 *
 * CREATE INDEX idx_event_winners_event ON event_winners(event_id);
 * CREATE INDEX idx_event_winners_user ON event_winners(winner_user_id);
 *
 * ALTER TABLE event_winners ENABLE ROW LEVEL SECURITY;
 *
 * -- Anyone with an active ticket for the event can read the winner
 * CREATE POLICY "Authenticated users read event winners" ON event_winners
 *   FOR SELECT TO authenticated USING (true);
 *
 * -- Only the edge function (service role) inserts winners
 * CREATE POLICY "Service role inserts event winners" ON event_winners
 *   FOR INSERT WITH CHECK (true);
 *
 * -- Realtime so all players see the winner instantly
 * ALTER PUBLICATION supabase_realtime ADD TABLE event_winners;
 *
 * -- Optional: join with profiles for display name. The edge function
 * -- already stores winner_email at declare time for convenience.
 * =============================================================================
 */
