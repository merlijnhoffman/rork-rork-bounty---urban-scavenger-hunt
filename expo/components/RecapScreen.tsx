import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Trophy, Target, Users, Lightbulb, Navigation, Share as ShareIcon, X } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface RecapScreenProps {
  visible: boolean;
  onClose: () => void;
  winnerEmail: string | null;
  isWinner: boolean;
  closestDistance: number | null;
  cluesSolved: number;
  connectionsMade: number;
  hintTokensLeft: number;
  cityName: string;
}

export default function RecapScreen({
  visible,
  onClose,
  winnerEmail,
  isWinner,
  closestDistance,
  cluesSolved,
  connectionsMade,
  hintTokensLeft,
  cityName,
}: RecapScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const crownAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(crownAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.bounce,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      crownAnim.setValue(0);
    }
  }, [visible, fadeAnim, scaleAnim, crownAnim]);

  const handleShare = async () => {
    const message = isWinner
      ? `I found the bounty in ${cityName} and WON the hunt! 🏆 Can you catch me next time?`
      : `The ${cityName} bounty hunt just ended! ${winnerEmail ? winnerEmail + ' found the bounty' : 'Someone found the bounty'} — I got ${closestDistance !== null ? closestDistance + 'm' : 'close'} away. Next time it's mine! 🎯`;

    try {
      await Share.share({ message });
    } catch (e) {
      // User cancelled or share failed
    }
  };

  const stats = [
    {
      icon: Navigation,
      label: 'Closest Distance',
      value: closestDistance !== null ? `${closestDistance}m` : '—',
      color: Colors.accent.primary,
    },
    {
      icon: Target,
      label: 'Clues Solved',
      value: String(cluesSolved),
      color: Colors.accent.teal,
    },
    {
      icon: Users,
      label: 'Connections',
      value: String(connectionsMade),
      color: Colors.accent.primaryLight,
    },
    {
      icon: Lightbulb,
      label: 'Hints Left',
      value: String(hintTokensLeft),
      color: Colors.status.warning,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={[Colors.gradient.backgroundStart, Colors.gradient.backgroundEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradient}
          >
            {/* Close button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
              <X color={Colors.dark.textMuted} size={20} />
            </TouchableOpacity>

            {/* Crown / Trophy animation */}
            <Animated.View
              style={[
                styles.crownContainer,
                {
                  transform: [
                    {
                      scale: crownAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {isWinner ? (
                <Crown color={Colors.accent.primary} size={56} />
              ) : (
                <Trophy color={Colors.accent.primary} size={48} />
              )}
            </Animated.View>

            {/* Title */}
            <Text style={styles.title}>
              {isWinner ? 'YOU FOUND THE BOUNTY!' : 'HUNT COMPLETE'}
            </Text>

            {/* Winner reveal */}
            <Text style={styles.subtitle}>
              {isWinner
                ? 'Congratulations, hunter!'
                : winnerEmail
                  ? `${winnerEmail} found the bounty`
                  : 'A hunter found the bounty'}
            </Text>

            <Text style={styles.cityText}>{cityName.toUpperCase()}</Text>

            {/* Stats grid */}
            <View style={styles.statsGrid}>
              {stats.map((stat, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.statCard,
                    idx % 2 === 0 ? { marginRight: 8 } : null,
                    idx < stats.length - 2 ? { marginBottom: 8 } : null,
                  ]}
                >
                  <stat.icon color={stat.color} size={20} />
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Share button */}
            <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.8}>
              <ShareIcon color="#000" size={18} />
              <Text style={styles.shareButtonText}>Share Your Result</Text>
            </TouchableOpacity>

            {/* Play again */}
            <TouchableOpacity style={styles.playAgainButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.playAgainText}>Back to Hunt</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    width: '100%' as any,
    maxWidth: 380,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  gradient: {
    padding: 28,
    alignItems: 'center' as const,
    position: 'relative' as const,
  },
  closeButton: {
    position: 'absolute' as const,
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.card,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 10,
  },
  crownContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: Colors.accent.primary,
    textAlign: 'center' as const,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 4,
  },
  cityText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.dark.textMuted,
    letterSpacing: 2,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center' as const,
    width: '47%' as any,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: Colors.dark.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  shareButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.accent.primary,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    width: '100%' as any,
    marginBottom: 12,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
    letterSpacing: 0.5,
  },
  playAgainButton: {
    alignItems: 'center' as const,
    paddingVertical: 12,
  },
  playAgainText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
  },
});
