import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Send, Radius, Target, AlertCircle, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { useGameStore } from '@/store/game-store';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery } from '@tanstack/react-query';

export default function AdminPanel() {
  const insets = useSafeAreaInsets();
  const { currentEvent } = useGameStore();
  
  const [clueText, setClueText] = useState<string>('');
  const [clueHint, setClueHint] = useState<string>('');
  const [nextClueOrder, setNextClueOrder] = useState<number>(1);
  const [zoneSize, setZoneSize] = useState<string>('500');

  const cluesQuery = useQuery({
    queryKey: ['admin-clues', currentEvent?.id],
    queryFn: async () => {
      if (!currentEvent) return [];
      
      const { data, error } = await supabase
        .from('clues')
        .select('*')
        .eq('event_id', currentEvent.id)
        .order('order_number', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentEvent,
  });

  const sendClueMutation = useMutation({
    mutationFn: async (params: { text: string; hint?: string; order: number }) => {
      if (!currentEvent) throw new Error('No event selected');
      
      const { data, error } = await supabase
        .from('clues')
        .insert({
          event_id: currentEvent.id,
          text: params.text,
          hint: params.hint || null,
          order_number: params.order,
          release_time: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Clue sent to all hunters!');
      setClueText('');
      setClueHint('');
      setNextClueOrder(prev => prev + 1);
      cluesQuery.refetch();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to send clue');
    },
  });

  const handleSendClue = () => {
    if (!clueText.trim()) {
      Alert.alert('Error', 'Please enter clue text');
      return;
    }

    Alert.alert(
      'Confirm Send',
      `Send clue #${nextClueOrder} to all hunters?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            sendClueMutation.mutate({
              text: clueText.trim(),
              hint: clueHint.trim() || undefined,
              order: nextClueOrder,
            });
          },
        },
      ]
    );
  };

  const handleUpdateZone = () => {
    const size = parseInt(zoneSize);
    if (isNaN(size) || size < 10 || size > 5000) {
      Alert.alert('Error', 'Zone size must be between 10 and 5000 meters');
      return;
    }

    Alert.alert(
      'Success',
      `Zone size updated to ${size}m. This will be applied to the next clue sent.`,
      [{ text: 'OK' }]
    );
  };

  const recentClues = cluesQuery.data?.slice(0, 5) || [];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}>
          <View style={styles.header}>
            <Shield color="#FF6B6B" size={32} />
            <Text style={styles.title}>ADMIN PANEL</Text>
            <Text style={styles.subtitle}>Live Event Control</Text>
          </View>

          {!currentEvent && (
            <View style={styles.noEventCard}>
              <AlertCircle color="#FFA500" size={48} />
              <Text style={styles.noEventTitle}>No Active Event</Text>
              <Text style={styles.noEventText}>
                Create an event in the database to start controlling hunts
              </Text>
            </View>
          )}

          {currentEvent && (
            <>
              <View style={styles.eventCard}>
                <Text style={styles.eventLabel}>CURRENT EVENT</Text>
                <Text style={styles.eventTitle}>{currentEvent.city}</Text>
                <Text style={styles.eventDate}>{currentEvent.date}</Text>
                <View style={styles.eventStats}>
                  <View style={styles.eventStat}>
                    <Text style={styles.eventStatLabel}>Prize</Text>
                    <Text style={styles.eventStatValue}>€{currentEvent.prize}</Text>
                  </View>
                  <View style={styles.eventStat}>
                    <Text style={styles.eventStatLabel}>Hunters</Text>
                    <Text style={styles.eventStatValue}>{currentEvent.registeredPlayers}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Send color="#00D4FF" size={24} />
                  <Text style={styles.sectionTitle}>Send Live Clue</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Clue Order Number</Text>
                  <View style={styles.orderControl}>
                    <TouchableOpacity
                      style={styles.orderButton}
                      onPress={() => setNextClueOrder(Math.max(1, nextClueOrder - 1))}
                    >
                      <Text style={styles.orderButtonText}>-</Text>
                    </TouchableOpacity>
                    <View style={styles.orderDisplay}>
                      <Text style={styles.orderText}>{nextClueOrder}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.orderButton}
                      onPress={() => setNextClueOrder(nextClueOrder + 1)}
                    >
                      <Text style={styles.orderButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Clue Text (Required)</Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Enter detailed clue about bounty location or appearance..."
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={4}
                    value={clueText}
                    onChangeText={setClueText}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Hint (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Brief hint if needed..."
                    placeholderTextColor="#666"
                    value={clueHint}
                    onChangeText={setClueHint}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (sendClueMutation.isPending || !clueText.trim()) && styles.sendButtonDisabled
                  ]}
                  onPress={handleSendClue}
                  disabled={sendClueMutation.isPending || !clueText.trim()}
                >
                  <Send color={!clueText.trim() ? '#666' : '#000'} size={20} />
                  <Text style={[
                    styles.sendButtonText,
                    !clueText.trim() && styles.sendButtonTextDisabled
                  ]}>
                    {sendClueMutation.isPending ? 'Sending...' : 'Send Clue to All Hunters'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Radius color="#00D4FF" size={24} />
                  <Text style={styles.sectionTitle}>Zone Size Control</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Search Zone Radius (meters)</Text>
                  <View style={styles.zoneControl}>
                    <TextInput
                      style={styles.zoneInput}
                      placeholder="500"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={zoneSize}
                      onChangeText={setZoneSize}
                    />
                    <Text style={styles.zoneSuffix}>meters</Text>
                  </View>
                  <Text style={styles.helperText}>
                    Recommended: 500m - Shrink as hunt progresses
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={handleUpdateZone}
                >
                  <Target color="#00D4FF" size={20} />
                  <Text style={styles.updateButtonText}>Update Zone Size</Text>
                </TouchableOpacity>
              </View>

              {recentClues.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Clock color="#00D4FF" size={24} />
                    <Text style={styles.sectionTitle}>Recent Clues</Text>
                  </View>

                  {recentClues.map((clue) => (
                    <View key={clue.id} style={styles.clueHistoryCard}>
                      <View style={styles.clueHistoryHeader}>
                        <View style={styles.clueHistoryOrder}>
                          <Text style={styles.clueHistoryOrderText}>#{clue.order_number}</Text>
                        </View>
                        <Text style={styles.clueHistoryTime}>
                          {new Date(clue.release_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <Text style={styles.clueHistoryText}>{clue.text}</Text>
                      {clue.hint && (
                        <Text style={styles.clueHistoryHint}>Hint: {clue.hint}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Exit Admin Panel</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
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
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF6B6B',
    letterSpacing: 2,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  noEventCard: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginBottom: 20,
  },
  noEventTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  noEventText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  eventCard: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    borderLeftWidth: 4,
    borderLeftColor: '#00D4FF',
  },
  eventLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00D4FF',
    letterSpacing: 1,
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  eventStats: {
    flexDirection: 'row',
    gap: 24,
  },
  eventStat: {
    flex: 1,
  },
  eventStatLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  eventStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00D4FF',
  },
  section: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCC',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFF',
  },
  textArea: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFF',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  orderControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderButton: {
    width: 48,
    height: 48,
    backgroundColor: '#00D4FF',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  orderDisplay: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#00D4FF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  orderText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00D4FF',
  },
  zoneControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  zoneInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFF',
  },
  zoneSuffix: {
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4FF',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  sendButtonTextDisabled: {
    color: '#666',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A1A2A',
    borderWidth: 2,
    borderColor: '#00D4FF',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00D4FF',
    letterSpacing: 0.5,
  },
  clueHistoryCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#00D4FF',
  },
  clueHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  clueHistoryOrder: {
    backgroundColor: '#00D4FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clueHistoryOrderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  clueHistoryTime: {
    fontSize: 12,
    color: '#888',
  },
  clueHistoryText: {
    fontSize: 14,
    color: '#FFF',
    lineHeight: 20,
    marginBottom: 8,
  },
  clueHistoryHint: {
    fontSize: 12,
    color: '#FFA500',
    fontStyle: 'italic',
  },
  backButton: {
    backgroundColor: '#2A1A1A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
});
