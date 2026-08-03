import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Easing } from 'react-native';
import { Radar } from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { NearbyHunter } from '@/hooks/useHunterRadar';

interface HunterRadarProps {
  nearbyCount: number;
  nearbyHunters: NearbyHunter[];
}

const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export default function HunterRadar({ nearbyCount, nearbyHunters }: HunterRadarProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    rotate.start();

    return () => {
      pulse.stop();
      rotate.stop();
    };
  }, [pulseAnim, rotateAnim]);

  const radarSize = 160;
  const maxRadius = radarSize / 2 - 8;

  // Place hunter dots on the radar based on bearing + distance
  const hunterDots = nearbyHunters.slice(0, 12).map((hunter, idx) => {
    const angleRad = (hunter.bearing * Math.PI) / 180;
    // Scale distance: closer hunters are closer to center
    const distRatio = Math.min(hunter.distance / 500, 1);
    const r = distRatio * maxRadius * 0.85;
    const x = radarSize / 2 + r * Math.sin(angleRad);
    const y = radarSize / 2 - r * Math.cos(angleRad);
    return { x, y, idx, distance: hunter.distance, bearing: hunter.bearing };
  });

  // Determine dominant direction for label
  const dominantDirection = (() => {
    if (nearbyHunters.length === 0) return null;
    const sectors: number[] = new Array(8).fill(0);
    for (const h of nearbyHunters) {
      const sector = Math.round(h.bearing / 45) % 8;
      sectors[sector]++;
    }
    const maxSector = sectors.indexOf(Math.max(...sectors));
    return COMPASS_LABELS[maxSector];
  })();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Radar color={Colors.accent.teal} size={16} />
        <Text style={styles.headerText}>HUNTER RADAR</Text>
        <View style={styles.liveDot} />
      </View>

      <View style={styles.radarWrapper}>
        {/* Radar circle */}
        <View style={[styles.radarCircle, { width: radarSize, height: radarSize }]}>
          {/* Pulsing rings */}
          <Animated.View
            style={[
              styles.radarRing,
              {
                width: radarSize,
                height: radarSize,
                opacity: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 0],
                }),
                transform: [
                  {
                    scale: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.radarRing,
              {
                width: radarSize * 0.66,
                height: radarSize * 0.66,
                opacity: pulseAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.5, 0],
                }),
                transform: [
                  {
                    scale: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
          />

          {/* Static rings */}
          <View style={[styles.staticRing, { width: radarSize * 0.66, height: radarSize * 0.66 }]} />
          <View style={[styles.staticRing, { width: radarSize * 0.33, height: radarSize * 0.33 }]} />

          {/* Crosshair lines */}
          <View style={styles.crosshairV} />
          <View style={styles.crosshairH} />

          {/* Center dot (player) */}
          <View style={styles.playerDot} />

          {/* Rotating sweep line */}
          <Animated.View
            style={[
              styles.sweepLine,
              {
                transform: [
                  {
                    rotate: rotateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}
          />

          {/* Hunter dots */}
          {hunterDots.map((dot) => (
            <View
              key={dot.idx}
              style={[
                styles.hunterDot,
                {
                  left: dot.x - 5,
                  top: dot.y - 5,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.countText}>
          {nearbyCount === 0
            ? 'No hunters nearby'
            : nearbyCount === 1
              ? '1 hunter nearby'
              : `${nearbyCount} hunters nearby`}
        </Text>
        {dominantDirection && nearbyCount > 0 && (
          <View style={styles.directionBadge}>
            <Text style={styles.directionText}>{dominantDirection}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 14,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: Colors.dark.text,
    letterSpacing: 2,
    flex: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.teal,
  },
  radarWrapper: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radarCircle: {
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: 'rgba(20, 184, 166, 0.25)',
    backgroundColor: 'rgba(20, 184, 166, 0.04)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden',
  },
  radarRing: {
    position: 'absolute' as const,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.3)',
  },
  staticRing: {
    position: 'absolute' as const,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: 'rgba(20, 184, 166, 0.15)',
  },
  crosshairV: {
    position: 'absolute' as const,
    width: 1,
    height: '100%' as any,
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
  },
  crosshairH: {
    position: 'absolute' as const,
    width: '100%' as any,
    height: 1,
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
  },
  sweepLine: {
    position: 'absolute' as const,
    width: '50%' as any,
    height: 1.5,
    left: '50%' as any,
    top: '50%' as any,
    backgroundColor: 'rgba(20, 184, 166, 0.4)',
    transformOrigin: 'left center',
  },
  playerDot: {
    position: 'absolute' as const,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent.primary,
    borderWidth: 2,
    borderColor: Colors.dark.background,
    zIndex: 10,
  },
  hunterDot: {
    position: 'absolute' as const,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent.teal,
    borderWidth: 1.5,
    borderColor: Colors.dark.background,
    zIndex: 5,
  },
  infoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginTop: 14,
  },
  countText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  directionBadge: {
    backgroundColor: Colors.accent.tealMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  directionText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: Colors.accent.teal,
    letterSpacing: 1,
  },
});
