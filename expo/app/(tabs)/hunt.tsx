import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Linking,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, AlertCircle, LogIn, Target, Crosshair, Navigation, ChevronRight, ChevronDown, CalendarDays, Zap, Trophy, Eye, Lightbulb, Lock, Unlock, ChevronUp, Users, Crown } from 'lucide-react-native';
import HunterRadar from '@/components/HunterRadar';
import RecapScreen from '@/components/RecapScreen';
import HuntHistory from '@/components/HuntHistory';
import PrizePoolGraphic from '@/components/PrizePoolGraphic';
import PrizePoolCelebration from '@/components/PrizePoolCelebration';
import { useHunterRadar } from '@/hooks/useHunterRadar';
import * as Calendar from 'expo-calendar';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventZoneMap from '@/components/EventZoneMap';
import ClueMedia from '@/components/ClueMedia';
import { buildPublicMediaUrl } from '@/lib/media-url';
import { useCompassHeading } from '@/hooks/useCompassHeading';
import { useGameStore } from '@/store/game-store';
import { useEventZone } from '@/hooks/useEventZone';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Colors from '@/constants/colors';

import { supabase } from '@/lib/supabase';
import ConnectModal from '@/components/ConnectModal';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { TICKET } from '@/constants/payment';
import { usePayment } from '@/contexts/PaymentContext';

