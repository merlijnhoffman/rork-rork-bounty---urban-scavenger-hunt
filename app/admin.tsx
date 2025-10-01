import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Send, Clock, Hash, Key, AlertCircle, CheckCircle } from 'lucide-react-native';
import { trpcClient } from '@/lib/trpc';
import { router } from 'expo-router';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [eventId, setEventId] = useState<string>('1'); // Default event ID
  const [clueText, setClueText] = useState<string>('');
  const [hint, setHint] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState<string>('1');
  const [adminKey, setAdminKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastSentClue, setLastSentClue] = useState<string | null>(null);

  const handleSendClue = async () => {
    if (!clueText.trim()) {
      Alert.alert('Error', 'Please enter clue text');
      return;
    }

    if (!adminKey.trim()) {
      Alert.alert('Error', 'Please enter admin key');
      return;
    }

    const orderNum = parseInt(orderNumber);
    if (isNaN(orderNum) || orderNum < 1) {
      Alert.alert('Error', 'Please enter a valid order number (1 or higher)');
      return;
    }

    setIsLoading(true);

    try {
      const response = await trpcClient.clues.sendClue.mutate({
        eventId,
        text: clueText.trim(),
        hint: hint.trim() || undefined,
        orderNumber: orderNum,
        adminKey: adminKey.trim(),
      });

      console.log('Clue sent successfully:', response);
      
      Alert.alert(
        'Success!', 
        `Clue #${orderNum} has been sent to all hunters with tickets.`,
        [
          {
            text: 'Send Another',
            onPress: () => {
              setLastSentClue(clueText);
              setClueText('');
              setHint('');
              setOrderNumber((orderNum + 1).toString());
            }
          },
          {
            text: 'Done',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      console.error('Error sending clue:', error);
      Alert.alert(
        'Error', 
        error instanceof Error ? error.message : 'Failed to send clue. Please check your admin key and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A']}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>ADMIN PANEL</Text>
            <Text style={styles.subtitle}>Send Live Clues</Text>
          </View>

          {lastSentClue && (
            <View style={styles.successContainer}>
              <CheckCircle color="#00FF88" size={20} />
              <Text style={styles.successText}>Last clue sent successfully!</Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <View style={styles.inputHeader}>
                <Hash color="#00D4FF" size={16} />
                <Text style={styles.inputLabel}>Event ID</Text>
              </View>
              <TextInput
                style={styles.input}
                value={eventId}
                onChangeText={setEventId}
                placeholder="Enter event ID"
                placeholderTextColor="#666"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputHeader}>
                <Key color="#00D4FF" size={16} />
                <Text style={styles.inputLabel}>Admin Key</Text>
              </View>
              <TextInput
                style={styles.input}
                value={adminKey}
                onChangeText={setAdminKey}
                placeholder="Enter admin key"
                placeholderTextColor="#666"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputHeader}>
                <Hash color="#00D4FF" size={16} />
                <Text style={styles.inputLabel}>Order Number</Text>
              </View>
              <TextInput
                style={styles.input}
                value={orderNumber}
                onChangeText={setOrderNumber}
                placeholder="1"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputHeader}>
                <AlertCircle color="#00D4FF" size={16} />
                <Text style={styles.inputLabel}>Clue Text</Text>
                <Text style={styles.required}>*</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={clueText}
                onChangeText={setClueText}
                placeholder="Enter the clue text that hunters will see..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputHeader}>
                <Clock color="#00D4FF" size={16} />
                <Text style={styles.inputLabel}>Hint (Optional)</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={hint}
                onChangeText={setHint}
                placeholder="Enter an optional hint..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
              onPress={handleSendClue}
              disabled={isLoading}
            >
              <Send color="#000" size={20} />
              <Text style={styles.sendButtonText}>
                {isLoading ? 'SENDING...' : 'SEND CLUE'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>How it works:</Text>
            <Text style={styles.infoText}>
              • Clues are sent immediately to all users with valid tickets{'\n'}
              • Users will see clues in order based on the order number{'\n'}
              • Only users with tickets for the specified event can see clues{'\n'}
              • Clues are automatically timestamped when sent
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
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
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#00D4FF',
    letterSpacing: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#00FF88',
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: '#00FF88',
    marginLeft: 8,
    fontWeight: '500',
  },
  form: {
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  required: {
    fontSize: 14,
    color: '#FF6B6B',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    minHeight: 80,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#00D4FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#666',
  },
  sendButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 8,
  },
  infoContainer: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00D4FF',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00D4FF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
  },
});