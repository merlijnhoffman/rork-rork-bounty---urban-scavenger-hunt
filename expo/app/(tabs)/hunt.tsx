import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Animated,
  Modal,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Users, AlertCircle, LogIn, Target, MapPin, Crosshair, Navigation, ChevronRight, Zap, Trophy, Eye, Lightbulb, Lock, Unlock, CalendarPlus } from 'lucide-react-native';
import * as Calendar from 'expo-calendar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import HuntMap from '@/components/HuntMap';
import { useGameStore, Clue } from '@/store/game-store';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

import { supabase } from '@/lib/supabase';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { TICKET } from '@/constants/payment';
import { usePayment } from '@/contexts/PaymentContext';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

interface ClueWithLocation extends Clue {
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
    name: string;
  };
}

export default function HuntScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const { 
    currentEvent, 
    isLoading: gameLoading,
    purchaseError: _gamePurchaseError,
    eventError,
    refetchEvent,
    isEventFetching,
  } = useGameStore();
  const {
    offering,
    isOfferingLoading,
    hasHuntAccess,
    purchasePackage,
    isPurchasing,
    purchaseError: rcPurchaseError,
    restorePurchases,
    isRestoring,
  } = usePayment();

  const [hasTicket, setHasTicket] = useState<boolean>(false);
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const queryClient = useQueryClient();
  const [liveClues, setLiveClues] = useState<Clue[]>([]);
  const [selectedClueForMap, setSelectedClueForMap] = useState<ClueWithLocation | null>(null);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const slideUpAnim = useMemo(() => new Animated.Value(50), []);
  const opacityAnim = useMemo(() => new Animated.Value(0), []);
  const [distanceMeterUsed, setDistanceMeterUsed] = useState<boolean>(false);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] = useState<boolean>(false);
  const [timeUntilEvent, setTimeUntilEvent] = useState<string>('');
  const [showPrizeModal, setShowPrizeModal] = useState<boolean>(false);
  const [joinedLiveHunt, setJoinedLiveHunt] = useState<boolean>(false);
  const [hintTokens, setHintTokens] = useState<number>(3);
  const [unlockedHints, setUnlockedHints] = useState<Set<string>>(new Set());
  const [showHintConfirm, setShowHintConfirm] = useState<string | null>(null);
  
  const bountyLocation = useMemo(() => ({
    latitude: 52.3752,
    longitude: 4.8840,
  }), []);
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideUpAnim, opacityAnim]);
  
  useEffect(() => {
    const updateCountdown = () => {
      if (!currentEvent) {
        setTimeUntilEvent('');
        return;
      }

      if (currentEvent.status === 'live') {
        setTimeUntilEvent('Event is live!');
        return;
      }

      if (currentEvent.status === 'completed') {
        setTimeUntilEvent('Event has ended');
        return;
      }

      const now = new Date();
      const eventStart = currentEvent.startTime ? new Date(currentEvent.startTime) : null;
      
      if (!eventStart || isNaN(eventStart.getTime())) {
        setTimeUntilEvent('Coming soon');
        return;
      }

      const diff = eventStart.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeUntilEvent('Starting soon...');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (days > 0) {
        setTimeUntilEvent(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setTimeUntilEvent(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeUntilEvent(`${minutes}m ${seconds}s`);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [currentEvent]);
  
  useEffect(() => {
    const requestNotificationPermissions = async () => {
      if (Platform.OS === 'web') {
        console.log('Notifications not supported on web');
        setNotificationPermission(false);
        return;
      }
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      setNotificationPermission(finalStatus === 'granted');
      
      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };
    
    void requestNotificationPermissions();
  }, []);
  
  const sendClueNotification = useCallback(async (clue: Clue) => {
    if (Platform.OS === 'web') {
      console.log('Notifications not supported on web, skipping for clue:', clue.id);
      return;
    }
    if (!notificationPermission) {
      console.log('Notification permission not granted');
      return;
    }
    
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'New Clue Received!',
          body: `Clue #${clue.order}: ${clue.text.substring(0, 100)}${clue.text.length > 100 ? '...' : ''}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { clueId: clue.id, order: clue.order },
        },
        trigger: null,
      });
      console.log('Notification sent for clue:', clue.id);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, [notificationPermission]);
  
  const ticketQuery = useQuery({
    queryKey: ['ticket-status', user?.id, currentEvent?.id],
    queryFn: async () => {
      if (!user || !currentEvent) {
        return { hasTicket: false };
      }

      if (hasHuntAccess) {
        return { hasTicket: true };
      }

      const { data, error } = await supabase
        .from('tickets')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('event_id', currentEvent.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error checking ticket status:', error.message || 'Unknown error');
        throw new Error(error.message || 'Failed to check ticket status');
      }

      return { hasTicket: !!data };
    },
    enabled: !!user && !!currentEvent,
    refetchInterval: 30000,
    staleTime: 0,
  });
  
  const isLiveWithTicket = !!hasTicket && !!currentEvent && currentEvent.status === 'live' && !!user;

  const cluesQuery = useQuery({
    queryKey: ['live-clues', currentEvent?.id],
    queryFn: async () => {
      if (!currentEvent) return [];
      console.log('[Clues] Polling clues for event:', currentEvent.id);
      const { data, error } = await supabase
        .from('clues')
        .select('*')
        .eq('event_id', currentEvent.id)
        .order('order_number', { ascending: true });

      if (error) {
        console.error('[Clues] Error fetching clues:', error.message, error.details, error.hint);
        throw error;
      }

      console.log('[Clues] Fetched', data?.length ?? 0, 'clues');
      const mapped: Clue[] = (data || []).map((c: any) => ({
        id: c.id,
        text: c.text,
        hint: c.hint,
        timestamp: c.release_time || c.created_at,
        order: c.order_number,
      }));
      return mapped;
    },
    enabled: isLiveWithTicket,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  useEffect(() => {
    if (cluesQuery.data && cluesQuery.data.length > 0) {
      setLiveClues(prev => {
        const newClues = cluesQuery.data;
        if (newClues.length > prev.length) {
          const latestNew = newClues[newClues.length - 1];
          const alreadyHave = prev.find(c => c.id === latestNew.id);
          if (!alreadyHave) {
            console.log('[Clues] New clue detected via polling:', latestNew.id);
            void sendClueNotification(latestNew);
            Animated.sequence([
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                delay: 2000,
                useNativeDriver: true,
              }),
            ]).start();
          }
        }
        return newClues;
      });
    }
  }, [cluesQuery.data, fadeAnim, sendClueNotification]);

  useEffect(() => {
    if (!currentEvent || !user) return;
    
    const channelName = `clues-${currentEvent.id}-${Date.now()}`;
    console.log('[Clues] Setting up realtime subscription on channel:', channelName);
    
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clues',
          filter: `event_id=eq.${currentEvent.id}`,
        },
        (payload) => {
          console.log('[Clues] Realtime INSERT received:', payload.new);
          void queryClient.invalidateQueries({ queryKey: ['live-clues', currentEvent.id] });
        }
      )
      .subscribe((status) => {
        console.log('[Clues] Realtime subscription status:', status);
      });
    
    return () => {
      console.log('[Clues] Cleaning up realtime subscription:', channelName);
      void subscription.unsubscribe();
    };
  }, [currentEvent, user, queryClient]);
  
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };
  
  const handleUnlockHint = useCallback((clueId: string) => {
    setShowHintConfirm(clueId);
  }, []);

  const confirmUnlockHint = useCallback(() => {
    if (!showHintConfirm || hintTokens <= 0) return;
    console.log('[Hints] Unlocking hint for clue:', showHintConfirm, 'tokens remaining:', hintTokens - 1);
    setHintTokens(prev => prev - 1);
    setUnlockedHints(prev => {
      const next = new Set(prev);
      next.add(showHintConfirm);
      return next;
    });
    setShowHintConfirm(null);
  }, [showHintConfirm, hintTokens]);

  const handleAddToCalendar = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const googleUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=BOUNTY+-+Urban+Scavenger+Hunt&dates=20250118T110000Z/20250118T150000Z&details=BOUNTY+Urban+Scavenger+Hunt+in+Amsterdam.+Find+the+target+and+win!&location=Amsterdam,+Netherlands';
        const { Linking } = require('react-native');
        await Linking.openURL(googleUrl);
        return;
      }

      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Calendar access is needed to add the event.');
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = Platform.OS === 'ios'
        ? calendars.find(c => c.allowsModifications && c.type === Calendar.CalendarType.LOCAL) || calendars.find(c => c.allowsModifications)
        : calendars.find(c => c.isPrimary) || calendars.find(c => c.allowsModifications);

      if (!defaultCalendar) {
        Alert.alert('No Calendar Found', 'Could not find a writable calendar on your device.');
        return;
      }

      await Calendar.createEventAsync(defaultCalendar.id, {
        title: 'BOUNTY - Urban Scavenger Hunt',
        startDate: new Date('2025-01-18T12:00:00+01:00'),
        endDate: new Date('2025-01-18T16:00:00+01:00'),
        location: 'Amsterdam, Netherlands',
        notes: 'BOUNTY Urban Scavenger Hunt. Find the target and win the prize!',
        timeZone: 'Europe/Amsterdam',
      });

      Alert.alert('Added to Calendar!', 'The hunt event has been added to your calendar.');
    } catch (error) {
      console.error('Error adding to calendar:', error);
      Alert.alert('Error', 'Failed to add the event to your calendar.');
    }
  }, []);

  const handleDistanceMeter = async () => {
    if (distanceMeterUsed) {
      Alert.alert('Already Used', 'You have already used your distance meter for this hunt.');
      return;
    }
    
    setIsCalculatingDistance(true);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location permissions to use the distance meter.'
        );
        setIsCalculatingDistance(false);
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        bountyLocation.latitude,
        bountyLocation.longitude
      );
      
      setMeasuredDistance(Math.round(distance));
      setDistanceMeterUsed(true);
      
      Alert.alert(
        'Distance Measured',
        `You are ${Math.round(distance)} meters away from the Bounty!`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        'Error',
        'Failed to get your location. Please make sure location services are enabled.'
      );
    } finally {
      setIsCalculatingDistance(false);
    }
  };
  
  useEffect(() => {
    if (!user) {
      setHasTicket(false);
      return;
    }
    if (hasHuntAccess) {
      setHasTicket(true);
      return;
    }
    if (ticketQuery.data) {
      setHasTicket(ticketQuery.data.hasTicket);
    }
  }, [ticketQuery.data, user, hasHuntAccess]);

  const canPurchaseTicket = isLoggedIn && !hasTicket && !ticketQuery.isLoading && !isPurchasing;
  const isLoading = gameLoading || (ticketQuery.isLoading && !ticketQuery.isFetched) || isPurchasing;
  
  const isHuntActive = currentEvent?.status === 'live';
  const shouldShowHunt = hasTicket && isHuntActive && joinedLiveHunt;

  const handlePurchaseTicket = () => {
    if (!isLoggedIn) {
      router.push('/signup');
      return;
    }
    setShowPaywall(true);
  };

  const handleConfirmPurchase = async () => {
    if (!offering || offering.availablePackages.length === 0) {
      Alert.alert('Error', 'No ticket packages available. Please try again later.');
      return;
    }

    const pkg = offering.availablePackages[0];
    try {
      await purchasePackage(pkg);
      setShowPaywall(false);

      if (user && currentEvent) {
        const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        await supabase
          .from('tickets')
          .insert({
            user_id: user.id,
            event_id: currentEvent.id,
            status: 'active',
            verification_code: verificationCode,
          });
      }

      await ticketQuery.refetch();

      Alert.alert(
        'Ticket Purchased!',
        'You\'re in! Check your profile for your verification code.',
        [
          { text: 'View Profile', onPress: () => router.push('/profile') },
          { text: 'OK' },
        ]
      );
    } catch (error: any) {
      const msg = error?.message || 'Purchase failed';
      if (msg.includes('cancelled') || msg.includes('canceled')) {
        console.log('[Purchase] User cancelled');
        return;
      }
      console.error('[Purchase] Error:', msg);
      Alert.alert('Purchase Failed', msg);
    }
  };

  const handleRestore = async () => {
    try {
      await restorePurchases();
      await ticketQuery.refetch();
      if (hasHuntAccess) {
        setShowPaywall(false);
        Alert.alert('Restored!', 'Your ticket has been restored.');
      } else {
        Alert.alert('No Purchases Found', 'No previous ticket purchases were found for this account.');
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error?.message || 'Could not restore purchases.');
    }
  };

  if (shouldShowHunt) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.gradient.backgroundStart, Colors.gradient.backgroundEnd]}
          style={styles.gradient}
        >
          <View style={[styles.huntHeader, { paddingTop: insets.top + 12 }]}>
            <View style={styles.huntTitleRow}>
              <View style={styles.huntTitleLeft}>
                <View style={styles.liveIconContainer}>
                  <Target color={Colors.accent.primary} size={20} />
                </View>
                <Text style={styles.huntTitle}>LIVE HUNT</Text>
              </View>
              <View style={styles.huntStatusPill}>
                <View style={styles.statusDotPulse} />
                <Text style={styles.statusPillText}>ACTIVE</Text>
              </View>
            </View>
            
            <View style={styles.huntInfoRow}>
              <Text style={styles.huntLocation}>AMSTERDAM</Text>
              <Text style={styles.huntTimeSeparator}>|</Text>
              <Text style={styles.huntTime}>Started at 3:00 PM CET</Text>
            </View>
            
            <View style={styles.hintTokensBar}>
              <View style={styles.hintTokensLeft}>
                <Lightbulb color={Colors.accent.primary} size={16} />
                <Text style={styles.hintTokensLabel}>Hint Tokens</Text>
              </View>
              <View style={styles.hintTokensRight}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.hintTokenDot,
                      i < hintTokens ? styles.hintTokenDotActive : styles.hintTokenDotUsed,
                    ]}
                  >
                    {i < hintTokens ? (
                      <Lightbulb color="#000" size={11} />
                    ) : (
                      <Text style={styles.hintTokenDotUsedText}>{"\u2715"}</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.huntActions}>
              <TouchableOpacity 
                style={[
                  styles.distanceMeterButton,
                  (distanceMeterUsed || isCalculatingDistance) && styles.distanceMeterButtonDisabled
                ]}
                onPress={handleDistanceMeter}
                disabled={distanceMeterUsed || isCalculatingDistance}
                activeOpacity={0.8}
              >
                <Navigation 
                  color={distanceMeterUsed ? Colors.dark.textMuted : '#000'} 
                  size={18} 
                />
                <Text style={[
                  styles.distanceMeterButtonText,
                  distanceMeterUsed && styles.distanceMeterButtonTextDisabled
                ]}>
                  {isCalculatingDistance ? 'Calculating...' : 
                   distanceMeterUsed ? 'Distance Meter Used' : 
                   'Use Distance Meter'}
                </Text>
                {!distanceMeterUsed && (
                  <View style={styles.oneTimeUseBadge}>
                    <Text style={styles.oneTimeUseText}>1x</Text>
                  </View>
                )}
              </TouchableOpacity>
            
              {measuredDistance !== null && (
                <View style={styles.distanceResult}>
                  <Target color={Colors.accent.primary} size={16} />
                  <Text style={styles.distanceResultText}>
                    {measuredDistance}m away
                  </Text>
                </View>
              )}
            </View>
            
          </View>
          
          <ScrollView style={styles.cluesContainer} showsVerticalScrollIndicator={false}>
            {liveClues.length === 0 ? (
              <View style={styles.waitingContainer}>
                <View style={styles.waitingIconContainer}>
                  <Clock color={Colors.accent.primary} size={40} />
                </View>
                <Text style={styles.waitingTitle}>Waiting for clues...</Text>
                <Text style={styles.waitingText}>
                  The hunt has started! Clues will appear here as they are released.
                </Text>
              </View>
            ) : (
              liveClues.map((clue, index) => (
                <Animated.View 
                  key={clue.id}
                  style={[
                    styles.clueCard,
                    index === liveClues.length - 1 && {
                      opacity: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1],
                      })
                    }
                  ]}
                >
                  <View style={styles.clueHeader}>
                    <View style={styles.clueNumberBadge}>
                      <Text style={styles.clueNumberText}>{clue.order}</Text>
                    </View>
                    <View style={styles.clueTimestamp}>
                      <Clock color={Colors.dark.textMuted} size={13} />
                      <Text style={styles.timestampText}>
                        {new Date(clue.timestamp).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.clueText}>{clue.text}</Text>
                  
                  {clue.hint && (
                    unlockedHints.has(clue.id) ? (
                      <View style={styles.hintRevealed}>
                        <View style={styles.hintRevealedHeader}>
                          <Lightbulb color={Colors.accent.primaryLight} size={14} />
                          <Text style={styles.hintRevealedLabel}>HINT</Text>
                        </View>
                        <Text style={styles.hintRevealedText}>{clue.hint}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.hintLockedButton}
                        onPress={() => handleUnlockHint(clue.id)}
                        activeOpacity={0.7}
                        disabled={hintTokens <= 0}
                      >
                        <Lock color={hintTokens > 0 ? Colors.accent.primary : Colors.dark.textMuted} size={14} />
                        <Text style={[
                          styles.hintLockedText,
                          hintTokens <= 0 && styles.hintLockedTextDisabled
                        ]}>
                          {hintTokens > 0 ? 'Use Hint Token' : 'No Tokens Left'}
                        </Text>
                        {hintTokens > 0 && (
                          <View style={styles.hintTokenCost}>
                            <Text style={styles.hintTokenCostText}>-1</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  )}
                  
                  <View style={styles.clueActions}>
                    <TouchableOpacity 
                      style={styles.mapButton}
                      onPress={() => setSelectedClueForMap(clue as ClueWithLocation)}
                      activeOpacity={0.8}
                    >
                      <Crosshair color={Colors.accent.primary} size={15} />
                      <Text style={styles.mapButtonText}>View Hunt Zone</Text>
                    </TouchableOpacity>
                    
                    {(clue as ClueWithLocation).location && (
                      <View style={styles.radiusIndicator}>
                        <MapPin color={Colors.dark.textMuted} size={12} />
                        <Text style={styles.radiusText}>
                          {(clue as ClueWithLocation).location!.radius}m zone
                        </Text>
                      </View>
                    )}
                  </View>
                </Animated.View>
              ))
            )}
            
            {liveClues.length > 0 && (
              <View style={styles.huntProgress}>
                <Text style={styles.progressText}>
                  {liveClues.length} clue{liveClues.length !== 1 ? 's' : ''} received
                </Text>
                <Text style={styles.progressSubtext}>
                  Keep checking back for more clues!
                </Text>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
          
          <Animated.View 
            style={[
              styles.newClueNotification,
              {
                opacity: fadeAnim,
                transform: [{
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  })
                }]
              }
            ]}
          >
            <Zap color={Colors.accent.primary} size={20} />
            <Text style={styles.notificationText}>New clue received!</Text>
          </Animated.View>
        </LinearGradient>
        
        <Modal
          visible={showHintConfirm !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowHintConfirm(null)}
        >
          <View style={styles.hintModalOverlay}>
            <View style={styles.hintModalContent}>
              <View style={styles.hintModalIcon}>
                <Lightbulb color={Colors.accent.primary} size={32} />
              </View>
              <Text style={styles.hintModalTitle}>Use Hint Token?</Text>
              <Text style={styles.hintModalDesc}>
                Spend 1 hint token to reveal an extra clue for this riddle. You have {hintTokens} token{hintTokens !== 1 ? 's' : ''} remaining.
              </Text>
              <View style={styles.hintModalActions}>
                <TouchableOpacity
                  style={styles.hintModalCancel}
                  onPress={() => setShowHintConfirm(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.hintModalCancelText}>Keep Token</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.hintModalConfirm}
                  onPress={confirmUnlockHint}
                  activeOpacity={0.8}
                >
                  <Unlock color="#000" size={16} />
                  <Text style={styles.hintModalConfirmText}>Unlock Hint</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {selectedClueForMap && selectedClueForMap.location && (
          <HuntMap
            visible={true}
            onClose={() => setSelectedClueForMap(null)}
            clueOrder={selectedClueForMap.order}
            totalClues={liveClues.length}
            targetLocation={selectedClueForMap.location}
          />
        )}
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.gradient.backgroundStart, Colors.gradient.backgroundEnd]}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <View style={styles.heroIconRow}>
              <View style={styles.heroBadge}>
                <Crosshair color={Colors.accent.primary} size={16} />
              </View>
            </View>
            <Text style={styles.appTitle}>BOUNTY</Text>
            <Text style={styles.tagline}>Urban Scavenger Hunt</Text>
          </View>

          {!currentEvent && !gameLoading && !!eventError && (
            <View style={styles.errorCard}>
              <View style={styles.errorCardIcon}>
                <AlertCircle color={Colors.status.danger} size={28} />
              </View>
              <Text style={styles.errorCardTitle}>Unable to Load Event</Text>
              <Text style={styles.errorCardMessage}>
                {eventError === 'Load failed' || eventError === 'Network request failed' || eventError === 'Failed to fetch'
                  ? 'Could not connect to the server. Check your internet connection and try again.'
                  : `Something went wrong: ${eventError}`}
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => refetchEvent()}
                disabled={isEventFetching}
                activeOpacity={0.8}
              >
                <Text style={styles.retryButtonText}>
                  {isEventFetching ? 'Retrying...' : 'Try Again'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!currentEvent && gameLoading && (
            <View style={styles.loadingCard}>
              <View style={styles.loadingPulse} />
              <Text style={styles.loadingText}>Loading event details...</Text>
            </View>
          )}

          {currentEvent && (
            <Animated.View 
              style={[
                styles.eventCard,
                {
                  opacity: opacityAnim,
                  transform: [{ translateY: slideUpAnim }]
                }
              ]}
            >
              <LinearGradient
                colors={[Colors.gradient.accentStart, Colors.gradient.accentMid, Colors.gradient.accentEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.eventGradient}
              >
                <Image
                  source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qsqldepkdx2ld5bwrcdk' }}
                  style={styles.backgroundImage}
                />
                <View style={styles.eventHeader}>
                  <View style={[styles.nextEventPill, isHuntActive && styles.livePill]}>
                    <Text style={[styles.nextEventLabel, isHuntActive && styles.livePillText]}>
                      {isHuntActive ? 'LIVE NOW' : currentEvent?.status === 'completed' ? 'COMPLETED' : 'NEXT HUNT'}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.prizeContainer}
                    onPress={() => setShowPrizeModal(true)}
                    activeOpacity={0.7}
                  >
                    <Trophy color="#FFF" size={16} />
                    <Text style={styles.prizeAmount}>{'\u20AC'}{currentEvent.prize}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.citySection}>
                  <Text style={styles.cityLabel}>LOCATION</Text>
                  <Text style={styles.cityNameLarge}>AMSTERDAM</Text>
                  <View style={styles.cityMetaRow}>
                    <Text style={styles.cityFlag}>{'🇳🇱'}</Text>
                    <Text style={styles.cityCountry}>Netherlands</Text>
                  </View>
                  <Text style={styles.cityCoordinates}>52.37°N  4.88°E</Text>
                </View>

                {!!timeUntilEvent && !isHuntActive && (
                  <View style={styles.countdownContainer}>
                    <Text style={styles.countdownLabel}>
                      {currentEvent?.status === 'completed' ? 'STATUS' : 'STARTS IN'}
                    </Text>
                    <Text style={styles.countdownTime}>{timeUntilEvent}</Text>
                  </View>
                )}

                {isHuntActive && (
                  <View style={[styles.countdownContainer, styles.liveCountdownContainer]}>
                    <View style={styles.liveIndicatorRow}>
                      <View style={styles.liveIndicatorDot} />
                      <Text style={styles.liveIndicatorText}>HUNT IS ACTIVE</Text>
                    </View>
                    <Text style={styles.liveSubtext}>
                      {hasTicket ? 'Scroll down or tap below to join the hunt!' : 'Purchase a ticket to join the live hunt!'}
                    </Text>
                  </View>
                )}

                <View style={styles.eventDetails}>
                  <View style={styles.eventDateTimeRow}>
                    <View style={styles.eventDateTimeItem}>
                      <Clock color="rgba(255,255,255,0.7)" size={13} />
                      <Text style={styles.eventDateTimeText} numberOfLines={1}>SAT, JAN 18</Text>
                    </View>
                    <View style={styles.eventDateTimeDot} />
                    <View style={styles.eventDateTimeItem}>
                      <Zap color="rgba(255,255,255,0.7)" size={13} />
                      <Text style={styles.eventDateTimeText} numberOfLines={1}>12:00 PM CET</Text>
                    </View>
                    <View style={styles.eventDateTimeDivider} />
                    <TouchableOpacity
                      style={styles.addToCalendarButton}
                      onPress={handleAddToCalendar}
                      activeOpacity={0.7}
                    >
                      <CalendarPlus color={Colors.accent.primary} size={15} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.huntersRowContainer}>
                  <View style={styles.huntersRow}>
                    <Users color="#FFFFFF" size={14} />
                    <Text style={styles.huntersCount}>189</Text>
                    <Text style={styles.huntersLabel}>hunters registered</Text>
                  </View>
                </View>

                {!isLoggedIn && (
                  <TouchableOpacity 
                    style={styles.authRequiredContainer}
                    onPress={() => router.push('/signup')}
                    activeOpacity={0.8}
                  >
                    <LogIn color="#FFF" size={18} />
                    <Text style={styles.authRequiredText}>
                      Sign in to claim your ticket
                    </Text>
                    <ChevronRight color="rgba(255,255,255,0.6)" size={16} />
                  </TouchableOpacity>
                )}
                
                {!!rcPurchaseError && (
                  <View style={styles.errorContainer}>
                    <AlertCircle color={Colors.status.danger} size={16} />
                    <Text style={styles.errorText}>{rcPurchaseError}</Text>
                  </View>
                )}

                {hasTicket && !isHuntActive && (
                  <View style={styles.ticketClaimedSection}>
                    <View style={styles.ticketClaimedHeader}>
                      <View style={styles.ticketCheckmark}>
                        <Text style={styles.ticketCheckmarkText}>{'\u2713'}</Text>
                      </View>
                      <Text style={styles.ticketClaimedTitle}>TICKET CLAIMED</Text>
                    </View>
                    <Text style={styles.ticketClaimedText}>
                      Hunt starts at the scheduled time.
                    </Text>
                  </View>
                )}

                {hasTicket && isHuntActive && (
                  <TouchableOpacity
                    style={styles.joinHuntButton}
                    onPress={() => setJoinedLiveHunt(true)}
                    activeOpacity={0.8}
                  >
                    <Target color="#000" size={20} />
                    <Text style={styles.joinHuntButtonText}>JOIN LIVE HUNT</Text>
                    <ChevronRight color="#000" size={18} />
                  </TouchableOpacity>
                )}
              </LinearGradient>
            </Animated.View>
          )}
          
          {!hasTicket && currentEvent && (
            <Animated.View style={[styles.firstEventBannerContainer, { opacity: opacityAnim }]}>
              <View style={styles.firstEventBanner}>
                <Zap color={Colors.accent.primary} size={20} />
                <View style={styles.firstEventTextContainer}>
                  <Text style={styles.firstEventText}>{TICKET.currency} {TICKET.price.toFixed(2)} PER TICKET</Text>
                  <Text style={styles.firstEventSubtext}>One-time purchase. Includes all hunt features and prize eligibility.</Text>
                </View>
              </View>
            </Animated.View>
          )}
          
          {currentEvent && isLoggedIn && !hasTicket && (
            <Animated.View style={{ opacity: opacityAnim }}>
              <TouchableOpacity
                style={[
                  styles.ticketButton,
                  (!canPurchaseTicket || isLoading) && styles.ticketButtonDisabled
                ]}
                onPress={handlePurchaseTicket}
                disabled={!canPurchaseTicket || isLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.ticketButtonText}>
                  {isLoading || isPurchasing ? 'PROCESSING...' : `BUY TICKET - ${TICKET.currency} ${TICKET.price.toFixed(2)}`}
                </Text>
                {!isLoading && (
                  <ChevronRight color={'#000'} size={18} />
                )}
              </TouchableOpacity>
            </Animated.View>
          )}

          <View style={styles.howItWorks}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            
            <View style={styles.stepsContainer}>
              {[
                { num: '1', text: 'Create your secure account (one ticket per account)', icon: LogIn },
                { num: '2', text: `Purchase your ticket for \u20AC${TICKET.price.toFixed(2)}`, icon: Zap },
                { num: '3', text: 'Receive real-time clues during the live event', icon: Eye },
                { num: '4', text: 'Find the target first and claim the prize', icon: Trophy },
              ].map((step, i) => (
                <View key={step.num} style={styles.step}>
                  <View style={styles.stepIconContainer}>
                    <step.icon color={Colors.accent.primary} size={18} />
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepLabel}>STEP {step.num}</Text>
                    <Text style={styles.stepText}>{step.text}</Text>
                  </View>
                  {i < 3 && <View style={styles.stepConnector} />}
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
        
        <Modal
          visible={showPrizeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowPrizeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Prize Details</Text>
                <TouchableOpacity 
                  onPress={() => setShowPrizeModal(false)}
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCloseText}>{'\u2715'}</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.modalPrizeSection}>
                  <Trophy color={Colors.accent.primary} size={40} />
                  <Text style={styles.modalPrizeAmount}>{'\u20AC'}{currentEvent?.prize || '1000'}</Text>
                  <Text style={styles.modalPrizeSubtitle}>Cash Prize</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Prize Description</Text>
                  <Text style={styles.modalSectionText}>
                    {`The winner will receive \u20AC1,000 in cash, paid via bank transfer within 7 business days of verification. The prize is awarded to the first verified hunter who successfully locates and identifies the target during the live event.`}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>How to Win</Text>
                  <Text style={styles.modalSectionText}>
                    {`\u2022 Be the first to find the target person in the designated area\n\u2022 Take a photo or video as proof of discovery\n\u2022 Submit your verification through the app\n\u2022 Our team will verify your submission\n\u2022 Winner announced within 1 hour of hunt completion`}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Legal Terms</Text>
                  <Text style={styles.modalSectionText}>
                    {`\u2022 Participants must be 18 years or older\n\u2022 One prize per event, awarded to first verified winner\n\u2022 Prize cannot be transferred or exchanged for other goods\n\u2022 Winner must provide valid identification for verification\n\u2022 Tax obligations are the responsibility of the winner\n\u2022 Bounty reserves the right to disqualify any participant for rule violations\n\u2022 All participants must comply with local laws and regulations\n\u2022 Harassment or aggressive behavior will result in immediate disqualification\n\u2022 Prize payment subject to identity verification and fraud prevention checks`}
                  </Text>
                </View>

                <View style={[styles.modalSection, { borderBottomWidth: 0 }]}>
                  <Text style={styles.modalSectionTitle}>Important Notice</Text>
                  <Text style={styles.modalSectionText}>
                    By participating in this hunt, you agree to our Terms of Service and Privacy Policy. All decisions made by Bounty regarding winner verification are final. The hunt may be cancelled or postponed due to unforeseen circumstances, in which case full refunds will be provided.
                  </Text>
                </View>
              </ScrollView>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowPrizeModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonText}>Got It</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <Modal
          visible={showPaywall}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPaywall(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.paywallContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Get Your Ticket</Text>
                <TouchableOpacity
                  onPress={() => setShowPaywall(false)}
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCloseText}>{'\u2715'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.paywallBody}>
                <View style={styles.paywallPriceSection}>
                  <Target color={Colors.accent.primary} size={44} />
                  <Text style={styles.paywallPrice}>{'\u20AC'}{TICKET.price.toFixed(2)}</Text>
                  <Text style={styles.paywallPriceLabel}>One-time purchase</Text>
                </View>

                <View style={styles.paywallFeatures}>
                  {TICKET.features.map((feature, idx) => (
                    <View key={idx} style={styles.paywallFeatureRow}>
                      <View style={styles.paywallFeatureCheck}>
                        <Text style={styles.paywallFeatureCheckText}>{'\u2713'}</Text>
                      </View>
                      <Text style={styles.paywallFeatureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                {!!rcPurchaseError && (
                  <View style={styles.paywallError}>
                    <AlertCircle color={Colors.status.danger} size={16} />
                    <Text style={styles.paywallErrorText}>{rcPurchaseError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.paywallBuyButton,
                    (isPurchasing || isOfferingLoading) && styles.paywallBuyButtonDisabled,
                  ]}
                  onPress={handleConfirmPurchase}
                  disabled={isPurchasing || isOfferingLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.paywallBuyButtonText}>
                    {isPurchasing ? 'PROCESSING...' : isOfferingLoading ? 'LOADING...' : `PURCHASE FOR \u20AC${TICKET.price.toFixed(2)}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.paywallRestoreButton}
                  onPress={handleRestore}
                  disabled={isRestoring}
                  activeOpacity={0.7}
                >
                  <Text style={styles.paywallRestoreText}>
                    {isRestoring ? 'Restoring...' : 'Restore Previous Purchase'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
}

const C = Colors;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.dark.background,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 12,
  },
  heroIconRow: {
    marginBottom: 12,
  },
  heroBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 44,
    fontWeight: '900' as const,
    color: C.dark.text,
    letterSpacing: 6,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    color: C.dark.textSecondary,
    marginTop: 6,
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
  },
  eventCard: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  eventGradient: {
    padding: 24,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  nextEventPill: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  nextEventLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFF',
    letterSpacing: 1.5,
  },
  prizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  prizeAmount: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: '#FFF',
  },
  eventDetails: {
    marginBottom: 12,
    marginTop: 8,
  },
  eventDateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  eventDateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  eventDateTimeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  eventDateTimeDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 2,
  },
  addToCalendarButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDateTimeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
  },
  huntersRowContainer: {
    marginBottom: 8,
  },
  huntersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
  },
  huntersCount: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  huntersLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.85)',
  },
  citySection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
  },
  cityLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    marginBottom: 4,
  },
  cityNameLarge: {
    fontSize: 34,
    fontWeight: '900' as const,
    color: '#FFF',
    letterSpacing: 4,
    textAlign: 'center',
  },
  cityMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 4,
  },
  cityFlag: {
    fontSize: 16,
  },
  cityCountry: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.7)',
  },
  cityCoordinates: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  countdownContainer: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    marginBottom: 6,
  },
  countdownTime: {
    fontSize: 26,
    fontWeight: '900' as const,
    color: '#FFF',
    letterSpacing: 1,
  },
  authRequiredContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    gap: 10,
  },
  authRequiredText: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600' as const,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.status.dangerMuted,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: C.status.danger,
    fontWeight: '500' as const,
  },
  ticketClaimedSection: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  ticketClaimedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  ticketCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.status.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketCheckmarkText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  ticketClaimedTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFF',
    letterSpacing: 1,
  },
  ticketClaimedText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  firstEventBannerContainer: {
    marginBottom: 16,
  },
  firstEventBanner: {
    backgroundColor: C.accent.primaryMuted,
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  firstEventTextContainer: {
    flex: 1,
  },
  firstEventText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: C.accent.primary,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  firstEventSubtext: {
    fontSize: 13,
    color: C.dark.textSecondary,
    lineHeight: 18,
  },
  ticketButton: {
    backgroundColor: C.accent.primary,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ticketButtonDisabled: {
    backgroundColor: C.dark.card,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  ticketButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
  },
  ticketButtonTextDisabled: {
    color: C.dark.textMuted,
  },
  howItWorks: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginBottom: 20,
  },
  stepsContainer: {
    gap: 0,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative' as const,
    paddingBottom: 24,
  },
  stepIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: C.accent.primary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  stepText: {
    fontSize: 15,
    color: C.dark.textSecondary,
    lineHeight: 22,
  },
  stepConnector: {
    position: 'absolute',
    left: 19,
    top: 44,
    bottom: 4,
    width: 2,
    backgroundColor: C.dark.border,
  },
  huntHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.dark.border,
  },
  huntTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  huntTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  huntTitle: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: C.dark.text,
    letterSpacing: 2,
  },
  huntStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.status.successMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.status.success,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: C.status.success,
    letterSpacing: 1,
  },
  huntInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  huntLocation: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: C.dark.text,
    letterSpacing: 1,
  },
  huntTimeSeparator: {
    fontSize: 14,
    color: C.dark.textMuted,
  },
  huntTime: {
    fontSize: 14,
    color: C.dark.textSecondary,
  },
  cluesContainer: {
    flex: 1,
    padding: 20,
  },
  waitingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  waitingIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: C.dark.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  waitingText: {
    fontSize: 15,
    color: C.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  clueCard: {
    backgroundColor: C.dark.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.accent.primary,
  },
  clueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  clueNumberBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clueNumberText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: C.accent.primary,
  },
  clueTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timestampText: {
    fontSize: 12,
    color: C.dark.textMuted,
    fontWeight: '500' as const,
  },
  clueText: {
    fontSize: 15,
    color: C.dark.text,
    lineHeight: 23,
    marginBottom: 14,
  },
  clueActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accent.primaryMuted,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  mapButtonText: {
    fontSize: 13,
    color: C.accent.primary,
    fontWeight: '600' as const,
  },
  radiusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.dark.cardElevated,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 5,
  },
  radiusText: {
    fontSize: 11,
    color: C.dark.textMuted,
    fontWeight: '600' as const,
  },
  huntProgress: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.dark.border,
  },
  progressText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: C.dark.text,
    marginBottom: 4,
  },
  progressSubtext: {
    fontSize: 14,
    color: C.dark.textSecondary,
    textAlign: 'center',
  },
  newClueNotification: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: C.dark.card,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.accent.primary,
    shadowColor: C.accent.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    gap: 12,
  },
  notificationText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: C.accent.primary,
  },
  huntActions: {
    gap: 10,
  },
  distanceMeterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    position: 'relative',
    gap: 8,
  },
  distanceMeterButtonDisabled: {
    backgroundColor: C.dark.card,
  },
  distanceMeterButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#000',
    letterSpacing: 0.5,
  },
  distanceMeterButtonTextDisabled: {
    color: C.dark.textMuted,
  },
  oneTimeUseBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: C.status.danger,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: C.dark.background,
  },
  oneTimeUseText: {
    fontSize: 10,
    fontWeight: '900' as const,
    color: '#FFF',
  },
  distanceResult: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent.primaryMuted,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  distanceResultText: {
    fontSize: 18,
    fontWeight: '900' as const,
    color: C.accent.primary,
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: C.dark.surface,
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: C.dark.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.dark.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: C.dark.text,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: C.dark.textSecondary,
    fontWeight: '600' as const,
  },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalPrizeSection: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: C.dark.border,
    gap: 8,
  },
  modalPrizeAmount: {
    fontSize: 52,
    fontWeight: '900' as const,
    color: C.accent.primary,
    letterSpacing: 2,
  },
  modalPrizeSubtitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: C.dark.textMuted,
    letterSpacing: 1,
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.dark.border,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: C.dark.text,
    marginBottom: 10,
  },
  modalSectionText: {
    fontSize: 14,
    color: C.dark.textSecondary,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: C.accent.primary,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
    letterSpacing: 0.5,
  },
  errorCard: {
    backgroundColor: C.dark.card,
    borderRadius: 20,
    padding: 28,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  errorCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.status.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorCardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: C.dark.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorCardMessage: {
    fontSize: 14,
    color: C.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    maxWidth: 300,
  },
  retryButton: {
    backgroundColor: C.accent.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
    letterSpacing: 0.5,
  },
  loadingCard: {
    backgroundColor: C.dark.card,
    borderRadius: 20,
    padding: 40,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  loadingPulse: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.accent.primaryMuted,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 15,
    color: C.dark.textSecondary,
    fontWeight: '500' as const,
  },
  paywallContent: {
    backgroundColor: C.dark.surface,
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  paywallBody: {
    padding: 24,
  },
  paywallPriceSection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  paywallPrice: {
    fontSize: 48,
    fontWeight: '900' as const,
    color: C.accent.primary,
    letterSpacing: 2,
  },
  paywallPriceLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: C.dark.textMuted,
    letterSpacing: 1,
  },
  paywallFeatures: {
    gap: 14,
    marginBottom: 24,
  },
  paywallFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paywallFeatureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.status.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallFeatureCheckText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: C.status.success,
  },
  paywallFeatureText: {
    fontSize: 15,
    color: C.dark.text,
    flex: 1,
  },
  paywallError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.status.dangerMuted,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
  },
  paywallErrorText: {
    flex: 1,
    fontSize: 14,
    color: C.status.danger,
    fontWeight: '500' as const,
  },
  paywallBuyButton: {
    backgroundColor: C.accent.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  paywallBuyButtonDisabled: {
    backgroundColor: C.dark.card,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  paywallBuyButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
    letterSpacing: 0.8,
  },
  paywallRestoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  paywallRestoreText: {
    fontSize: 14,
    color: C.dark.textMuted,
    fontWeight: '500' as const,
  },
  livePill: {
    backgroundColor: 'rgba(139,0,0,0.35)',
  },
  livePillText: {
    color: '#C41E3A',
  },
  liveCountdownContainer: {
    borderColor: 'rgba(139,0,0,0.4)',
    backgroundColor: 'rgba(139,0,0,0.15)',
  },
  liveIndicatorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 6,
  },
  liveIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C41E3A',
  },
  liveIndicatorText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: '#FFF',
    letterSpacing: 2,
  },
  liveSubtext: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center' as const,
  },
  joinHuntButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: C.accent.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 16,
    gap: 10,
  },
  joinHuntButtonText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#000',
    letterSpacing: 1.5,
  },
  hintTokensBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: C.dark.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  hintTokensLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  hintTokensLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: C.dark.textSecondary,
  },
  hintTokensRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  hintTokenDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  hintTokenDotActive: {
    backgroundColor: C.accent.primary,
  },
  hintTokenDotUsed: {
    backgroundColor: C.dark.cardElevated,
    borderWidth: 1,
    borderColor: C.dark.borderLight,
  },
  hintTokenDotUsedText: {
    fontSize: 9,
    color: C.dark.textMuted,
    fontWeight: '700' as const,
  },
  hintRevealed: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  hintRevealedHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 6,
  },
  hintRevealedLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: C.accent.primaryLight,
    letterSpacing: 1.5,
  },
  hintRevealedText: {
    fontSize: 14,
    color: C.accent.primaryLight,
    lineHeight: 20,
    fontStyle: 'italic' as const,
  },
  hintLockedButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: C.dark.cardElevated,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: C.dark.borderLight,
    borderStyle: 'dashed' as const,
  },
  hintLockedText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: C.accent.primary,
    flex: 1,
  },
  hintLockedTextDisabled: {
    color: C.dark.textMuted,
  },
  hintTokenCost: {
    backgroundColor: C.accent.primaryMuted,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hintTokenCostText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: C.accent.primary,
  },
  hintModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 30,
  },
  hintModalContent: {
    backgroundColor: C.dark.surface,
    borderRadius: 24,
    padding: 28,
    width: '100%' as const,
    maxWidth: 340,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  hintModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 18,
  },
  hintModalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginBottom: 10,
    textAlign: 'center' as const,
  },
  hintModalDesc: {
    fontSize: 14,
    color: C.dark.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 21,
    marginBottom: 24,
  },
  hintModalActions: {
    flexDirection: 'row' as const,
    gap: 12,
    width: '100%' as const,
  },
  hintModalCancel: {
    flex: 1,
    backgroundColor: C.dark.card,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  hintModalCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: C.dark.textSecondary,
  },
  hintModalConfirm: {
    flex: 1,
    backgroundColor: C.accent.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 6,
  },
  hintModalConfirmText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#000',
  },
});
