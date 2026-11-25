import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  FadeInDown,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { Crosshair, MapPin, Radar, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/contexts/LanguageContext';
import Colors from '@/constants/colors';
import { ONBOARDING_SEEN_KEY } from '@/constants/keys';

const C = Colors;
const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_COUNT = 5;

/* ---------- looping visual building blocks (all flat 2D, amber-on-dark) ---------- */

function PulseRing({ delay = 0, size = 240 }: { delay?: number; size?: number }) {
  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.55, 1.35]) }],
    opacity: interpolate(progress.value, [0, 1], [0.9, 0]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

function ReticleArt() {
  const spin = useSharedValue(0);
  React.useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [spin]);
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  return (
    <View style={styles.artStage}>
      <PulseRing />
      <PulseRing delay={1100} />
      <Animated.View style={[styles.ringStatic, spinStyle]}>
        <View style={styles.ringTick} />
        <View style={[styles.ringTick, styles.ringTickOpposite]} />
      </Animated.View>
      <View style={styles.ringStatic}>
        <Crosshair color={C.accent.primary} size={96} strokeWidth={1.5} />
      </View>
    </View>
  );
}

function ClueCard({ label, index, clock }: { label: string; index: number; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(
      clock.value,
      [index * 0.22, index * 0.22 + 0.18, 0.92, 1],
      [0.15, 1, 1, 0.15],
      Extrapolation.CLAMP,
    ),
    transform: [
      { translateX: interpolate(clock.value, [0, 1], [-14, 0]) * (1 - index * 0.35) },
    ],
  }));
  return (
    <Animated.View style={[styles.clueCard, style]}>
      <MapPin color={C.accent.primary} size={16} />
      <View style={styles.clueTextWrap}>
        <Text style={styles.clueCardLabel}>{label}</Text>
        <View style={styles.clueTextBar} />
      </View>
    </Animated.View>
  );
}

function ClueDropArt() {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [clock]);

  return (
    <View style={[styles.artStage, styles.artStageWide]}>
      <ClueCard label="CLUE 01" index={0} clock={clock} />
      <ClueCard label="CLUE 02" index={1} clock={clock} />
      <ClueCard label="CLUE 03" index={2} clock={clock} />
    </View>
  );
}

function PrizePotArt() {
  const glow = useSharedValue(0);
  React.useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.35, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.12, 0.3]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.9, 1.1]) }],
  }));

  return (
    <View style={styles.artStage}>
      <Animated.View style={[styles.glowDisc, glowStyle]} />
      <Animated.Image
        source={require('@/assets/images/prize-pot.png')}
        style={[styles.prizePot, glowStyle]}
        resizeMode="contain"
      />
    </View>
  );
}

