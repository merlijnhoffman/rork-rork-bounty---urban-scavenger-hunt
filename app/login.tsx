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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, ChevronDown, Search } from 'lucide-react-native';

type LoginStep = 'phone' | 'verify';

type CountryCode = {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
};

const COUNTRY_CODES: CountryCode[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dialCode: '+1' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dialCode: '+61' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', dialCode: '+64' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dialCode: '+31' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', dialCode: '+34' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', dialCode: '+39' },
];

export default function LoginScreen() {
  const [step, setStep] = useState<LoginStep>('phone');
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState<boolean>(false);
  const [countrySearch, setCountrySearch] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const { signUp, verifyPhone } = useAuth();

  const formatPhoneNumber = (phone: string, dialCode: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    return `${dialCode}${cleaned}`;
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  };

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber.trim())) {
      Alert.alert('Error', 'Please enter a valid phone number (10-15 digits)');
      return;
    }

    setLoading(true);
    const formattedPhone = formatPhoneNumber(phoneNumber.trim(), selectedCountry.dialCode);
    const result = await signUp(formattedPhone);
    setLoading(false);

    if (result.success) {
      setStep('verify');
    } else {
      Alert.alert('Error', result.error || 'Failed to send verification code');
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (verificationCode.trim().length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    const formattedPhone = formatPhoneNumber(phoneNumber.trim(), selectedCountry.dialCode);
    const result = await verifyPhone(formattedPhone, verificationCode.trim());
    setLoading(false);

    if (result.success) {
      router.replace('/' as any);
    } else {
      Alert.alert('Verification Failed', result.error || 'Invalid verification code');
    }
  };

  const filteredCountries = COUNTRY_CODES.filter(
    (country) =>
      country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      country.dialCode.includes(countrySearch) ||
      country.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const renderPhoneStep = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue your hunt</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.phoneInputRow}>
          <TouchableOpacity
            style={styles.countrySelector}
            onPress={() => setShowCountryPicker(true)}
            testID="country-selector"
          >
            <Text style={styles.flagText}>{selectedCountry.flag}</Text>
            <Text style={styles.dialCodeText}>{selectedCountry.dialCode}</Text>
            <ChevronDown size={16} color="#666" />
          </TouchableOpacity>

          <View style={styles.phoneInputContainer}>
            <Phone size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.phoneInput}
              placeholder="Phone number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoComplete="tel"
              testID="phone-input"
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleSendCode}
          disabled={loading}
          testID="send-code-button"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Send Verification Code</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  const renderVerifyStep = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Verify Your Phone</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to {selectedCountry.dialCode} {phoneNumber}</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.verificationInput}
            placeholder="000000"
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            maxLength={6}
            testID="verification-code-input"
          />
        </View>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleVerifyCode}
          disabled={loading}
          testID="verify-button"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Verify & Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleSendCode}
          disabled={loading}
        >
          <Text style={styles.resendButtonText}>Resend Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep('phone')}
        >
          <Text style={styles.backButtonText}>Change Phone Number</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {step === 'phone' && renderPhoneStep()}
          {step === 'verify' && renderVerifyStep()}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/signup' as any)}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCountryPicker(false);
                  setCountrySearch('');
                }}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Search size={18} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search country or code"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCapitalize="none"
              />
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    selectedCountry.code === item.code && styles.selectedCountryItem,
                  ]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setShowCountryPicker(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryDialCode}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  form: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },

  eyeIcon: {
    padding: 4,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  signupLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#f9f9f9',
  },
  flagText: {
    fontSize: 24,
  },
  dialCodeText: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  phoneInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9f9f9',
  },
  phoneInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },
  verificationInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    letterSpacing: 8,
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  selectedCountryItem: {
    backgroundColor: '#F0F8FF',
  },
  countryFlag: {
    fontSize: 24,
    width: 32,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  countryDialCode: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 64,
  },
});