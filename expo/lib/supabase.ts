import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.warn('Missing EXPO_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.warn('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

console.log('Supabase URL loaded:', supabaseUrl ? 'Yes' : 'No');
console.log('Supabase Anon Key loaded:', supabaseAnonKey ? 'Yes' : 'No');

// Helper function to send clues directly through Supabase
export async function sendClueToSupabase({
  eventId,
  text,
  hint,
  orderNumber,
  releaseTime,
  mediaType,
  mediaUrl,
}: {
  eventId: string;
  text: string;
  hint?: string;
  orderNumber: number;
  releaseTime?: string;
  mediaType?: string;
  mediaUrl?: string;
}) {
  const { data, error } = await supabase
    .from('clues')
    .insert({
      event_id: eventId,
      clue_text: text,
      hint,
      order_number: orderNumber,
      release_time: releaseTime || new Date().toISOString(),
      media_type: mediaType,
      media_url: mediaUrl,
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending clue to Supabase:', error);
    throw error;
  }

  console.log('Clue sent successfully:', data.id);
  return data;
}

// Helper function to get clues for users with tickets
export async function getCluesForUser(userId: string, eventId: string) {
  // First check if user has a valid ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .eq('is_used', false)
    .single();

  if (ticketError || !ticket) {
    return { hasAccess: false, clues: [], message: 'No valid ticket found' };
  }

  // Get released clues for this event
  const { data: clues, error: cluesError } = await supabase
    .from('clues')
    .select('*')
    .eq('event_id', eventId)
    .lte('release_time', new Date().toISOString())
    .order('order_number', { ascending: true });

  if (cluesError) {
    console.error('Error fetching clues:', cluesError);
    throw cluesError;
  }

  return {
    hasAccess: true,
    clues: clues || [],
    message: 'Clues retrieved successfully'
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// SQL to create the clues table in Supabase:
/*
CREATE TABLE clues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  text TEXT NOT NULL,
  hint TEXT,
  order_number INTEGER NOT NULL,
  release_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE clues ENABLE ROW LEVEL SECURITY;

-- Policy to allow reading clues for users with valid tickets
CREATE POLICY "Users can read clues if they have valid tickets" ON clues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.user_id = auth.uid()::text 
      AND tickets.event_id = clues.event_id 
      AND tickets.is_used = false
    )
  );

-- Policy to allow service role to insert clues
CREATE POLICY "Service role can insert clues" ON clues
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
*/


export type Clue = {
  id: string;
  event_id: string;
  clue_text: string;
  clue_order: number;
  hint: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          phone_number: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          phone_number: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          phone_number?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tickets: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          verification_code: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          verification_code: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          verification_code?: string;
          status?: string;
          created_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          city: string;
          date: string;
          price: number;
          is_active: boolean;
          status: 'scheduled' | 'live' | 'completed';
          bounty_access_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          city: string;
          date: string;
          price: number;
          is_active?: boolean;
          status?: 'scheduled' | 'live' | 'completed';
          bounty_access_code?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          city?: string;
          date?: string;
          price?: number;
          is_active?: boolean;
          status?: 'scheduled' | 'live' | 'completed';
          bounty_access_code?: string | null;
          created_at?: string;
        };
      };
      bounty_locations: {
        Row: {
          event_id: string;
          latitude: number;
          longitude: number;
          accuracy: number | null;
          heading: number | null;
          speed: number | null;
          is_active: boolean;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          event_id: string;
          latitude: number;
          longitude: number;
          accuracy?: number | null;
          heading?: number | null;
          speed?: number | null;
          is_active?: boolean;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          latitude?: number;
          longitude?: number;
          accuracy?: number | null;
          heading?: number | null;
          speed?: number | null;
          is_active?: boolean;
          updated_at?: string;
          created_at?: string;
        };
      };
      clues: {
        Row: {
          id: string;
          event_id: string;
          clue_text: string;
          hint?: string;
          order_number: number;
          release_time: string;
          created_at: string;
          media_type?: string;
          media_url?: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          clue_text: string;
          hint?: string;
          order_number: number;
          release_time: string;
          created_at?: string;
          media_type?: string;
          media_url?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          clue_text?: string;
          hint?: string;
          order_number?: number;
          release_time?: string;
          created_at?: string;
          media_type?: string;
          media_url?: string;
        };
      };
      event_zones: {
        Row: {
          event_id: string;
          center_latitude: number;
          center_longitude: number;
          initial_radius: number;
          narrowed_percent: number;
          zone_name: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          event_id: string;
          center_latitude: number;
          center_longitude: number;
          initial_radius: number;
          narrowed_percent?: number;
          zone_name?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          center_latitude?: number;
          center_longitude?: number;
          initial_radius?: number;
          narrowed_percent?: number;
          zone_name?: string | null;
          updated_at?: string;
          created_at?: string;
        };
      };
      connection_codes: {
        Row: {
          id: string;
          code: string;
          user_id: string;
          event_id: string;
          latitude: number;
          longitude: number;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          user_id: string;
          event_id: string;
          latitude: number;
          longitude: number;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          user_id?: string;
          event_id?: string;
          latitude?: number;
          longitude?: number;
          expires_at?: string;
          created_at?: string;
        };
      };
      push_tokens: {
        Row: {
          user_id: string;
          push_token: string;
          platform: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          push_token: string;
          platform: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          push_token?: string;
          platform?: string;
          updated_at?: string;
        };
      };
      player_connections: {
        Row: {
          id: string;
          connection_key: string;
          generator_user_id: string;
          scanner_user_id: string;
          event_id: string;
          distance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          connection_key: string;
          generator_user_id: string;
          scanner_user_id: string;
          event_id: string;
          distance: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          connection_key?: string;
          generator_user_id?: string;
          scanner_user_id?: string;
          event_id?: string;
          distance?: number;
          created_at?: string;
        };
      };
      event_winners: {
        Row: {
          id: string;
          event_id: string;
          winner_user_id: string;
          winner_email: string | null;
          verification_code: string;
          declared_at: string;
          declare_distance_m: number | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          winner_user_id: string;
          winner_email?: string | null;
          verification_code: string;
          declared_at?: string;
          declare_distance_m?: number | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          winner_user_id?: string;
          winner_email?: string | null;
          verification_code?: string;
          declared_at?: string;
          declare_distance_m?: number | null;
        };
      };
    };
  };
};