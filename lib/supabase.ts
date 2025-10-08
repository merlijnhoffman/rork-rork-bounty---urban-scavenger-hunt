import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable');
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
}: {
  eventId: string;
  text: string;
  hint?: string;
  orderNumber: number;
  releaseTime?: string;
}) {
  const { data, error } = await supabase
    .from('clues')
    .insert({
      event_id: eventId,
      text,
      hint,
      order_number: orderNumber,
      release_time: releaseTime || new Date().toISOString(),
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

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function generateConnectionCode({
  userId,
  eventId,
  latitude,
  longitude,
}: {
  userId: string;
  eventId: string;
  latitude: number;
  longitude: number;
}) {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const expiresAt = new Date(Date.now() + 60000).toISOString();

  const { data, error } = await supabase
    .from('connection_codes')
    .insert({
      code,
      user_id: userId,
      event_id: eventId,
      latitude,
      longitude,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    console.error('Error generating connection code:', error);
    throw new Error('Failed to generate connection code');
  }

  console.log(`Generated connection code for user ${userId}:`, code);

  return {
    code: data.code,
    expiresAt: data.expires_at,
  };
}

export async function verifyConnection({
  code,
  scannerUserId,
  scannerLatitude,
  scannerLongitude,
}: {
  code: string;
  scannerUserId: string;
  scannerLatitude: number;
  scannerLongitude: number;
}) {
  const { data: codeData, error: codeError } = await supabase
    .from('connection_codes')
    .select('*')
    .eq('code', code)
    .single();

  if (codeError || !codeData) {
    throw new Error('Invalid or expired connection code');
  }

  if (new Date(codeData.expires_at) < new Date()) {
    await supabase.from('connection_codes').delete().eq('code', code);
    throw new Error('Connection code has expired');
  }

  if (codeData.user_id === scannerUserId) {
    throw new Error('Cannot connect with yourself');
  }

  const connectionKey = [codeData.user_id, scannerUserId].sort().join('-');

  const { data: existingConnection } = await supabase
    .from('player_connections')
    .select('*')
    .eq('connection_key', connectionKey)
    .single();

  if (existingConnection) {
    throw new Error('You have already connected with this player');
  }

  const distance = calculateDistance(
    codeData.latitude,
    codeData.longitude,
    scannerLatitude,
    scannerLongitude
  );

  console.log(`Distance between players: ${distance}m`);

  if (distance > 5) {
    throw new Error(
      `Players must be within 5 meters of each other (current distance: ${Math.round(distance)}m)`
    );
  }

  const { error: insertError } = await supabase
    .from('player_connections')
    .insert({
      connection_key: connectionKey,
      generator_user_id: codeData.user_id,
      scanner_user_id: scannerUserId,
      event_id: codeData.event_id,
      distance: Math.round(distance),
    });

  if (insertError) {
    console.error('Error creating connection:', insertError);
    throw new Error('Failed to create connection');
  }

  await supabase.from('connection_codes').delete().eq('code', code);

  console.log(
    `Connection successful between ${codeData.user_id} and ${scannerUserId}`
  );

  return {
    success: true,
    generatorUserId: codeData.user_id,
    scannerUserId: scannerUserId,
    distance: Math.round(distance),
  };
}

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
          purchased_at: string;
          is_used: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          verification_code: string;
          purchased_at?: string;
          is_used?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          verification_code?: string;
          purchased_at?: string;
          is_used?: boolean;
        };
      };
      events: {
        Row: {
          id: string;
          city: string;
          date: string;
          start_time: string;
          price: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          city: string;
          date: string;
          start_time: string;
          price: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          city?: string;
          date?: string;
          start_time?: string;
          price?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      clues: {
        Row: {
          id: string;
          event_id: string;
          text: string;
          hint?: string;
          order_number: number;
          release_time: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          text: string;
          hint?: string;
          order_number: number;
          release_time: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          text?: string;
          hint?: string;
          order_number?: number;
          release_time?: string;
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
    };
  };
};