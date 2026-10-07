import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop, Circle } from 'react-native-svg';
import Colors from '@/constants/colors';

/**
 * The AI-generated prize pot artwork (transparent PNG hosted on R2).
 * Reference by URL exactly as returned by the generation tool.
 */
export const PRIZE_POT_ICON_URL = 'https://92dokpnm94nubmxh14any.rork.app/~assets/img/9de9cb31-4a58-4dc5-9d7f-dd3a422e8735.png';

interface AnimatedPrizePotProps {
  size?: number;
  animated?: boolean;
}

const SPARKLE_PATH =
  'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z';

/**
 * Animated prize pot icon — the generated glossy euro-coin pot floating over
 * a pulsing amber glow, with two twinkling sparkles. Every moving part uses
 * the native driver (transform/opacity only) so it stays smooth even inside
 * the busy celebration screen.
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
    () => sparkleA.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] }),
    [sparkleA],
  );
  const sparkleOpacityB = useMemo(
    () => sparkleB.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.9] }),
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
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Pulsing ambient glow */}
      <Animated.View
        style={[styles.layer, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
      >
        <Svg width={size} height={size} viewBox="0 0 240 240">
          <Defs>
            <RadialGradient id="appGlow" cx="120" cy="122" r="112" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFD54A" stopOpacity="0.55" />
              <Stop offset="0.55" stopColor="#FF8C00" stopOpacity="0.16" />
              <Stop offset="1" stopColor="#FF8C00" stopOpacity="0" />
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
          source={{ uri: PRIZE_POT_ICON_URL }}
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
        <Svg width={size * 0.09} height={size * 0.09} viewBox="0 0 24 24">
          <Path d={SPARKLE_PATH} fill="#FFF3C4" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          styles.sparkle,
          { top: size * 0.3, left: size * 0.1, opacity: sparkleOpacityB, transform: [{ scale: sparkleScaleB }] },
        ]}
        pointerEvents="none"
      >
        <Svg width={size * 0.07} height={size * 0.07} viewBox="0 0 24 24">
          <Path d={SPARKLE_PATH} fill={Colors.accent.primaryLight ?? '#FFC04D'} />
        </Svg>
      </Animated.View>
    </View>
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
