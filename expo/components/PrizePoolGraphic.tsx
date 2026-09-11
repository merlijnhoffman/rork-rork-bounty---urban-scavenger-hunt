import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface PrizePoolGraphicProps {
  size?: number;
  animated?: boolean;
}

/**
 * Custom animated "prize pot" artwork — a cauldron overflowing with gold
 * euro coins under a rotating light burst. Represents where the prize money
 * lives. Pure SVG + Animated, no image assets required.
 */
export default function PrizePoolGraphic({ size = 220, animated = true }: PrizePoolGraphicProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const bob1 = useRef(new Animated.Value(0)).current;
  const bob2 = useRef(new Animated.Value(0)).current;
  const bob3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const spinLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 26000, easing: Easing.linear, useNativeDriver: false }),
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    const makeBob = (v: Animated.Value, dur: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
    spinLoop.start();
    glowLoop.start();
    const b1 = makeBob(bob1, 1700, 0);
    const b2 = makeBob(bob2, 2100, 500);
    const b3 = makeBob(bob3, 1900, 900);
    b1.start();
    b2.start();
    b3.start();
    return () => {
      spinLoop.stop();
      glowLoop.stop();
      b1.stop();
      b2.stop();
      b3.stop();
    };
  }, [animated, spin, glow, bob1, bob2, bob3]);

  const rotation = useMemo(
    () => spin.interpolate({ inputRange: [0, 1], outputRange: [0, 360] }),
    [spin],
  );
  const glowOpacity = useMemo(
    () => glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] }),
    [glow],
  );
  const bob = (v: Animated.Value, dist: number) =>
    v.interpolate({ inputRange: [0, 1], outputRange: [0, -dist] });

  const rays = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 30), []);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Floating coins around the pot */}
      <FloatingCoin value={bob(bob1, 9)} size={size * 0.095} x={size * 0.1} y={size * 0.3} />
      <FloatingCoin value={bob(bob2, 12)} size={size * 0.08} x={size * 0.82} y={size * 0.22} />
      <FloatingCoin value={bob(bob3, 8)} size={size * 0.07} x={size * 0.86} y={size * 0.52} />

      <Svg width={size} height={size} viewBox="0 0 240 240">
        <Defs>
          <RadialGradient id="glowGrad" cx="120" cy="110" rx="115" ry="115" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFD54A" stopOpacity="0.55" />
            <Stop offset="0.55" stopColor="#FFB300" stopOpacity="0.14" />
            <Stop offset="1" stopColor="#FFB300" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="rimGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFE082" />
            <Stop offset="0.5" stopColor="#FFC107" />
            <Stop offset="1" stopColor="#C9931B" />
          </LinearGradient>
          <LinearGradient id="potGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#26262E" />
            <Stop offset="0.6" stopColor="#131318" />
            <Stop offset="1" stopColor="#0A0A0E" />
          </LinearGradient>
          <LinearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFE082" />
            <Stop offset="1" stopColor="#E0A800" />
          </LinearGradient>
          <RadialGradient id="moundGrad" cx="120" cy="70" rx="58" ry="24" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFE082" />
            <Stop offset="1" stopColor="#D19A00" />
          </RadialGradient>
        </Defs>

        {/* Ambient gold glow */}
        <AnimatedCircle cx={120} cy={110} r={112} fill="url(#glowGrad)" opacity={glowOpacity} />

        {/* Rotating light rays */}
        <AnimatedG rotation={rotation} originX={120} originY={104}>
          {rays.map((angle) => (
            <Path
              key={angle}
              d="M120 14 L127 58 L113 58 Z"
              fill="#FFD54A"
              opacity={0.14}
              transform={`rotate(${angle} 120 104)`}
            />
          ))}
        </AnimatedG>

        {/* Cyan under-glow accent */}
        <Ellipse cx={120} cy={196} rx={62} ry={12} fill="#00D4FF" opacity={0.1} />

        {/* Coin mound overflowing the pot */}
        <Ellipse cx={120} cy={78} rx={54} ry={18} fill="url(#moundGrad)" />
        {[
          { x: 92, y: 70, r: 11 },
          { x: 118, y: 62, r: 12 },
          { x: 146, y: 70, r: 11 },
          { x: 105, y: 60, r: 9 },
          { x: 133, y: 58, r: 9 },
          { x: 120, y: 78, r: 10 },
        ].map((c, i) => (
          <G key={i}>
            <Circle cx={c.x} cy={c.y} r={c.r} fill="url(#coinGrad)" stroke="#8A6400" strokeWidth={1.5} />
            <SvgText
              x={c.x}
              y={c.y + c.r * 0.38}
              fontSize={c.r * 1.15}
              fontWeight="bold"
              fill="#7A5B00"
              textAnchor="middle"
            >
              {'\u20AC'}
            </SvgText>
          </G>
        ))}

        {/* Pot body */}
        <Path
          d="M76 92 C64 94 60 104 60 114 C60 148 88 170 120 170 C152 170 180 148 180 114 C180 104 176 94 164 92 Z"
          fill="url(#potGrad)"
          stroke="#33333D"
          strokeWidth={2}
        />
        {/* Cyan rim-light on the pot shoulders */}
        <Path
          d="M64 108 C70 138 92 156 120 158"
          fill="none"
          stroke="#00D4FF"
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.55}
        />
        {/* Handles */}
        <Path d="M60 106 C42 108 38 126 52 136" fill="none" stroke="url(#rimGrad)" strokeWidth={7} strokeLinecap="round" />
        <Path d="M180 106 C198 108 202 126 188 136" fill="none" stroke="url(#rimGrad)" strokeWidth={7} strokeLinecap="round" />
        {/* Legs */}
        <Path d="M92 168 L86 186 L98 184 Z" fill="#131318" stroke="#33333D" strokeWidth={1.5} />
        <Path d="M148 168 L154 186 L142 184 Z" fill="#131318" stroke="#33333D" strokeWidth={1.5} />
        <Path d="M118 172 L118 190 L126 188 Z" fill="#131318" stroke="#33333D" strokeWidth={1.5} />
        {/* Rim */}
        <Ellipse cx={120} cy={92} rx={58} ry={12} fill="url(#rimGrad)" />
        <Ellipse cx={120} cy={92} rx={46} ry={7} fill="#5C4300" />
        {/* Euro emblem on the pot */}
        <SvgText x={120} y={142} fontSize={34} fontWeight="bold" fill="#FFD54A" textAnchor="middle">
          {'\u20AC'}
        </SvgText>
      </Svg>
    </View>
  );
}

/** Small RN-view euro coin that gently floats. */
function FloatingCoin({ value, size, x, y }: { value: Animated.AnimatedInterpolation<number>; size: number; x: number; y: number }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.floatingCoin,
        { width: size, height: size, left: x, top: y, transform: [{ translateY: value }] },
      ]}
    >
      <Text style={[styles.floatingCoinText, { fontSize: size * 0.62 }]}>{'\u20AC'}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCoin: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#FFC107',
    borderWidth: 1.5,
    borderColor: '#8A6400',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD54A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingCoinText: {
    color: '#7A5B00',
    fontWeight: '900',
  },
});
