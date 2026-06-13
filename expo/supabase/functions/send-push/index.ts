import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

type PushPayload =
  | { type: 'event_published'; eventId: string; city: string }
  | { type: 'event_started'; eventId: string; city: string }
  | { type: 'new_clue'; eventId: string; clueText: string };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: PushPayload = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let title: string;
    let bodyText: string;
    let targetTokens: string[] = [];
    const data: Record<string, unknown> = { screen: 'hunt' };

    if (body.type === 'event_published') {
      title = '\u{1F3AF} New Hunt Published!';
      bodyText = `A new scavenger hunt in ${body.city} has just been published. Grab your ticket!`;
      data.eventId = body.eventId;

      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('push_token');
      targetTokens = (tokens || []).map((t: { push_token: string }) => t.push_token);
    } else if (body.type === 'event_started') {
      title = '\u{1F3C1} Hunt is Live!';
      bodyText = `The ${body.city} scavenger hunt has started! Open the app to join.`;
      data.eventId = body.eventId;

      const { data: ticketHolders } = await supabase
        .from('tickets')
        .select('user_id')
        .eq('event_id', body.eventId)
        .eq('status', 'active');

      const userIds = (ticketHolders || []).map((t: { user_id: string }) => t.user_id);
      if (userIds.length > 0) {
        const { data: tokens } = await supabase
          .from('push_tokens')
          .select('push_token')
          .in('user_id', userIds);
        targetTokens = (tokens || []).map((t: { push_token: string }) => t.push_token);
      }
    } else if (body.type === 'new_clue') {
      title = '\u{1F50D} New Clue!';
      const preview = body.clueText.length > 80
        ? body.clueText.slice(0, 77) + '...'
        : body.clueText;
      bodyText = preview;
      data.eventId = body.eventId;

      const { data: ticketHolders } = await supabase
        .from('tickets')
        .select('user_id')
        .eq('event_id', body.eventId)
        .eq('status', 'active');

      const userIds = (ticketHolders || []).map((t: { user_id: string }) => t.user_id);
      if (userIds.length > 0) {
        const { data: tokens } = await supabase
          .from('push_tokens')
          .select('push_token')
          .in('user_id', userIds);
        targetTokens = (tokens || []).map((t: { push_token: string }) => t.push_token);
      }
    } else {
      return new Response(JSON.stringify({ error: 'Unknown notification type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (targetTokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No tokens to send to' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[send-push] Sending "${title}" to ${targetTokens.length} device(s)`);

    const messages = targetTokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body: bodyText,
      data,
    }));

    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const pushResult = await pushResponse.json();

    return new Response(
      JSON.stringify({ success: true, sent: targetTokens.length, expoResult: pushResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[send-push] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/*
 * =============================================================================
 * SUPABASE SETUP
 * =============================================================================
 *
 * 1. Create the push_tokens table in your Supabase SQL editor:
 *
 *    CREATE TABLE IF NOT EXISTS push_tokens (
 *      user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
 *      push_token TEXT NOT NULL,
 *      platform TEXT NOT NULL,
 *      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *    );
 *
 *    ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
 *
 *    CREATE POLICY "Users can upsert their own token" ON push_tokens
 *      FOR ALL USING (auth.uid()::text = user_id);
 *
 * 2. Set up Database Webhooks in the Supabase Dashboard:
 *    (Recommended for push notifications to work when the app is in background)
 *
 *    Webhook 1 — Event Published:
 *      Table: events
 *      Events: INSERT
 *      URL: https://<project>.supabase.co/functions/v1/send-push
 *      HTTP Method: POST
 *      Payload: { "type": "event_published", "eventId": "{{record.id}}", "city": "{{record.city}}" }
 *
 *    Webhook 2 — Event Started:
 *      Table: events
 *      Events: UPDATE (filter: status = 'live')
 *      URL: https://<project>.supabase.co/functions/v1/send-push
 *      HTTP Method: POST
 *      Payload: { "type": "event_started", "eventId": "{{record.id}}", "city": "{{record.city}}" }
 *
 *    Webhook 3 — New Clue:
 *      Table: clues
 *      Events: INSERT
 *      URL: https://<project>.supabase.co/functions/v1/send-push
 *      HTTP Method: POST
 *      Payload: { "type": "new_clue", "eventId": "{{record.event_id}}", "clueText": "{{record.clue_text}}" }
 *
 * Until webhooks are configured, push notifications still work when the app
 * detects changes via realtime (foreground) — see hunt.tsx triggerPushForNewClue.
 * =============================================================================
 */
