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

interface PrizePoolGraphicProps {
  size?: number;
  animated?: boolean;
}

const LONG_RAY = 'M120 8 L127 68 L113 68 Z';
const SHORT_RAY = 'M120 40 L125.5 86 L114.5 86 Z';

/**
 * Custom animated "prize pot" artwork — a cauldron overflowing with gold
 * euro coins under a rotating sunburst. Every moving part is a React Native
 * Animated view (native driver) wrapping a static SVG layer, so the rotation
 * stays perfectly centered and never drifts or fades out of frame on device.
 */
export default function PrizePoolGraphic({ size = 220, animated = true }: PrizePoolGraphicProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  const bob1 = useRef(new Animated.Value(0)).current;
  const bob2 = useRef(new Animated.Value(0)).current;
  const bob3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const spinLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true }),
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const twinkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
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
    twinkleLoop.start();
    const b1 = makeBob(bob1, 1700, 0);
    const b2 = makeBob(bob2, 2100, 500);
    const b3 = makeBob(bob3, 1900, 900);
    b1.start();
    b2.start();
    b3.start();
    return () => {
      spinLoop.stop();
      glowLoop.stop();
      twinkleLoop.stop();
      b1.stop();
      b2.stop();
      b3.stop();
    };
  }, [animated, spin, glow, twinkle, bob1, bob2, bob3]);

  const rotation = useMemo(
    () => spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
    [spin],
  );
  const glowOpacity = useMemo(
    () => glow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
    [glow],
  );
  const twinkleA = useMemo(
    () => twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.95] }),
    [twinkle],
  );
  const twinkleB = useMemo(
    () => twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.1] }),
    [twinkle],
  );
  const bob = (v: Animated.Value, dist: number) =>
    v.interpolate({ inputRange: [0, 1], outputRange: [0, -dist] });

  const rays = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 30), []);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Pulsing ambient glow (static layer, native opacity) */}
      <Animated.View style={[styles.layer, { opacity: glowOpacity }]}>
        <Svg width={size} height={size} viewBox="0 0 240 240">
          <Defs>
            <RadialGradient id="ppGlow" cx="120" cy="116" rx="112" ry="112" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFD54A" stopOpacity="0.5" />
              <Stop offset="0.55" stopColor="#FFB300" stopOpacity="0.13" />
              <Stop offset="1" stopColor="#FFB300" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={120} cy={116} r={112} fill="url(#ppGlow)" />
        </Svg>
      </Animated.View>

      {/* Rotating sunburst — long and short rays with fading tips */}
      <Animated.View style={[styles.layer, { transform: [{ rotate: rotation }] }]}>
        <Svg width={size} height={size} viewBox="0 0 240 240">
          <Defs>
            <LinearGradient id="ppRay" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFD54A" stopOpacity="0" />
              <Stop offset="0.55" stopColor="#FFD54A" stopOpacity="0.2" />
              <Stop offset="1" stopColor="#FFC107" stopOpacity="0.5" />
            </LinearGradient>
          </Defs>
          {rays.map((angle) => (
            <Path
              key={angle}
              d={angle % 60 === 0 ? LONG_RAY : SHORT_RAY}
              fill="url(#ppRay)"
              transform={`rotate(${angle} 120 120)`}
            />
          ))}
        </Svg>
      </Animated.View>

      {/* Twinkling sparkles */}
      <Animated.View style={{ position: 'absolute', left: size * 0.2, top: size * 0.05, opacity: twinkleA, pointerEvents: 'box-none' }}>
        <Sparkle size={size * 0.06} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', left: size * 0.87, top: size * 0.3, opacity: twinkleB, pointerEvents: 'box-none' }}>
        <Sparkle size={size * 0.045} />
      </Animated.View>

      {/* Floating coins around the pot */}
      <FloatingCoin value={bob(bob1, 9)} size={size * 0.095} x={size * 0.1} y={size * 0.3} />
      <FloatingCoin value={bob(bob2, 12)} size={size * 0.08} x={size * 0.82} y={size * 0.22} />
      <FloatingCoin value={bob(bob3, 8)} size={size * 0.07} x={size * 0.86} y={size * 0.52} />

      {/* Static artwork: pot, coins, rim, badge */}
      <Svg width={size} height={size} viewBox="0 0 240 240" style={styles.layer}>
        <Defs>
          <LinearGradient id="rimGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFE082" />
            <Stop offset="0.5" stopColor="#FFC107" />
            <Stop offset="1" stopColor="#C9931B" />
          </LinearGradient>
          <LinearGradient id="potGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2B2B35" />
            <Stop offset="0.6" stopColor="#14141A" />
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

        {/* Ground shadow + cyan under-glow accent */}
        <Ellipse cx={120} cy={198} rx={58} ry={9} fill="#000000" opacity={0.4} />
        <Ellipse cx={120} cy={194} rx={44} ry={6} fill="#00D4FF" opacity={0.12} />

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
        {/* Soft white sheen on the upper-left of the pot */}
        <Path
          d="M72 106 C72 124 80 142 96 152"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0.07}
        />
        {/* Cyan rim-light on the pot shoulder */}
        <Path
          d="M64 108 C70 138 92 156 120 158"
          fill="none"
          stroke="#00D4FF"
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.55}
        />
        {/* Gold drips running over the rim */}
        <Path d="M98 98 C98 105 95 110 95 114 C95 117.5 101 117.5 101 114 C101 110 98 105 98 98 Z" fill="url(#rimGrad)" opacity={0.9} />
        <Path d="M122 98 C122 108 119 114 119 119 C119 123 125 123 125 119 C125 114 122 108 122 98 Z" fill="url(#rimGrad)" opacity={0.9} />
        <Path d="M144 98 C144 103 142 107 142 110 C142 113 147 113 147 110 C147 107 145 103 144 98 Z" fill="url(#rimGrad)" opacity={0.9} />
        {/* Handles */}
        <Path d="M60 106 C42 108 38 126 52 136" fill="none" stroke="url(#rimGrad)" strokeWidth={7} strokeLinecap="round" />
        <Path d="M180 106 C198 108 202 126 188 136" fill="none" stroke="url(#rimGrad)" strokeWidth={7} strokeLinecap="round" />
        {/* Legs */}
        <Path d="M92 168 L86 186 L98 184 Z" fill="#131318" stroke="#33333D" strokeWidth={1.5} />
        <Path d="M148 168 L154 186 L142 184 Z" fill="#131318" stroke="#33333D" strokeWidth={1.5} />
        <Path d="M118 172 L118 190 L126 188 Z" fill="#131318" stroke="#33333D" strokeWidth={1.5} />
        {/* Rim with top shine */}
        <Ellipse cx={120} cy={92} rx={58} ry={12} fill="url(#rimGrad)" />
        <Ellipse cx={120} cy={92} rx={46} ry={7} fill="#4A3600" />
        <Ellipse cx={120} cy={88.5} rx={38} ry={4} fill="#FFE082" opacity={0.55} />
        {/* Coin leaning against the rim */}
        <Circle cx={172} cy={86} r={9} fill="url(#coinGrad)" stroke="#8A6400" strokeWidth={1.2} />
        {/* Euro badge on the pot front */}
        <Circle cx={120} cy={136} r={24} fill="#101016" stroke="#FFC107" strokeWidth={2.5} />
        <Circle cx={120} cy={136} r={19.5} fill="none" stroke="#5C4300" strokeWidth={1} />
        <SvgText x={120} y={145} fontSize={27} fontWeight="bold" fill="#FFD54A" textAnchor="middle">
          {'\u20AC'}
        </SvgText>
      </Svg>
    </View>
  );
}

/** Small four-point star that twinkles. */
function Sparkle({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-8 -8 16 16">
      <Path d="M0 -7 L1.7 -1.7 L7 0 L1.7 1.7 L0 7 L-1.7 1.7 L-7 0 L-1.7 -1.7 Z" fill="#FFE082" />
    </Svg>
  );
}

/** Small RN-view euro coin that gently floats. */
function FloatingCoin({ value, size, x, y }: { value: Animated.AnimatedInterpolation<number>; size: number; x: number; y: number }) {
  return (
    <Animated.View
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
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'box-none' as const,
  },
  floatingCoin: {
    position: 'absolute',
    pointerEvents: 'none' as const,
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
