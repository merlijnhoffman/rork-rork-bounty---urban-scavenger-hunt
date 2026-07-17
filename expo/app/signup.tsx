import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  Mail, Lock, Eye, EyeOff, ArrowLeft, Crosshair, Check, Square,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

const C = Colors;

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [ageConfirmed, setAgeConfirmed] = useState<boolean>(false);
  const [privacyConsent, setPrivacyConsent] = useState<boolean>(false);

  const validateEmail = (emailStr: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr);
  };

  const handleSignUp = async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Missing Password', 'Please enter a password.');
      return;
    }

    if (password.trim().length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords Don\'t Match', 'Please make sure both passwords are identical.');
      return;
    }

    if (!ageConfirmed) {
      Alert.alert('Age Verification Required', 'You must confirm that you are at least 16 years old to create an account.');
      return;
    }

    if (!privacyConsent) {
      Alert.alert('Consent Required', 'You must agree to the Privacy Policy and data processing to create an account.');
      return;
    }

    setLoading(true);
    const result = await signUp(email, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Sign Up Failed', result.error || 'Something went wrong. Please try again.');
      return;
    }

    Alert.alert(
      'Account Created!',
      'We\'ve sent a confirmation link to your email. Please open it to verify your account, then sign in.',
      [
        {
          text: 'OK',
          onPress: () => router.replace('/login' as any),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[C.gradient.backgroundStart, C.gradient.backgroundEnd]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <ArrowLeft color={C.dark.textSecondary} size={22} />
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <Crosshair color={C.accent.primary} size={24} />
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join the hunt in seconds</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Mail size={18} color={C.dark.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={C.dark.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  testID="email-input"
                />
              </View>

              <View style={styles.inputContainer}>
                <Lock size={18} color={C.dark.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={C.dark.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  testID="password-input"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  testID="toggle-password"
                >
                  {showPassword ? (
                    <Eye size={18} color={C.dark.textMuted} />
                  ) : (
                    <EyeOff size={18} color={C.dark.textMuted} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Lock size={18} color={C.dark.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={C.dark.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  testID="confirm-password-input"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                  testID="toggle-confirm-password"
                >
                  {showConfirmPassword ? (
                    <Eye size={18} color={C.dark.textMuted} />
                  ) : (
                    <EyeOff size={18} color={C.dark.textMuted} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.consentSection}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setAgeConfirmed(!ageConfirmed)}
                  activeOpacity={0.7}
                  testID="age-checkbox"
                >
                  {ageConfirmed ? (
                    <Check size={20} color={C.accent.primary} />
                  ) : (
                    <Square size={20} color={C.dark.textMuted} />
                  )}
                  <Text style={styles.checkboxLabel}>
                    I confirm that I am at least 16 years old
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setPrivacyConsent(!privacyConsent)}
                  activeOpacity={0.7}
                  testID="privacy-consent-checkbox"
                >
                  {privacyConsent ? (
                    <Check size={20} color={C.accent.primary} />
                  ) : (
                    <Square size={20} color={C.dark.textMuted} />
                  )}
                  <Text style={styles.checkboxLabel}>
                    I consent to the processing of my personal data as described in the{' '}
                    <Text
                      style={styles.checkboxLink}
                      onPress={() => router.push('/privacy' as any)}
                    >
                      Privacy Policy
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (loading || !ageConfirmed || !privacyConsent) && styles.primaryButtonDisabled,
                ]}
                onPress={handleSignUp}
                disabled={loading || !ageConfirmed || !privacyConsent}
                activeOpacity={0.8}
                testID="signup-button"
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login' as any)}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: C.dark.textSecondary,
    textAlign: 'center',
  },
  form: {
    marginBottom: 32,
    gap: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.dark.card,
    borderWidth: 1,
    borderColor: C.dark.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: C.dark.text,
  },
  eyeIcon: {
    padding: 4,
  },
  primaryButton: {
    backgroundColor: C.accent.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: C.dark.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    color: C.accent.primary,
    fontWeight: '600' as const,
  },
  consentSection: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: C.dark.textSecondary,
    lineHeight: 19,
  },
  checkboxLink: {
    color: C.accent.primary,
    textDecorationLine: 'underline' as const,
  },
});