/** Convert an ISO 3166-1 alpha-2 code to its flag emoji (empty when invalid or null). */
const flagEmoji = (code: string | null | undefined): string => {
  if (!code || !/^[a-zA-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
};

export default function HuntScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isLoggedIn = !!user;
  const { 
    currentEvent, 
    isLoading: gameLoading,
    purchaseError: _gamePurchaseError,
    eventError,
    refetchEvent,
    isEventFetching,
    refetchPool,
    nextEvent,
    nextEventLoading,
    nextEventReady,
    refetchNextEvent,
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

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchEvent(), refetchNextEvent(), refetchPool()]);
    } catch {
      // Individual queries surface their own error states.
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchEvent, refetchNextEvent, refetchPool]);
  const accentColor = currentEvent?.accentColor || '#FF6B00';

  const [hasTicket, setHasTicket] = useState<boolean>(false);
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const queryClient = useQueryClient();
  const [liveClues, setLiveClues] = useState<import('@/store/game-store').Clue[]>([]);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const opacityAnim = useMemo(() => new Animated.Value(0), []);
  const [distanceMeterUsed, setDistanceMeterUsed] = useState<boolean>(false);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState<boolean>(false);
  const [timeUntilEvent, setTimeUntilEvent] = useState<string>('');
  const [showPrizeModal, setShowPrizeModal] = useState<boolean>(false);
  const [celebration, setCelebration] = useState<{ previous: number; current: number; added: number; playerCount: number } | null>(null);
  const [joinedLiveHunt, setJoinedLiveHunt] = useState<boolean>(false);
  const [hintTokens, setHintTokens] = useState<number>(3);
  const [unlockedHints, setUnlockedHints] = useState<Set<string>>(new Set());
  const [showHintConfirm, setShowHintConfirm] = useState<string | null>(null);
  const [hintsHydrated, setHintsHydrated] = useState<boolean>(false);
  const [distanceHydrated, setDistanceHydrated] = useState<boolean>(false);
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [huntMenuOpen, setHuntMenuOpen] = useState<boolean>(false);
  const [showRecap, setShowRecap] = useState<boolean>(false);
  const [recapShownKey, setRecapShownKey] = useState<string | null>(null);
  const [connectionsCount, setConnectionsCount] = useState<number>(0);
  const [eventWinner, setEventWinner] = useState<{
    winnerUserId: string;
    winnerEmail: string | null;
    declaredAt: string;
  } | null>(null);
  const cluesScrollRef = useRef<ScrollView>(null);
  const prevEventStatusRef = useRef<string | null>(null);
  const countedConnectionsRef = useRef<Set<string>>(new Set());

  const hintStorageKey = currentEvent ? `hints:${currentEvent.id}` : null;
  const distanceStorageKey = currentEvent ? `distance:${currentEvent.id}` : null;

  useEffect(() => {
    let cancelled = false;
    if (!hintStorageKey) {
      setHintsHydrated(true);
      return;
    }
    setHintsHydrated(false);
    AsyncStorage.getItem(hintStorageKey)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { tokens?: number; unlocked?: string[]; savedAt?: string };
            // Admin hunt reset: if these stats were saved before the event was
            // last updated by the admin, they belong to the old hunt — discard.
            const savedAt = typeof parsed.savedAt === 'string' ? new Date(parsed.savedAt).getTime() : 0;
            const resetAt = currentEvent?.updatedAt ? new Date(currentEvent.updatedAt).getTime() : 0;
            if (savedAt > 0 && resetAt > 0 && savedAt < resetAt) {
              console.log('[Hunt] Discarding pre-reset hints (saved before admin reset)');
              AsyncStorage.removeItem(hintStorageKey).catch(() => {});
            } else {
              if (typeof parsed.tokens === 'number') setHintTokens(parsed.tokens);
              if (Array.isArray(parsed.unlocked)) setUnlockedHints(new Set(parsed.unlocked));
            }
          } catch {}
        }
        setHintsHydrated(true);
      })
      .catch(() => setHintsHydrated(true));
    return () => { cancelled = true; };
  }, [hintStorageKey, currentEvent?.updatedAt]);

  useEffect(() => {
    if (!hintsHydrated || !hintStorageKey) return;
    const payload = JSON.stringify({ tokens: hintTokens, unlocked: Array.from(unlockedHints), savedAt: new Date().toISOString() });
    AsyncStorage.setItem(hintStorageKey, payload).catch(() => {});
  }, [hintTokens, unlockedHints, hintStorageKey, hintsHydrated]);

  // Bug 1: Persist distance meter state across app restarts
  useEffect(() => {
    let cancelled = false;
    if (!distanceStorageKey) {
      setDistanceMeterUsed(false);
      setMeasuredDistance(null);
      setDistanceHydrated(true);
      return;
    }
    setDistanceHydrated(false);
    AsyncStorage.getItem(distanceStorageKey)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { used?: boolean; distance?: number | null; savedAt?: string };
            // Same reset check as hints: drop pre-reset distance meter state.
            const savedAt = typeof parsed.savedAt === 'string' ? new Date(parsed.savedAt).getTime() : 0;
            const resetAt = currentEvent?.updatedAt ? new Date(currentEvent.updatedAt).getTime() : 0;
            if (savedAt > 0 && resetAt > 0 && savedAt < resetAt) {
              console.log('[Hunt] Discarding pre-reset distance meter');
              AsyncStorage.removeItem(distanceStorageKey).catch(() => {});
            } else {
              if (typeof parsed.used === 'boolean') setDistanceMeterUsed(parsed.used);
              if (parsed.distance === null || typeof parsed.distance === 'number') setMeasuredDistance(parsed.distance ?? null);
            }
          } catch {}
        }
        setDistanceHydrated(true);
      })
      .catch(() => setDistanceHydrated(true));
    return () => { cancelled = true; };
  }, [distanceStorageKey, currentEvent?.updatedAt]);

  useEffect(() => {
    if (!distanceHydrated || !distanceStorageKey) return;
    const payload = JSON.stringify({ used: distanceMeterUsed, distance: measuredDistance, savedAt: new Date().toISOString() });
    AsyncStorage.setItem(distanceStorageKey, payload).catch(() => {});
  }, [distanceMeterUsed, measuredDistance, distanceStorageKey, distanceHydrated]);

  // Bug 3 & 4: When the event status transitions FROM 'completed' to another status,
  // or from live back to scheduled, the admin has reset the hunt — clear all local stats and clues.
  useEffect(() => {
    const currentStatus = currentEvent?.status ?? null;
    const prevStatus = prevEventStatusRef.current;
    const eventId = currentEvent?.id;

    const isCompletedReset = prevStatus === 'completed' && currentStatus && currentStatus !== 'completed';
    const isLiveReset = prevStatus === 'live' && currentStatus === 'scheduled';
    if ((isCompletedReset || isLiveReset) && eventId) {
      console.log('[Hunt] Event reset detected (completed → ' + currentStatus + ') — clearing local stats');
      setHintTokens(3);
      setUnlockedHints(new Set());
      setDistanceMeterUsed(false);
      setMeasuredDistance(null);
      setLiveClues([]);
      setConnectionsCount(0);
      setJoinedLiveHunt(false);
      setEventWinner(null);
      countedConnectionsRef.current = new Set();
      AsyncStorage.removeItem(`hints:${eventId}`).catch(() => {});
      AsyncStorage.removeItem(`distance:${eventId}`).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['live-clues', eventId] });
      void queryClient.invalidateQueries({ queryKey: ['player-connections', user?.id, eventId] });
      void queryClient.invalidateQueries({ queryKey: ['event-winner', eventId] });
    }

    prevEventStatusRef.current = currentStatus;
  }, [currentEvent?.status, currentEvent?.id, queryClient, user?.id]);

  // Fetch existing connections count for this event
  const connectionsQuery = useQuery({
    queryKey: ['player-connections', user?.id, currentEvent?.id],
    queryFn: async () => {
      if (!user || !currentEvent) return 0;
      const { count, error } = await supabase
        .from('player_connections')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', currentEvent.id)
        .or(`generator_user_id.eq.${user.id},scanner_user_id.eq.${user.id}`);
      if (error) {
        console.error('[Connect] Error fetching connections:', error.message);
        return 0;
      }
      return count ?? 0;
    },
    enabled: !!user && !!currentEvent && hasTicket,
    staleTime: 10000,
    refetchInterval: 30000,
  });

  useEffect(() => {
    setConnectionsCount(connectionsQuery.data ?? 0);
  }, [connectionsQuery.data]);

  // Fetch the event winner (if any) and subscribe to realtime INSERTs so the
  // banner appears on every player's screen the instant the bounty declares.
  const winnerQuery = useQuery({
    queryKey: ['event-winner', currentEvent?.id],
    queryFn: async () => {
      if (!currentEvent) return null;
      const { data, error } = await supabase
        .from('event_winners')
        .select('winner_user_id, winner_email, declared_at')
        .eq('event_id', currentEvent.id)
        .maybeSingle();
      if (error) {
        console.error('[Winner] Error fetching:', error.message);
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
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (winnerQuery.data) {
      setEventWinner(winnerQuery.data);
    }
  }, [winnerQuery.data]);

  // Realtime: event_winners INSERT + events UPDATE (status -> completed)
  useEffect(() => {
    if (!currentEvent) return;
    const channelName = `hunt-winner-${currentEvent.id}-${Date.now()}`;
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
          setEventWinner({
            winnerUserId: row.winner_user_id,
            winnerEmail: row.winner_email ?? null,
            declaredAt: row.declared_at,
          });
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
          void winnerQuery.refetch();
          void queryClient.invalidateQueries({ queryKey: ['current-event'] });
        },
      )
      .subscribe();

    return () => {
      void sub.unsubscribe();
    };
  }, [currentEvent, queryClient, winnerQuery]);

  const handleConnectionMade = useCallback(() => {
    setHintTokens(prev => prev + 1);
    void connectionsQuery.refetch();
  }, [connectionsQuery]);

  const {
    zone: eventZone,
    currentRadius: currentZoneRadius,
    bountyLocation: liveBountyLocation,
    isBountyActive,
  } = useEventZone(
    currentEvent?.id ?? null,
    !!hasTicket && !!user,
  );

  // Prefer the live bounty position (moving target) when available;
  // fall back to the zone center (static) otherwise.
  const bountyLocation = useMemo(() => {
    if (liveBountyLocation) {
      return {
        latitude: liveBountyLocation.latitude,
        longitude: liveBountyLocation.longitude,
      };
    }
    if (eventZone) {
      return {
        latitude: eventZone.centerLatitude,
        longitude: eventZone.centerLongitude,
      };
    }
    return null;
  }, [eventZone, liveBountyLocation]);


  useEffect(() => {
    if (!currentEvent) {
      opacityAnim.setValue(0);
      return;
    }
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [currentEvent, opacityAnim]);
  
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
  const canReceiveClues = !!hasTicket && !!currentEvent && !!user;

  // Hunter Radar — broadcast GPS and fetch nearby hunters during live hunt
  const radarEnabled = isLiveWithTicket && joinedLiveHunt;
  const { nearbyHunters, nearbyCount, isRefreshing: radarRefreshing } = useHunterRadar(
    currentEvent?.id ?? null,
    user?.id ?? null,
    radarEnabled,
  );
  const radarHeading = useCompassHeading(radarEnabled);

  // Auto-show recap when event transitions to completed with a winner (once per event)
  useEffect(() => {
    if (!currentEvent || currentEvent.status !== 'completed' || !eventWinner) return;
    const recapKey = `recap:${currentEvent.id}`;
    if (recapShownKey === recapKey) return;
    AsyncStorage.getItem(recapKey)
      .then((shown) => {
        if (!shown) {
          setShowRecap(true);
          setRecapShownKey(recapKey);
          AsyncStorage.setItem(recapKey, '1').catch(() => {});
        } else {
          setRecapShownKey(recapKey);
        }
      })
      .catch(() => {});
  }, [currentEvent, eventWinner, recapShownKey]);

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
      const mapped: import('@/store/game-store').Clue[] = (data || []).map((c: any) => {
        const mediaType = c.media_type || null;
        // Normalizes messy admin-stored paths (leading slashes, bucket prefix,
        // full storage URLs) into a valid public URL.
        const mediaUrl = c.media_url ? buildPublicMediaUrl(c.media_url as string) : null;
        if (c.media_url) console.log('[Clues] Media URL resolved:', c.media_url, '→', mediaUrl);
        return {
          id: c.id,
          text: c.clue_text || c.text || '',
          hint: c.hint,
          timestamp: c.release_time || c.created_at,
          order: c.order_number,
          imageUrl: mediaType === 'image' ? (mediaUrl ?? undefined) : undefined,
          videoUrl: mediaType === 'video' ? (mediaUrl ?? undefined) : undefined,
          audioUrl: mediaType === 'audio' ? (mediaUrl ?? undefined) : undefined,
        };
      });
      console.log('[Clues] Mapped clues with media:', mapped.map(c => ({ id: c.id, hasImage: !!c.imageUrl, hasVideo: !!c.videoUrl, hasAudio: !!c.audioUrl })));
      return mapped;
    },
    enabled: canReceiveClues,
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
  }, [cluesQuery.data, fadeAnim]);

  useEffect(() => {
    if (!currentEvent || !user || !hasTicket) return;
    
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clues',
          filter: `event_id=eq.${currentEvent.id}`,
        },
        (payload) => {
          console.log('[Clues] Realtime UPDATE received:', payload.new);
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
  }, [currentEvent, user, queryClient, hasTicket]);

  // Bug 6: Realtime subscription on player_connections so the QR *generator*
  // gets their bonus hint token when someone scans their code.
  // (The scanner already gets theirs via onConnectionMade in ConnectModal.)
  useEffect(() => {
    if (!currentEvent || !user || !hasTicket) return;

    const channelName = `player-connections-rt-${currentEvent.id}-${Date.now()}`;
    const sub = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_connections',
          filter: `event_id=eq.${currentEvent.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          // Only react if the current user is the generator (scanner gets hint via onConnectionMade)
          if (row.generator_user_id === user.id) {
            const connId = row.id as string;
            if (countedConnectionsRef.current.has(connId)) return;
            countedConnectionsRef.current.add(connId);
            console.log('[Connect] Generator received a connection — awarding bonus hint');
            setHintTokens(prev => prev + 1);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            void connectionsQuery.refetch();
          }
        },
      )
      .subscribe();

    return () => {
      void sub.unsubscribe();
    };
  }, [currentEvent, user, hasTicket, connectionsQuery]);
  
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

  const addHuntToCalendar = useCallback(async (opts: { title: string; location: string; startDate: Date }) => {
    try {
      const endDate = new Date(opts.startDate.getTime() + 4 * 60 * 60 * 1000);

      if (Platform.OS === 'web') {
        const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(opts.title)}&dates=${fmt(opts.startDate)}/${fmt(endDate)}&details=${encodeURIComponent('BOUNTY Urban Scavenger Hunt. Find the target and win!')}&location=${encodeURIComponent(opts.location)}`;
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
        title: opts.title,
        startDate: opts.startDate,
        endDate,
        location: opts.location,
        notes: 'BOUNTY Urban Scavenger Hunt. Find the target and win the prize!',
      });

      Alert.alert('Added to Calendar!', 'The hunt event has been added to your calendar.');
    } catch (error) {
      if (__DEV__) console.error('Error adding to calendar:', error);
      Alert.alert('Error', 'Failed to add the event to your calendar.');
    }
  }, []);

  const performAddToCalendar = useCallback(async () => {
    const startISO = currentEvent?.startTime;
    const startDate = startISO ? new Date(startISO) : null;
    if (!startDate || isNaN(startDate.getTime())) {
      Alert.alert(t('errNoEventScheduled'), t('errNoEventScheduledMsg'));
      return;
    }
    await addHuntToCalendar({
      title: `BOUNTY - ${currentEvent?.title || 'Urban Scavenger Hunt'}`,
      location: currentEvent?.city || '',
      startDate,
    });
  }, [addHuntToCalendar, currentEvent, t]);

  const handleNextHuntCalendar = useCallback(async () => {
    if (!nextEvent?.startISO) {
      Alert.alert(t('errNoEventScheduled'), t('errNoEventScheduledMsg'));
      return;
    }
    const startDate = new Date(nextEvent.startISO);
    if (isNaN(startDate.getTime())) {
      Alert.alert(t('errNoEventScheduled'), t('errNoEventScheduledMsg'));
      return;
    }
    await addHuntToCalendar({
      title: `BOUNTY - ${nextEvent.title}`,
      location: nextEvent.city,
      startDate,
    });
  }, [addHuntToCalendar, nextEvent, t]);

  const eventTimeZone = useMemo<string>(() => {
    const city = (currentEvent?.city || '').trim().toLowerCase();
    const map: Record<string, string> = {
      amsterdam: 'Europe/Amsterdam',
      rotterdam: 'Europe/Amsterdam',
      utrecht: 'Europe/Amsterdam',
      'the hague': 'Europe/Amsterdam',
      london: 'Europe/London',
      paris: 'Europe/Paris',
      berlin: 'Europe/Berlin',
      madrid: 'Europe/Madrid',
      barcelona: 'Europe/Madrid',
      rome: 'Europe/Rome',
      milan: 'Europe/Rome',
      lisbon: 'Europe/Lisbon',
      dublin: 'Europe/Dublin',
      brussels: 'Europe/Brussels',
      copenhagen: 'Europe/Copenhagen',
      stockholm: 'Europe/Stockholm',
      oslo: 'Europe/Oslo',
      helsinki: 'Europe/Helsinki',
      vienna: 'Europe/Vienna',
      zurich: 'Europe/Zurich',
      prague: 'Europe/Prague',
      warsaw: 'Europe/Warsaw',
      athens: 'Europe/Athens',
      istanbul: 'Europe/Istanbul',
      'new york': 'America/New_York',
      nyc: 'America/New_York',
      'los angeles': 'America/Los_Angeles',
      la: 'America/Los_Angeles',
      'san francisco': 'America/Los_Angeles',
      chicago: 'America/Chicago',
      miami: 'America/New_York',
      toronto: 'America/Toronto',
      vancouver: 'America/Vancouver',
      tokyo: 'Asia/Tokyo',
      seoul: 'Asia/Seoul',
      singapore: 'Asia/Singapore',
      'hong kong': 'Asia/Hong_Kong',
      bangkok: 'Asia/Bangkok',
      dubai: 'Asia/Dubai',
      sydney: 'Australia/Sydney',
      melbourne: 'Australia/Melbourne',
    };
    return map[city] || 'Europe/Amsterdam';
  }, [currentEvent?.city]);

  const formattedEventDateTime = useMemo(() => {
    const startISO = currentEvent?.startTime;
    if (!startISO) return 'TBA';
    const d = new Date(startISO);
    if (isNaN(d.getTime())) return 'TBA';
    try {
      return d.toLocaleString('en-GB', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: eventTimeZone,
        timeZoneName: 'short',
      });
    } catch {
      try {
        return d.toLocaleString('en-GB', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      } catch {
        return d.toString();
      }
    }
  }, [currentEvent?.startTime, eventTimeZone]);

  const handleDateTimePress = useCallback(() => {
    if (!currentEvent?.startTime) {
      Alert.alert(t('errNoEventScheduled'), t('errNoEventScheduledMsg'));
      return;
    }
    Alert.alert(
      t('addCalendarTitle'),
      t('addCalendarMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('add'), onPress: () => { void performAddToCalendar(); } },
      ]
    );
  }, [currentEvent, performAddToCalendar]);

  const handleDistanceMeter = async () => {
    if (distanceMeterUsed) {
      Alert.alert(t('meterAlreadyUsedTitle'), t('meterAlreadyUsedMsg'));
      return;
    }
    if (!bountyLocation) {
      Alert.alert(t('meterNoTargetTitle'), t('meterNoTargetMsg'));
      return;
    }

    setIsCalculatingDistance(true);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Needed',
          'Turn on location to measure your distance to the Bounty.'
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
        isBountyActive
          ? `You are ${Math.round(distance)}m from the Bounty. They're moving — this was their position just now.`
          : `You are ${Math.round(distance)} meters away from the Bounty!`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      if (__DEV__) console.error('Error getting location:', error);
      Alert.alert(
        'Couldn\'t Get Location',
        'Make sure location services are turned on in your device settings.'
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

  const handleClaimFreeTicket = async () => {
    if (!user || !currentEvent) return;
    const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { error } = await supabase
      .from('tickets')
      .insert({
        user_id: user.id,
        event_id: currentEvent.id,
        status: 'active',
        verification_code: verificationCode,
      });

    if (error) {
      console.error('[FreeTicket] Error inserting ticket:', error.message);
      Alert.alert('Error', 'Failed to claim ticket. Please try again.');
      return;
    }

    await ticketQuery.refetch();
    setCelebration({
      previous: currentEvent.prize,
      current: currentEvent.prize + currentEvent.prizePerTicket,
      added: currentEvent.prizePerTicket,
      playerCount: currentEvent.playerCount + 1,
    });
  };

  const handlePurchaseTicket = () => {
    if (!isLoggedIn) {
      router.push('/signup');
      return;
    }
    if (TICKET.isFree) {
      void handleClaimFreeTicket();
      return;
    }
    setShowPaywall(true);
  };

  const handleConfirmPurchase = async () => {
    // Snapshot the pool before this ticket lands so the celebration can
    // animate the exact amount this purchase adds.
    const previousPrize = currentEvent?.prize ?? 0;
    const perTicket = currentEvent?.prizePerTicket ?? 0;
    const prevPlayerCount = currentEvent?.playerCount ?? 0;

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
        const { error: ticketInsertError } = await supabase
          .from('tickets')
          .insert({
            user_id: user.id,
            event_id: currentEvent.id,
            status: 'active',
            verification_code: verificationCode,
          });
        if (ticketInsertError) {
          console.error('[Purchase] Ticket insert failed after successful purchase:', ticketInsertError.message);
          Alert.alert(
            'Purchase Saved — Ticket Not Activated',
            'Your purchase went through, but we could not activate your ticket automatically. Contact support@bounty.app with your receipt and we will fix it right away.',
            [{ text: 'OK' }],
          );
          await ticketQuery.refetch();
          return;
        }
      }

      await ticketQuery.refetch();

      setCelebration({
        previous: previousPrize,
        current: previousPrize + perTicket,
        added: perTicket,
        playerCount: prevPlayerCount + 1,
      });
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

  const scrollToZone = useCallback(() => {
    cluesScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

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
                <Text style={styles.huntTitle}>{t('liveHunt')}</Text>
              </View>
              <View style={styles.huntStatusPill}>
                <View style={styles.statusDotPulse} />
                <Text style={styles.statusPillText}>{t('active')}</Text>
              </View>
            </View>

            {/* Winner banner — shown to all players when a winner is declared */}
            {eventWinner && (
              <View style={styles.winnerBanner}>
                <View style={styles.winnerBannerTop}>
                  <Crown color={Colors.accent.primary} size={22} />
                  <Text style={styles.winnerBannerTitle}>{t('weHaveWinner')}</Text>
                </View>
                <Text style={styles.winnerBannerEmail} numberOfLines={1}>
                  {eventWinner.winnerEmail || 'A hunter'} found the bounty!
                </Text>
                {eventWinner.winnerUserId === user?.id ? (
                  <View style={styles.winnerYouBadge}>
                    <Trophy color="#000" size={12} />
                    <Text style={styles.winnerYouBadgeText}>THAT'S YOU — CONGRATS!</Text>
                  </View>
                ) : (
                  <Text style={styles.winnerBannerSubtext}>
                    The hunt has ended. Thanks for playing!
                  </Text>
                )}
              </View>
            )}
            
            <View style={styles.huntInfoRow}>
              <Text style={styles.huntLocation}>{currentEvent?.title || '—'}</Text>
              <Text style={styles.huntTimeSeparator}>|</Text>
              <Text style={styles.huntTime}>{formattedEventDateTime}</Text>
            </View>
            
            <View style={styles.hintTokensBar}>
              <View style={styles.hintTokensLeft}>
                <Lightbulb color={Colors.accent.primary} size={16} />
                <Text style={styles.hintTokensLabel}>{t('hintTokens')}</Text>
              </View>
              <View style={styles.hintTokensRight}>
                {Array.from({ length: Math.max(3, hintTokens) }).map((_, i) => (
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
              {huntMenuOpen && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.distanceMeterButton,
                      (distanceMeterUsed || isCalculatingDistance) && styles.distanceMeterButtonDisabled,
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
                      distanceMeterUsed && styles.distanceMeterButtonTextDisabled,
                    ]}>
                      {isCalculatingDistance ? t('calculating') :
                       distanceMeterUsed ? t('distanceMeterUsed') :
                       t('useDistanceMeter')}
                    </Text>
                    {!distanceMeterUsed && (
                      <View style={styles.oneTimeUseBadge}>
                        <Text style={styles.oneTimeUseText}>1x</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.connectButton}
                    onPress={() => setShowConnectModal(true)}
                    activeOpacity={0.8}
                  >
                    <Users color="#000" size={18} />
                    <Text style={styles.connectButtonText}>{t('connectWithHunters')}</Text>
                    {connectionsCount > 0 && (
                      <View style={styles.connectBadge}>
                        <Text style={styles.connectBadgeText}>{connectionsCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {measuredDistance !== null && (
                    <View style={styles.distanceResult}>
                      <Target color={Colors.accent.primary} size={16} />
                      <Text style={styles.distanceResultText}>
                        {t('metersAway', { n: measuredDistance })}
                      </Text>
                      {isBountyActive && (
                        <View style={styles.liveTrackingBadge}>
                          <View style={styles.liveTrackingDot} />
                          <Text style={styles.liveTrackingText}>{t('live')}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}

              <TouchableOpacity
                style={styles.toolsToggleArrow}
                onPress={() => setHuntMenuOpen((prev) => !prev)}
                activeOpacity={0.8}
              >
                <Text style={styles.toolsToggleLabel}>{t('huntTools')}</Text>
                <ChevronDown
                  color={Colors.accent.primary}
                  size={14}
                  style={{ transform: [{ rotate: huntMenuOpen ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>
            </View>
            
          </View>
          
          <ScrollView
            ref={cluesScrollRef}
            style={styles.cluesContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.accent.primary}
                colors={[Colors.accent.primary]}
              />
            }
          >
            {eventZone && currentZoneRadius !== null && (
              <View style={styles.zoneMapWrapper}>
                <View style={styles.zoneMapHeader}>
                  <Crosshair color={Colors.accent.primary} size={16} />
                  <Text style={styles.zoneMapHeaderText}>{t('huntZoneLabel')}</Text>
                  <View style={styles.zoneMapLiveDot} />
                </View>
                <EventZoneMap
                  centerLatitude={eventZone.centerLatitude}
                  centerLongitude={eventZone.centerLongitude}
                  radiusMeters={currentZoneRadius}
                  zoneName={eventZone.zoneName ?? undefined}
                />
              </View>
            )}

            {isLiveWithTicket && (
              <HunterRadar
                nearbyCount={nearbyCount}
                nearbyHunters={nearbyHunters}
                heading={radarHeading}
                isRefreshing={radarRefreshing}
              />
            )}
            {liveClues.length === 0 ? (
              <View style={styles.waitingContainer}>
                <View style={styles.waitingIconContainer}>
                  <Clock color={Colors.accent.primary} size={40} />
                </View>
                <Text style={styles.waitingTitle}>{t('waitingTitle')}</Text>
                <Text style={styles.waitingText}>
                  {t('waitingText')}
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
                        {new Date(clue.timestamp).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        })}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.clueText}>{clue.text}</Text>

                  <ClueMedia
                    imageUrl={clue.imageUrl}
                    videoUrl={clue.videoUrl}
                    audioUrl={clue.audioUrl}
                  />

                  {clue.hint && (
                    unlockedHints.has(clue.id) ? (
                      <View style={styles.hintRevealed}>
                        <View style={styles.hintRevealedHeader}>
                          <Lightbulb color={Colors.accent.primaryLight} size={14} />
                          <Text style={styles.hintRevealedLabel}>{t('hint')}</Text>
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

            {liveClues.length > 1 && (
              <TouchableOpacity
                style={styles.scrollToZoneButton}
                onPress={scrollToZone}
                activeOpacity={0.7}
              >
                <Crosshair color={Colors.accent.primary} size={16} />
                <Text style={styles.scrollToZoneText}>{t('backToHuntZone')}</Text>
                <ChevronUp color={Colors.accent.primary} size={16} />
              </TouchableOpacity>
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
            <Text style={styles.notificationText}>{t('newClueReceived')}</Text>
          </Animated.View>
        </LinearGradient>
        
        <RecapScreen
          visible={showRecap}
          onClose={() => setShowRecap(false)}
          winnerEmail={eventWinner?.winnerEmail ?? null}
          isWinner={eventWinner?.winnerUserId === user?.id}
          closestDistance={measuredDistance}
          cluesSolved={liveClues.length}
          connectionsMade={connectionsCount}
          hintTokensLeft={hintTokens}
          cityName={currentEvent?.city ?? ''}
        />

        <ConnectModal
          visible={showConnectModal}
          onClose={() => setShowConnectModal(false)}
          eventId={currentEvent?.id ?? ''}
          onConnectionMade={handleConnectionMade}
        />

        <Modal
          visible={showHintConfirm !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowHintConfirm(null)}
        >
          <View style={styles.hintModalOverlay}>
            <View style={styles.hintModalContent}>
              <View style={styles.hintModalIcon}>
                <Lightbulb color={Colors.accent.primary} size={36} />
              </View>
              <Text style={styles.hintModalTitle}>{t('hintModalTitle')}</Text>
              <View style={styles.hintModalTokenBadge}>
                <Text style={styles.hintModalTokenCount}>{hintTokens}</Text>
                <Text style={styles.hintModalTokenLabel}>{t('tokensLeft', { n: hintTokens })}</Text>
              </View>
              <Text style={styles.hintModalDesc}>
                {t('hintModalDesc')}
              </Text>
              <View style={styles.hintModalActions}>
                <TouchableOpacity
                  style={styles.hintModalCancel}
                  onPress={() => setShowHintConfirm(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.hintModalCancelText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.hintModalConfirm}
                  onPress={confirmUnlockHint}
                  activeOpacity={0.8}
                >
                  <Unlock color="#000" size={16} />
                  <Text style={styles.hintModalConfirmText}>{t('reveal')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
            <Text style={styles.tagline}>{t('tagline')}</Text>
          </View>

          {!currentEvent && !gameLoading && !!eventError && (
            <View style={styles.errorCard}>
              <View style={styles.errorCardIcon}>
                <AlertCircle color={Colors.status.danger} size={28} />
              </View>
              <Text style={styles.errorCardTitle}>{t('unableToLoadEvent')}</Text>
              <Text style={styles.errorCardMessage}>
                {eventError === 'Load failed' || eventError === 'Network request failed' || eventError === 'Failed to fetch'
                  ? t('errNoServer')
                  : t('errGenericEvent', { error: eventError })}
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => refetchEvent()}
                disabled={isEventFetching}
                activeOpacity={0.8}
              >
                <Text style={styles.retryButtonText}>
                  {isEventFetching ? t('retrying') : t('tryAgain')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!currentEvent && gameLoading && (
            <View style={styles.loadingCard}>
              <View style={styles.loadingPulse} />
              <Text style={styles.loadingText}>{t('loadingEventDetails')}</Text>
            </View>
          )}

          {currentEvent && (
            <Animated.View 
              style={[
                styles.eventCard,
                { opacity: opacityAnim }
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
                  <View style={[styles.nextEventPill, !isHuntActive && { backgroundColor: accentColor }, isHuntActive && styles.livePill]}>
                    <Text style={[styles.nextEventLabel, isHuntActive && styles.livePillText]}>
                      {isHuntActive ? t('liveNowPill') : currentEvent?.status === 'completed' ? t('completedPill') : t('nextHuntPill')}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.prizeContainer}
                    onPress={() => setShowPrizeModal(true)}
                    activeOpacity={0.7}
                  >
                    <Trophy color="#FFF" size={16} />
                    <Text style={styles.prizeAmount}>{'\u20AC'}{currentEvent.prize.toLocaleString('en-US')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.citySection}>
                  <Text style={styles.cityLabel}>{t('locationLabel')}</Text>
                  <View style={styles.cityTitleRow}>
                    {flagEmoji(currentEvent.country) ? (
                      <Text style={styles.cityFlag}>{flagEmoji(currentEvent.country)}</Text>
                    ) : null}
                    <Text style={styles.cityNameLarge} numberOfLines={2}>{currentEvent.title}</Text>
                  </View>
                </View>

                {!!timeUntilEvent && !isHuntActive && (
                  <View style={styles.countdownContainer}>
                    <Text style={styles.countdownLabel}>
                      {currentEvent?.status === 'completed' ? t('statusCountdownLabel') : t('startsIn')}
                    </Text>
                    <Text style={styles.countdownTime}>{timeUntilEvent}</Text>
                  </View>
                )}

                {isHuntActive && (
                  <View style={[styles.countdownContainer, styles.liveCountdownContainer]}>
                    <View style={styles.liveIndicatorRow}>
                      <View style={styles.liveIndicatorDot} />
                      <Text style={styles.liveIndicatorText}>{t('huntIsActive')}</Text>
                    </View>
                    <Text style={styles.liveSubtext}>
                      {hasTicket ? t('liveSubWithTicket') : t('liveSubNoTicket')}
                    </Text>
                  </View>
                )}

                <View style={styles.eventDetails}>
                  <TouchableOpacity
                    style={styles.eventDateTimeRow}
                    onPress={handleDateTimePress}
                    activeOpacity={0.7}
                    testID="event-datetime-add-calendar"
                  >
                    <View style={styles.eventDateTimeItem}>
                      <Clock color="rgba(255,255,255,0.7)" size={13} />
                      <Text style={styles.eventDateTimeText} numberOfLines={1}>{formattedEventDateTime}</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {!isLoggedIn && (
                  <TouchableOpacity 
                    style={styles.authRequiredContainer}
                    onPress={() => router.push('/signup')}
                    activeOpacity={0.8}
                  >
                    <LogIn color="#FFF" size={18} />
                    <Text style={styles.authRequiredText}>
                      {t('signupToClaim')}
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
                      <Text style={styles.ticketClaimedTitle}>{t('ticketClaimedTitle')}</Text>
                    </View>
                    <Text style={styles.ticketClaimedText}>
                      {t('ticketClaimedText')}
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
                    <Text style={styles.joinHuntButtonText}>{t('joinLiveHunt')}</Text>
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
                  <Text style={styles.firstEventText}>{TICKET.isFree ? t('free') : t('pricePerTicket', { price: `${TICKET.currency} ${TICKET.price.toFixed(2)}` })}</Text>
                  <Text style={styles.firstEventSubtext}>{TICKET.isFree ? t('firstEventFreeSub') : t('firstEventPaidSub')}</Text>
                </View>
              </View>
            </Animated.View>
          )}
          
          {currentEvent && isLoggedIn && !hasTicket && (
            <Animated.View style={{ opacity: opacityAnim }}>
              <TouchableOpacity
                style={[
                  styles.ticketButton,
                  { backgroundColor: accentColor },
                  (!canPurchaseTicket || isLoading) && styles.ticketButtonDisabled
                ]}
                onPress={handlePurchaseTicket}
                disabled={!canPurchaseTicket || isLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.ticketButtonText}>
                  {isLoading || isPurchasing
                    ? t('processing')
                    : TICKET.isFree
                    ? t('claimTicket')
                    : t('buyTicketWithPrice', { price: offering?.availablePackages?.[0]?.product?.priceString ?? `${TICKET.currency} ${TICKET.price.toFixed(2)}` })}
                </Text>
                {!isLoading && (
                  <ChevronRight color={'#000'} size={18} />
                )}
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Next Hunt preview — the soonest scheduled hunt coming up */}
          {nextEvent && currentEvent?.status === 'completed' && nextEvent.id !== currentEvent.id && (
            <View
              style={[
                styles.nextHuntCard,
                { borderColor: nextEvent.accentColor || '#FF6B00', shadowColor: nextEvent.accentColor || '#FF6B00' },
              ]}
            >
              <View style={[styles.nextHuntPill, { backgroundColor: nextEvent.accentColor || '#FF6B00' }]}>
                <Text style={styles.nextHuntPillText}>{t('nextHuntPill')}</Text>
              </View>
              <View style={styles.nextHuntTitleRow}>
                {flagEmoji(nextEvent.country) ? (
                  <Text style={styles.nextHuntFlag}>{flagEmoji(nextEvent.country)}</Text>
                ) : null}
                <Text style={styles.nextHuntTitle} numberOfLines={2}>{nextEvent.city}</Text>
              </View>
              {!!nextEvent.dateLabel && (
                <View style={styles.nextHuntDateTimeRow}>
                  <Clock color="rgba(255,255,255,0.6)" size={13} />
                  <Text style={styles.nextHuntDateTimeText}>
                    {nextEvent.dateLabel}{nextEvent.timeLabel ? ` • ${nextEvent.timeLabel}` : ''}
                  </Text>
                </View>
              )}
              {!!nextEvent.startISO && (
                <TouchableOpacity
                  style={[styles.nextHuntCta, { borderColor: nextEvent.accentColor || '#FF6B00' }]}
                  onPress={handleNextHuntCalendar}
                  activeOpacity={0.8}
                >
                  <CalendarDays color={nextEvent.accentColor || '#FF6B00'} size={16} />
                  <Text style={[styles.nextHuntCtaText, { color: nextEvent.accentColor || '#FF6B00' }]}>
                    {t('addToCalendar')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {nextEventReady && !nextEvent && !nextEventLoading && (!currentEvent || currentEvent.status === 'completed') && (
            <View style={styles.noHuntsCard}>
              <Target color={Colors.dark.textMuted} size={22} />
              <Text style={styles.noHuntsText}>{t('noUpcomingHunts')}</Text>
            </View>
          )}

          <View style={styles.howItWorks}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <View>
                <Text style={styles.sectionTitle}>{t('theHunt')}</Text>
                <Text style={styles.sectionSubtitle}>{t('fourSteps')}</Text>
              </View>
            </View>
            
            <View style={styles.stepsContainer}>
              {[
                { num: '01', title: t('step1Title'), text: t('step1Text'), icon: LogIn },
                { num: '02', title: t('step2Title'), text: TICKET.isFree ? t('step2TextFree') : t('step2TextPaid', { price: TICKET.price.toFixed(2) }), icon: Zap },
                { num: '03', title: t('step3Title'), text: t('step3Text'), icon: Eye },
                { num: '04', title: t('step4Title'), text: t('step4Text'), icon: Trophy },
              ].map((step, i) => (
                <View key={step.num} style={styles.stepCard}>
                  <View style={styles.stepNumberWatermark}>
                    <Text style={styles.stepNumberWatermarkText}>{step.num}</Text>
                  </View>
                  <View style={styles.stepIconContainer}>
                    <step.icon color={Colors.accent.primary} size={20} />
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepText}>{step.text}</Text>
                  </View>
                  {i < 3 && <View style={styles.stepConnectorDot} />}
                </View>
              ))}
            </View>
          </View>

          {isLoggedIn && (
            <HuntHistory userId={user?.id ?? null} />
          )}

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
                <Text style={styles.modalTitle}>{t('prizeDetailsTitle')}</Text>
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
                  <PrizePoolGraphic size={170} />
                  <Text style={styles.modalPrizeLive}>{t('prizePoolLive')}</Text>
                  <Text style={styles.modalPrizeAmount}>
                    {'\u20AC'}{(currentEvent?.prize ?? 0).toLocaleString('en-US')}
                  </Text>
                  <Text style={styles.modalPrizeHunters}>
                    {t('huntersJoined', { count: String(currentEvent?.playerCount ?? 0) })}
                  </Text>
                  <View style={styles.poolBreakdown}>
                    <View style={styles.poolBreakdownRow}>
                      <Text style={styles.poolBreakdownLabel}>{t('poolStarting')}</Text>
                      <Text style={styles.poolBreakdownValue}>{`\u20AC${currentEvent?.prizeBase ?? 0}`}</Text>
                    </View>
                    <View style={[styles.poolBreakdownRow, { borderBottomWidth: 0 }]}>
                      <Text style={styles.poolBreakdownLabel}>
                        {t('poolPerTicket', { amount: `\u20AC${currentEvent?.prizePerTicket ?? 0}` })}
                      </Text>
                      <Text style={styles.poolBreakdownValue}>{`+\u20AC${currentEvent?.prizePerTicket ?? 0}`}</Text>
                    </View>
                  </View>
                  <Text style={styles.modalPrizeSubtitle}>{t('cashPrize')}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{t('prizeDescriptionTitle')}</Text>
                  <Text style={styles.modalSectionText}>
                    {t('prizeDescriptionText')}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{t('howToWinTitle')}</Text>
                  <Text style={styles.modalSectionText}>
                    {t('howToWinText')}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{t('legalTermsTitle')}</Text>
                  <Text style={styles.modalSectionText}>
                    {t('legalTermsText')}
                  </Text>
                </View>

                <View style={[styles.modalSection, { borderBottomWidth: 0 }]}>
                  <Text style={styles.modalSectionTitle}>{t('importantNoticeTitle')}</Text>
                  <Text style={styles.modalSectionText}>
                    {t('importantNoticeText')}
                  </Text>
                </View>
              </ScrollView>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowPrizeModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonText}>{t('gotIt')}</Text>
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
                <Text style={styles.modalTitle}>{t('getYourTicket')}</Text>
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
                  <Text style={styles.paywallPrice}>{offering?.availablePackages?.[0]?.product?.priceString ?? `\u20AC${TICKET.price.toFixed(2)}`}</Text>
                  <Text style={styles.paywallPriceLabel}>{t('oneTimePurchase')}</Text>
                </View>

                <View style={styles.paywallPoolRow}>
                  <PrizePoolGraphic size={56} animated={false} />
                  <Text style={styles.paywallPoolText}>
                    {t('paywallPoolRow', {
                      pool: `\u20AC${(currentEvent?.prize ?? 0).toLocaleString('en-US')}`,
                      add: `\u20AC${currentEvent?.prizePerTicket ?? 0}`,
                    })}
                  </Text>
                </View>

                <View style={styles.paywallFeatures}>
                  {[t('ticketFeature1'), t('ticketFeature2'), t('ticketFeature3'), t('ticketFeature4')].map((feature, idx) => (
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
                    {isPurchasing
                      ? t('processing')
                      : isOfferingLoading
                      ? t('loading')
                      : t('purchaseFor', { price: offering?.availablePackages?.[0]?.product?.priceString ?? `\u20AC${TICKET.price.toFixed(2)}` })}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.paywallRestoreButton}
                  onPress={handleRestore}
                  disabled={isRestoring}
                  activeOpacity={0.7}
                >
                  <Text style={styles.paywallRestoreText}>
                    {isRestoring ? t('restoring') : t('restorePrevious')}
                  </Text>
                </TouchableOpacity>

                <View style={styles.paywallLegalRow}>
                  <TouchableOpacity onPress={() => Linking.openURL('https://bounty.app/terms')} activeOpacity={0.7}>
                    <Text style={styles.paywallLegalLink}>{t('termsOfService')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.paywallLegalDot}>{'\u2022'}</Text>
                  <TouchableOpacity onPress={() => Linking.openURL('https://bounty.app/privacy')} activeOpacity={0.7}>
                    <Text style={styles.paywallLegalLink}>{t('privacyPolicy')}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.paywallLegalNote}>
                  {t('chargedTo', { account: Platform.OS === 'ios' ? t('appleId') : t('googleAccount') })}
                </Text>
              </View>
            </View>
          </View>
        </Modal>

        <PrizePoolCelebration
          visible={!!celebration}
          onClose={() => setCelebration(null)}
          previousPrize={celebration?.previous ?? 0}
          newPrize={celebration?.current ?? 0}
          addedAmount={celebration?.added ?? 0}
          playerCount={celebration?.playerCount ?? 0}
        />
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
    padding: 22,
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
    marginBottom: 16,
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
    marginBottom: 4,
    marginTop: 4,
  },
  eventDateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
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
    marginBottom: 18,
    paddingVertical: 8,
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
  cityTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    marginTop: 4,
  },
  cityFlag: {
    fontSize: 20,
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
  nextHuntCard: {
    backgroundColor: C.dark.card,
    borderWidth: 2,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  nextHuntPill: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  nextHuntPillText: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: '#FFF',
    letterSpacing: 1.5,
  },
  nextHuntTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 12,
  },
  nextHuntFlag: {
    fontSize: 22,
  },
  nextHuntTitle: {
    fontSize: 26,
    fontWeight: '900' as const,
    color: C.dark.text,
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  nextHuntDateTimeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start' as const,
    marginBottom: 14,
  },
  nextHuntDateTimeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.3,
  },
  nextHuntCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
  },
  nextHuntCtaText: {
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  noHuntsCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: C.dark.card,
    borderWidth: 1,
    borderColor: C.dark.border,
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 20,
  },
  noHuntsText: {
    fontSize: 14,
    color: C.dark.textMuted,
    fontWeight: '600' as const,
  },
  howItWorks: {
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    marginBottom: 24,
  },
  sectionAccent: {
    width: 4,
    height: 44,
    borderRadius: 2,
    backgroundColor: C.accent.primary,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '900' as const,
    color: C.dark.text,
    letterSpacing: 1,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: C.dark.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  stepsContainer: {
    gap: 12,
  },
  stepCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: C.dark.card,
    borderRadius: 16,
    padding: 18,
    position: 'relative' as const,
    borderWidth: 1,
    borderColor: C.dark.border,
    overflow: 'hidden',
  },
  stepNumberWatermark: {
    position: 'absolute' as const,
    top: -8,
    right: -4,
  },
  stepNumberWatermarkText: {
    fontSize: 64,
    fontWeight: '900' as const,
    color: 'rgba(245, 158, 11, 0.06)',
    letterSpacing: -2,
  },
  stepIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  stepText: {
    fontSize: 14,
    color: C.dark.textSecondary,
    lineHeight: 21,
  },
  stepConnectorDot: {
    position: 'absolute' as const,
    left: 38,
    bottom: -7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.dark.borderLight,
    zIndex: 1,
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
  // Winner banner (live hunt)
  winnerBanner: {
    backgroundColor: C.accent.primaryMuted,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    marginBottom: 14,
    alignItems: 'center',
  },
  winnerBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  winnerBannerTitle: {
    fontSize: 13,
    fontWeight: '900' as const,
    color: C.accent.primary,
    letterSpacing: 1.5,
  },
  winnerBannerEmail: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: C.dark.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  winnerBannerSubtext: {
    fontSize: 13,
    color: C.dark.textSecondary,
    textAlign: 'center',
  },
  winnerYouBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.accent.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  winnerYouBadgeText: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: '#000',
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
  zoneMapWrapper: {
    marginBottom: 18,
  },
  zoneMapHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  zoneMapHeaderText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: C.dark.text,
    letterSpacing: 2,
  },
  zoneMapLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.status.success,
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
  scrollToZoneButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.18)',
  },
  scrollToZoneText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: C.accent.primary,
    letterSpacing: 0.5,
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
  liveTrackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 4,
  },
  liveTrackingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.status.success,
  },
  liveTrackingText: {
    fontSize: 10,
    fontWeight: '900' as const,
    color: C.status.success,
    letterSpacing: 1,
  },
  connectButton: {
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
  connectButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#000',
    letterSpacing: 0.5,
  },
  connectBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: C.accent.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: C.dark.background,
    minWidth: 20,
    alignItems: 'center',
  },
  connectBadgeText: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: '#000',
  },
  toolsToggleArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  toolsToggleLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: C.accent.primary,
    letterSpacing: 0.3,
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
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: C.dark.border,
    gap: 6,
  },
  modalPrizeLive: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: '#FFD54A',
    letterSpacing: 3,
    marginTop: 4,
  },
  modalPrizeHunters: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: C.dark.textSecondary,
  },
  poolBreakdown: {
    marginTop: 14,
    width: '100%' as const,
    backgroundColor: C.dark.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.dark.border,
    overflow: 'hidden' as const,
  },
  poolBreakdownRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.dark.border,
  },
  poolBreakdownLabel: {
    fontSize: 13,
    color: C.dark.textMuted,
    fontWeight: '600' as const,
    flex: 1,
  },
  poolBreakdownValue: {
    fontSize: 14,
    color: C.dark.text,
    fontWeight: '800' as const,
  },
  paywallPoolRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: 'rgba(255,213,74,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,213,74,0.25)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  paywallPoolText: {
    flex: 1,
    fontSize: 13,
    color: C.dark.textSecondary,
    lineHeight: 18,
    fontWeight: '600' as const,
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
  paywallLegalRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 4,
  },
  paywallLegalLink: {
    fontSize: 12,
    color: C.accent.primary,
    fontWeight: '600' as const,
  },
  paywallLegalDot: {
    fontSize: 12,
    color: C.dark.textMuted,
  },
  paywallLegalNote: {
    fontSize: 11,
    color: C.dark.textMuted,
    textAlign: 'center' as const,
    marginTop: 8,
    paddingHorizontal: 16,
    lineHeight: 16,
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
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  hintModalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  hintModalTokenBadge: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginBottom: 14,
    backgroundColor: C.dark.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  hintModalTokenCount: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: C.accent.primary,
  },
  hintModalTokenLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: C.dark.textSecondary,
  },
  hintModalDesc: {
    fontSize: 14,
    color: C.dark.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 21,
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  hintModalActions: {
    flexDirection: 'row' as const,
    gap: 10,
    width: '100%' as const,
  },
  hintModalCancel: {
    flex: 1,
    backgroundColor: C.dark.card,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  hintModalCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: C.dark.textSecondary,
  },
  hintModalConfirm: {
    flex: 1,
    backgroundColor: C.accent.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: 7,
  },
  hintModalConfirmText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
  },
});
