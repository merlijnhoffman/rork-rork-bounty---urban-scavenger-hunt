import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Colors from '@/constants/colors';

const C = Colors;

type Provider = 'google' | 'apple';

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </Svg>
  );
}

function AppleIcon({ size = 18, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 384 512">
      <Path
        fill={color}
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </Svg>
  );
}

interface Props {
  /** Shows the "or continue with email" divider below the buttons. */
  divider?: boolean;
  /** Where to navigate after a successful sign-in. */
  onDone?: () => void;
}

export function SocialAuthButtons({ divider = true, onDone }: Props) {
  const { signInWithProvider } = useAuth();
  const { t } = useLanguage();
  const [busy, setBusy] = useState<Provider | null>(null);

  const handleProvider = async (provider: Provider) => {
    if (busy) return;
    setBusy(provider);
    const result = await signInWithProvider(provider);
    setBusy(null);

    if (result.success) {
      if (onDone) onDone();
      else router.replace('/' as any);
      return;
    }

    if (result.error === 'CANCELLED') return;
    Alert.alert(t('errOauthFailed'), result.error || t('errOauthFailed'));
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.button, busy === 'google' && styles.buttonDisabled]}
        onPress={() => handleProvider('google')}
        disabled={busy !== null}
        activeOpacity={0.8}
        testID="google-signin"
      >
        {busy === 'google' ? (
          <ActivityIndicator size="small" color="#111" />
        ) : (
          <>
            <GoogleIcon />
            <Text style={styles.buttonText}>{t('obGoogle')}</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, busy === 'apple' && styles.buttonDisabled]}
        onPress={() => handleProvider('apple')}
        disabled={busy !== null}
        activeOpacity={0.8}
        testID="apple-signin"
      >
        {busy === 'apple' ? (
          <ActivityIndicator size="small" color="#111" />
        ) : (
          <>
            <AppleIcon />
            <Text style={styles.buttonText}>{t('obApple')}</Text>
          </>
        )}
      </TouchableOpacity>

      {divider && (
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('orEmail')}</Text>
          <View style={styles.dividerLine} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.dark.border,
  },
  dividerText: {
    fontSize: 13,
    color: C.dark.textMuted,
  },
});
