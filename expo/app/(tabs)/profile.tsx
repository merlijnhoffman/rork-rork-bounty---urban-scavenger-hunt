import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Mail, Phone, Shield, QrCode, Clock, LogIn, UserPlus, Ticket, Fingerprint, Settings } from 'lucide-react-native';
import { useGameStore } from '@/store/game-store';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

const C = Colors;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { currentEvent } = useGameStore();
  const { user, signOut } = useAuth();
  
  
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
  
  const handleSignOut = async () => {
    await signOut();
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[C.gradient.backgroundStart, C.gradient.backgroundEnd]}
          style={styles.gradient}
        >
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}>
            <View style={styles.authHeader}>
              <View style={styles.avatarLarge}>
                <User color={C.accent.primary} size={36} />
              </View>
              <Text style={styles.authTitle}>Join the Hunt</Text>
              <Text style={styles.authSubtitle}>
                Create an account to claim tickets and participate in treasure hunts
              </Text>
            </View>

            <View style={styles.authButtonsContainer}>
              <TouchableOpacity
                style={styles.primaryAuthButton}
                onPress={() => router.push('/signup')}
                activeOpacity={0.8}
              >
                <UserPlus color="#000" size={20} />
                <Text style={styles.primaryAuthButtonText}>Create Account</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.secondaryAuthButton}
                onPress={() => router.push('/login')}
                activeOpacity={0.8}
              >
                <LogIn color={C.accent.primary} size={20} />
                <Text style={styles.secondaryAuthButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.benefitsCard}>
              <Text style={styles.benefitsTitle}>Why Create an Account?</Text>
              
              {[
                { icon: Shield, text: 'Secure ticket management' },
                { icon: QrCode, text: 'Unique verification codes' },
                { icon: Clock, text: 'Real-time hunt updates' },
              ].map((item, i) => (
                <View key={i} style={styles.benefitRow}>
                  <View style={styles.benefitIconContainer}>
                    <item.icon color={C.accent.primary} size={18} />
                  </View>
                  <Text style={styles.benefitText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[C.gradient.backgroundStart, C.gradient.backgroundEnd]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}>
          <View style={styles.profileHeader}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => router.push('/settings')}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Settings color={C.dark.textSecondary} size={22} />
            </TouchableOpacity>
            <View style={styles.avatarLarge}>
              <User color={C.accent.primary} size={36} />
            </View>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>

          <View style={styles.profileCard}>
            <Text style={styles.cardTitle}>Account Details</Text>
            
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Mail color={C.dark.textMuted} size={18} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Phone color={C.dark.textMuted} size={18} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>
                  {profileQuery.data?.phone_number || user.phone || user.user_metadata?.phone_number || 'Not provided'}
                </Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Fingerprint color={C.dark.textMuted} size={18} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Account Status</Text>
                <View style={[
                  styles.statusChip,
                  user.email_confirmed_at ? styles.statusChipSuccess : styles.statusChipDanger
                ]}>
                  <View style={[
                    styles.statusChipDot,
                    { backgroundColor: user.email_confirmed_at ? C.status.success : C.status.danger }
                  ]} />
                  <Text style={[
                    styles.statusChipText,
                    { color: user.email_confirmed_at ? C.status.success : C.status.danger }
                  ]}>
                    {user.email_confirmed_at ? 'Verified' : 'Not Verified'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ticket color={C.dark.textMuted} size={18} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Ticket Status</Text>
                <View style={[
                  styles.statusChip,
                  hasTicket ? styles.statusChipSuccess : styles.statusChipMuted
                ]}>
                  <View style={[
                    styles.statusChipDot,
                    { backgroundColor: hasTicket ? C.status.success : C.dark.textMuted }
                  ]} />
                  <Text style={[
                    styles.statusChipText,
                    { color: hasTicket ? C.status.success : C.dark.textMuted }
                  ]}>
                    {hasTicket ? 'Active Ticket' : 'No Active Ticket'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {hasTicket && !!verificationCode && (
            <View style={styles.verificationCard}>
              <LinearGradient
                colors={[C.gradient.accentStart, C.gradient.accentEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.verificationGradient}
              >
                <View style={styles.verificationHeader}>
                  <QrCode color="#FFF" size={22} />
                  <Text style={styles.verificationTitle}>Verification Code</Text>
                </View>
                
                <View style={styles.codeContainer}>
                  <Text style={styles.verificationCode}>{verificationCode}</Text>
                </View>
                
                <Text style={styles.verificationNote}>
                  Present this code to claim your prize if you find the target first!
                </Text>
                
                <View style={styles.secureNotice}>
                  <Shield color="rgba(255,255,255,0.8)" size={14} />
                  <Text style={styles.secureNoticeText}>
                    Keep this code secure and don't share it
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {!!hasTicket && !verificationCode && (
            <View style={styles.loadingTicketCard}>
              <Clock color={C.accent.primary} size={28} />
              <Text style={styles.loadingTicketTitle}>Loading Ticket...</Text>
              <Text style={styles.loadingTicketText}>
                Your verification code is being retrieved
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={styles.securityCard}>
            <Shield color={C.accent.primary} size={22} />
            <Text style={styles.securityTitle}>Security Features</Text>
            <Text style={styles.securityDescription}>
              {`\u2022 Account verification required\n\u2022 Secure authentication\n\u2022 Screenshot protection enabled\n\u2022 Unique verification codes\n\u2022 Anti-sharing technology`}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  authHeader: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 36,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 15,
    color: C.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  authButtonsContainer: {
    marginBottom: 32,
    gap: 12,
  },
  primaryAuthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent.primary,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  primaryAuthButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
  },
  secondaryAuthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  secondaryAuthButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: C.accent.primary,
  },
  benefitsCard: {
    backgroundColor: C.dark.card,
    borderRadius: 16,
    padding: 20,
  },
  benefitsTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: C.dark.text,
    marginBottom: 18,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  benefitIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 15,
    color: C.dark.textSecondary,
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 28,
  },
  settingsButton: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: C.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 15,
    color: C.dark.textSecondary,
  },
  profileCard: {
    backgroundColor: C.dark.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: C.dark.text,
    marginBottom: 18,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.dark.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: C.dark.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: C.dark.text,
    fontWeight: '500' as const,
  },
  detailDivider: {
    height: 1,
    backgroundColor: C.dark.border,
    marginVertical: 12,
    marginLeft: 48,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  statusChipSuccess: {
    backgroundColor: C.status.successMuted,
  },
  statusChipDanger: {
    backgroundColor: C.status.dangerMuted,
  },
  statusChipMuted: {
    backgroundColor: C.dark.cardElevated,
  },
  statusChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  verificationCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  verificationGradient: {
    padding: 24,
    alignItems: 'center',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 10,
  },
  verificationTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  codeContainer: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  verificationCode: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: '#FFF',
    letterSpacing: 5,
    textAlign: 'center',
  },
  verificationNote: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 20,
  },
  secureNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 8,
  },
  secureNoticeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600' as const,
  },
  loadingTicketCard: {
    backgroundColor: C.dark.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  loadingTicketTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: C.dark.text,
    marginTop: 4,
  },
  loadingTicketText: {
    fontSize: 14,
    color: C.dark.textSecondary,
    textAlign: 'center',
  },
  signOutButton: {
    backgroundColor: C.status.dangerMuted,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  signOutButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: C.status.danger,
  },
  securityCard: {
    backgroundColor: C.dark.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: C.dark.text,
    marginTop: 10,
    marginBottom: 10,
  },
  securityDescription: {
    fontSize: 14,
    color: C.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

});
