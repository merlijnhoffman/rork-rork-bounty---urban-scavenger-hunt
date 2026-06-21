import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Shield, Clock, Database, Globe, UserCheck, Mail } from 'lucide-react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';

const C = Colors;

interface PolicySectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function PolicySection({ icon, title, children }: PolicySectionProps) {
  return (
    <View style={sectionStyles.wrap}>
      <View style={sectionStyles.header}>
        {icon}
        <Text style={sectionStyles.title}>{title}</Text>
      </View>
      <View style={sectionStyles.body}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: C.dark.text,
  },
  body: {
    paddingLeft: 4,
  },
});

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();

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
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.lastUpdated}>Last updated: June 21, 2026</Text>

          <Text style={styles.intro}>
            Bounty (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting your
            privacy. This policy explains how we collect, use, and safeguard your personal data when you use
            the Bounty urban scavenger hunt app, in compliance with the EU General Data Protection Regulation
            (GDPR), the UK GDPR, and applicable EU member state laws.
          </Text>

          <PolicySection
            icon={<Database color={C.accent.primary} size={18} />}
            title="1. Data Controller"
          >
            <Text style={styles.paragraph}>
              The data controller responsible for your personal data is the operator of the Bounty app.
              For privacy inquiries, contact us at{' '}
              <Text style={styles.link}>privacy@bounty.app</Text>.
            </Text>
            <Text style={styles.paragraph}>
              EU Representative (Art. 27 GDPR): Available upon request at{' '}
              <Text style={styles.link}>privacy@bounty.app</Text>.
            </Text>
          </PolicySection>

          <PolicySection
            icon={<Database color={C.accent.primary} size={18} />}
            title="2. Data We Collect"
          >
            <Text style={styles.paragraph}>
              We collect only the data necessary to provide the scavenger hunt service:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Email address</Text> &ndash; for account creation,
                login, and service communications.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Phone number</Text> &ndash; for two-factor
                authentication and account verification.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Precise &amp; coarse location</Text> &ndash; core
                hunt functionality: tracking your position during active scavenger hunts.
                Location is only collected while the app is in use or, with your permission,
                in the background during active events.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>User ID &amp; device ID</Text> &ndash; for
                authentication, push notifications, and fraud prevention.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Diagnostic data</Text> &ndash; crash logs and
                performance data (anonymized where possible).
              </Text>
            </View>
          </PolicySection>

          <PolicySection
            icon={<UserCheck color={C.status.success} size={18} />}
            title="3. Legal Basis for Processing (Art. 6 GDPR)"
          >
            <Text style={styles.paragraph}>We process your data on these legal grounds:</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Consent (Art. 6(1)(a))</Text> &ndash; Location data,
                push notifications, and diagnostic data. You can withdraw consent at any time
                in Settings.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Contractual necessity (Art. 6(1)(b))</Text> &ndash;
                Email, phone number, and User ID are required to provide the scavenger hunt
                service you requested.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Legitimate interest (Art. 6(1)(f))</Text> &ndash;
                Fraud prevention and service improvement (aggregated analytics only).
              </Text>
            </View>
          </PolicySection>

          <PolicySection
            icon={<Globe color={C.accent.teal} size={18} />}
            title="4. Third-Party Services &amp; Cross-Border Transfers"
          >
            <Text style={styles.paragraph}>
              We use the following processors who may receive your data:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Supabase</Text> &ndash; authentication, database
                hosting, and push notifications. Data stored in EU regions where available.
                Standard Contractual Clauses (SCCs) are in place for any transfers outside
                the EEA.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>RevenueCat</Text> &ndash; in-app purchase processing.
                Receives only anonymized purchase tokens.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Google Maps</Text> &ndash; map rendering during
                hunts. Location data is processed ephemerally and not stored by Google.
              </Text>
            </View>
            <Text style={styles.paragraph}>
              For international data transfers outside the EEA/UK, we rely on the EU
              Commission&rsquo;s adequacy decisions or Standard Contractual Clauses.
              Contact us for a copy of the safeguards.
            </Text>
          </PolicySection>

          <PolicySection
            icon={<Clock color={C.accent.primary} size={18} />}
            title="5. Data Retention"
          >
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Account data</Text> (email, phone, User ID): Retained
                while your account is active. Deleted within 30 days of account deletion.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Location data</Text>: Stored only for the duration
                of an active hunt event. Deleted within 7 days after the event ends.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Purchase records</Text>: Retained for 10 years per
                EU tax law requirements.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Diagnostic data</Text>: Retained for 90 days, then
                automatically deleted.
              </Text>
            </View>
          </PolicySection>

          <PolicySection
            icon={<Shield color={C.status.live} size={18} />}
            title="6. Your GDPR Rights"
          >
            <Text style={styles.paragraph}>
              Under the GDPR, you have the following rights regarding your personal data:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Right of access (Art. 15)</Text> &ndash; Request a
                copy of your data. Use &ldquo;Export My Data&rdquo; in Settings.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Right to rectification (Art. 16)</Text> &ndash;
                Correct inaccurate data. Update your profile in Settings.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Right to erasure (Art. 17)</Text> &ndash;
                &ldquo;Right to be forgotten.&rdquo; Use &ldquo;Delete Account&rdquo; in Settings
                to permanently erase all your data.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Right to data portability (Art. 20)</Text> &ndash;
                Receive your data in a structured, machine-readable format. Use
                &ldquo;Export My Data&rdquo; in Settings.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Right to restrict processing (Art. 18)</Text> &ndash;
                Temporarily limit how we use your data.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Right to object (Art. 21)</Text> &ndash; Object to
                processing based on legitimate interests.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Right to withdraw consent (Art. 7(3))</Text> &ndash;
                Withdraw any consent you&rsquo;ve given at any time in Settings. Withdrawal
                does not affect the lawfulness of processing before withdrawal.
              </Text>
              <Text style={styles.bullet}>
                <Text style={styles.bold}>Right to lodge a complaint (Art. 77)</Text> &ndash;
                You have the right to complain to your national Data Protection Authority
                (DPA). Find yours at{' '}
                <Text style={styles.link}>edpb.europa.eu/about-edpb/members</Text>.
              </Text>
            </View>
            <Text style={styles.paragraph}>
              To exercise any of these rights, contact{' '}
              <Text style={styles.link}>privacy@bounty.app</Text>. We respond within 30 days
              as required by GDPR Art. 12(3). Complex or numerous requests may be extended
              by a further 60 days with notification.
            </Text>
          </PolicySection>

          <PolicySection
            icon={<UserCheck color={C.accent.primary} size={18} />}
            title="7. Children&rsquo;s Data (Art. 8 GDPR)"
          >
            <Text style={styles.paragraph}>
              Bounty is not intended for children under 16. We do not knowingly collect data
              from children under 16 without verifiable parental consent. If you believe a
              child under 16 has provided us with personal data, contact{' '}
              <Text style={styles.link}>privacy@bounty.app</Text> and we will delete it
              immediately.
            </Text>
          </PolicySection>

          <PolicySection
            icon={<Shield color={C.status.danger} size={18} />}
            title="8. Data Breach Notification"
          >
            <Text style={styles.paragraph}>
              In the event of a personal data breach likely to result in a risk to your
              rights and freedoms, we will notify the relevant supervisory authority within
              72 hours (Art. 33 GDPR) and inform you without undue delay if the breach is
              likely to result in a high risk (Art. 34 GDPR).
            </Text>
          </PolicySection>

          <PolicySection
            icon={<Mail color={C.dark.textSecondary} size={18} />}
            title="9. Contact &amp; Complaints"
          >
            <Text style={styles.paragraph}>
              For any privacy-related questions or to exercise your rights:{' '}
              <Text style={styles.link}>privacy@bounty.app</Text>
            </Text>
            <Text style={styles.paragraph}>
              You also have the right to lodge a complaint with your local Data Protection
              Authority. EU residents can find their DPA at{' '}
              <Text style={styles.link}>edpb.europa.eu</Text>.
            </Text>
          </PolicySection>

          <View style={styles.footer}>
            <Shield color={C.dark.textMuted} size={14} />
            <Text style={styles.footerText}>
              This policy complies with Regulation (EU) 2016/679 (GDPR), the UK Data
              Protection Act 2018, and applicable EU member state data protection laws.
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
  lastUpdated: {
    fontSize: 12,
    color: C.dark.textMuted,
    marginBottom: 16,
  },
  intro: {
    fontSize: 14,
    color: C.dark.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  paragraph: {
    fontSize: 14,
    color: C.dark.textSecondary,
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletList: {
    gap: 8,
    marginBottom: 10,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 14,
    color: C.dark.textSecondary,
    lineHeight: 22,
    paddingLeft: 12,
  },
  bold: {
    fontWeight: '700' as const,
    color: C.dark.text,
  },
  link: {
    color: C.accent.primary,
    textDecorationLine: 'underline' as const,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: C.dark.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: C.dark.textMuted,
    lineHeight: 18,
  },
});
