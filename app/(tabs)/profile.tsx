import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Mail, Phone, Shield, QrCode, Clock, LogIn, UserPlus, Ticket, Lock } from 'lucide-react-native';
import { useGameStore } from '@/store/game-store';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const ADMIN_PASSWORD = 'whereswally2003';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { currentEvent } = useGameStore();
  const { user, signOut } = useAuth();
  
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Fetch ticket data from Supabase
  const profileQuery = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error.message || 'Unknown error');
        return null;
      }

      return data;
    },
    enabled: !!user,
  });

  const ticketQuery = useQuery({
    queryKey: ['user-ticket', user?.id, currentEvent?.id],
    queryFn: async () => {
      if (!user || !currentEvent) {
        return { hasTicket: false, ticket: null };
      }

      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', user.id)
        .eq('event_id', currentEvent.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error fetching ticket:', error.message || 'Unknown error');
        throw new Error(error.message || 'Failed to fetch ticket');
      }

      return { hasTicket: !!data, ticket: data };
    },
    enabled: !!user && !!currentEvent,
    refetchInterval: 10000,
  });
  
  const hasTicket = ticketQuery.data?.hasTicket || false;
  const verificationCode = ticketQuery.data?.ticket?.verification_code || null;
  
  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowPasswordModal(true);
    }, 10000);
  };
  
  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  
  const handlePasswordSubmit = () => {
    if (password === ADMIN_PASSWORD) {
      setShowPasswordModal(false);
      setPassword('');
      router.push('/admin');
    } else {
      Alert.alert('Access Denied', 'Incorrect password');
      setPassword('');
    }
  };

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
                <User color="#1E40AF" size={32} />
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
                <LogIn color="#1E40AF" size={20} />
                <Text style={styles.secondaryAuthButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.benefitsContainer}>
              <Text style={styles.benefitsTitle}>Why Create an Account?</Text>
              
              <View style={styles.benefitItem}>
                <Shield color="#1E40AF" size={20} />
                <Text style={styles.benefitText}>Secure ticket purchases</Text>
              </View>
              
              <View style={styles.benefitItem}>
                <QrCode color="#1E40AF" size={20} />
                <Text style={styles.benefitText}>Unique verification codes</Text>
              </View>
              
              <View style={styles.benefitItem}>
                <Clock color="#1E40AF" size={20} />
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
            <Pressable
              style={styles.avatarContainer}
              onPressIn={handleLongPressStart}
              onPressOut={handleLongPressEnd}
            >
              <User color="#1E40AF" size={32} />
            </Pressable>
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
                <Text style={styles.detailValue}>
                  {profileQuery.data?.phone_number || user.phone || user.user_metadata?.phone_number || 'Not provided'}
                </Text>
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
              <Ticket color="#888" size={20} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Ticket Status</Text>
                <Text style={[styles.detailValue, { color: hasTicket ? '#00FF88' : '#888' }]}>
                  {hasTicket ? 'Active Ticket' : 'No Active Ticket'}
                </Text>
              </View>
            </View>
          </View>

          {hasTicket && verificationCode && (
            <View style={styles.verificationCard}>
              <LinearGradient
                colors={['#1E40AF', '#1E3A8A']}
                style={styles.verificationGradient}
              >
                <View style={styles.verificationHeader}>
                  <QrCode color="#000" size={24} />
                  <Text style={styles.verificationTitle}>Your Ticket Verification Code</Text>
                </View>
                
                <View style={styles.codeContainer}>
                  <Text style={styles.verificationCode}>{verificationCode}</Text>
                </View>
                
                <Text style={styles.verificationNote}>
                  Present this code to claim your prize if you find the target first during the hunt!
                </Text>
                
                <View style={styles.ticketDetails}>
                  <Shield color="#000" size={16} />
                  <Text style={styles.ticketDetailsText}>
                    Keep this code secure and don&apos;t share it
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {hasTicket && !verificationCode && (
            <View style={styles.waitingCard}>
              <Clock color="#1E40AF" size={32} />
              <Text style={styles.waitingTitle}>Loading Ticket...</Text>
              <Text style={styles.waitingText}>
                Your verification code is being retrieved
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={styles.securityInfo}>
            <Shield color="#1E40AF" size={24} />
            <Text style={styles.securityTitle}>Security Features</Text>
            <Text style={styles.securityDescription}>
              {`• Account verification required\n• Secure authentication\n• Screenshot protection enabled\n• Unique verification codes\n• Anti-sharing technology`}
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
      
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPasswordModal(false);
          setPassword('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Lock color="#FF6B6B" size={48} />
            <Text style={styles.modalTitle}>Admin Access</Text>
            <Text style={styles.modalSubtitle}>Enter password to continue</Text>
            
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#666"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoFocus
              onSubmitEditing={handlePasswordSubmit}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={handlePasswordSubmit}
              >
                <Text style={styles.modalSubmitText}>Enter</Text>
              </TouchableOpacity>
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
    backgroundColor: '#1E40AF',
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
    borderColor: '#1E40AF',
    paddingVertical: 16,
    borderRadius: 12,
  },
  secondaryAuthButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
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
    backgroundColor: '#1E40AF',
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
    color: '#1E40AF',
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
    color: '#1E40AF',
    letterSpacing: 4,
    textAlign: 'center',
  },
  verificationNote: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 16,
  },
  ticketDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  ticketDetailsText: {
    fontSize: 12,
    color: '#000',
    marginLeft: 8,
    fontWeight: '600',
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
    color: '#1E40AF',
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
    color: '#1E40AF',
    marginLeft: 8,
    fontWeight: '600',
  },
  phoneNumber: {
    color: '#1E40AF',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
  },
  passwordInput: {
    width: '100%',
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFF',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});