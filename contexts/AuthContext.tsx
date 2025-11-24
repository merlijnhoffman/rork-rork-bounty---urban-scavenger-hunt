import { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';
import { router } from 'expo-router';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (phoneNumber: string) => Promise<{ success: boolean; error?: string }>;
  verifyPhone: (phoneNumber: string, code: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (phoneNumber: string, code: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const [AuthProviderInternal, useAuthInternal] = createContextHook((): AuthState => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    
    // Get initial session asynchronously - don't block render
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Error getting session:', error);
      }
    };

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    // Initialize session after setting up listener
    initSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (phoneNumber: string) => {
    try {
      console.log('Sending OTP to:', phoneNumber);
      
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber,
      });

      if (error) {
        console.error('OTP send error:', error);
        let errorMessage = error.message;
        
        if (error.message.includes('not a valid phone number')) {
          errorMessage = 'Invalid phone number format. Please use format: +1234567890';
        } else if (error.message.includes('sms_send_failed')) {
          errorMessage = 'Failed to send SMS. Please check your phone number and try again.';
        }
        
        return { success: false, error: errorMessage };
      }

      console.log('OTP sent successfully');
      return { success: true };
    } catch (error) {
      console.error('Unexpected OTP send error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  }, []);

  const verifyPhone = useCallback(async (phoneNumber: string, code: string) => {
    try {
      setLoading(true);
      console.log('Verifying OTP for:', phoneNumber);
      
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneNumber,
        token: code,
        type: 'sms',
      });

      if (error) {
        console.error('OTP verification error:', error);
        let errorMessage = error.message;
        
        if (error.message.includes('expired')) {
          errorMessage = 'Verification code has expired. Please request a new one.';
        } else if (error.message.includes('invalid')) {
          errorMessage = 'Invalid verification code. Please try again.';
        }
        
        return { success: false, error: errorMessage };
      }

      if (data.user) {
        console.log('User verified successfully:', data.user.id);
        
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            phone_number: phoneNumber,
          }, {
            onConflict: 'id',
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          return { success: false, error: 'Account created but profile setup failed. Please contact support.' };
        }
        
        console.log('Profile created/updated successfully');
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected verification error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (phoneNumber: string, code: string) => {
    return verifyPhone(phoneNumber, code);
  }, [verifyPhone]);



  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        Alert.alert('Error', 'Failed to sign out');
        return;
      }
      
      // Redirect to home screen after successful sign out
      router.replace('/(tabs)/hunt');
    } catch (error) {
      console.error('Unexpected sign out error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);



  return useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    verifyPhone,
    signIn,
    signOut,
  }), [user, session, loading, signUp, verifyPhone, signIn, signOut]);
});

// Safe wrapper hook that ensures the context is available
export function useAuth() {
  const context = useAuthInternal();
  if (!context) {
    // Return default values instead of throwing error to prevent crashes
    return {
      user: null,
      session: null,
      loading: false,
      signUp: async () => ({ success: false, error: 'Auth context not available' }),
      verifyPhone: async () => ({ success: false, error: 'Auth context not available' }),
      signIn: async () => ({ success: false, error: 'Auth context not available' }),
      signOut: async () => {},
    };
  }
  return context;
}

export const AuthProvider = AuthProviderInternal;