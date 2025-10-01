import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Users, AlertCircle, CreditCard, LogIn, Target, MapPin, Lightbulb, Play, Pause } from 'lucide-react-native';
import { useGameStore, Clue } from '@/store/game-store';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

import { trpc, trpcClient } from '@/lib/trpc';
import StripePayment from '@/components/StripePayment';
import { router } from 'expo-router';

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
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  
  // Mock clues for simulation
  const mockClues: Clue[] = [
    {
      id: '1',
      text: 'Start your hunt at the heart of Amsterdam! Find the iconic monument where the city\'s history began. Look for the bronze plaque near the base.',
      hint: 'Dam Square - Royal Palace area',
      timestamp: new Date().toISOString(),
      order: 1,
    },
    {
      id: '2', 
      text: 'Cross the famous canals to where art meets history. The target awaits in the museum district, near the entrance of the house where a famous painter once lived.',
      hint: 'Van Gogh Museum vicinity',
      timestamp: new Date(Date.now() + 5 * 60000).toISOString(),
      order: 2,
    },
    {
      id: '3',
      text: 'Navigate to the floating flower market. The final clue hides where tulips bloom year-round, near the vendor with the red and white striped awning.',
      hint: 'Bloemenmarkt - look for the striped stall',
      timestamp: new Date(Date.now() + 10 * 60000).toISOString(),
      order: 3,
    },
  ];
  
  // Check ticket status when user logs in
  const ticketQuery = trpc.payment.checkTicketStatus.useQuery(
    {
      userId: user?.id || '',
      eventId: currentEvent?.id || '',
    },
    {
      enabled: !!user && !!currentEvent,
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );
  
  // Subscribe to real-time clues from Supabase
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
          
          // Animate new clue appearance
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
  }, [hasTicket, currentEvent, user, fadeAnim]);
  
  // Simulation functions
  const startSimulation = () => {
    setIsSimulating(true);
    setIsHuntActive(true);
    setLiveClues([]);
    
    // Add clues progressively
    mockClues.forEach((clue, index) => {
      setTimeout(() => {
        setLiveClues(prev => [...prev, clue]);
        
        // Animate new clue
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
      }, index * 8000); // 8 seconds between clues
    });
  };
  
  const stopSimulation = () => {
    setIsSimulating(false);
    setIsHuntActive(false);
    setLiveClues([]);
  };
  
  useEffect(() => {
    if (ticketQuery.data) {
      setHasTicket(ticketQuery.data.hasTicket);
    }
  }, [ticketQuery.data]);
  

  
  const canPurchaseTicket = isLoggedIn && !hasTicket && !ticketQuery.isLoading;
  const isLoading = gameLoading || ticketQuery.isLoading;
  
  // Check if hunt should be active (for demo, we'll use simulation)
  const shouldShowHunt = hasTicket && (isHuntActive || isSimulating);

  const handlePurchaseTicket = () => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    console.log('Payment successful:', paymentIntentId);
    
    if (!user || !currentEvent) {
      console.error('Missing user or event data');
      return;
    }

    try {
      // Create ticket in database
      const ticket = await trpcClient.payment.createTicket.mutate({
        userId: user.id,
        eventId: currentEvent.id,
        paymentIntentId,
      });
      
      console.log('Ticket created successfully:', ticket.ticketId);
      
      // Refresh ticket status
      await ticketQuery.refetch();
      
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const handlePaymentClose = () => {
    setShowPayment(false);
  };



  // Render live hunt interface
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
                  
                  {clue.hint && (
                    <View style={styles.hintContainer}>
                      <Lightbulb color="#FFA500" size={16} />
                      <Text style={styles.hintText}>{clue.hint}</Text>
                    </View>
                  )}
                  
                  <View style={styles.clueActions}>
                    <TouchableOpacity style={styles.mapButton}>
                      <MapPin color="#00D4FF" size={16} />
                      <Text style={styles.mapButtonText}>Open Map</Text>
                    </TouchableOpacity>
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
          
          {/* New clue notification overlay */}
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

          {currentEvent && (
            <View style={styles.eventCard}>
              <ImageBackground
                source={{ uri: 'https://r2-pub.rork.com/generated-images/a9cf554f-16c0-4074-828e-4eb741a7bf80.png' }}
                style={styles.cityBackground}
                imageStyle={styles.cityBackgroundImage}
              >
                <LinearGradient
                  colors={['#00D4FF', '#0099CC']}
                  style={styles.eventGradient}
                >
                  <View style={styles.eventHeader}>
                    <Text style={styles.nextEventLabel}>NEXT HUNT</Text>
                    <View style={styles.prizeContainer}>
                      <Text style={styles.prizeAmount}>${currentEvent.prize}</Text>
                      <Text style={styles.prizeLabel}>PRIZE</Text>
                    </View>
                  </View>

                  <View style={styles.citySection}>
                    <Text style={styles.cityLabel}>LOCATION</Text>
                    <Text style={styles.cityNameLarge}>AMSTERDAM</Text>
                    <Text style={styles.cityCountry}>Netherlands</Text>
                  </View>

                  <View style={styles.eventDetails}>
                    <View style={styles.eventRow}>
                      <Clock color="#000" size={20} />
                      <Text style={styles.eventDate}>Saturday, Jan 18, 2025 • 3:00 PM CET</Text>
                    </View>
                    
                    <View style={styles.eventRow}>
                      <Users color="#000" size={20} />
                      <Text style={styles.eventPlayers}>
                        189 hunters registered
                      </Text>
                    </View>
                  </View>

                {!isLoggedIn && (
                  <TouchableOpacity 
                    style={styles.authRequiredContainer}
                    onPress={() => router.push('/login')}
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
                  <View style={styles.ticketInfo}>
                    <Text style={styles.ticketInfoTitle}>✓ TICKET PURCHASED</Text>
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

                <TouchableOpacity
                  style={[
                    styles.ticketButton,
                    (!canPurchaseTicket || isLoading) && styles.ticketButtonDisabled
                  ]}
                  onPress={handlePurchaseTicket}
                  disabled={!canPurchaseTicket || isLoading}
                >
                  <View style={styles.ticketButtonContent}>
                    <CreditCard color={hasTicket ? '#888' : '#000'} size={20} />
                    <Text style={[
                      styles.ticketButtonText,
                      hasTicket && styles.ticketButtonTextDisabled
                    ]}>
                      {isLoading ? 'PROCESSING...' : 
                       hasTicket ? 'TICKET PURCHASED' : 
                       !isLoggedIn ? 'SIGN IN TO PURCHASE' :
                       'PURCHASE TICKET'}
                    </Text>
                  </View>
                </TouchableOpacity>
                

                </LinearGradient>
              </ImageBackground>
            </View>
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
                <Text style={styles.stepText}>Purchase your ticket for the next hunt</Text>
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
    marginBottom: 40,
    overflow: 'hidden',
  },
  eventGradient: {
    padding: 24,
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
    color: '#000',
    letterSpacing: 1,
  },
  prizeContainer: {
    alignItems: 'flex-end',
  },
  prizeAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
  },
  prizeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    opacity: 0.7,
  },
  eventDetails: {
    marginBottom: 24,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventCity: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginLeft: 12,
  },
  eventDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 12,
  },
  eventPlayers: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginLeft: 12,
  },
  ticketButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  ticketButtonDisabled: {
    backgroundColor: '#333',
  },
  ticketButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketButtonText: {
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
    backgroundColor: '#1A2A2A',
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
    backgroundColor: '#2A1A1A',
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
  cityBackground: {
    width: '100%',
  },
  cityBackgroundImage: {
    opacity: 0.1,
    resizeMode: 'contain',
    height: 120,
    bottom: 0,
  },
  citySection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  cityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    opacity: 0.7,
    letterSpacing: 1,
    marginBottom: 4,
  },
  cityNameLarge: {
    fontSize: 36,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 3,
    textAlign: 'center',
  },
  cityCountry: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    opacity: 0.8,
    marginTop: 2,
  },
  ticketInfo: {
    backgroundColor: '#1A1A1A',
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
  ticketInfoDate: {
    fontSize: 12,
    color: '#888',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
  browserButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  browserButtonText: {
    fontSize: 14,
    color: '#00D4FF',
    fontWeight: '600',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    maxWidth: 300,
    margin: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  ticketInfoEvent: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  debugInfo: {
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FFA500',
  },
  debugText: {
    fontSize: 12,
    color: '#FFA500',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  refreshButton: {
    backgroundColor: '#FFA500',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  refreshButtonText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
  },

  // Hunt interface styles
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
    gap: 12,
  },
  huntTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00D4FF',
    letterSpacing: 2,
  },
  huntStatus: {
    flexDirection: 'row',
    alignItems: 'center',
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
    gap: 6,
  },
  simulationText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '600',
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
  },
  clueText: {
    fontSize: 16,
    color: '#FFF',
    lineHeight: 24,
    marginBottom: 16,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2A2A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 14,
    color: '#FFA500',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  clueActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1A2A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  mapButtonText: {
    fontSize: 12,
    color: '#00D4FF',
    fontWeight: '600',
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
    gap: 12,
    borderWidth: 1,
    borderColor: '#00D4FF',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  notificationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00D4FF',
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

});