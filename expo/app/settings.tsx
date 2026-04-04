import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Bell,
  BellRing,
  Clock,
  Zap,
  Trophy,
  Shield,
  FileText,
  ExternalLink,
  ChevronRight,
  Info,
  Trash2,
  HelpCircle,
  MessageCircle,
} from 'lucide-react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

const C = Colors;

const NOTIFICATION_PREFS_KEY = 'bounty_notification_prefs';

interface NotificationPrefs {
  eventReminder24h: boolean;
  eventReminder1h: boolean;
  eventLive: boolean;
  huntUpdates: boolean;
  winnerAnnouncements: boolean;
  promotions: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  eventReminder24h: true,
  eventReminder1h: true,
  eventLive: true,
  huntUpdates: true,
  winnerAnnouncements: true,
  promotions: false,
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [_loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
        if (stored) {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
        }
      } catch (e) {
        console.error('Failed to load notification prefs:', e);
      } finally {
        setLoaded(true);
      }
    };
    void loadPrefs();
  }, []);

  const updatePref = useCallback((key: keyof NotificationPrefs, value: boolean) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    try {
      void AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated));
      console.log('Notification prefs saved:', key, value);
    } catch (e) {
      console.error('Failed to save notification prefs:', e);
    }
  }, [prefs]);


  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Contact Support',
              'To delete your account, please contact our support team at support@bounty.app',
            );
          },
        },
      ],
    );
  }, []);

  const handleSignOut = useCallback(async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.back();
        },
      },
    ]);
  }, [signOut]);

  const renderToggle = useCallback((
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    key: keyof NotificationPrefs,
  ) => (
    <View style={styles.settingRow} key={key}>
      <View style={styles.settingIconWrap}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={prefs[key]}
        onValueChange={(v) => updatePref(key, v)}
        trackColor={{ false: C.dark.cardElevated, true: 'rgba(245,158,11,0.4)' }}
        thumbColor={prefs[key] ? C.accent.primary : C.dark.textMuted}
        ios_backgroundColor={C.dark.cardElevated}
      />
    </View>
  ), [prefs, updatePref]);

  const renderLink = useCallback((
    icon: React.ReactNode,
    title: string,
    onPress: () => void,
    danger?: boolean,
  ) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={0.7}
      key={title}
    >
      <View style={[styles.settingIconWrap, danger && styles.settingIconDanger]}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.settingTitleDanger]}>{title}</Text>
      </View>
      <ChevronRight color={danger ? C.status.danger : C.dark.textMuted} size={18} />
    </TouchableOpacity>
  ), []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[C.gradient.backgroundStart, C.gradient.backgroundEnd]}
        style={styles.gradient}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft color={C.dark.text} size={22} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Bell color={C.accent.primary} size={16} />
              <Text style={styles.sectionTitle}>Push Notifications</Text>
            </View>
            <View style={styles.card}>
              {renderToggle(
                <BellRing color={C.accent.primary} size={18} />,
                '24h Reminder',
                'Get notified 24 hours before an event',
                'eventReminder24h',
              )}
              <View style={styles.rowDivider} />
              {renderToggle(
                <Clock color={C.accent.primary} size={18} />,
                '1h Reminder',
                'Get notified 1 hour before an event',
                'eventReminder1h',
              )}
              <View style={styles.rowDivider} />
              {renderToggle(
                <Zap color={C.accent.primary} size={18} />,
                'Event Live',
                'Know the moment a hunt goes live',
                'eventLive',
              )}
              <View style={styles.rowDivider} />
              {renderToggle(
                <MessageCircle color={C.accent.primary} size={18} />,
                'Hunt Updates',
                'New clues and in-game alerts',
                'huntUpdates',
              )}
              <View style={styles.rowDivider} />
              {renderToggle(
                <Trophy color={C.accent.primary} size={18} />,
                'Winner Announcements',
                'See who claimed the bounty',
                'winnerAnnouncements',
              )}
              <View style={styles.rowDivider} />
              {renderToggle(
                <Bell color={C.dark.textMuted} size={18} />,
                'Promotions',
                'Deals, discounts, and special offers',
                'promotions',
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Info color={C.accent.primary} size={16} />
              <Text style={styles.sectionTitle}>About</Text>
            </View>
            <View style={styles.card}>
              {renderLink(
                <FileText color={C.dark.textSecondary} size={18} />,
                'Terms of Service',
                () => Linking.openURL('https://bounty.app/terms'),
              )}
              <View style={styles.rowDivider} />
              {renderLink(
                <Shield color={C.dark.textSecondary} size={18} />,
                'Privacy Policy',
                () => Linking.openURL('https://bounty.app/privacy'),
              )}
              <View style={styles.rowDivider} />
              {renderLink(
                <HelpCircle color={C.dark.textSecondary} size={18} />,
                'Help & Support',
                () => Linking.openURL('mailto:support@bounty.app'),
              )}
            </View>
          </View>

          {user && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Shield color={C.status.danger} size={16} />
                <Text style={[styles.sectionTitle, { color: C.dark.textSecondary }]}>Account</Text>
              </View>
              <View style={styles.card}>
                {renderLink(
                  <ExternalLink color={C.status.danger} size={18} />,
                  'Sign Out',
                  handleSignOut,
                  true,
                )}
                <View style={styles.rowDivider} />
                {renderLink(
                  <Trash2 color={C.status.danger} size={18} />,
                  'Delete Account',
                  handleDeleteAccount,
                  true,
                )}
              </View>
            </View>
          )}

          <Text style={styles.versionText}>Bounty v1.0.0</Text>
          <View style={{ height: insets.bottom + 40 }} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.dark.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700' as const,
    color: C.dark.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 38,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingLeft: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: C.accent.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: C.dark.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconDanger: {
    backgroundColor: C.status.dangerMuted,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: C.dark.text,
  },
  settingTitleDanger: {
    color: C.status.danger,
  },
  settingSubtitle: {
    fontSize: 12,
    color: C.dark.textMuted,
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: C.dark.border,
    marginLeft: 64,
  },
  versionText: {
    fontSize: 12,
    color: C.dark.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
});
