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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, Eye, EyeOff, Phone, ChevronDown, ArrowLeft, Crosshair, Search } from 'lucide-react-native';
import Colors from '@/constants/colors';

const C = Colors;

interface CountryCode {
  code: string;
  name: string;
  dialCode: string;
}

const countryCodes: CountryCode[] = [
  { code: 'AF', name: 'Afghanistan', dialCode: '+93' },
  { code: 'AL', name: 'Albania', dialCode: '+355' },
  { code: 'DZ', name: 'Algeria', dialCode: '+213' },
  { code: 'AS', name: 'American Samoa', dialCode: '+1684' },
  { code: 'AD', name: 'Andorra', dialCode: '+376' },
  { code: 'AO', name: 'Angola', dialCode: '+244' },
  { code: 'AI', name: 'Anguilla', dialCode: '+1264' },
  { code: 'AG', name: 'Antigua and Barbuda', dialCode: '+1268' },
  { code: 'AR', name: 'Argentina', dialCode: '+54' },
  { code: 'AM', name: 'Armenia', dialCode: '+374' },
  { code: 'AW', name: 'Aruba', dialCode: '+297' },
  { code: 'AU', name: 'Australia', dialCode: '+61' },
  { code: 'AT', name: 'Austria', dialCode: '+43' },
  { code: 'AZ', name: 'Azerbaijan', dialCode: '+994' },
  { code: 'BS', name: 'Bahamas', dialCode: '+1242' },
  { code: 'BH', name: 'Bahrain', dialCode: '+973' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880' },
  { code: 'BB', name: 'Barbados', dialCode: '+1246' },
  { code: 'BY', name: 'Belarus', dialCode: '+375' },
  { code: 'BE', name: 'Belgium', dialCode: '+32' },
  { code: 'BZ', name: 'Belize', dialCode: '+501' },
  { code: 'BJ', name: 'Benin', dialCode: '+229' },
  { code: 'BM', name: 'Bermuda', dialCode: '+1441' },
  { code: 'BT', name: 'Bhutan', dialCode: '+975' },
  { code: 'BO', name: 'Bolivia', dialCode: '+591' },
  { code: 'BA', name: 'Bosnia and Herzegovina', dialCode: '+387' },
  { code: 'BW', name: 'Botswana', dialCode: '+267' },
  { code: 'BR', name: 'Brazil', dialCode: '+55' },
  { code: 'BN', name: 'Brunei', dialCode: '+673' },
  { code: 'BG', name: 'Bulgaria', dialCode: '+359' },
  { code: 'BF', name: 'Burkina Faso', dialCode: '+226' },
  { code: 'BI', name: 'Burundi', dialCode: '+257' },
  { code: 'KH', name: 'Cambodia', dialCode: '+855' },
  { code: 'CM', name: 'Cameroon', dialCode: '+237' },
  { code: 'CA', name: 'Canada', dialCode: '+1' },
  { code: 'CV', name: 'Cape Verde', dialCode: '+238' },
  { code: 'KY', name: 'Cayman Islands', dialCode: '+1345' },
  { code: 'CF', name: 'Central African Republic', dialCode: '+236' },
  { code: 'TD', name: 'Chad', dialCode: '+235' },
  { code: 'CL', name: 'Chile', dialCode: '+56' },
  { code: 'CN', name: 'China', dialCode: '+86' },
  { code: 'CO', name: 'Colombia', dialCode: '+57' },
  { code: 'KM', name: 'Comoros', dialCode: '+269' },
  { code: 'CG', name: 'Congo', dialCode: '+242' },
  { code: 'CD', name: 'Congo (DRC)', dialCode: '+243' },
  { code: 'CK', name: 'Cook Islands', dialCode: '+682' },
  { code: 'CR', name: 'Costa Rica', dialCode: '+506' },
  { code: 'HR', name: 'Croatia', dialCode: '+385' },
  { code: 'CU', name: 'Cuba', dialCode: '+53' },
  { code: 'CY', name: 'Cyprus', dialCode: '+357' },
  { code: 'CZ', name: 'Czech Republic', dialCode: '+420' },
  { code: 'DK', name: 'Denmark', dialCode: '+45' },
  { code: 'DJ', name: 'Djibouti', dialCode: '+253' },
  { code: 'DM', name: 'Dominica', dialCode: '+1767' },
  { code: 'DO', name: 'Dominican Republic', dialCode: '+1849' },
  { code: 'EC', name: 'Ecuador', dialCode: '+593' },
  { code: 'EG', name: 'Egypt', dialCode: '+20' },
  { code: 'SV', name: 'El Salvador', dialCode: '+503' },
  { code: 'GQ', name: 'Equatorial Guinea', dialCode: '+240' },
  { code: 'ER', name: 'Eritrea', dialCode: '+291' },
  { code: 'EE', name: 'Estonia', dialCode: '+372' },
  { code: 'ET', name: 'Ethiopia', dialCode: '+251' },
  { code: 'FJ', name: 'Fiji', dialCode: '+679' },
  { code: 'FI', name: 'Finland', dialCode: '+358' },
  { code: 'FR', name: 'France', dialCode: '+33' },
  { code: 'GA', name: 'Gabon', dialCode: '+241' },
  { code: 'GM', name: 'Gambia', dialCode: '+220' },
  { code: 'GE', name: 'Georgia', dialCode: '+995' },
  { code: 'DE', name: 'Germany', dialCode: '+49' },
  { code: 'GH', name: 'Ghana', dialCode: '+233' },
  { code: 'GI', name: 'Gibraltar', dialCode: '+350' },
  { code: 'GR', name: 'Greece', dialCode: '+30' },
  { code: 'GL', name: 'Greenland', dialCode: '+299' },
  { code: 'GD', name: 'Grenada', dialCode: '+1473' },
  { code: 'GU', name: 'Guam', dialCode: '+1671' },
  { code: 'GT', name: 'Guatemala', dialCode: '+502' },
  { code: 'GN', name: 'Guinea', dialCode: '+224' },
  { code: 'GW', name: 'Guinea-Bissau', dialCode: '+245' },
  { code: 'GY', name: 'Guyana', dialCode: '+592' },
  { code: 'HT', name: 'Haiti', dialCode: '+509' },
  { code: 'HN', name: 'Honduras', dialCode: '+504' },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852' },
  { code: 'HU', name: 'Hungary', dialCode: '+36' },
  { code: 'IS', name: 'Iceland', dialCode: '+354' },
  { code: 'IN', name: 'India', dialCode: '+91' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62' },
  { code: 'IR', name: 'Iran', dialCode: '+98' },
  { code: 'IQ', name: 'Iraq', dialCode: '+964' },
  { code: 'IE', name: 'Ireland', dialCode: '+353' },
  { code: 'IL', name: 'Israel', dialCode: '+972' },
  { code: 'IT', name: 'Italy', dialCode: '+39' },
  { code: 'CI', name: 'Ivory Coast', dialCode: '+225' },
  { code: 'JM', name: 'Jamaica', dialCode: '+1876' },
  { code: 'JP', name: 'Japan', dialCode: '+81' },
  { code: 'JO', name: 'Jordan', dialCode: '+962' },
  { code: 'KZ', name: 'Kazakhstan', dialCode: '+7' },
  { code: 'KE', name: 'Kenya', dialCode: '+254' },
  { code: 'KI', name: 'Kiribati', dialCode: '+686' },
  { code: 'KW', name: 'Kuwait', dialCode: '+965' },
  { code: 'KG', name: 'Kyrgyzstan', dialCode: '+996' },
  { code: 'LA', name: 'Laos', dialCode: '+856' },
  { code: 'LV', name: 'Latvia', dialCode: '+371' },
  { code: 'LB', name: 'Lebanon', dialCode: '+961' },
  { code: 'LS', name: 'Lesotho', dialCode: '+266' },
  { code: 'LR', name: 'Liberia', dialCode: '+231' },
  { code: 'LY', name: 'Libya', dialCode: '+218' },
  { code: 'LI', name: 'Liechtenstein', dialCode: '+423' },
  { code: 'LT', name: 'Lithuania', dialCode: '+370' },
  { code: 'LU', name: 'Luxembourg', dialCode: '+352' },
  { code: 'MO', name: 'Macau', dialCode: '+853' },
  { code: 'MK', name: 'Macedonia', dialCode: '+389' },
  { code: 'MG', name: 'Madagascar', dialCode: '+261' },
  { code: 'MW', name: 'Malawi', dialCode: '+265' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60' },
  { code: 'MV', name: 'Maldives', dialCode: '+960' },
  { code: 'ML', name: 'Mali', dialCode: '+223' },
  { code: 'MT', name: 'Malta', dialCode: '+356' },
  { code: 'MH', name: 'Marshall Islands', dialCode: '+692' },
  { code: 'MR', name: 'Mauritania', dialCode: '+222' },
  { code: 'MU', name: 'Mauritius', dialCode: '+230' },
  { code: 'MX', name: 'Mexico', dialCode: '+52' },
  { code: 'FM', name: 'Micronesia', dialCode: '+691' },
  { code: 'MD', name: 'Moldova', dialCode: '+373' },
  { code: 'MC', name: 'Monaco', dialCode: '+377' },
  { code: 'MN', name: 'Mongolia', dialCode: '+976' },
  { code: 'ME', name: 'Montenegro', dialCode: '+382' },
  { code: 'MA', name: 'Morocco', dialCode: '+212' },
  { code: 'MZ', name: 'Mozambique', dialCode: '+258' },
  { code: 'MM', name: 'Myanmar', dialCode: '+95' },
  { code: 'NA', name: 'Namibia', dialCode: '+264' },
  { code: 'NR', name: 'Nauru', dialCode: '+674' },
  { code: 'NP', name: 'Nepal', dialCode: '+977' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64' },
  { code: 'NI', name: 'Nicaragua', dialCode: '+505' },
  { code: 'NE', name: 'Niger', dialCode: '+227' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234' },
  { code: 'NO', name: 'Norway', dialCode: '+47' },
  { code: 'OM', name: 'Oman', dialCode: '+968' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92' },
  { code: 'PW', name: 'Palau', dialCode: '+680' },
  { code: 'PS', name: 'Palestine', dialCode: '+970' },
  { code: 'PA', name: 'Panama', dialCode: '+507' },
  { code: 'PG', name: 'Papua New Guinea', dialCode: '+675' },
  { code: 'PY', name: 'Paraguay', dialCode: '+595' },
  { code: 'PE', name: 'Peru', dialCode: '+51' },
  { code: 'PH', name: 'Philippines', dialCode: '+63' },
  { code: 'PL', name: 'Poland', dialCode: '+48' },
  { code: 'PT', name: 'Portugal', dialCode: '+351' },
  { code: 'PR', name: 'Puerto Rico', dialCode: '+1939' },
  { code: 'QA', name: 'Qatar', dialCode: '+974' },
  { code: 'RO', name: 'Romania', dialCode: '+40' },
  { code: 'RU', name: 'Russia', dialCode: '+7' },
  { code: 'RW', name: 'Rwanda', dialCode: '+250' },
  { code: 'KN', name: 'Saint Kitts and Nevis', dialCode: '+1869' },
  { code: 'LC', name: 'Saint Lucia', dialCode: '+1758' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', dialCode: '+1784' },
  { code: 'WS', name: 'Samoa', dialCode: '+685' },
  { code: 'SM', name: 'San Marino', dialCode: '+378' },
  { code: 'ST', name: 'Sao Tome and Principe', dialCode: '+239' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966' },
  { code: 'SN', name: 'Senegal', dialCode: '+221' },
  { code: 'RS', name: 'Serbia', dialCode: '+381' },
  { code: 'SC', name: 'Seychelles', dialCode: '+248' },
  { code: 'SL', name: 'Sierra Leone', dialCode: '+232' },
  { code: 'SG', name: 'Singapore', dialCode: '+65' },
  { code: 'SK', name: 'Slovakia', dialCode: '+421' },
  { code: 'SI', name: 'Slovenia', dialCode: '+386' },
  { code: 'SB', name: 'Solomon Islands', dialCode: '+677' },
  { code: 'SO', name: 'Somalia', dialCode: '+252' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27' },
  { code: 'KR', name: 'South Korea', dialCode: '+82' },
  { code: 'SS', name: 'South Sudan', dialCode: '+211' },
  { code: 'ES', name: 'Spain', dialCode: '+34' },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94' },
  { code: 'SD', name: 'Sudan', dialCode: '+249' },
  { code: 'SR', name: 'Suriname', dialCode: '+597' },
  { code: 'SZ', name: 'Swaziland', dialCode: '+268' },
  { code: 'SE', name: 'Sweden', dialCode: '+46' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41' },
  { code: 'SY', name: 'Syria', dialCode: '+963' },
  { code: 'TW', name: 'Taiwan', dialCode: '+886' },
  { code: 'TJ', name: 'Tajikistan', dialCode: '+992' },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255' },
  { code: 'TH', name: 'Thailand', dialCode: '+66' },
  { code: 'TL', name: 'Timor-Leste', dialCode: '+670' },
  { code: 'TG', name: 'Togo', dialCode: '+228' },
  { code: 'TO', name: 'Tonga', dialCode: '+676' },
  { code: 'TT', name: 'Trinidad and Tobago', dialCode: '+1868' },
  { code: 'TN', name: 'Tunisia', dialCode: '+216' },
  { code: 'TR', name: 'Turkey', dialCode: '+90' },
  { code: 'TM', name: 'Turkmenistan', dialCode: '+993' },
  { code: 'TV', name: 'Tuvalu', dialCode: '+688' },
  { code: 'UG', name: 'Uganda', dialCode: '+256' },
  { code: 'UA', name: 'Ukraine', dialCode: '+380' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44' },
  { code: 'US', name: 'United States', dialCode: '+1' },
  { code: 'UY', name: 'Uruguay', dialCode: '+598' },
  { code: 'UZ', name: 'Uzbekistan', dialCode: '+998' },
  { code: 'VU', name: 'Vanuatu', dialCode: '+678' },
  { code: 'VA', name: 'Vatican City', dialCode: '+379' },
  { code: 'VE', name: 'Venezuela', dialCode: '+58' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84' },
  { code: 'YE', name: 'Yemen', dialCode: '+967' },
  { code: 'ZM', name: 'Zambia', dialCode: '+260' },
  { code: 'ZW', name: 'Zimbabwe', dialCode: '+263' },
];

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<number>(1);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(countryCodes[0]);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [showCountryPicker, setShowCountryPicker] = useState<boolean>(false);
  const [codeSent, setCodeSent] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const validateEmail = (emailStr: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr);
  };

  const handleStep1Continue = () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    if (password.trim().length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    console.log('Email and password validated, moving to step 2');
    setStep(2);
  };

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    const fullPhoneNumber = `${selectedCountry.dialCode}${phoneNumber.trim()}`;
    
    if (phoneNumber.trim().length < 7) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    try {
      setLoading(true);
      console.log('=== SENDING OTP ===');
      console.log('Phone number:', fullPhoneNumber);

      const { data, error } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
      });

      console.log('OTP Response data:', JSON.stringify(data, null, 2));

      if (error) {
        console.error('OTP send error:', error);
        
        let errorMsg = error.message || 'Failed to send verification code';
        if (error.message?.includes('Phone provider not configured')) {
          errorMsg = 'Phone authentication is not configured. Please contact support.';
        } else if (error.message?.includes('rate limit')) {
          errorMsg = 'Too many attempts. Please wait a few minutes before trying again.';
        }
        
        Alert.alert('Error', errorMsg);
        return;
      }

      console.log('Verification code sent successfully');
      setCodeSent(true);
      Alert.alert('Success', 'Verification code sent to your phone! Check your SMS.');
    } catch (error) {
      console.error('Unexpected error sending OTP:', error);
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (verificationCode.trim().length !== 6) {
      Alert.alert('Error', 'Verification code must be 6 digits');
      return;
    }

    const fullPhoneNumber = `${selectedCountry.dialCode}${phoneNumber.trim()}`;

    try {
      setLoading(true);
      console.log('=== STEP 1: Verifying phone OTP ===');

      const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
        phone: fullPhoneNumber,
        token: verificationCode.trim(),
        type: 'sms',
      });

      if (otpError) {
        console.error('Phone verification error:', otpError);
        let errorMessage = otpError.message;
        
        if (otpError.message.includes('expired')) {
          errorMessage = 'Verification code has expired. Please request a new one.';
        } else if (otpError.message.includes('invalid')) {
          errorMessage = 'Invalid verification code. Please try again.';
        }
        
        Alert.alert('Verification Failed', errorMessage);
        return;
      }

      if (!otpData.user || !otpData.session) {
        Alert.alert('Error', 'Failed to verify phone number. Please try again.');
        return;
      }

      console.log('Phone verified successfully!');
      const userId = otpData.user.id;

      console.log('=== STEP 2: Updating user with email ===');
      const { error: updateError } = await supabase.auth.updateUser({
        email: email.trim(),
        password: password.trim(),
      });

      if (updateError) {
        console.error('Update user error:', updateError);
        Alert.alert('Error', 'Failed to update account with email. Please try again.');
        return;
      }

      console.log('=== STEP 3: Creating profile ===');
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: email.trim(),
          phone_number: fullPhoneNumber,
        }, {
          onConflict: 'id',
        });

      if (profileError) {
        console.error('Profile error:', profileError);
      } else {
        console.log('Profile created successfully');
      }

      console.log('=== STEP 4: Signing out and redirecting to login ===');
      await supabase.auth.signOut();

      Alert.alert(
        'Account Created Successfully!',
        'Your phone number has been verified. Please check your email inbox and confirm your email address before signing in.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login' as any),
          },
        ]
      );
    } catch (error) {
      console.error('Unexpected verification error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error('Error signing out after failure:', signOutError);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredCountries = countryCodes.filter((country) => 
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.dialCode.includes(searchQuery) ||
    country.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderCountryPicker = () => (
    <Modal
      visible={showCountryPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCountryPicker(false)}
    >
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerContent}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => {
              setShowCountryPicker(false);
              setSearchQuery('');
            }}>
              <Text style={styles.pickerDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pickerSearchContainer}>
            <Search size={16} color={C.dark.textMuted} />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Search country..."
              placeholderTextColor={C.dark.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              testID="country-search-input"
            />
          </View>
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.countryItem}
                onPress={() => {
                  setSelectedCountry(item);
                  setShowCountryPicker(false);
                  setSearchQuery('');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.countryDialCode}>{item.dialCode}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No countries found</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );

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
              onPress={() => step === 2 ? setStep(1) : router.back()}
              activeOpacity={0.7}
            >
              <ArrowLeft color={C.dark.textSecondary} size={22} />
            </TouchableOpacity>

            {step === 1 ? (
              <>
                <View style={styles.header}>
                  <View style={styles.logoBadge}>
                    <Crosshair color={C.accent.primary} size={24} />
                  </View>
                  <Text style={styles.title}>Create Account</Text>
                  <View style={styles.stepIndicator}>
                    <View style={styles.stepDotActive} />
                    <View style={styles.stepDotInactive} />
                  </View>
                  <Text style={styles.subtitle}>Step 1 of 2: Enter your email and password</Text>
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

                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                    onPress={handleStep1Continue}
                    disabled={loading}
                    activeOpacity={0.8}
                    testID="continue-button"
                  >
                    {loading ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => router.push('/login' as any)}>
                    <Text style={styles.loginLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.header}>
                  <View style={styles.logoBadge}>
                    <Phone color={C.accent.primary} size={24} />
                  </View>
                  <Text style={styles.title}>Verify Phone</Text>
                  <View style={styles.stepIndicator}>
                    <View style={styles.stepDotCompleted} />
                    <View style={styles.stepDotActive} />
                  </View>
                  <Text style={styles.subtitle}>Step 2 of 2: Enter your phone number for verification</Text>
                </View>

                <View style={styles.form}>
                  <View style={styles.phoneInputContainer}>
                    <TouchableOpacity
                      style={styles.countrySelector}
                      onPress={() => setShowCountryPicker(true)}
                      disabled={codeSent}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dialCode, codeSent && styles.disabledText]}>{selectedCountry.dialCode}</Text>
                      <ChevronDown size={14} color={codeSent ? C.dark.textMuted : C.dark.textSecondary} />
                    </TouchableOpacity>
                    <View style={[styles.phoneInputWrapper, codeSent && styles.inputDisabled]}>
                      <Phone size={18} color={codeSent ? C.dark.textMuted : C.dark.textMuted} />
                      <TextInput
                        style={styles.input}
                        placeholder="Phone Number"
                        placeholderTextColor={C.dark.textMuted}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="phone-pad"
                        autoCapitalize="none"
                        testID="phone-input"
                        editable={!codeSent}
                      />
                    </View>
                  </View>

                  {codeSent && (
                    <View style={styles.inputContainer}>
                      <Lock size={18} color={C.dark.textMuted} />
                      <TextInput
                        style={styles.input}
                        placeholder="Verification Code"
                        placeholderTextColor={C.dark.textMuted}
                        value={verificationCode}
                        onChangeText={setVerificationCode}
                        keyboardType="number-pad"
                        maxLength={6}
                        testID="verification-code-input"
                      />
                    </View>
                  )}

                  {!codeSent ? (
                    <TouchableOpacity
                      style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                      onPress={handleSendCode}
                      disabled={loading}
                      activeOpacity={0.8}
                      testID="send-code-button"
                    >
                      {loading ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Send Verification Code</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                        onPress={handleVerifyCode}
                        disabled={loading}
                        activeOpacity={0.8}
                        testID="verify-button"
                      >
                        {loading ? (
                          <ActivityIndicator color="#000" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Verify & Complete Signup</Text>
                        )}
                      </TouchableOpacity>
                      <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => {
                            setCodeSent(false);
                            setVerificationCode('');
                          }}
                          disabled={loading}
                          activeOpacity={0.8}
                          testID="change-number-button"
                        >
                          <Text style={styles.secondaryButtonText}>Change Number</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={handleSendCode}
                          disabled={loading}
                          activeOpacity={0.8}
                          testID="resend-code-button"
                        >
                          <Text style={styles.secondaryButtonText}>Resend Code</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        {renderCountryPicker()}
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
    marginBottom: 12,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  stepDotActive: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent.primary,
  },
  stepDotInactive: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.dark.border,
  },
  stepDotCompleted: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.status.success,
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
  phoneInputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.dark.card,
    borderWidth: 1,
    borderColor: C.dark.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 6,
  },
  dialCode: {
    fontSize: 16,
    color: C.dark.text,
    fontWeight: '600' as const,
  },
  phoneInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.dark.card,
    borderWidth: 1,
    borderColor: C.dark.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: C.dark.textMuted,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: C.dark.card,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  secondaryButtonText: {
    color: C.accent.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: C.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: 500,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.dark.border,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: C.dark.text,
  },
  pickerDone: {
    fontSize: 16,
    color: C.accent.primary,
    fontWeight: '600' as const,
  },
  pickerSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.dark.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginVertical: 12,
    gap: 10,
  },
  pickerSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: C.dark.text,
  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.dark.border,
  },
  countryName: {
    fontSize: 16,
    color: C.dark.text,
  },
  countryDialCode: {
    fontSize: 16,
    color: C.dark.textSecondary,
    fontWeight: '600' as const,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: C.dark.textMuted,
  },
});
