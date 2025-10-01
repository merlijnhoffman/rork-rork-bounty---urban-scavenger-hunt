import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Users, Target, Zap, AlertCircle, CreditCard, LogIn, CheckCircle } from 'lucide-react-native';
import { useGameStore } from '@/store/game-store';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketDetection } from '@/hooks/useTicketDetection';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import { STRIPE_CONFIG } from '@/constants/stripe';
import { router } from 'expo-router';

export default function HuntScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const { 
    currentEvent, 
    isGameActive, 
    clues, 
    purchaseTicket,
    isLoading,
    purchaseError
  } = useGameStore();
  
  // Use the new ticket detection system
  const {
    hasTicket,
    activeTicket,
    isLoading: ticketLoading,
    isError: ticketError,
    refreshTicketStatus,
    isMonitoring
  } = useTicketDetection();
  
  const canPurchaseTicket = isLoggedIn && !hasTicket;

  
  const [showStripeWebView, setShowStripeWebView] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  // Stripe Buy Button HTML
  const STRIPE_BUY_BUTTON_HTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Purchase Ticket</title>
    <style>
      body {
        margin: 0;
        padding: 20px;
        background-color: #0A0A0A;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .container {
        text-align: center;
        max-width: 400px;
        width: 100%;
      }
      .title {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 8px;
        color: #FFF;
      }
      .price {
        font-size: 32px;
        font-weight: 900;
        color: #00D4FF;
        margin-bottom: 12px;
      }
      .description {
        font-size: 16px;
        color: #888;
        margin-bottom: 32px;
        line-height: 1.4;
      }
      stripe-buy-button {
        width: 100%;
      }
      .footer {
        margin-top: 24px;
        font-size: 12px;
        color: #666;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 class="title">Hunt Ticket</h1>
      <div class="price">€3.99</div>
      <p class="description">Get access to the ultimate treasure hunt experience</p>
      
      <script async src="https://js.stripe.com/v3/buy-button.js"></script>
      <stripe-buy-button
        buy-button-id="${STRIPE_CONFIG.buyButtonId}"
        publishable-key="${STRIPE_CONFIG.publishableKey}"
      ></stripe-buy-button>
      
      <div class="footer">
        Secure payment powered by Stripe
      </div>
    </div>
    
    <script>
      // Listen for successful payment
      window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'stripe_checkout_success') {
          // Notify React Native about successful payment
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'payment_success'
          }));
        }
      });
      
      // Alternative: Listen for URL changes that indicate success
      let lastUrl = window.location.href;
      setInterval(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          if (lastUrl.includes('success') || lastUrl.includes('payment_intent')) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'payment_success'
            }));
          }
        }
      }, 1000);
    </script>
  </body>
  </html>
  `;

  const handlePurchaseTicket = () => {
    if (!isLoggedIn) {
      // Redirect to login page
      router.push('/login');
      return;
    }
    
    if (Platform.OS === 'web') {
      // On web, create a popup with the Stripe buy button
      const popup = window.open('', '_blank', 'width=500,height=600,scrollbars=yes');
      if (popup) {
        popup.document.write(STRIPE_BUY_BUTTON_HTML);
        popup.document.close();
      }
    } else {
      // On mobile, show WebView
      setShowStripeWebView(true);
    }
  };

  const handleOpenInBrowser = async () => {
    try {
      // Create a data URL with the HTML content
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(STRIPE_BUY_BUTTON_HTML)}`;
      await Linking.openURL(dataUrl);
    } catch {
      Alert.alert('Error', 'Could not open payment link');
    }
  };
  
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'payment_success') {
        setShowStripeWebView(false);
        handlePaymentSuccess();
      }
    } catch (error) {
      console.log('WebView message parsing error:', error);
    }
  };

  const handleWebViewNavigationStateChange = (navState: any) => {
    const { url } = navState;
    
    // Check for Stripe success indicators
    if (url.includes('success') || url.includes('payment_intent') || url.includes('checkout-success')) {
      setShowStripeWebView(false);
      handlePaymentSuccess();
    } else if (url.includes('canceled') || url.includes('cancel')) {
      setShowStripeWebView(false);
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      // Show success animation first
      setShowSuccess(true);
      
      // Create a mock ticket for the €3.99 tier
      const mockTier = {
        id: 'standard',
        name: 'Standard',
        price: 3.99,
        currency: 'EUR' as const,
        description: 'Access to the hunt',
        features: ['Real-time clues', 'Prize eligibility']
      };
      
      // Check if component is still mounted before proceeding
      if (isLoggedIn && user) {
        await purchaseTicket(mockTier, `pi_mock_${Date.now()}`, isLoggedIn, user);
        console.log('Ticket created successfully');
      }
      
      // Hide success animation after 2 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to create ticket after payment:', error);
      setShowSuccess(false);
    }
  };
  
  const handleCloseWebView = () => {
    setShowStripeWebView(false);
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
                
                {hasTicket && activeTicket && (
                  <View style={styles.ticketInfo}>
                    <Text style={styles.ticketInfoTitle}>Your Ticket</Text>
                    <Text style={styles.ticketInfoText}>
                      Verification Code: {activeTicket.verificationCode}
                    </Text>
                    <Text style={styles.ticketInfoDate}>
                      Purchased: {new Date(activeTicket.purchasedAt).toLocaleDateString()}
                    </Text>
                    {activeTicket.event && (
                      <Text style={styles.ticketInfoEvent}>
                        Event: {activeTicket.event.city} • €{activeTicket.event.price}
                      </Text>
                    )}
                  </View>
                )}
                
                {/* Ticket detection status for debugging */}
                {isLoggedIn && (
                  <View style={styles.debugInfo}>
                    <Text style={styles.debugText}>
                      Monitoring: {isMonitoring ? '✅' : '❌'} | 
                      Loading: {ticketLoading ? '⏳' : '✅'} | 
                      Error: {ticketError ? '❌' : '✅'}
                    </Text>
                    <TouchableOpacity 
                      style={styles.refreshButton}
                      onPress={refreshTicketStatus}
                    >
                      <Text style={styles.refreshButtonText}>Refresh Status</Text>
                    </TouchableOpacity>
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
        
        {/* Stripe WebView Modal for Mobile */}
        {showStripeWebView && Platform.OS !== 'web' && (
          <Modal
            visible={showStripeWebView}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleCloseWebView}
          >
            <View style={[styles.webViewContainer, { paddingTop: insets.top }]}>
              <View style={styles.webViewHeader}>
                <Text style={styles.webViewTitle}>Secure Payment</Text>
                <TouchableOpacity style={styles.closeButton} onPress={handleCloseWebView}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              <WebView
                source={{ html: STRIPE_BUY_BUTTON_HTML }}
                onNavigationStateChange={handleWebViewNavigationStateChange}
                onMessage={handleWebViewMessage}
                style={styles.webView}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                mixedContentMode="compatibility"
                allowsInlineMediaPlayback={true}
              />
              <TouchableOpacity
                style={styles.browserButton}
                onPress={handleOpenInBrowser}
              >
                <Text style={styles.browserButtonText}>Open in Browser</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        )}
        
        {/* Success Modal */}
        {showSuccess && (
          <Modal
            visible={showSuccess}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setShowSuccess(false)}
          >
            <View style={styles.successOverlay}>
              <View style={styles.successContainer}>
                <CheckCircle color="#00D4FF" size={80} />
                <Text style={styles.successTitle}>Payment Successful!</Text>
                <Text style={styles.successMessage}>
                  Your ticket has been purchased successfully.
                  Get ready for an amazing hunt experience!
                </Text>
              </View>
            </View>
          </Modal>
        )}
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
});