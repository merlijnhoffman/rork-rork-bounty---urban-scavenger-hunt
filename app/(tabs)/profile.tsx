import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Mail, Phone, Shield, QrCode, Clock, LogIn, UserPlus } from 'lucide-react-native';
import { useGameStore } from '@/store/game-store';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isGameActive, hasTicket, gameStartTime } = useGameStore();
  const { user, signOut } = useAuth();
  
  // Mock verification code for now - this will be generated when game starts
  const verificationCode = hasTicket && isGameActive ? 'HUNT2024' : null;
  
  const [showVerificationCode, setShowVerificationCode] = useState(false);

  useEffect(() => {
    // Show verification code only when game is active and user has ticket
    if (isGameActive && hasTicket && user) {
      setShowVerificationCode(true);
    }
  }, [isGameActive, hasTicket, user]);

  const handleSignOut = async () => {
    await signOut();
  };

  // Show login/signup options if not authenticated
  if (!user) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A']}
          style={styles.gradient}
        >
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}>
            <View style={styles.authHeader}>
              <View style={styles.avatarContainer}>
                <User color="#00D4FF" size={32} />
              </View>
              <Text style={styles.authTitle}>Join the Hunt</Text>
              <Text style={styles.authSubtitle}>
                Create an account to purchase tickets and participate in treasure hunts
              </Text>
            </View>

            <View style={styles.authButtonsContainer}>
              <TouchableOpacity
                style={styles.primaryAuthButton}
                onPress={() => router.push('/signup')}
              >
                <UserPlus color="#000" size={20} />
                <Text style={styles.primaryAuthButtonText}>Create Account</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.secondaryAuthButton}
                onPress={() => router.push('/login')}
              >
                <LogIn color="#00D4FF" size={20} />
                <Text style={styles.secondaryAuthButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.benefitsContainer}>
              <Text style={styles.benefitsTitle}>Why Create an Account?</Text>
              
              <View style={styles.benefitItem}>
                <Shield color="#00D4FF" size={20} />
                <Text style={styles.benefitText}>Secure ticket purchases</Text>
              </View>
              
              <View style={styles.benefitItem}>
                <QrCode color="#00D4FF" size={20} />
                <Text style={styles.benefitText}>Unique verification codes</Text>
              </View>
              
              <View style={styles.benefitItem}>
                <Clock color="#00D4FF" size={20} />
                <Text style={styles.benefitText}>Real-time hunt updates</Text>
              </View>
            </View>
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
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <User color="#00D4FF" size={32} />
            </View>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>

          <View style={styles.profileCard}>
            <Text style={styles.cardTitle}>Account Details</Text>
            
            <View style={styles.detailRow}>
              <Mail color="#888" size={20} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Phone color="#888" size={20} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{user.user_metadata?.phone_number || 'Not provided'}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Shield color="#888" size={20} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Account Status</Text>
                <Text style={[styles.detailValue, { color: user.email_confirmed_at ? '#00FF88' : '#FF6B6B' }]}>
                  {user.email_confirmed_at ? 'Verified' : 'Not Verified'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Shield color="#888" size={20} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Ticket Status</Text>
                <Text style={[styles.detailValue, { color: hasTicket ? '#00FF88' : '#888' }]}>
                  {hasTicket ? 'Ticket Purchased' : 'No Active Ticket'}
                </Text>
              </View>
            </View>
          </View>

          {showVerificationCode && verificationCode && (
            <View style={styles.verificationCard}>
              <LinearGradient
                colors={['#00D4FF', '#0099CC']}
                style={styles.verificationGradient}
              >
                <View style={styles.verificationHeader}>
                  <QrCode color="#000" size={24} />
                  <Text style={styles.verificationTitle}>Winner Verification</Text>
                </View>
                
                <View style={styles.codeContainer}>
                  <Text style={styles.verificationCode}>{verificationCode}</Text>
                </View>
                
                <Text style={styles.verificationNote}>
                  Present this code to claim your prize if you find the target first
                </Text>
              </LinearGradient>
            </View>
          )}

          {!showVerificationCode && hasTicket && (
            <View style={styles.waitingCard}>
              <Clock color="#00D4FF" size={32} />
              <Text style={styles.waitingTitle}>Verification Code</Text>
              <Text style={styles.waitingText}>
                Your unique verification code will appear here when the hunt begins
              </Text>
              {gameStartTime && (
                <Text style={styles.startTime}>
                  Game starts: {gameStartTime}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={styles.securityInfo}>
            <Shield color="#00D4FF" size={24} />
            <Text style={styles.securityTitle}>Security Features</Text>
            <Text style={styles.securityDescription}>
              • Account verification required{'\n'}
              • Secure authentication{'\n'}
              • Screenshot protection enabled{'\n'}
              • Unique verification codes{'\n'}
              • Anti-sharing technology
            </Text>
          </View>
        </ScrollView>
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
  authHeader: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  authButtonsContainer: {
    marginBottom: 40,
  },
  primaryAuthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4FF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  primaryAuthButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginLeft: 8,
  },
  secondaryAuthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#00D4FF',
    paddingVertical: 16,
    borderRadius: 12,
  },
  secondaryAuthButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00D4FF',
    marginLeft: 8,
  },
  benefitsContainer: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 20,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitText: {
    fontSize: 16,
    color: '#CCC',
    marginLeft: 12,
    flex: 1,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    paddingVertical: 16,
    paddingLeft: 12,
  },
  authButton: {
    backgroundColor: '#00D4FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  switchButtonText: {
    fontSize: 14,
    color: '#00D4FF',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: '#CCC',
    marginLeft: 12,
    lineHeight: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#888',
  },
  profileCard: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  verificationCard: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  verificationGradient: {
    padding: 24,
    alignItems: 'center',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginLeft: 8,
  },
  codeContainer: {
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  verificationCode: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00D4FF',
    letterSpacing: 4,
    textAlign: 'center',
  },
  verificationNote: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    opacity: 0.8,
  },
  waitingCard: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 12,
    marginBottom: 8,
  },
  waitingText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  startTime: {
    fontSize: 16,
    color: '#00D4FF',
    fontWeight: '600',
  },
  securityInfo: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 12,
    marginBottom: 12,
  },
  securityDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#00D4FF',
    marginLeft: 8,
    fontWeight: '600',
  },
  phoneNumber: {
    color: '#00D4FF',
    fontWeight: '600',
  },
  verificationContainer: {
    marginBottom: 30,
  },
  verificationLabel: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  verificationInput: {
    backgroundColor: '#222',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    fontSize: 24,
    color: '#FFF',
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  verificationNoteText: {
    flex: 1,
    fontSize: 14,
    color: '#CCC',
    marginLeft: 12,
    lineHeight: 20,
  },
  signOutButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

});