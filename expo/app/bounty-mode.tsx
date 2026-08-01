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
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
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
  ScanLine,
  Trophy,
  X,
  Crown,
  Loader,
} from 'lucide-react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useGameStore } from '@/store/game-store';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useEventZone } from '@/hooks/useEventZone';
import EventZoneMap from '@/components/EventZoneMap';

const C = Colors;

const UPDATE_INTERVAL_MS = 8000;
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

type BroadcastState = 'idle' | 'starting' | 'live' | 'paused' | 'error';

type WinnerScanState = 'idle' | 'scanning' | 'verifying' | 'success' | 'error';

type VerificationPayload = {
  userId: string;
  verificationCode: string;
  eventId: string;
};

type WinnerInfo = {
  winnerUserId: string;
  winnerEmail: string | null;
  declaredAt: string;
} | null;

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

  // Winner declaration state (QR scanner shown while broadcasting)
  const [showWinnerScanner, setShowWinnerScanner] = useState<boolean>(false);
  const [winnerScanState, setWinnerScanState] = useState<WinnerScanState>('idle');
  const [winnerScanError, setWinnerScanError] = useState<string>('');
  const [declaredWinner, setDeclaredWinner] = useState<WinnerInfo>(null);
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Stable ref so the realtime effect doesn't re-run on every query re-render
  const winnerRefetchRef = useRef<(() => void) | null>(null);

  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const isBroadcastingRef = useRef<boolean>(false);
  const accessCodeRef = useRef<string>('');

  // Zone boundary alert state
  const [isOutsideZone, setIsOutsideZone] = useState<boolean | null>(null);
  const [showOutsideAlert, setShowOutsideAlert] = useState<boolean>(false);
  const wasOutsideRef = useRef<boolean>(false);
  const alertSoundRef = useRef<Audio.Sound | null>(null);
  const lastAlertAtRef = useRef<number>(0);

  // Keep refs in sync
  useEffect(() => {
    accessCodeRef.current = accessCode;
  }, [accessCode]);

  // Fetch the hunt zone for this event so the bounty can see if they're in it
  const { zone: eventZone, currentRadius: currentZoneRadius, refetch: refetchZone } = useEventZone(
    currentEvent?.id,
    !!currentEvent,
  );

  // Refetch the zone the moment broadcasting goes live, so the bounty sees
  // the current zone immediately rather than waiting for the next poll.
  useEffect(() => {
    if (broadcastState === 'live') {
      void refetchZone();
    }
  }, [broadcastState, refetchZone]);

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

  // Check if a winner has already been declared for this event
  const winnerQuery = useQuery<WinnerInfo>({
    queryKey: ['event-winner', currentEvent?.id],
    queryFn: async () => {
      if (!currentEvent) return null;
      const { data, error } = await supabase
        .from('event_winners')
        .select('winner_user_id, winner_email, declared_at')
        .eq('event_id', currentEvent.id)
        .maybeSingle();
      if (error) {
        console.error('[BountyMode] Error fetching winner:', error.message);
        return null;
      }
      if (!data) return null;
      return {
        winnerUserId: (data as any).winner_user_id,
        winnerEmail: (data as any).winner_email ?? null,
        declaredAt: (data as any).declared_at,
      };
    },
    enabled: !!currentEvent,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (winnerQuery.data) {
      setDeclaredWinner(winnerQuery.data);
    }
  }, [winnerQuery.data]);

  // Keep the refetch ref in sync so the realtime subscription can call it
  // without depending on the entire winnerQuery object (which changes every render)
  useEffect(() => {
    winnerRefetchRef.current = () => void winnerQuery.refetch();
  }, [winnerQuery]);

  // Realtime: listen for a winner being declared while broadcasting
  useEffect(() => {
    if (!currentEvent) return;
    const channelName = `bounty-winner-${currentEvent.id}-${Date.now()}`;
    const sub = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_winners',
          filter: `event_id=eq.${currentEvent.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          setDeclaredWinner({
            winnerUserId: row.winner_user_id,
            winnerEmail: row.winner_email ?? null,
            declaredAt: row.declared_at,
          });
          setShowWinnerScanner(false);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${currentEvent.id}`,
        },
        () => {
          // Event status changed (likely to completed) — refetch winner
          winnerRefetchRef.current?.();
        },
      )
      .subscribe();

    return () => {
      void sub.unsubscribe();
    };
  }, [currentEvent]);

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
    setIsOutsideZone(null);
    wasOutsideRef.current = false;
    setShowOutsideAlert(false);
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
      if (alertSoundRef.current) {
        void alertSoundRef.current.unloadAsync().catch(() => {});
        alertSoundRef.current = null;
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

  // Preload the boundary-alert sound when broadcasting starts; unload on stop
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/notification_sound.wav'),
        );
        if (cancelled) {
          void sound.unloadAsync();
          return;
        }
        alertSoundRef.current = sound;
      } catch (err) {
        console.warn('[BountyMode] Could not preload alert sound:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (alertSoundRef.current) {
        void alertSoundRef.current.unloadAsync().catch(() => {});
        alertSoundRef.current = null;
      }
    };
  }, [isLive]);

  // Haversine distance between two coords in meters
  const haversineMeters = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  // Fire the boundary-exit alert: strong haptic pattern + sound + banner
  const fireBoundaryAlert = useCallback(() => {
    const now = Date.now();
    // Throttle to once per 10s even if effect re-runs
    if (now - lastAlertAtRef.current < 10000) return;
    lastAlertAtRef.current = now;

    setShowOutsideAlert(true);

    // Heavy haptic pattern: warning + error
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }, 350);

    // Play the alert sound (reload if it failed before)
    (async () => {
      try {
        const sound = alertSoundRef.current;
        if (sound) {
          await sound.setPositionAsync(0);
          await sound.playAsync();
        } else {
          const { sound: newSound } = await Audio.Sound.createAsync(
            require('../assets/notification_sound.wav'),
          );
          alertSoundRef.current = newSound;
          await newSound.playAsync();
        }
      } catch (err) {
        console.warn('[BountyMode] Alert sound playback failed:', err);
      }
    })();
  }, []);

  // Watch the bounty's position against the zone boundary and fire an alert on exit
  useEffect(() => {
    if (!isLive || !currentLocation || !eventZone || currentZoneRadius === null) {
      setIsOutsideZone(null);
      wasOutsideRef.current = false;
      return;
    }

    const distance = haversineMeters(
      currentLocation.latitude,
      currentLocation.longitude,
      eventZone.centerLatitude,
      eventZone.centerLongitude,
    );
    const outside = distance > currentZoneRadius;
    setIsOutsideZone(outside);

    if (outside && !wasOutsideRef.current) {
      // Transition: inside -> outside
      fireBoundaryAlert();
    } else if (!outside && wasOutsideRef.current) {
      // Transition: outside -> inside, clear the banner
      setShowOutsideAlert(false);
    }
    wasOutsideRef.current = outside;
  }, [isLive, currentLocation, eventZone, currentZoneRadius, fireBoundaryAlert]);

  // Parse the verification QR payload scanned from a player's screen
  const parseVerificationPayload = (raw: string): VerificationPayload | null => {
    const trimmed = raw.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (
        parsed &&
        typeof parsed.userId === 'string' &&
        typeof parsed.verificationCode === 'string' &&
        typeof parsed.eventId === 'string'
      ) {
        return parsed as VerificationPayload;
      }
    } catch {
      // Not JSON — fall through
    }
    return null;
  };

  const handleWinnerScanned = useCallback(
    async (result: { type: string; data: string }) => {
      if (hasScanned || winnerScanState === 'verifying') return;
      setHasScanned(true); // Debounce immediately — prevent rapid-fire callbacks

      const payload = parseVerificationPayload(result.data);
      if (!payload) {
        setWinnerScanState('error');
        setWinnerScanError('That QR code is not a player verification code. Scan the QR on a hunter\'s Profile screen.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => {
          setHasScanned(false);
          setWinnerScanState('scanning');
        }, 1800);
        return;
      }

      if (!currentEvent || payload.eventId !== currentEvent.id) {
        setWinnerScanState('error');
        setWinnerScanError('This QR code is for a different event.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => {
          setHasScanned(false);
          setWinnerScanState('scanning');
        }, 1800);
        return;
      }

      setWinnerScanState('verifying');
      setWinnerScanError('');

      const code = accessCodeRef.current;
      const loc = currentLocation;

      if (!code) {
        setWinnerScanState('error');
        setWinnerScanError('Access code missing. Restart your broadcast and try again.');
        setHasScanned(false);
        return;
      }

      if (!loc) {
        setWinnerScanState('error');
        setWinnerScanError('Could not read your current GPS position. Try again.');
        setHasScanned(false);
        return;
      }

      try {
        const endpoint = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/declare-winner`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessCode: code,
            eventId: currentEvent.id,
            playerUserId: payload.userId,
            verificationCode: payload.verificationCode,
            bountyLatitude: loc.latitude,
            bountyLongitude: loc.longitude,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setWinnerScanState('success');
          setDeclaredWinner({
            winnerUserId: data.winnerUserId,
            winnerEmail: data.winnerEmail ?? null,
            declaredAt: data.declaredAt,
          });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Realtime will propagate to all players; also stop broadcasting.
          setTimeout(() => {
            setShowWinnerScanner(false);
            void stopBroadcast();
          }, 2200);
        } else {
          setWinnerScanState('error');
          setWinnerScanError(data.error || 'Could not declare a winner.');
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setHasScanned(false);
          setTimeout(() => setWinnerScanState('scanning'), 2200);
        }
      } catch (err) {
        console.error('[BountyMode] Declare winner error:', err);
        setWinnerScanState('error');
        setWinnerScanError('Network error. Check your connection and try again.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setHasScanned(false);
        setTimeout(() => setWinnerScanState('scanning'), 2000);
      }
    },
    [hasScanned, winnerScanState, currentEvent, currentLocation, stopBroadcast],
  );

  const openWinnerScanner = useCallback(async () => {
    if (!isLive) {
      Alert.alert('Not Broadcasting', 'You must be broadcasting to declare a winner.');
      return;
    }
    if (declaredWinner) {
      Alert.alert('Winner Already Declared', 'A winner has already been declared for this event.');
      return;
    }
    if (!cameraPermission?.granted) {
      const { status } = await requestCameraPermission();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Needed',
          'Bounty Mode needs camera access to scan a player\'s verification QR code.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
    }
    setWinnerScanState('scanning');
    setWinnerScanError('');
    setHasScanned(false);
    setShowWinnerScanner(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [isLive, declaredWinner, cameraPermission, requestCameraPermission]);

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

          {/* Outside-Zone Boundary Alert */}
          {isLive && showOutsideAlert && isOutsideZone && (
            <Animated.View style={[styles.zoneAlertBanner]}>
              <View style={styles.zoneAlertIconRow}>
                <Animated.View style={{ opacity: pulseAnim }}>
                  <AlertCircle color={C.status.danger} size={24} />
                </Animated.View>
                <Text style={styles.zoneAlertTitle}>YOU LEFT THE HUNT ZONE</Text>
              </View>
              <Text style={styles.zoneAlertBody}>
                You're no longer in play. Move back inside the amber circle on the map
                to resume the hunt. Hunters can still see your distance but you're
                outside the active area.
              </Text>
            </Animated.View>
          )}

          {/* Inside-Zone reassurance banner (subtle, only when live & back inside after being out) */}
          {isLive && isOutsideZone === false && wasOutsideRef.current && (
            <View style={styles.zoneReassuranceBanner}>
              <CheckCircle2 color={C.status.success} size={18} />
              <Text style={styles.zoneReassuranceText}>
                Back inside the hunt zone — you're in play again.
              </Text>
            </View>
          )}

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

          {/* Zone Map — let the bounty see if they're inside the hunt zone */}
          {isLive && eventZone && currentZoneRadius !== null && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>HUNT ZONE</Text>
              <EventZoneMap
                centerLatitude={eventZone.centerLatitude}
                centerLongitude={eventZone.centerLongitude}
                radiusMeters={currentZoneRadius}
                zoneName={eventZone.zoneName ?? undefined}
              />
              <Text style={styles.zoneHelperText}>
                Stay inside the amber circle. If you leave the zone, hunters can see
                your distance but you're no longer in the hunt area.
              </Text>
            </View>
          )}

          {/* Winner Declaration Section (only while broadcasting) */}
          {isLive && currentEvent && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DECLARE WINNER</Text>
              {declaredWinner ? (
                <View style={styles.winnerDeclaredCard}>
                  <View style={styles.winnerCrownRow}>
                    <Crown color={C.accent.primary} size={26} />
                    <Text style={styles.winnerDeclaredTitle}>Winner Declared!</Text>
                  </View>
                  <Text style={styles.winnerDeclaredEmail} numberOfLines={1}>
                    {declaredWinner.winnerEmail || 'A hunter'}
                  </Text>
                  <Text style={styles.winnerDeclaredSubtext}>
                    The hunt has ended. Every player now sees this winner on their screen.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.declareWinnerButton}
                  onPress={openWinnerScanner}
                  activeOpacity={0.8}
                >
                  <ScanLine color="#000" size={20} />
                  <Text style={styles.declareWinnerButtonText}>Scan Winner's QR Code</Text>
                </TouchableOpacity>
              )}
              {!declaredWinner && (
                <Text style={styles.declareHelperText}>
                  When a hunter finds you, scan the QR code on their Profile screen to declare them the winner. The bounty and the winner must be physically close.
                </Text>
              )}
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

      {/* Winner Scanner Modal — full-screen camera */}
      <Modal
        visible={showWinnerScanner}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWinnerScanner(false)}
      >
        <View style={styles.winnerScannerRoot}>
          {/* Camera fills the entire screen */}
          {cameraPermission?.granted &&
            winnerScanState !== 'success' &&
            winnerScanState !== 'verifying' &&
            winnerScanState !== 'idle' ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={hasScanned ? undefined : handleWinnerScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
          ) : null}

          {/* Dark overlay for non-camera states */}
          {(winnerScanState === 'success' ||
            winnerScanState === 'verifying' ||
            !cameraPermission?.granted) && (
            <View style={styles.winnerScannerDimmer} />
          )}

          {/* Top bar — close button + title */}
          <View style={[styles.winnerScannerTopBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              onPress={() => setShowWinnerScanner(false)}
              style={styles.winnerScannerCloseBtn}
              activeOpacity={0.7}
            >
              <X color="#FFFFFF" size={24} />
            </TouchableOpacity>
            <View style={styles.winnerScannerTitleContainer}>
              <Trophy color={C.accent.primary} size={16} />
              <Text style={styles.winnerScannerTitle}>Declare Winner</Text>
            </View>
            <View style={styles.winnerScannerCloseBtn} pointerEvents="none" />
          </View>

          {/* Scan frame overlay (only when camera is active) */}
          {cameraPermission?.granted &&
            winnerScanState !== 'success' &&
            winnerScanState !== 'verifying' &&
            winnerScanState !== 'idle' && (
              <View style={styles.winnerScannerFrameOverlay} pointerEvents="none">
                <View style={styles.winnerScannerFrame}>
                  <View style={[styles.winnerScanCorner, styles.winnerScanCornerTL]} />
                  <View style={[styles.winnerScanCorner, styles.winnerScanCornerTR]} />
                  <View style={[styles.winnerScanCorner, styles.winnerScanCornerBL]} />
                  <View style={[styles.winnerScanCorner, styles.winnerScanCornerBR]} />
                </View>
              </View>
            )}

          {/* Bottom content area */}
          <View style={[styles.winnerScannerBottom, { paddingBottom: insets.bottom + 16 }]}>
            {winnerScanState === 'success' ? (
              <View style={styles.winnerSuccessState}>
                <View style={styles.winnerSuccessIcon}>
                  <Crown color={C.status.success} size={48} />
                </View>
                <Text style={styles.winnerSuccessTitle}>Winner Declared!</Text>
                <Text style={styles.winnerSuccessText} numberOfLines={2}>
                  {declaredWinner?.winnerEmail || 'A hunter'} found the bounty first. All players are being notified now.
                </Text>
              </View>
            ) : winnerScanState === 'verifying' ? (
              <View style={styles.winnerVerifyingState}>
                <Loader color={C.accent.primary} size={40} />
                <Text style={styles.winnerVerifyingTitle}>Verifying hunter...</Text>
                <Text style={styles.winnerVerifyingText}>
                  Checking ticket, verification code, and proximity
                </Text>
              </View>
            ) : !cameraPermission?.granted ? (
              <View style={styles.winnerPermissionState}>
                <ScanLine color={C.accent.primary} size={40} />
                <Text style={styles.winnerPermissionTitle}>Camera Access Needed</Text>
                <Text style={styles.winnerPermissionText}>
                  Allow camera access to scan a hunter's verification QR code.
                </Text>
                <TouchableOpacity
                  style={styles.winnerGrantButton}
                  onPress={requestCameraPermission}
                  activeOpacity={0.8}
                >
                  <Text style={styles.winnerGrantButtonText}>Allow Camera</Text>
                </TouchableOpacity>
                {cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain === false && (
                  <TouchableOpacity
                    style={styles.winnerSettingsLink}
                    onPress={() => Linking.openSettings()}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.winnerSettingsLinkText}>Open Settings</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.winnerScanInstructions}>
                <ScanLine color={C.accent.primary} size={20} />
                <Text style={styles.winnerScanInstructionsTitle}>
                  Point at the hunter's verification QR
                </Text>
                <Text style={styles.winnerScanInstructionsText}>
                  Find it on their Profile screen
                </Text>
                {winnerScanState === 'error' && winnerScanError ? (
                  <View style={styles.winnerScanError}>
                    <AlertCircle color={C.status.danger} size={14} />
                    <Text style={styles.winnerScanErrorText}>{winnerScanError}</Text>
                  </View>
                ) : null}
              </View>
            )}

            <View style={styles.winnerFooter}>
              <Shield color="rgba(255,255,255,0.5)" size={12} />
              <Text style={styles.winnerFooterText}>
                Anti-cheat: ticket, verification code, and GPS proximity verified.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
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
  zoneHelperText: {
    fontSize: 12,
    color: C.dark.textMuted,
    lineHeight: 17,
    marginTop: 10,
  },
  // Zone boundary alert banner
  zoneAlertBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    padding: 18,
    marginBottom: 16,
    marginTop: 4,
  },
  zoneAlertIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  zoneAlertTitle: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: C.status.danger,
    letterSpacing: 1,
  },
  zoneAlertBody: {
    fontSize: 13,
    color: C.dark.textSecondary,
    lineHeight: 18,
  },
  // Reassurance banner (back inside)
  zoneReassuranceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  zoneReassuranceText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: C.status.success,
    flex: 1,
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
  // Declare winner section
  declareWinnerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.accent.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  declareWinnerButtonText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#000',
    letterSpacing: 0.3,
  },
  declareHelperText: {
    fontSize: 12,
    color: C.dark.textMuted,
    lineHeight: 17,
    marginTop: 10,
  },
  winnerDeclaredCard: {
    backgroundColor: C.accent.primaryMuted,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    alignItems: 'center',
    gap: 8,
  },
  winnerCrownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  winnerDeclaredTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: C.accent.primary,
  },
  winnerDeclaredEmail: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: C.dark.text,
  },
  winnerDeclaredSubtext: {
    fontSize: 12,
    color: C.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  // Winner Scanner — full-screen camera
  winnerScannerRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  winnerScannerDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.dark.surface,
  },
  winnerScannerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  winnerScannerCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerScannerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  winnerScannerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  winnerScannerFrameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerScannerFrame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  winnerScannerBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingTop: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  // Success state
  winnerSuccessState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  winnerSuccessIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: C.status.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  winnerSuccessTitle: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: C.status.success,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  winnerSuccessText: {
    fontSize: 15,
    color: C.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  // Verifying state
  winnerVerifyingState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  winnerVerifyingTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: C.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  winnerVerifyingText: {
    fontSize: 14,
    color: C.dark.textSecondary,
  },
  // Permission state
  winnerPermissionState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  winnerPermissionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginTop: 18,
    marginBottom: 8,
  },
  winnerPermissionText: {
    fontSize: 14,
    color: C.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 24,
  },
  winnerGrantButton: {
    backgroundColor: C.accent.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  winnerGrantButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
  },
  winnerSettingsLink: {
    marginTop: 12,
  },
  winnerSettingsLinkText: {
    fontSize: 14,
    color: C.accent.primary,
    fontWeight: '600' as const,
  },
  // Scan corners (used in full-screen frame)
  winnerScanCorner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#FFFFFF',
  },
  winnerScanCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  winnerScanCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  winnerScanCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  winnerScanCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  winnerScanInstructions: {
    alignItems: 'center',
    gap: 6,
  },
  winnerScanInstructionsTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: C.dark.text,
  },
  winnerScanInstructionsText: {
    fontSize: 13,
    color: C.dark.textSecondary,
  },
  winnerScanError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.status.dangerMuted,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  winnerScanErrorText: {
    flex: 1,
    fontSize: 13,
    color: C.status.danger,
    fontWeight: '500' as const,
  },
  winnerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.dark.border,
  },
  winnerFooterText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500' as const,
  },
});
