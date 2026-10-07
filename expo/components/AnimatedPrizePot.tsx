import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop, Circle } from 'react-native-svg';
import Colors from '@/constants/colors';

/**
 * The prize pot artwork bundled with the app, so it renders instantly —
 * no network fetch, no cache lookups, no loading gap.
 */
const PRIZE_POT_SOURCE = require('../assets/images/prize-pot.png');

interface AnimatedPrizePotProps {
  size?: number;
  animated?: boolean;
}

const SPARKLE_PATH =
  'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z';

/**
 * Animated prize pot icon — the minimal flat-2D euro-coin pot floating over a
 * soft amber glow, with two subtle accent sparkles. Every moving part uses the
 * native driver (transform/opacity only) so it stays smooth even inside the
 * busy celebration screen.
 */
export default function AnimatedPrizePot({
  size = 220,
  animated = true,
}: AnimatedPrizePotProps) {
  const glow = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const sparkleA = useRef(new Animated.Value(0)).current;
  const sparkleB = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  // Soft entrance: fade the whole composition in on mount
  useEffect(() => {
    const anim = Animated.timing(fadeIn, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [fadeIn]);

  useEffect(() => {
    if (!animated) return;
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const sparkleLoop = (
      v: Animated.Value,
      dur: number,
      delay: number,
    ): Animated.CompositeAnimation =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );

    glowLoop.start();
    bobLoop.start();
    breatheLoop.start();
    const sA = sparkleLoop(sparkleA, 1200, 300);
    const sB = sparkleLoop(sparkleB, 1000, 1100);
    sA.start();
    sB.start();
    return () => {
      glowLoop.stop();
      bobLoop.stop();
      breatheLoop.stop();
      sA.stop();
      sB.stop();
    };
  }, [animated, glow, bob, breathe, sparkleA, sparkleB]);

  const glowOpacity = useMemo(
    () => glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
    [glow],
  );
  const glowScale = useMemo(
    () => breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
    [breathe],
  );
  const translateY = useMemo(
    () => bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.03] }),
    [bob, size],
  );
  const imageScale = useMemo(
    () => breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }),
    [breathe],
  );
  const sparkleOpacityA = useMemo(
    () => sparkleA.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
    [sparkleA],
  );
  const sparkleOpacityB = useMemo(
    () => sparkleB.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.85] }),
    [sparkleB],
  );
  const sparkleScaleA = useMemo(
    () => sparkleA.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
    [sparkleA],
  );
  const sparkleScaleB = useMemo(
    () => sparkleB.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] }),
    [sparkleB],
  );

  return (
    <Animated.View style={[styles.container, { width: size, height: size, opacity: fadeIn }]}>
      {/* Pulsing ambient glow */}
      <Animated.View
        style={[styles.layer, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
      >
        <Svg width={size} height={size} viewBox="0 0 240 240">
          <Defs>
            <RadialGradient id="appGlow" cx="120" cy="122" r="112" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#F59E0B" stopOpacity="0.28" />
              <Stop offset="0.55" stopColor="#F59E0B" stopOpacity="0.1" />
              <Stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={120} cy={122} r={112} fill="url(#appGlow)" />
        </Svg>
      </Animated.View>

      {/* The prize pot itself — gentle float + breathe */}
      <Animated.View
        style={[styles.layer, { transform: [{ translateY }, { scale: imageScale }] }]}
      >
        <Image
          source={PRIZE_POT_SOURCE}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Twinkling sparkles */}
      <Animated.View
        style={[
          styles.sparkle,
          { top: size * 0.12, right: size * 0.16, opacity: sparkleOpacityA, transform: [{ scale: sparkleScaleA }] },
        ]}
        pointerEvents="none"
      >
        <Svg width={size * 0.12} height={size * 0.12} viewBox="0 0 24 24">
          <Path d={SPARKLE_PATH} fill={Colors.accent.primaryLight} />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          styles.sparkle,
          { top: size * 0.3, left: size * 0.1, opacity: sparkleOpacityB, transform: [{ scale: sparkleScaleB }] },
        ]}
        pointerEvents="none"
      >
        <Svg width={size * 0.09} height={size * 0.09} viewBox="0 0 24 24">
          <Path d={SPARKLE_PATH} fill={Colors.accent.primary} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
  },
});
