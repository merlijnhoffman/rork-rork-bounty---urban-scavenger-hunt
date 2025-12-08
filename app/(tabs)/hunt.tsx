import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Animated,

  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Users, AlertCircle, CreditCard, LogIn, Target, MapPin, Play, Pause, Crosshair, Navigation } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import HuntMap from '@/components/HuntMap';
import { useGameStore, Clue } from '@/store/game-store';
import { useAuth } from '@/contexts/AuthContext';

import { supabase } from '@/lib/supabase';

import StripePayment from '@/components/StripePayment';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { TICKET } from '@/constants/payment';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});


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
    purchaseError
  } = useGameStore();
  
  const [showPayment, setShowPayment] = useState<boolean>(false);
  const [hasTicket, setHasTicket] = useState<boolean>(false);
  const [isHuntActive, setIsHuntActive] = useState<boolean>(false);
  const [liveClues, setLiveClues] = useState<Clue[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [selectedClueForMap, setSelectedClueForMap] = useState<ClueWithLocation | null>(null);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const slideUpAnim = useMemo(() => new Animated.Value(50), []);
  const opacityAnim = useMemo(() => new Animated.Value(0), []);
  const [distanceMeterUsed, setDistanceMeterUsed] = useState<boolean>(false);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] = useState<boolean>(false);
  const [timeUntilEvent, setTimeUntilEvent] = useState<string>('');
  
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
      const now = new Date();
      const eventStart = new Date('2026-01-18T12:00:00');
      const diff = eventStart.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeUntilEvent('Event is live!');
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
  }, []);
  
  useEffect(() => {
    const requestNotificationPermissions = async () => {
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
    
    requestNotificationPermissions();
  }, []);
  
  const sendClueNotification = useCallback(async (clue: Clue) => {
    if (!notificationPermission) {
      console.log('Notification permission not granted');
      return;
    }
    
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎯 New Clue Received!',
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
  
  const mockClues: ClueWithLocation[] = [
    {
      id: '1',
      text: 'BOUNTY SPOTTED: Wearing a bright red jacket and black baseball cap. Last seen heading towards the central square area. They were carrying a blue backpack and stopped to check their phone near a large monument.',
      timestamp: new Date().toISOString(),
      order: 1,
      location: {
        latitude: 52.3731,
        longitude: 4.8922,
        radius: 500,
        name: 'Dam Square Area',
      },
    },
    {
      id: '2', 
      text: 'UPDATE: The bounty was seen 5 minutes ago walking south. Still wearing the red jacket. Witnesses report they stopped at a coffee shop with outdoor seating. Look for someone with a blue backpack sitting alone.',
      timestamp: new Date(Date.now() + 5 * 60000).toISOString(),
      order: 2,
      location: {
        latitude: 52.3580,
        longitude: 4.8810,
        radius: 300,
        name: 'Museum District',
      },
    },
    {
      id: '3',
      text: 'FRESH SIGHTING: Bounty spotted near the flower market! They removed their red jacket - now wearing a white t-shirt underneath. Still has the black cap and blue backpack. Moving slowly, checking their phone frequently.',
      timestamp: new Date(Date.now() + 10 * 60000).toISOString(),
      order: 3,
      location: {
        latitude: 52.3676,
        longitude: 4.8913,
        radius: 150,
        name: 'Bloemenmarkt',
      },
    },
    {
      id: '4',
      text: 'FINAL LOCATION: Bounty confirmed heading north! White t-shirt, black cap, blue backpack. They were seen entering a historic building with a long queue outside. Move fast - they\'re on the move!',
      timestamp: new Date(Date.now() + 15 * 60000).toISOString(),
      order: 4,
      location: {
        latitude: 52.3752,
        longitude: 4.8840,
        radius: 50,
        name: 'Anne Frank House',
      },
    },
  ];
  
  const ticketQuery = useQuery({
    queryKey: ['ticket-status', user?.id, currentEvent?.id],
    queryFn: async () => {
      if (!user || !currentEvent) {
        return { hasTicket: false };
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
  
  useEffect(() => {
    if (!hasTicket || !currentEvent || !user) return;
    
    const subscription = supabase
      .channel('clues')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clues',
          filter: `event_id=eq.${currentEvent.id}`,
        },
        (payload) => {
          console.log('New clue received:', payload.new);
          const newClue: Clue = {
            id: payload.new.id,
            text: payload.new.text,
            hint: payload.new.hint,
            timestamp: payload.new.release_time,
            order: payload.new.order_number,
          };
          
          setLiveClues(prev => {
            const exists = prev.find(c => c.id === newClue.id);
            if (exists) return prev;
            return [...prev, newClue].sort((a, b) => a.order - b.order);
          });
          
          sendClueNotification(newClue);
          
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
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [hasTicket, currentEvent, user, fadeAnim, sendClueNotification]);
  
  const startSimulation = () => {
    setIsSimulating(true);
    setIsHuntActive(true);
    setLiveClues([]);
    
    mockClues.forEach((clue, index) => {
      setTimeout(() => {
        setLiveClues(prev => [...prev, clue]);
        
        sendClueNotification(clue);
        
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
      }, index * 8000);
    });
  };
  
  const stopSimulation = () => {
    setIsSimulating(false);
    setIsHuntActive(false);
    setLiveClues([]);
    setDistanceMeterUsed(false);
    setMeasuredDistance(null);
  };
  
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };
  
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
        '📍 Distance Measured',
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
    if (ticketQuery.data) {
      setHasTicket(ticketQuery.data.hasTicket);
    }
  }, [ticketQuery.data, user]);
  

  
  const canPurchaseTicket = isLoggedIn && !hasTicket && !ticketQuery.isLoading;
  const isLoading = gameLoading || (ticketQuery.isLoading && !ticketQuery.isFetched);
  
  const isEventLive = useMemo(() => {
    if (!currentEvent) return false;
    const now = new Date();
    const eventStart = new Date(currentEvent.startTime);
    const eventEnd = new Date(eventStart.getTime() + 3 * 60 * 60 * 1000);
    return now >= eventStart && now <= eventEnd;
  }, [currentEvent]);
  
  const shouldShowHunt = hasTicket && (isHuntActive || isSimulating);

  const handleClaimFreeTicket = async () => {
    if (!user || !currentEvent) {
      console.error('Missing user or event data');
      Alert.alert('Error', 'Session expired. Please try again.');
      return;
    }

    try {
      const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          user_id: user.id,
          event_id: currentEvent.id,
          status: 'active',
          verification_code: verificationCode,
        })
        .select()
        .single();
      
      if (error) {
        const errorMessage = error.message || error.toString() || 'Unknown error occurred';
        console.error('Error creating ticket:', errorMessage);
        Alert.alert('Error', `Failed to claim ticket: ${errorMessage}`);
        return;
      }
      
      console.log('Free ticket claimed successfully:', ticket.id);
      
      await ticketQuery.refetch();
      
      Alert.alert(
        '🎉 Free Ticket Claimed!',
        'Welcome to the first hunt! This event is FREE for early supporters. Check your profile for your verification code.',
        [
          {
            text: 'View Profile',
            onPress: () => router.push('/(tabs)/profile'),
          },
          {
            text: 'OK',
          },
        ]
      );
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error claiming free ticket:', errorMessage);
      Alert.alert('Error', `Failed to claim ticket: ${errorMessage}`);
    }
  };

  const handlePurchaseTicket = () => {
    if (!isLoggedIn) {
      router.push('/signup');
      return;
    }
    
    if (TICKET.isFree) {
      handleClaimFreeTicket();
    } else {
      setShowPayment(true);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    console.log('Payment successful:', paymentIntentId);
    
    if (!user || !currentEvent) {
      console.error('Missing user or event data');
      Alert.alert('Error', 'Session expired. Please try again.');
      return;
    }

    try {
      const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          user_id: user.id,
          event_id: currentEvent.id,
          status: 'active',
          verification_code: verificationCode,
        })
        .select()
        .single();
      
      if (error) {
        const errorMessage = error.message || error.toString() || 'Unknown error occurred';
        console.error('Error creating ticket:', errorMessage);
        Alert.alert('Error', `Failed to create ticket: ${errorMessage}. Please contact support with payment ID: ${paymentIntentId}`);
        return;
      }
      
      console.log('Ticket created successfully:', ticket.id);
      
      await ticketQuery.refetch();
      
      Alert.alert(
        '🎉 Ticket Purchased!',
        'Your ticket has been purchased successfully. Check your profile for your verification code.',
        [
          {
            text: 'View Profile',
            onPress: () => {
              setShowPayment(false);
              router.push('/(tabs)/profile');
            },
          },
          {
            text: 'OK',
            onPress: () => setShowPayment(false),
          },
        ]
      );
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error creating ticket:', errorMessage);
      Alert.alert('Error', `Failed to create ticket: ${errorMessage}`);
    }
  };
  


  const handlePaymentClose = () => {
    setShowPayment(false);
  };
  




  if (shouldShowHunt) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A']}
          style={styles.gradient}
        >
          <View style={[styles.huntHeader, { paddingTop: insets.top + 20 }]}>
            <View style={styles.huntTitleContainer}>
              <Target color="#00D4FF" size={24} />
              <Text style={styles.huntTitle}>LIVE HUNT</Text>
              <View style={styles.huntStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>ACTIVE</Text>
              </View>
            </View>
            
            <View style={styles.huntInfo}>
              <Text style={styles.huntLocation}>AMSTERDAM</Text>
              <Text style={styles.huntTime}>Started at 3:00 PM CET</Text>
            </View>
            
            <View style={styles.huntActions}>
              <TouchableOpacity 
                style={[
                  styles.distanceMeterButton,
                  (distanceMeterUsed || isCalculatingDistance) && styles.distanceMeterButtonDisabled
                ]}
                onPress={handleDistanceMeter}
                disabled={distanceMeterUsed || isCalculatingDistance}
              >
                <Navigation 
                  color={distanceMeterUsed ? '#888' : '#FFF'} 
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
                  <View style={styles.oneTimeUse}>
                    <Text style={styles.oneTimeUseText}>1x</Text>
                  </View>
                )}
              </TouchableOpacity>
            
            {measuredDistance !== null && (
                <View style={styles.distanceResult}>
                  <Target color="#00D4FF" size={16} />
                  <Text style={styles.distanceResultText}>
                    {measuredDistance}m away
                  </Text>
                </View>
              )}
          </View>
            
            {isSimulating && (
              <TouchableOpacity 
                style={styles.simulationControls}
                onPress={stopSimulation}
              >
                <Pause color="#FF6B6B" size={16} />
                <Text style={styles.simulationText}>Stop Simulation</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView style={styles.cluesContainer}>
            {liveClues.length === 0 ? (
              <View style={styles.waitingContainer}>
                <Clock color="#00D4FF" size={48} />
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
                    <View style={styles.clueNumber}>
                      <Text style={styles.clueNumberText}>{clue.order}</Text>
                    </View>
                    <View style={styles.clueTimestamp}>
                      <Clock color="#888" size={14} />
                      <Text style={styles.timestampText}>
                        {new Date(clue.timestamp).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.clueText}>{clue.text}</Text>
                  
                  <View style={styles.clueActions}>
                    <TouchableOpacity 
                      style={styles.mapButton}
                      onPress={() => setSelectedClueForMap(clue as ClueWithLocation)}
                    >
                      <Crosshair color="#00D4FF" size={16} />
                      <Text style={styles.mapButtonText}>View Hunt Zone</Text>
                    </TouchableOpacity>
                    
                    {(clue as ClueWithLocation).location && (
                      <View style={styles.radiusIndicator}>
                        <MapPin color="#888" size={12} />
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
            <Target color="#00D4FF" size={20} />
            <Text style={styles.notificationText}>New clue received!</Text>
          </Animated.View>
        </LinearGradient>
        
        {selectedClueForMap && selectedClueForMap.location && (
          <HuntMap
            visible={true}
            onClose={() => setSelectedClueForMap(null)}
            clueOrder={selectedClueForMap.order}
            totalClues={mockClues.length}
            targetLocation={selectedClueForMap.location}
          />
        )}
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}>
          <View style={styles.heroSection}>
            <Text style={styles.appTitle}>BOUNTY</Text>
            <Text style={styles.tagline}>Urban Bounty Hunt</Text>
          </View>

          {isEventLive && !hasTicket && (
            <View style={styles.liveEventNotice}>
              <View style={styles.liveEventHeader}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>EVENT LIVE NOW</Text>
                </View>
              </View>
              <Text style={styles.liveEventTitle}>The Hunt is Currently Active!</Text>
              <Text style={styles.liveEventMessage}>
                Ticket sales are closed for this event. Hunters are currently tracking the bounty in real-time.
              </Text>
              <View style={styles.nextEventPrompt}>
                <AlertCircle color="#00D4FF" size={20} />
                <Text style={styles.nextEventPromptText}>
                  Stay alert for the next upcoming event announcement!
                </Text>
              </View>
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
                colors={['#1E3A8A', '#3B82F6', '#60A5FA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.eventGradient}
              >
                <Image
                    source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qsqldepkdx2ld5bwrcdk' }}
                    style={styles.backgroundImage}
                  />
                  <View style={styles.eventHeader}>
                    <Text style={styles.nextEventLabel}>NEXT HUNT</Text>
                    <View style={styles.prizeContainer}>
                      <Text style={styles.prizeAmount}>€{currentEvent.prize}</Text>
                      <Text style={styles.prizeLabel}>PRIZE</Text>
                    </View>
                  </View>

                  <View style={styles.citySection}>
                    <Text style={styles.cityLabel}>LOCATION</Text>
                    <Text style={styles.cityNameLarge}>AMSTERDAM</Text>
                    <Text style={styles.cityCountry}>Netherlands</Text>
                  </View>

                  {timeUntilEvent && (
                    <View style={styles.countdownContainer}>
                      <Text style={styles.countdownLabel}>STARTS IN</Text>
                      <Text style={styles.countdownTime}>{timeUntilEvent}</Text>
                    </View>
                  )}

                  <View style={styles.eventDetails}>
                    <View style={styles.eventRow}>
                      <Clock color="#FFF" size={20} />
                      <Text style={styles.eventDate}>Saturday, Jan 18, 2026 • 12:00 PM CET</Text>
                    </View>
                    
                    <View style={styles.eventRow}>
                      <Users color="#FFF" size={20} />
                      <Text style={styles.eventPlayers}>
                        189 hunters registered
                      </Text>
                    </View>
                  </View>

                {!isLoggedIn && (
                  <TouchableOpacity 
                    style={styles.authRequiredContainer}
                    onPress={() => router.push('/signup')}
                  >
                    <LogIn color="#00D4FF" size={20} />
                    <Text style={styles.authRequiredText}>
                      Sign in to purchase tickets
                    </Text>
                  </TouchableOpacity>
                )}
                
                {purchaseError && (
                  <View style={styles.errorContainer}>
                    <AlertCircle color="#FF6B6B" size={16} />
                    <Text style={styles.errorText}>{purchaseError}</Text>
                  </View>
                )}

                {hasTicket && (
                  <View style={styles.ticketInfoSeparate}>
                    <Text style={styles.ticketInfoTitle}>✓ TICKET CLAIMED</Text>
                    <Text style={styles.ticketInfoText}>
                      Hunt starts at the scheduled time.
                    </Text>
                    <TouchableOpacity 
                      style={styles.simulationButton}
                      onPress={startSimulation}
                    >
                      <Play color="#00D4FF" size={16} />
                      <Text style={styles.simulationButtonText}>Preview Hunt Experience</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </LinearGradient>
            </Animated.View>
          )}
          
          {TICKET.isFirstEvent && !hasTicket && currentEvent && (
            <Animated.View style={[styles.firstEventBannerSeparate, { opacity: opacityAnim }]}>
              <View style={styles.firstEventBanner}>
                <Text style={styles.firstEventText}>🎉 FIRST EVENT - FREE ENTRY!</Text>
                <Text style={styles.firstEventSubtext}>This is a special launch event. Future hunts will require paid tickets.</Text>
              </View>
            </Animated.View>
          )}
          
          {currentEvent && (
            <Animated.View style={{ opacity: opacityAnim }}>
              <TouchableOpacity
                style={[
                  styles.ticketButtonSeparate,
                  (!canPurchaseTicket || isLoading || isEventLive) && styles.ticketButtonDisabled
                ]}
                onPress={handlePurchaseTicket}
                disabled={!canPurchaseTicket || isLoading || isEventLive}
              >
                <View style={styles.ticketButtonContent}>
                  <CreditCard color={hasTicket || isEventLive ? '#888' : '#00D4FF'} size={20} />
                  <Text style={[
                    styles.ticketButtonTextSeparate,
                    (hasTicket || isEventLive) && styles.ticketButtonTextDisabled
                  ]}>
                    {isLoading ? 'PROCESSING...' : 
                     isEventLive ? 'EVENT LIVE - SALES CLOSED' :
                     hasTicket ? 'TICKET CLAIMED' : 
                     !isLoggedIn ? 'SIGN IN TO CLAIM FREE TICKET' :
                     TICKET.isFree ? 'CLAIM FREE TICKET' : 'PURCHASE TICKET'}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          <View style={styles.howItWorks}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            
            <View style={styles.stepContainer}>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>Create your secure account (one ticket per account)</Text>
              </View>
              
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>{TICKET.isFree ? 'Claim your FREE ticket (verified accounts only)' : 'Purchase your ticket for the next hunt'}</Text>
              </View>
              
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>Receive real-time clues during the live event</Text>
              </View>
              
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>4</Text>
                </View>
                <Text style={styles.stepText}>Find the target first and claim the prize</Text>
              </View>
            </View>
          </View>
        </ScrollView>
        
        <StripePayment
          visible={showPayment}
          onClose={handlePaymentClose}
          onSuccess={handlePaymentSuccess}
          priceId={TICKET.stripePriceId || process.env.EXPO_PUBLIC_STRIPE_PRICE_ID || ''}
          amount={Math.round(TICKET.price * 100)}
          currency={TICKET.currency.toLowerCase()}
          description={TICKET.name}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
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
    marginBottom: 40,
    marginTop: 20,
  },
  appTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#00D4FF',
    letterSpacing: 4,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  eventCard: {
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
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
    opacity: 0.15,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  nextEventLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 1,
  },
  prizeContainer: {
    alignItems: 'flex-end',
  },
  prizeAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
  },
  prizeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    opacity: 0.7,
  },
  eventDetails: {
    marginBottom: 24,
    marginTop: 8,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventRowIcon: {
    color: '#FFF',
  },
  eventDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 12,
  },
  eventPlayers: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFF',
    marginLeft: 12,
  },
  ticketButtonSeparate: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  ticketButtonDisabled: {
    backgroundColor: '#1A1A1A',
    borderColor: '#333',
  },
  ticketButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketButtonTextSeparate: {
    color: '#00D4FF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 8,
  },
  ticketButtonTextDisabled: {
    color: '#888',
  },
  howItWorks: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  stepContainer: {
    marginTop: 0,
    gap: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00D4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    color: '#CCC',
    lineHeight: 22,
  },

  authRequiredContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#00D4FF',
  },
  authRequiredText: {
    flex: 1,
    fontSize: 14,
    color: '#00D4FF',
    marginLeft: 8,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#FF6B6B',
    marginLeft: 8,
    fontWeight: '500',
  },
  citySection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  cityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    opacity: 0.7,
    letterSpacing: 1,
    marginBottom: 4,
  },
  cityNameLarge: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 3,
    textAlign: 'center',
  },
  cityCountry: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    opacity: 0.8,
    marginTop: 2,
  },
  ticketInfoSeparate: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00D4FF',
  },
  ticketInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00D4FF',
    marginBottom: 8,
    letterSpacing: 1,
  },
  ticketInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  simulationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1A2A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  simulationButtonText: {
    fontSize: 14,
    color: '#00D4FF',
    fontWeight: '600',
  },
  huntHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  huntTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  huntTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00D4FF',
    letterSpacing: 2,
    marginLeft: 8,
  },
  huntStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00FF88',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00FF88',
    letterSpacing: 1,
    marginLeft: 6,
  },
  huntInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  huntLocation: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 1,
  },
  huntTime: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  simulationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1A1A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 16,
  },
  simulationText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '600',
    marginLeft: 8,
  },
  cluesContainer: {
    flex: 1,
    padding: 20,
  },
  waitingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 16,
  },
  waitingText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  clueCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00D4FF',
  },
  clueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clueNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00D4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clueNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  clueTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestampText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    marginLeft: 6,
  },
  clueText: {
    fontSize: 16,
    color: '#FFF',
    lineHeight: 24,
    marginBottom: 16,
  },
  clueActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1A2A',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00D4FF',
    gap: 6,
  },
  mapButtonText: {
    fontSize: 13,
    color: '#00D4FF',
    fontWeight: '700',
    marginLeft: 6,
  },
  radiusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 6,
  },
  radiusText: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    marginLeft: 6,
  },
  huntProgress: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  progressSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  newClueNotification: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00D4FF',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    gap: 12,
  },
  notificationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00D4FF',
    marginLeft: 12,
  },
  huntActions: {
    marginTop: 16,
  },
  distanceMeterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4FF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    position: 'relative',
    gap: 8,
    marginBottom: 12,
  },
  distanceMeterButtonDisabled: {
    backgroundColor: '#333',
  },
  distanceMeterButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  distanceMeterButtonTextDisabled: {
    color: '#888',
  },
  oneTimeUse: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: '#0A0A0A',
  },
  oneTimeUseText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  distanceResult: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#00D4FF',
    gap: 8,
  },
  distanceResultText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#00D4FF',
    letterSpacing: 1,
    marginLeft: 8,
  },
  liveEventNotice: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  liveEventHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1A1A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B6B',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FF6B6B',
    letterSpacing: 1.5,
    marginLeft: 8,
  },
  liveEventTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  liveEventMessage: {
    fontSize: 16,
    color: '#CCC',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  nextEventPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1A2A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00D4FF',
    gap: 12,
  },
  nextEventPromptText: {
    flex: 1,
    fontSize: 14,
    color: '#00D4FF',
    fontWeight: '600',
    lineHeight: 20,
    marginLeft: 12,
  },
  firstEventBannerSeparate: {
    marginBottom: 20,
  },
  firstEventBanner: {
    backgroundColor: '#1A2A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00FF88',
    alignItems: 'center',
  },
  firstEventText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#00FF88',
    letterSpacing: 1,
    marginBottom: 6,
    textAlign: 'center',
  },
  firstEventSubtext: {
    fontSize: 13,
    color: '#CCC',
    textAlign: 'center',
    lineHeight: 18,
  },
  countdownContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 0,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00D4FF',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  countdownTime: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
});
