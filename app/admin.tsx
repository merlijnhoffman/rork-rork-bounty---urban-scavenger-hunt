import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Send, Radius, Target, AlertCircle, Clock, Play } from 'lucide-react-native';
import { router } from 'expo-router';
import { useGameStore } from '@/store/game-store';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';


export default function AdminPanel() {
  const insets = useSafeAreaInsets();
  const { currentEvent } = useGameStore();
  const { user } = useAuth();
  
  const [isCheckingAdmin, setIsCheckingAdmin] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  const [clueText, setClueText] = useState<string>('');
  const [zoneSize, setZoneSize] = useState<string>('500');
  const [eventStatus, setEventStatus] = useState<'scheduled' | 'live' | 'completed'>('scheduled');

  useEffect(() => {
    if (currentEvent) {
      setEventStatus(currentEvent.status);
    }
  }, [currentEvent]);

  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        setIsCheckingAdmin(false);
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data?.is_admin === true);
        }
      } catch (error) {
        console.error('Unexpected error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    }

    checkAdminStatus();
  }, [user]);

  const cluesQuery = useQuery({
    queryKey: ['admin-clues', currentEvent?.id, currentEvent],
    queryFn: async () => {
      if (!currentEvent) return [];
      
      const { data, error } = await supabase
        .from('clues')
        .select('*')
        .eq('event_id', currentEvent.id)
        .order('release_time', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentEvent,
  });

  const updateEventStatusMutation = useMutation({
    mutationFn: async (newStatus: 'scheduled' | 'live' | 'completed') => {
      if (!currentEvent) throw new Error('No event selected');
      
      const { data, error } = await supabase
        .from('events')
        .update({ status: newStatus })
        .eq('id', currentEvent.id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setEventStatus(data.status);
      Alert.alert('Success', `Event status updated to ${data.status.toUpperCase()}`);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update event status');
    },
  });

  const sendClueMutation = useMutation({
    mutationFn: async (params: { text: string }) => {
      if (!currentEvent) throw new Error('No event selected');
      
      const existingClues = cluesQuery.data || [];
      const nextOrderNumber = existingClues.length > 0 
        ? Math.max(...existingClues.map(c => c.order_number || 0)) + 1 
        : 1;
      
      const { data, error } = await supabase
        .from('clues')
        .insert({
          event_id: currentEvent.id,
          text: params.text,
          order_number: nextOrderNumber,
          release_time: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error inserting clue:', error);
        throw new Error(error.message || 'Failed to insert clue');
      }
      return data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Clue sent to all hunters!');
      setClueText('');
      cluesQuery.refetch();
    },
    onError: (error: any) => {
      console.error('Mutation error:', error);
      Alert.alert('Error', error.message || 'Failed to send clue');
    },
  });

  const handleStartEvent = () => {
    Alert.alert(
      'Start Event',
      'This will make the hunt LIVE for all hunters. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Hunt',
          onPress: () => updateEventStatusMutation.mutate('live'),
          style: 'default',
        },
      ]
    );
  };

  const handleEndEvent = () => {
    Alert.alert(
      'End Event',
      'This will mark the hunt as completed. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Hunt',
          onPress: () => updateEventStatusMutation.mutate('completed'),
          style: 'destructive',
        },
      ]
    );
  };

  const handleSendClue = () => {
    if (!clueText.trim()) {
      Alert.alert('Error', 'Please enter clue text');
      return;
    }

    if (eventStatus !== 'live') {
      Alert.alert('Error', 'Event must be LIVE to send clues');
      return;
    }

    Alert.alert(
      'Confirm Send',
      'Send clue to all hunters?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            sendClueMutation.mutate({
              text: clueText.trim(),
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



  if (isCheckingAdmin) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A']}
          style={styles.gradient}
        >
          <View style={[styles.centerContent, { paddingTop: insets.top }]}>
            <ActivityIndicator size="large" color="#00D4FF" />
            <Text style={styles.loadingText}>Checking admin access...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A']}
          style={styles.gradient}
        >
          <View style={[styles.centerContent, { paddingTop: insets.top }]}>
            <Shield color="#FF6B6B" size={64} />
            <Text style={styles.accessDeniedTitle}>ACCESS DENIED</Text>
            <Text style={styles.accessDeniedText}>
              You do not have admin privileges
            </Text>
            <TouchableOpacity
              style={styles.backToAppButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backToAppButtonText}>Back to App</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

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
                    <Text style={styles.eventStatLabel}>Status</Text>
                    <View style={styles.statusBadge}>
                      <View style={[
                        styles.statusDot,
                        eventStatus === 'live' && styles.statusDotLive,
                        eventStatus === 'completed' && styles.statusDotCompleted,
                      ]} />
                      <Text style={[
                        styles.statusText,
                        eventStatus === 'live' && styles.statusTextLive,
                        eventStatus === 'completed' && styles.statusTextCompleted,
                      ]}>{eventStatus.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Target color="#00D4FF" size={24} />
                  <Text style={styles.sectionTitle}>Event Control</Text>
                </View>

                {eventStatus === 'scheduled' && (
                  <TouchableOpacity
                    style={styles.startEventButton}
                    onPress={handleStartEvent}
                    disabled={updateEventStatusMutation.isPending}
                  >
                    <Play color="#000" size={20} />
                    <Text style={styles.startEventButtonText}>
                      {updateEventStatusMutation.isPending ? 'Starting...' : 'START HUNT NOW'}
                    </Text>
                  </TouchableOpacity>
                )}

                {eventStatus === 'live' && (
                  <View>
                    <View style={styles.liveEventBanner}>
                      <View style={styles.livePulse} />
                      <Text style={styles.liveEventText}>EVENT IS LIVE</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.endEventButton}
                      onPress={handleEndEvent}
                      disabled={updateEventStatusMutation.isPending}
                    >
                      <Text style={styles.endEventButtonText}>
                        {updateEventStatusMutation.isPending ? 'Ending...' : 'End Hunt'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {eventStatus === 'completed' && (
                  <View style={styles.completedBanner}>
                    <Text style={styles.completedText}>Hunt has ended</Text>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Send color="#00D4FF" size={24} />
                  <Text style={styles.sectionTitle}>Send Live Clue</Text>
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

                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (sendClueMutation.isPending || !clueText.trim() || eventStatus !== 'live') && styles.sendButtonDisabled
                  ]}
                  onPress={handleSendClue}
                  disabled={sendClueMutation.isPending || !clueText.trim() || eventStatus !== 'live'}
                >
                  <Send color={(!clueText.trim() || eventStatus !== 'live') ? '#666' : '#000'} size={20} />
                  <Text style={[
                    styles.sendButtonText,
                    (!clueText.trim() || eventStatus !== 'live') && styles.sendButtonTextDisabled
                  ]}>
                    {sendClueMutation.isPending ? 'Sending...' : 
                     eventStatus !== 'live' ? 'Event Must Be Live' : 
                     'Send Clue to All Hunters'}
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    marginTop: 16,
  },
  accessDeniedTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FF6B6B',
    letterSpacing: 2,
    marginTop: 24,
    textAlign: 'center',
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#888',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  backToAppButton: {
    backgroundColor: '#00D4FF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 32,
  },
  backToAppButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFA500',
  },
  statusDotLive: {
    backgroundColor: '#00FF88',
  },
  statusDotCompleted: {
    backgroundColor: '#888',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFA500',
  },
  statusTextLive: {
    color: '#00FF88',
  },
  statusTextCompleted: {
    color: '#888',
  },
  startEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00FF88',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 8,
  },
  startEventButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  liveEventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00FF88',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 10,
  },
  livePulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000',
  },
  liveEventText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
  endEventButton: {
    backgroundColor: '#2A1A1A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  endEventButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  completedBanner: {
    backgroundColor: '#2A2A2A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 1,
  },
});
