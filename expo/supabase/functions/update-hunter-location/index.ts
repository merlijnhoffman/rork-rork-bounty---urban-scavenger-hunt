import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { eventId, userId, latitude, longitude, heading } = body as {
      eventId: string;
      userId: string;
      latitude: number;
      longitude: number;
      heading?: number;
    };

    if (!eventId || !userId || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: eventId, userId, latitude, longitude' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the player has an active ticket for this event
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .eq('status', 'active')
      .maybeSingle();

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({ error: 'No active ticket for this event' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Upsert the hunter location
    const { error: upsertError } = await supabase
      .from('hunter_locations')
      .upsert(
        {
          event_id: eventId,
          user_id: userId,
          latitude,
          longitude,
          heading: heading ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,user_id' },
      );

    if (upsertError) {
      console.error('[update-hunter-location] Upsert error:', upsertError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to update location' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[update-hunter-location] Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
