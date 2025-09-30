import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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
    };
  };
};