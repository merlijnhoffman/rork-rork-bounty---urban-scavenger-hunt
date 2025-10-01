import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Users, Target, Zap, AlertCircle, User, CreditCard } from 'lucide-react-native';
import { useGameStore } from '@/store/game-store';
import { useUserStore } from '@/store/user-store';
import PaymentSheet from '@/components/PaymentSheet';

export default function HuntScreen() {
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useUserStore();
  const { 
    currentEvent, 
    isGameActive, 
    hasTicket,
    userTicket,
    clues, 
    purchaseTicket,
    isLoading,
    purchaseError,
    canPurchaseTicket
  } = useGameStore();

  
  const [showPaymentSheet, setShowPaymentSheet] = useState<boolean>(false);

  const handleShowPaymentSheet = () => {
    if (!isLoggedIn) {
      console.log('User must be logged in to purchase tickets');
      return;
    }
    
    setShowPaymentSheet(true);
  };
  
  const handlePaymentSuccess = async () => {
    try {
      // Create a mock ticket for the €3.99 tier
      const mockTier = {
        id: 'standard',
        name: 'Standard',
        price: 3.99,
        currency: 'EUR' as const,
        description: 'Access to the hunt',
        features: ['Real-time clues', 'Prize eligibility']
      };
      await purchaseTicket(mockTier, `pi_mock_${Date.now()}`);
      console.log('Ticket created successfully');
    } catch (error) {
      console.error('Failed to create ticket after payment:', error);
    }
  };
  
  const handleClosePaymentSheet = () => {
    setShowPaymentSheet(false);
  };

  if (isGameActive && hasTicket) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A']}
          style={styles.gradient}
        >
          <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE HUNT</Text>
            </View>
            <Text style={styles.cityName}>{currentEvent?.city}</Text>
          </View>

          <ScrollView style={styles.cluesContainer} showsVerticalScrollIndicator={false}>
            {clues.map((clue, index) => (
              <View key={clue.id} style={styles.clueCard}>
                <View style={styles.clueHeader}>
                  <Target color="#00D4FF" size={20} />
                  <Text style={styles.clueNumber}>CLUE #{index + 1}</Text>
                  <Text style={styles.clueTime}>{clue.timestamp}</Text>
                </View>
                <Text style={styles.clueText}>{clue.text}</Text>
                {clue.hint && (
                  <View style={styles.hintContainer}>
                    <Text style={styles.hintLabel}>HINT:</Text>
                    <Text style={styles.hintText}>{clue.hint}</Text>
                  </View>
                )}
              </View>
            ))}
            
            {clues.length === 0 && (
              <View style={styles.waitingContainer}>
                <Zap color="#00D4FF" size={48} />
                <Text style={styles.waitingTitle}>Hunt Starting Soon</Text>
                <Text style={styles.waitingText}>
                  First clue will drop at the scheduled start time
                </Text>
              </View>
            )}
          </ScrollView>
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
            <Text style={styles.tagline}>Urban Scavenger Hunt</Text>
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
                    <Text style={styles.cityLabel}>DESTINATION</Text>
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
                  <View style={styles.authRequiredContainer}>
                    <User color="#FF6B6B" size={20} />
                    <Text style={styles.authRequiredText}>
                      Create an account to purchase tickets
                    </Text>
                  </View>
                )}
                
                {purchaseError && (
                  <View style={styles.errorContainer}>
                    <AlertCircle color="#FF6B6B" size={16} />
                    <Text style={styles.errorText}>{purchaseError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.ticketButton,
                    (!canPurchaseTicket || isLoading) && styles.ticketButtonDisabled
                  ]}
                  onPress={handleShowPaymentSheet}
                  disabled={!canPurchaseTicket || isLoading}
                >
                  <View style={styles.ticketButtonContent}>
                    <CreditCard color={hasTicket ? '#888' : '#000'} size={20} />
                    <Text style={[
                      styles.ticketButtonText,
                      hasTicket && styles.ticketButtonTextDisabled
                    ]}>
                      {isLoading ? 'PROCESSING...' : 
                       hasTicket ? `${userTicket?.tier.name.toUpperCase()} TICKET PURCHASED` : 
                       !isLoggedIn ? 'ACCOUNT REQUIRED' :
                       'CHOOSE TICKET TIER'}
                    </Text>
                  </View>
                </TouchableOpacity>
                
                {hasTicket && userTicket && (
                  <View style={styles.ticketInfo}>
                    <Text style={styles.ticketInfoTitle}>Your Ticket</Text>
                    <Text style={styles.ticketInfoText}>
                      {userTicket.tier.name} • €{userTicket.tier.price}
                    </Text>
                    <Text style={styles.ticketInfoDate}>
                      Purchased: {new Date(userTicket.purchaseDate).toLocaleDateString()}
                    </Text>
                  </View>
                )}
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
        
        <PaymentSheet
          visible={showPaymentSheet}
          onClose={handleClosePaymentSheet}
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
  header: {
    padding: 20,
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF0000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    marginRight: 8,
  },
  liveText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cityName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#00D4FF',
    letterSpacing: 2,
  },
  cluesContainer: {
    flex: 1,
    padding: 20,
  },
  clueCard: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00D4FF',
  },
  clueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  clueNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00D4FF',
    marginLeft: 8,
    flex: 1,
    letterSpacing: 1,
  },
  clueTime: {
    fontSize: 12,
    color: '#888',
  },
  clueText: {
    fontSize: 16,
    color: '#FFF',
    lineHeight: 24,
    marginBottom: 12,
  },
  hintContainer: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  hintLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00D4FF',
    marginBottom: 4,
    letterSpacing: 1,
  },
  hintText: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
  },
  waitingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  waitingText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  authRequiredContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
  },
  authRequiredText: {
    flex: 1,
    fontSize: 14,
    color: '#FF6B6B',
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
});