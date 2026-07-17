import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  TextInput,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Crosshair,
  Radio,
  RadioTower,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Activity,
  CheckCircle2,
  AlertCircle,
  Zap,
  Shield,
} from 'lucide-react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useGameStore } from '@/store/game-store';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

const C = Colors;

const UPDATE_INTERVAL_MS = 8000;
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

type BroadcastState = 'idle' | 'starting' | 'live' | 'paused' | 'error';

export default function BountyModeScreen() {
  const insets = useSafeAreaInsets();
  const { currentEvent } = useGameStore();

  const [accessCode, setAccessCode] = useState<string>('');
  const [codeVisible, setCodeVisible] = useState<boolean>(false);
  const [broadcastState, setBroadcastState] = useState<BroadcastState>('idle');
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
  } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [updateCount, setUpdateCount] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const isBroadcastingRef = useRef<boolean>(false);
  const accessCodeRef = useRef<string>('');

  // Keep refs in sync
  useEffect(() => {
    accessCodeRef.current = accessCode;
  }, [accessCode]);

  // Pulse animation when live
  useEffect(() => {
    if (broadcastState === 'live') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(0.3);
    }
  }, [broadcastState, pulseAnim]);

  // Fetch the event's bounty_access_code (if admin pre-assigned it, show a hint)
  const codeQuery = useQuery({
    queryKey: ['bounty-access-code', currentEvent?.id],
    queryFn: async () => {
      if (!currentEvent) return null;
      const { data, error } = await supabase
        .from('events')
        .select('bounty_access_code, status')
        .eq('id', currentEvent.id)
        .maybeSingle();
      if (error) {
        console.error('[BountyMode] Error fetching access code:', error.message);
        return null;
      }
      return data as { bounty_access_code: string | null; status: string } | null;
    },
    enabled: !!currentEvent,
    staleTime: 30000,
  });

  // Check if there's an existing active broadcast
  const existingBroadcastQuery = useQuery({
    queryKey: ['existing-bounty-location', currentEvent?.id],
    queryFn: async () => {
      if (!currentEvent) return null;
      const { data, error } = await supabase
        .from('bounty_locations')
        .select('is_active, updated_at, latitude, longitude')
        .eq('event_id', currentEvent.id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!currentEvent,
    staleTime: 5000,
  });

  const sendLocationUpdate = useCallback(
    async (loc: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      heading: number | null;
      speed: number | null;
    }) => {
      const code = accessCodeRef.current;
      if (!code || !currentEvent) return;

      try {
        const endpoint = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/update-bounty-location`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessCode: code,
            eventId: currentEvent.id,
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            heading: loc.heading,
            speed: loc.speed,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          const msg = result.error || 'Failed to update location';
          if (msg.includes('Invalid access code')) {
            setErrorMsg('The access code you entered is incorrect for this event.');
            setBroadcastState('error');
            // Stop broadcasting
            isBroadcastingRef.current = false;
            if (watchSubRef.current) {
              await watchSubRef.current.remove();
              watchSubRef.current = null;
            }
          } else if (msg.includes('hunt has ended')) {
            setErrorMsg('This hunt has ended. Broadcasting is no longer available.');
            setBroadcastState('error');
            isBroadcastingRef.current = false;
            if (watchSubRef.current) {
              await watchSubRef.current.remove();
              watchSubRef.current = null;
            }
          } else {
            console.warn('[BountyMode] Update error:', msg);
          }
          return;
        }

        setLastUpdate(Date.now());
        setUpdateCount((prev) => prev + 1);
        setErrorMsg(null);
      } catch (err) {
        console.error('[BountyMode] Network error sending location:', err);
      }
    },
    [currentEvent],
  );

  const startBroadcast = useCallback(async () => {
    if (!accessCode.trim()) {
      Alert.alert('Access Code Required', 'Enter the access code provided by the hunt organizer.');
      return;
    }
    if (!currentEvent) {
      Alert.alert('No Event', 'There is no active event to broadcast for.');
      return;
    }

    setBroadcastState('starting');
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      // 1. Request location permission (always)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission is required to broadcast your position.');
        setBroadcastState('error');
        Alert.alert(
          'Location Needed',
          'Bounty Mode needs location access to broadcast your position to hunters.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      // 2. Get initial position
      const initialPos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locData = {
        latitude: initialPos.coords.latitude,
        longitude: initialPos.coords.longitude,
        accuracy: initialPos.coords.accuracy ?? null,
        heading: initialPos.coords.heading ?? null,
        speed: initialPos.coords.speed ?? null,
      };

      setCurrentLocation(locData);
      await sendLocationUpdate(locData);

      // 3. Start watching position
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: UPDATE_INTERVAL_MS,
          distanceInterval: 5,
        },
        (position) => {
          const newLoc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy ?? null,
            heading: position.coords.heading ?? null,
            speed: position.coords.speed ?? null,
          };
          setCurrentLocation(newLoc);
          if (isBroadcastingRef.current) {
            void sendLocationUpdate(newLoc);
          }
        },
      );

      watchSubRef.current = subscription;
      isBroadcastingRef.current = true;
      setBroadcastState('live');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.error('[BountyMode] Error starting broadcast:', err);
      setErrorMsg('Could not start broadcasting. Make sure location services are enabled.');
      setBroadcastState('error');
    }
  }, [accessCode, currentEvent, sendLocationUpdate]);

  const stopBroadcast = useCallback(async () => {
    isBroadcastingRef.current = false;
    setBroadcastState('paused');

    if (watchSubRef.current) {
      try {
        await watchSubRef.current.remove();
      } catch {}
      watchSubRef.current = null;
    }

    // Deactivate in database
    if (currentEvent && accessCode.trim() && currentLocation) {
      try {
        const endpoint = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/update-bounty-location`;
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessCode: accessCode.trim(),
            eventId: currentEvent.id,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            deactivate: true,
          }),
        });
      } catch (err) {
        console.error('[BountyMode] Error deactivating:', err);
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [currentEvent, accessCode, currentLocation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isBroadcastingRef.current = false;
      if (watchSubRef.current) {
        void watchSubRef.current.remove();
        watchSubRef.current = null;
      }
    };
  }, []);

  // Auto-stop when event ends
  useEffect(() => {
    if (currentEvent?.status === 'completed' && broadcastState === 'live') {
      void stopBroadcast();
      setErrorMsg('The hunt has ended. Broadcasting stopped automatically.');
      setBroadcastState('error');
    }
  }, [currentEvent?.status, broadcastState, stopBroadcast]);

  const formatCoords = (lat: number, lng: number): string => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(5)}° ${latDir}  ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
  };

  const formatTimeAgo = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 5000) return 'Just now';
    if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
    return `${Math.round(diff / 60000)}m ago`;
  };

  const isLive = broadcastState === 'live';
  const isStarting = broadcastState === 'starting';
  const hasError = broadcastState === 'error';
  const isPaused = broadcastState === 'paused';
  const showCodeEntry = broadcastState === 'idle' || hasError || isPaused;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[C.gradient.backgroundStart, C.gradient.backgroundEnd]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (isLive) {
                Alert.alert(
                  'Stop Broadcasting?',
                  'Hunters will no longer be able to track your location. Are you sure you want to leave?',
                  [
                    { text: 'Keep Broadcasting', style: 'cancel' },
                    {
                      text: 'Stop & Leave',
                      style: 'destructive',
                      onPress: async () => {
                        await stopBroadcast();
                        router.back();
                      },
                    },
                  ],
                );
              } else {
                router.back();
              }
            }}
            activeOpacity={0.7}
          >
            <ArrowLeft color={C.dark.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bounty Mode</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Status Banner */}
          <View
            style={[
              styles.statusBanner,
              isLive && styles.statusBannerLive,
              hasError && styles.statusBannerError,
              isStarting && styles.statusBannerStarting,
              (broadcastState === 'idle' || isPaused) && styles.statusBannerIdle,
            ]}
          >
            <View style={styles.statusIconRow}>
              {isLive ? (
                <Animated.View style={{ opacity: pulseAnim }}>
                  <RadioTower color={C.status.success} size={28} />
                </Animated.View>
              ) : isStarting ? (
                <Activity color={C.accent.primary} size={28} />
              ) : hasError ? (
                <AlertCircle color={C.status.danger} size={28} />
              ) : (
                <Radio color={C.dark.textMuted} size={28} />
              )}
              <Text
                style={[
                  styles.statusText,
                  isLive && styles.statusTextLive,
                  hasError && styles.statusTextError,
                ]}
              >
                {isLive
                  ? 'BROADCASTING'
                  : isStarting
                  ? 'STARTING...'
                  : hasError
                  ? 'ERROR'
                  : isPaused
                  ? 'PAUSED'
                  : 'OFFLINE'}
              </Text>
            </View>
            <Text style={styles.statusSubtext}>
              {isLive
                ? 'Hunters can now track your distance in real-time'
                : isStarting
                ? 'Acquiring GPS signal and verifying access code'
                : hasError
                ? errorMsg || 'Something went wrong'
                : isPaused
                ? 'Broadcast paused — hunters cannot see you'
                : 'Enter your access code to start broadcasting'}
            </Text>
          </View>

          {/* Access Code Entry */}
          {showCodeEntry && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ACCESS CODE</Text>
              <View style={styles.codeInputContainer}>
                <Lock color={C.dark.textMuted} size={18} style={{ marginLeft: 4 }} />
                <TextInput
                  style={styles.codeInput}
                  placeholder="BOUNTY-CITY-XXXXX"
                  placeholderTextColor={C.dark.textMuted}
                  value={accessCode}
                  onChangeText={setAccessCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  secureTextEntry={!codeVisible}
                  returnKeyType="done"
                  editable={!isStarting}
                />
                <TouchableOpacity
                  onPress={() => setCodeVisible(!codeVisible)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {codeVisible ? (
                    <EyeOff color={C.dark.textMuted} size={18} />
                  ) : (
                    <Eye color={C.dark.textMuted} size={18} />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                The organizer gave you this code before the hunt. Enter it to start broadcasting
                your position so hunters can track you with the distance meter.
              </Text>

              {/* Prefilled hint */}
              {codeQuery.data?.bounty_access_code &&
                codeQuery.data.bounty_access_code.length > 0 &&
                !accessCode && (
                  <TouchableOpacity
                    style={styles.prefillButton}
                    onPress={() => setAccessCode(codeQuery.data!.bounty_access_code!)}
                    activeOpacity={0.7}
                  >
                    <Zap color={C.accent.primary} size={14} />
                    <Text style={styles.prefillText}>Use the code assigned to this event</Text>
                  </TouchableOpacity>
                )}
            </View>
          )}

          {/* Live Info */}
          {isLive && currentLocation && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>YOUR POSITION</Text>
              <View style={styles.coordsCard}>
                <View style={styles.coordsRow}>
                  <MapPin color={C.accent.primary} size={18} />
                  <Text style={styles.coordsText}>
                    {formatCoords(currentLocation.latitude, currentLocation.longitude)}
                  </Text>
                </View>
                {currentLocation.accuracy != null && (
                  <View style={styles.coordsRow}>
                    <Crosshair color={C.dark.textMuted} size={16} />
                    <Text style={styles.coordsSubtext}>
                      GPS accuracy: ±{Math.round(currentLocation.accuracy)}m
                    </Text>
                  </View>
                )}
                <View style={styles.coordsRow}>
                  <CheckCircle2 color={C.status.success} size={16} />
                  <Text style={styles.coordsSubtext}>Last sent: {formatTimeAgo(lastUpdate)}</Text>
                </View>
                <View style={styles.coordsRow}>
                  <Radio color={C.dark.textMuted} size={16} />
                  <Text style={styles.coordsSubtext}>
                    Updates sent: {updateCount}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Event Info */}
          {currentEvent && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>EVENT</Text>
              <View style={styles.eventCard}>
                <View style={styles.eventRow}>
                  <Text style={styles.eventLabel}>City</Text>
                  <Text style={styles.eventValue}>{currentEvent.city || 'Amsterdam'}</Text>
                </View>
                <View style={styles.eventDivider} />
                <View style={styles.eventRow}>
                  <Text style={styles.eventLabel}>Status</Text>
                  <View style={styles.eventStatusRow}>
                    <View
                      style={[
                        styles.eventStatusDot,
                        currentEvent.status === 'live' && styles.eventStatusDotLive,
                        currentEvent.status === 'completed' && styles.eventStatusDotCompleted,
                      ]}
                    />
                    <Text
                      style={[
                        styles.eventValue,
                        currentEvent.status === 'live' && styles.eventValueLive,
                      ]}
                    >
                      {currentEvent.status === 'live'
                        ? 'Live now'
                        : currentEvent.status === 'completed'
                        ? 'Ended'
                        : 'Scheduled'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Anti-Cheat Info */}
          <View style={styles.section}>
            <View style={styles.infoCard}>
              <Shield color={C.accent.teal} size={20} />
              <Text style={styles.infoTitle}>How this works</Text>
              <Text style={styles.infoText}>
                Your GPS position updates every {UPDATE_INTERVAL_MS / 1000}s while broadcasting.
                Hunters see the distance to your position — not exact coordinates. If you stop
                broadcasting for more than 5 minutes, hunters will fall back to the zone center.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Action Button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {isLive || isStarting ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.stopButton, isStarting && styles.actionButtonDisabled]}
              onPress={stopBroadcast}
              disabled={isStarting}
              activeOpacity={0.8}
            >
              <Radio color="#FFF" size={20} />
              <Text style={styles.stopButtonText}>
                {isStarting ? 'Starting...' : 'Stop Broadcasting'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton, !accessCode.trim() && styles.actionButtonDisabled]}
              onPress={startBroadcast}
              disabled={!accessCode.trim() || isStarting}
              activeOpacity={0.8}
            >
              <RadioTower color="#000" size={20} />
              <Text style={styles.startButtonText}>
                {isPaused ? 'Resume Broadcasting' : 'Start Broadcasting'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: C.dark.text,
    letterSpacing: 0.5,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  // Status Banner
  statusBanner: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    marginTop: 8,
    borderWidth: 1,
  },
  statusBannerLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusBannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusBannerStarting: {
    backgroundColor: C.accent.primaryMuted,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusBannerIdle: {
    backgroundColor: C.dark.card,
    borderColor: C.dark.border,
  },
  statusIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: C.dark.textMuted,
    letterSpacing: 1.5,
  },
  statusTextLive: {
    color: C.status.success,
  },
  statusTextError: {
    color: C.status.danger,
  },
  statusSubtext: {
    fontSize: 13,
    color: C.dark.textSecondary,
    lineHeight: 18,
  },
  // Section
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: C.dark.textMuted,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  // Code Input
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.dark.border,
    paddingHorizontal: 12,
    height: 52,
  },
  codeInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700' as const,
    color: C.dark.text,
    letterSpacing: 1,
    paddingVertical: 0,
    marginHorizontal: 8,
  },
  eyeButton: {
    padding: 4,
  },
  helperText: {
    fontSize: 12,
    color: C.dark.textMuted,
    lineHeight: 17,
    marginTop: 10,
  },
  prefillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.accent.primaryMuted,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  prefillText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: C.accent.primary,
  },
  // Coords card
  coordsCard: {
    backgroundColor: C.dark.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.dark.border,
    padding: 16,
    gap: 12,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coordsText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: C.dark.text,
    letterSpacing: 0.5,
  },
  coordsSubtext: {
    fontSize: 13,
    color: C.dark.textSecondary,
  },
  // Event card
  eventCard: {
    backgroundColor: C.dark.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.dark.border,
    padding: 16,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  eventLabel: {
    fontSize: 14,
    color: C.dark.textSecondary,
  },
  eventValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: C.dark.text,
  },
  eventValueLive: {
    color: C.status.success,
  },
  eventDivider: {
    height: 1,
    backgroundColor: C.dark.border,
    marginVertical: 8,
  },
  eventStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.dark.textMuted,
  },
  eventStatusDotLive: {
    backgroundColor: C.status.success,
  },
  eventStatusDotCompleted: {
    backgroundColor: C.status.danger,
  },
  // Info card
  infoCard: {
    backgroundColor: C.accent.tealMuted,
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: C.accent.teal,
  },
  infoText: {
    fontSize: 12,
    color: C.dark.textSecondary,
    lineHeight: 17,
  },
  // Bottom bar
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: C.dark.surface,
    borderTopWidth: 1,
    borderTopColor: C.dark.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  startButton: {
    backgroundColor: C.accent.primary,
  },
  stopButton: {
    backgroundColor: C.status.danger,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#000',
    letterSpacing: 0.5,
  },
  stopButtonText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
