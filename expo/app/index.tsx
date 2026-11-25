import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { ONBOARDING_SEEN_KEY } from '@/constants/keys';

const C = Colors;

/**
 * First-launch gate:
 * - Never seen the app before (and signed out) → mysterious onboarding → /auth.
 * - Already has an account but hasn't seen onboarding (existing testers) →
 *   straight to the hunt, silently marking onboarding as seen.
 * - Everyone else → unchanged behaviour (/hunt).
 */
export default function Index() {
  const { user } = useAuth();
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_SEEN_KEY)
      .then((v) => setSeen(v === 'true'))
      .catch(() => setSeen(true));
  }, []);

  if (seen === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={C.accent.primary} />
      </View>
    );
  }

  if (!seen && !user) {
    return <Redirect href="/onboarding" />;
  }

  if (!seen && user) {
    // Existing signed-in testers: don't force them through the intro.
    AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true').catch(() => {});
  }

  return <Redirect href="/hunt" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: C.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
