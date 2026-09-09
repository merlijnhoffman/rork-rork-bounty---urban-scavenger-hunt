import React, { useCallback, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Shield,
  FileText,
  ExternalLink,
  ChevronRight,
  Info,
  Trash2,
  HelpCircle,
  RefreshCw,
  Download,
  ToggleLeft,
  ToggleRight,
  ClipboardList,
  Globe,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LANGUAGE_NAMES, LANGUAGE_ORDER } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const C = Colors;

const TERMS_URL = 'https://bounty.app/terms';
const SUPPORT_EMAIL = 'privacy@bounty.app';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { restorePurchases, isRestoring, hasHuntAccess } = usePayment();
  const { language, setLanguage, t } = useLanguage();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [locationConsent, setLocationConsent] = useState<boolean>(true);
  const [diagnosticConsent, setDiagnosticConsent] = useState<boolean>(true);
  const [langOpen, setLangOpen] = useState<boolean>(false);
  const chevronAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const animateChevron = useCallback((toValue: number) => {
    Animated.timing(chevronAnim, { toValue, duration: 200, useNativeDriver: true }).start();
  }, [chevronAnim]);

  const toggleLangOpen = useCallback(() => {
    animateChevron(langOpen ? 0 : 1);
    setLangOpen(!langOpen);
  }, [langOpen, animateChevron]);

  const selectLanguage = useCallback(
    (code: (typeof LANGUAGE_ORDER)[number]) => {
      const changed = code !== language;
      animateChevron(0);
      setLangOpen(false);
      setLanguage(code);
      if (changed) {
        Alert.alert(t('languageSaved'), t('languageSavedMsg'));
      }
    },
    [language, setLanguage, t, animateChevron],
  );

  const handleRestore = useCallback(async () => {
    try {
      await restorePurchases();
      Alert.alert(
        hasHuntAccess ? t('purchasesRestored') : t('noPurchasesFound'),
        hasHuntAccess
          ? t('purchasesRestoredMsg')
          : t('noPurchasesMsg'),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not restore purchases.';
      Alert.alert(t('errRestoreFailed'), message);
    }
  }, [restorePurchases, hasHuntAccess]);

  const performDelete = useCallback(async () => {
    try {
      setIsDeleting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error(t('errDeleteSignIn'));
      }

      const { error } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) {
        throw new Error(error.message || t('errDeleteFailed'));
      }

      await supabase.auth.signOut();
      Alert.alert(
        t('accountDeletedTitle'),
        t('accountDeletedMsg'),
        [{ text: t('ok'), onPress: () => router.replace('/hunt') }],
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errDeleteFailed');
      Alert.alert(
        t('errDeleteAccountTitle'),
        `${message}\n\n${t('deleteContactSupport')}`,
      );
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t('deleteAccount'),
      t('deleteAccountMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('deleteSureTitle'),
              t('deleteSureMsg'),
              [
                { text: t('keepAccount'), style: 'cancel' },
                { text: t('deleteForever'), style: 'destructive', onPress: performDelete },
              ],
            );
          },
        },
      ],
    );
  }, [performDelete]);

  const handleExportData = useCallback(async () => {
    try {
      setIsExporting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error(t('errExportSignIn'));
      }

      const { data, error } = await supabase.functions.invoke('export-data', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) {
        throw new Error(error.message || t('errExportFailed'));
      }

      Alert.alert(
        t('exportRequestedTitle'),
        t('exportRequestedMsg'),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errExportDataFailed');
      Alert.alert(t('exportFailedTitle'), `${message}\n\n${t('exportContactSupport', { email: SUPPORT_EMAIL })}`);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleToggleConsent = useCallback((type: 'location' | 'diagnostic') => {
    const label = type === 'location' ? t('locationData') : t('diagnosticData');
    Alert.alert(
      t('withdrawConsentTitle', { label }),
      t('withdrawConsentMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('withdraw'),
          style: 'destructive',
          onPress: () => {
            if (type === 'location') {
              setLocationConsent(false);
            } else {
              setDiagnosticConsent(false);
            }
            Alert.alert(
              t('consentUpdatedTitle'),
              t('consentUpdatedMsg'),
              [{ text: t('ok') }],
            );
          },
        },
      ],
    );
  }, []);

  const handleReenableConsent = useCallback((type: 'location' | 'diagnostic') => {
    if (type === 'location') {
      setLocationConsent(true);
    } else {
      setDiagnosticConsent(true);
    }
    Alert.alert(t('consentRestoredTitle'), t('consentRestoredMsg'));
  }, []);

  const handleSignOut = useCallback(async () => {
    Alert.alert(t('signOut'), t('signOutMsg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.back();
        },
      },
    ]);
  }, [signOut]);

  const renderLink = useCallback((
    icon: React.ReactNode,
    title: string,
    onPress: () => void,
    options?: { danger?: boolean; right?: React.ReactNode; disabled?: boolean },
  ) => (
    <TouchableOpacity
      style={[styles.settingRow, options?.disabled && styles.settingRowDisabled]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={options?.disabled}
      key={title}
    >
      <View style={[styles.settingIconWrap, options?.danger && styles.settingIconDanger]}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, options?.danger && styles.settingTitleDanger]}>{title}</Text>
      </View>
      {options?.right ?? <ChevronRight color={options?.danger ? C.status.danger : C.dark.textMuted} size={18} />}
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
          <Text style={styles.headerTitle}>{t('settingsTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <RefreshCw color={C.accent.primary} size={16} />
              <Text style={styles.sectionTitle}>{t('sectionPurchases')}</Text>
            </View>
            <View style={styles.card}>
              {renderLink(
                isRestoring ? (
                  <ActivityIndicator color={C.accent.primary} size="small" />
                ) : (
                  <RefreshCw color={C.dark.textSecondary} size={18} />
                ),
                isRestoring ? t('restoring') : t('restorePurchases'),
                handleRestore,
                { disabled: isRestoring },
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Globe color={C.accent.primary} size={16} />
              <Text style={styles.sectionTitle}>{t('sectionLanguage')}</Text>
            </View>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={toggleLangOpen}
                activeOpacity={0.7}
              >
                <View style={styles.settingIconWrap}>
                  <Globe color={C.dark.textSecondary} size={18} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>
                    {LANGUAGE_NAMES[language]}
                  </Text>
                </View>
                <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                  <ChevronDown color={C.dark.textMuted} size={18} />
                </Animated.View>
              </TouchableOpacity>
              {langOpen &&
                LANGUAGE_ORDER.map((code) => (
                  <React.Fragment key={code}>
                    <View style={styles.rowDivider} />
                    <TouchableOpacity
                      style={styles.settingRow}
                      onPress={() => selectLanguage(code)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.settingContent}>
                        <Text
                          style={[
                            styles.settingTitle,
                            language === code && { color: C.accent.primary },
                          ]}
                        >
                          {LANGUAGE_NAMES[code]}
                        </Text>
                      </View>
                      {language === code && <Check color={C.accent.primary} size={18} />}
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
            </View>
          </View>

          {user && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <ClipboardList color={C.accent.primary} size={16} />
                <Text style={styles.sectionTitle}>{t('sectionDataPrivacy')}</Text>
              </View>
              <View style={styles.card}>
                {renderLink(
                  <Shield color={C.dark.textSecondary} size={18} />,
                  t('privacyGdpr'),
                  () => router.push('/privacy' as any),
                )}
                <View style={styles.rowDivider} />
                {renderLink(
                  isExporting ? (
                    <ActivityIndicator color={C.accent.primary} size="small" />
                  ) : (
                    <Download color={C.dark.textSecondary} size={18} />
                  ),
                  isExporting ? t('exporting') : t('exportData'),
                  handleExportData,
                  { disabled: isExporting, right: <ChevronRight color={C.dark.textMuted} size={18} /> },
                )}
                <View style={styles.rowDivider} />
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() =>
                    locationConsent
                      ? handleToggleConsent('location')
                      : handleReenableConsent('location')
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.settingIconWrap}>
                    {locationConsent ? (
                      <ToggleRight color={C.status.success} size={22} />
                    ) : (
                      <ToggleLeft color={C.dark.textMuted} size={22} />
                    )}
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>{t('locationConsent')}</Text>
                    <Text style={styles.settingSubtitle}>
                      {locationConsent
                        ? t('locationConsentOn')
                        : t('locationConsentOff')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.rowDivider} />
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() =>
                    diagnosticConsent
                      ? handleToggleConsent('diagnostic')
                      : handleReenableConsent('diagnostic')
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.settingIconWrap}>
                    {diagnosticConsent ? (
                      <ToggleRight color={C.status.success} size={22} />
                    ) : (
                      <ToggleLeft color={C.dark.textMuted} size={22} />
                    )}
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>{t('diagnosticData')}</Text>
                    <Text style={styles.settingSubtitle}>
                      {diagnosticConsent
                        ? t('diagnosticOn')
                        : t('diagnosticOff')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Info color={C.accent.primary} size={16} />
              <Text style={styles.sectionTitle}>{t('sectionAbout')}</Text>
            </View>
            <View style={styles.card}>
              {renderLink(
                <FileText color={C.dark.textSecondary} size={18} />,
                t('termsOfService'),
                () => Linking.openURL(TERMS_URL),
              )}
              <View style={styles.rowDivider} />
              {renderLink(
                <Shield color={C.dark.textSecondary} size={18} />,
                t('privacyGdpr').replace(' (GDPR)', ''),
                () => router.push('/privacy' as any),
              )}
              <View style={styles.rowDivider} />
              {renderLink(
                <HelpCircle color={C.dark.textSecondary} size={18} />,
                t('contactSupport'),
                () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`),
              )}
            </View>
          </View>

          {user && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Shield color={C.status.danger} size={16} />
                <Text style={[styles.sectionTitle, { color: C.dark.textSecondary }]}>{t('sectionAccount')}</Text>
              </View>
              <View style={styles.card}>
                {renderLink(
                  <ExternalLink color={C.status.danger} size={18} />,
                  t('signOut'),
                  handleSignOut,
                  { danger: true },
                )}
                <View style={styles.rowDivider} />
                {renderLink(
                  isDeleting ? (
                    <ActivityIndicator color={C.status.danger} size="small" />
                  ) : (
                    <Trash2 color={C.status.danger} size={18} />
                  ),
                  isDeleting ? t('deleting') : t('deleteAccount'),
                  handleDeleteAccount,
                  { danger: true, disabled: isDeleting },
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
  settingRowDisabled: {
    opacity: 0.5,
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
