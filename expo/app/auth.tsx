import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowLeft, Crosshair, Mail, UserPlus } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import Colors from '@/constants/colors';
import { displayFont } from '@/constants/typography';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';

const C = Colors;

export default function AuthScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[C.gradient.backgroundStart, C.gradient.backgroundEnd]}
        style={styles.gradient}
      >
        {/* ambient reticle glow */}
        <View style={[styles.ambient, styles.ambientTop]} pointerEvents="none" />
        <View style={[styles.ambient, styles.ambientBottom]} pointerEvents="none" />

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft color={C.dark.textSecondary} size={22} />
          </TouchableOpacity>

          <Animated.View
            entering={FadeInDown.delay(80).duration(550)}
            style={styles.header}
          >
            <View style={styles.logoBadge}>
              <Crosshair color={C.accent.primary} size={26} />
            </View>
            <Text style={styles.title}>{t('authTitle')}</Text>
            <Text style={styles.subtitle}>{t('authSubtitle')}</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200).duration(550)} style={styles.actions}>
            <SocialAuthButtons />

            <View style={styles.emailRow}>
              <TouchableOpacity
                style={styles.emailButton}
                onPress={() => router.push('/login' as any)}
                activeOpacity={0.8}
                testID="email-signin"
              >
                <Mail size={17} color={C.accent.primary} />
                <Text style={styles.emailButtonText}>{t('signIn')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.emailButton}
                onPress={() => router.push('/signup' as any)}
                activeOpacity={0.8}
                testID="email-signup"
              >
                <UserPlus size={17} color={C.accent.primary} />
                <Text style={styles.emailButtonText}>{t('signUp')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.dark.background,
  },
  gradient: {
    flex: 1,
  },
  ambient: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  ambientTop: {
    top: -180,
    left: -140,
  },
  ambientBottom: {
    bottom: -220,
    right: -160,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: displayFont,
  },
  subtitle: {
    fontSize: 15,
    color: C.dark.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  actions: {
    gap: 20,
  },
  emailRow: {
    flexDirection: 'row',
    gap: 12,
  },
  emailButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.dark.card,
    borderWidth: 1,
    borderColor: C.dark.border,
    borderRadius: 14,
    paddingVertical: 15,
  },
  emailButtonText: {
    color: C.dark.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
