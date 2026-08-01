import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

/**
 * Generate a unique session token for this device login attempt.
 * Used to detect when another device logs into the same account.
 */
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Platform.OS}-${Device.modelName ?? 'unknown'}`;
}

/** Human-readable device label stored alongside the session for debugging. */
function getDeviceInfo(): string {
  const parts = [
    Device.modelName ?? 'Unknown device',
    Device.osName ?? Platform.OS,
    Device.osVersion ?? '',
  ];
  return parts.filter(Boolean).join(' ');
}

/* SQL to create the user_sessions table in Supabase:

CREATE TABLE user_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  device_info TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own session"
  ON user_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE user_sessions;
*/

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const [AuthProviderInternal, useAuthInternal] = createContextHook((): AuthState => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  /** This device's current session token — used to detect takeover by another device. */
  const sessionTokenRef = useRef<string | null>(null);
  /** Prevents the forced-sign-out alert from firing more than once. */
  const forceSignOutGuard = useRef<boolean>(false);

  /**
   * Register (or refresh) this device's session in the user_sessions table.
   * Another device logging in will overwrite this row, triggering our
   * realtime listener to sign us out.
   */
  const registerSession = useCallback(async (userId: string) => {
    const token = generateSessionToken();
    sessionTokenRef.current = token;
    try {
      await supabase.from('user_sessions').upsert(
        {
          user_id: userId,
          session_token: token,
          device_info: getDeviceInfo(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    } catch (err) {
      console.error('[Auth] Failed to register session:', err);
    }
  }, []);

  /** Remove this device's session row on sign-out. */
  const clearSession = useCallback(async (userId: string) => {
    try {
      await supabase.from('user_sessions').delete().eq('user_id', userId);
    } catch (err) {
      console.error('[Auth] Failed to clear session:', err);
    }
    sessionTokenRef.current = null;
  }, []);

  /**
   * Subscribe to realtime changes on the user_sessions row. If the
   * session_token changes to something other than ours, another device
   * has logged in — force sign out immediately.
   */
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const myToken = sessionTokenRef.current;
    if (!myToken) return;

    const channel = supabase
      .channel(`user_session:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_sessions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newToken = (payload.new as { session_token?: string })?.session_token;
          if (newToken && newToken !== sessionTokenRef.current && !forceSignOutGuard.current) {
            forceSignOutGuard.current = true;
            console.warn('[Auth] Session taken over by another device');
            Alert.alert(
              'Signed Out',
              'Your account was signed in on another device. Only one device can be logged in at a time to prevent cheating.',
              [
                {
                  text: 'OK',
                  onPress: async () => {
                    sessionTokenRef.current = null;
                    await supabase.auth.signOut();
                    router.replace('/login');
                  },
                },
              ],
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          // Re-register session on app relaunch so this device reclaims the slot
          if (session?.user) {
            await registerSession(session.user.id);
          }
        }
      } catch (error) {
        console.error('Error getting session:', error);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        // Reset the guard when we get a new auth user
        if (session?.user) {
          forceSignOutGuard.current = false;
        }
      }
    });

    initSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [registerSession]);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Sign up error:', error);
        let errorMessage = error.message;
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          errorMessage = 'An account with this email already exists. Try signing in instead.';
        } else if (error.message.includes('rate limit')) {
          errorMessage = 'Too many attempts. Please wait a few minutes before trying again.';
        }
        return { success: false, error: errorMessage };
      }

      // Create profile row if user was created
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: email.trim(),
          }, { onConflict: 'id' });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }

        // Register this device's session
        await registerSession(data.user.id);
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected sign up error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, [registerSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        let errorMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please confirm your email before signing in. Check your inbox for a confirmation link.';
        }
        return { success: false, error: errorMessage };
      }

      if (data.user) {
        // Update profile email in case it changed
        await supabase
          .from('profiles')
          .upsert({ id: data.user.id, email: email.trim() }, { onConflict: 'id' });

        // Register this device's session — this overwrites any existing
        // session row, which will force the other device to sign out
        forceSignOutGuard.current = false;
        await registerSession(data.user.id);
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected sign in error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, [registerSession]);

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      const userId = sessionTokenRef.current ? user?.id : null;
      if (userId) {
        await clearSession(userId);
      }
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
      sessionTokenRef.current = null;
      forceSignOutGuard.current = false;
      router.replace('/hunt');
    } catch (error) {
      console.error('Unexpected sign out error:', error);
    } finally {
      setLoading(false);
    }
  }, [clearSession, user?.id]);

  return useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  }), [user, session, loading, signUp, signIn, signOut]);
});

export function useAuth() {
  const context = useAuthInternal();
  if (!context) {
    return {
      user: null,
      session: null,
      loading: false,
      signUp: async () => ({ success: false, error: 'Auth context not available' }),
      signIn: async () => ({ success: false, error: 'Auth context not available' }),
      signOut: async () => {},
    } satisfies AuthState;
  }
  return context;
}

export const AuthProvider = AuthProviderInternal;
