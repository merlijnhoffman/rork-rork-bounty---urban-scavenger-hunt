import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Ticket } from 'lucide-react-native';
import PrizePoolGraphic from '@/components/PrizePoolGraphic';
import { useLanguage } from '@/contexts/LanguageContext';

interface PrizePoolCelebrationProps {
  visible: boolean;
  onClose: () => void;
  /** Pool value right before this ticket was added. */
  previousPrize: number;
  /** Pool value after this ticket was added. */
  newPrize: number;
  /** The amount this single ticket contributed. */
  addedAmount: number;
  playerCount: number;
}

const PARTICLE_COUNT = 14;

/** Formats a whole number as €1,240 style currency text. */
function formatEuro(value: number): string {
  return `\u20AC${Math.max(0, Math.round(value)).toLocaleString('en-US')}`;
}

/**
 * Full-screen celebration shown right after a ticket is purchased: the prize
 * pot counts up as the buyer's contribution flies into it, with a coin burst,
 * pulse rings, haptics and a chime. Visible to the buyer only.
 */
export default function PrizePoolCelebration({
  visible,
  onClose,
  previousPrize,
  newPrize,
  addedAmount,
  playerCount,
}: PrizePoolCelebrationProps) {
  const { t } = useLanguage();
  const countAnim = useRef(new Animated.Value(0)).current;
  const chipAnim = useRef(new Animated.Value(0)).current;
  const popAnim = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const burstAnim = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState<number>(previousPrize);
  const displayedRef = useRef<number>(previousPrize);

  // Deterministic "random" particle layout so the burst looks organic
  // but never re-randomizes between renders.
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (i % 3) * 0.35;
        const distance = 110 + ((i * 37) % 70);
        const size = 10 + (i % 3) * 4;
        return { angle, distance, size, delay: (i % 4) * 90 };
      }),
    [],
  );

  useEffect(() => {
    if (!visible) return;

    displayedRef.current = previousPrize;
    setDisplayed(previousPrize);
    countAnim.setValue(0);
    chipAnim.setValue(0);
    popAnim.setValue(0);

    const loops: Array<Animated.CompositeAnimation> = [];

    // Pool counts up from the old value to the new value.
    const countUp = Animated.timing(countAnim, {
      toValue: 1,
      duration: 1700,
      delay: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    countAnim.addListener(({ value }) => {
      const next = Math.round(previousPrize + (newPrize - previousPrize) * value);
      if (next !== displayedRef.current) {
        displayedRef.current = next;
        setDisplayed(next);
      }
    });

    // The "+€X" chip flies from the ticket into the pot.
    const chipFly = Animated.sequence([
      Animated.delay(600),
      Animated.timing(chipAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]);

    // Pot pop when the chip lands.
    const pop = Animated.sequence([
      Animated.delay(1350),
      Animated.timing(popAnim, { toValue: 1, duration: 320, easing: Easing.out(Easing.elastic(1.6)), useNativeDriver: true }),
    ]);

    loops.push(
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring1, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(ring1, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.delay(900),
          Animated.timing(ring2, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(ring2, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(burstAnim, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.delay(500),
          Animated.timing(burstAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );

    countUp.start();
    chipFly.start();
    pop.start();
    loops.forEach((l) => l.start());

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    let player: AudioPlayer | null = null;
    try {
      player = createAudioPlayer(require('../assets/notification_sound.wav'));
      player.play();
    } catch (err) {
      console.warn('[PrizePoolCelebration] Chime playback failed:', err);
    }

    return () => {
      countUp.stop();
      chipFly.stop();
      pop.stop();
      loops.forEach((l) => l.stop());
      try {
        player?.release();
      } catch {}
    };
  }, [visible, previousPrize, newPrize, countAnim, chipAnim, popAnim, ring1, ring2, burstAnim]);

  if (!visible) return null;

  const ringScale = (v: Animated.Value) =>
    v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.9] });
  const ringOpacity = (v: Animated.Value) =>
    v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.5, 0.35, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Coin burst */}
        <View style={styles.burstLayer} pointerEvents="none">
          {particles.map((p, i) => (
            <Animated.View
              key={i}
              style={[
                styles.particle,
                {
                  width: p.size,
                  height: p.size,
                  transform: [
                    {
                      translateX: Animated.multiply(burstAnim, Math.cos(p.angle) * p.distance),
                    },
                    {
                      translateY: Animated.multiply(burstAnim, Math.sin(p.angle) * p.distance * 0.8),
                    },
                    { scale: burstAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 1, 0.5] }) },
                  ],
                  opacity: burstAnim.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 0] }),
                },
              ]}
            >
              <Text style={[styles.particleText, { fontSize: p.size * 0.62 }]}>{'\u20AC'}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={styles.card}>
          {/* Pulse rings behind the pot */}
          <View style={styles.ringsLayer} pointerEvents="none">
            <Animated.View
              style={[
                styles.ring,
                { transform: [{ scale: ringScale(ring1) }], opacity: ringOpacity(ring1) },
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                { transform: [{ scale: ringScale(ring2) }], opacity: ringOpacity(ring2) },
              ]}
            />
          </View>

          <Animated.View
            style={{
              transform: [
                {
                  scale: popAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
                },
              ],
            }}
          >
            <PrizePoolGraphic size={210} />
          </Animated.View>

          <Text style={styles.liveLabel}>{t('prizePoolLive')}</Text>

          <View style={styles.amountRow}>
            <Text style={styles.amount}>{formatEuro(displayed)}</Text>
          </View>

          {/* The buyer's contribution flying into the pot */}
          <View style={styles.chipRow}>
            <Animated.View
              style={[
                styles.chip,
                {
                  opacity: chipAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
                  transform: [
                    { translateY: chipAnim.interpolate({ inputRange: [0, 1], outputRange: [74, 0] }) },
                    { scale: chipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                  ],
                },
              ]}
            >
              <Ticket color="#5C4300" size={16} />
              <Text style={styles.chipText}>{t('youAdded', { amount: formatEuro(addedAmount) })}</Text>
            </Animated.View>
          </View>

          <Text style={styles.huntersText}>{t('huntersJoined', { count: String(playerCount) })}</Text>
          <Text style={styles.growsText}>{t('poolGrowsSub')}</Text>

          <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{t('celebrateButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,4,8,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#FFC107',
    borderWidth: 1,
    borderColor: '#8A6400',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleText: {
    color: '#7A5B00',
    fontWeight: '900',
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  ringsLayer: {
    position: 'absolute',
    top: 105,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFD54A',
  },
  liveLabel: {
    color: '#FFD54A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 6,
  },
  amountRow: {
    marginTop: 8,
  },
  amount: {
    color: '#FFF',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(255,196,0,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  chipRow: {
    height: 52,
    marginTop: 10,
    justifyContent: 'flex-start',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFD54A',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
  chipText: {
    color: '#5C4300',
    fontSize: 15,
    fontWeight: '900',
  },
  huntersText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  growsText: {
    color: '#8E8E98',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  button: {
    marginTop: 28,
    backgroundColor: '#FFD54A',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
  },
  buttonText: {
    color: '#1A1400',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
