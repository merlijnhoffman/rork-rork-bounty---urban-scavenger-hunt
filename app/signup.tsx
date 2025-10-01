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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react-native';

export default function SignupScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const { signUp } = useAuth();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      return `+${cleaned}`;
    }
    
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    if (phone.startsWith('+')) {
      return phone;
    }
    
    return `+${cleaned}`;
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  };

  const validateForm = () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return false;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return false;
    }

    if (!validatePhoneNumber(phoneNumber.trim())) {
      Alert.alert('Error', 'Please enter a valid phone number (10-15 digits)');
      return false;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const formattedPhone = formatPhoneNumber(phoneNumber.trim());
    const result = await signUp(email.trim().toLowerCase(), password, formattedPhone);
    setLoading(false);

    if (result.success) {
      Alert.alert(
        'Success',
        'Account created successfully! Please check your email to verify your account.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login' as any),
          },
        ]
      );
    } else {
      Alert.alert('Signup Failed', result.error || 'An error occurred');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Join the Hunt</Text>
            <Text style={styles.subtitle}>Create your account to start hunting</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Mail size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                testID="email-input"
              />
            </View>

            <View style={styles.inputContainer}>
              <Phone size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone number (e.g., +1234567890)"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoComplete="tel"
                testID="phone-input"
              />
            </View>

            <View style={styles.inputContainer}>
              <Lock size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                testID="password-input"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#666" />
                ) : (
                  <Eye size={20} color="#666" />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Lock size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoComplete="new-password"
                testID="confirm-password-input"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color="#666" />
                ) : (
                  <Eye size={20} color="#666" />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By creating an account, you agree to our Terms of Service and Privacy Policy.
                Only one account per person is allowed.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.signupButton}
              onPress={handleSignup}
              disabled={loading}
              testID="signup-button"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signupButtonText}>Create Account</Text>
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
  termsContainer: {
    marginBottom: 24,
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  signupButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  signupButtonText: {
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
  loginLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});