function RadarArt() {
  const sweep = useSharedValue(0);
  React.useEffect(() => {
    sweep.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [sweep]);
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sweep.value}deg` }],
  }));

  return (
    <View style={styles.artStage}>
      <View style={[styles.radarCircle, styles.radarOuter]} />
      <View style={[styles.radarCircle, styles.radarMiddle]} />
      <View style={[styles.radarCircle, styles.radarInner]} />
      <Animated.View style={[styles.radarSweepWrap, sweepStyle]}>
        <View style={styles.radarSweep} />
      </Animated.View>
      <View style={[styles.radarBlip, styles.blip1]} />
      <View style={[styles.radarBlip, styles.blip2]} />
      <Radar color={C.accent.primary} size={28} style={styles.radarIcon} />
    </View>
  );
}

function IdentityArt() {
  return (
    <View style={styles.artStage}>
      <PulseRing size={200} />
      <View style={styles.identityBadge}>
        <Users color={C.accent.primary} size={44} strokeWidth={1.5} />
      </View>
    </View>
  );
}

/* ---------- pages ---------- */

const PAGES = [
  { kicker: 'ob1Kicker', title: 'ob1Title', body: 'ob1Body', Art: ReticleArt },
  { kicker: 'ob2Kicker', title: 'ob2Title', body: 'ob2Body', Art: ClueDropArt },
  { kicker: 'ob3Kicker', title: 'ob3Title', body: 'ob3Body', Art: PrizePotArt },
  { kicker: 'ob4Kicker', title: 'ob4Title', body: 'ob4Body', Art: RadarArt },
  { kicker: 'ob5Kicker', title: 'ob5Title', body: 'ob5Body', Art: IdentityArt },
] as const;

/* ---------- screen ---------- */

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [page, setPage] = useState(0);

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true').catch(() => {});
    router.replace('/auth' as any);
  }, [router]);

  const handleNext = useCallback(() => {
    if (page >= PAGE_COUNT - 1) {
      finish();
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    listRef.current?.scrollToIndex({ index: page + 1, animated: true });
  }, [page, finish]);

  return (
    <View style={styles.container}>
      {/* ambient corner glows */}
      <View style={[styles.ambient, styles.ambientTop]} pointerEvents="none" />
      <View style={[styles.ambient, styles.ambientBottom]} pointerEvents="none" />

      <TouchableOpacity
        style={[styles.skipButton, { top: insets.top + 12 }]}
        onPress={finish}
        activeOpacity={0.7}
        testID="onboarding-skip"
      >
        <Text style={styles.skipText}>{t('obSkip')}</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          if (next !== page) {
            Haptics.selectionAsync().catch(() => {});
            setPage(next);
          }
        }}
        renderItem={({ item }) => {
          const { Art } = item;
          return (
            <View style={[styles.page, { width: SCREEN_W }]}>
              <View style={styles.artWrap}>
                <Art />
              </View>
              <Animated.View
                entering={FadeInDown.delay(120).duration(600).easing(Easing.out(Easing.quad))}
                style={styles.copy}
              >
                <Text style={styles.kicker}>{t(item.kicker)}</Text>
                <Text style={styles.title}>{t(item.title)}</Text>
                <Text style={styles.body}>{t(item.body)}</Text>
              </Animated.View>
            </View>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.cta, page === PAGE_COUNT - 1 && styles.ctaFinal]}
          onPress={handleNext}
          activeOpacity={0.85}
          testID="onboarding-next"
        >
          <Text style={styles.ctaText}>
            {page === PAGE_COUNT - 1 ? t('obClaimSpot') : t('obNext')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.dark.background,
  },
  ambient: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    pointerEvents: 'none',
  },
  ambientTop: {
    top: -180,
    right: -140,
  },
  ambientBottom: {
    bottom: -220,
    left: -160,
  },
  skipButton: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: C.dark.card,
  },
  skipText: {
    color: C.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  artWrap: {
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  artStage: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artStageWide: {
    width: 280,
    height: 300,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 14,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: C.accent.primary,
  },
  ringStatic: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTick: {
    position: 'absolute',
    top: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent.primary,
  },
  ringTickOpposite: {
    top: undefined,
    bottom: -4,
  },
  clueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.dark.card,
    borderWidth: 1,
    borderColor: C.dark.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  clueTextWrap: {
    flex: 1,
    gap: 6,
  },
  clueCardLabel: {
    color: C.accent.primary,
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 2,
  },
  clueTextBar: {
    width: '70%',
    height: 6,
    borderRadius: 3,
    backgroundColor: C.dark.borderLight,
  },
  glowDisc: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: C.accent.primary,
  },
  prizePot: {
    width: 220,
    height: 220,
  },
  radarCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  radarOuter: {
    width: 280,
    height: 280,
  },
  radarMiddle: {
    width: 190,
    height: 190,
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  radarInner: {
    width: 100,
    height: 100,
    borderColor: 'rgba(245, 158, 11, 0.6)',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  radarSweepWrap: {
    position: 'absolute',
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  radarSweep: {
    width: 2,
    height: 140,
    backgroundColor: C.accent.primary,
    shadowColor: C.accent.primary,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  radarBlip: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.accent.primary,
  },
  blip1: {
    top: 80,
    right: 60,
  },
  blip2: {
    bottom: 78,
    left: 70,
  },
  radarIcon: {
    position: 'absolute',
    bottom: 108,
  },
  identityBadge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: C.accent.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: 10,
  },
  kicker: {
    color: C.accent.primary,
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 4,
  },
  title: {
    color: C.dark.text,
    fontSize: 30,
    fontWeight: '800' as const,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  body: {
    color: C.dark.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.dark.borderLight,
  },
  dotActive: {
    backgroundColor: C.accent.primary,
    width: 22,
  },
  cta: {
    backgroundColor: C.accent.primary,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
  },
  ctaFinal: {
    backgroundColor: C.accent.primary,
  },
  ctaText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
});
