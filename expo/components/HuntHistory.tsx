import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { Trophy, MapPin, Calendar, Crown } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

interface PastEvent {
  id: string;
  city: string;
  date: string;
  prize: number;
  status: string;
  winnerEmail: string | null;
  winnerUserId: string | null;
  declaredAt: string | null;
}

export default function HuntHistory({ userId }: { userId: string | null }) {
  const historyQuery = useQuery<PastEvent[]>({
    queryKey: ['hunt-history'],
    queryFn: async () => {
      // Fetch completed events
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, city, date, prize, price, status')
        .eq('status', 'completed')
        .order('date', { ascending: false })
        .limit(10);

      if (eventsError) {
        console.warn('[HuntHistory] Error fetching events:', eventsError.message);
        return [];
      }
      if (!events || events.length === 0) return [];

      const eventIds = events.map((e: any) => e.id);

      // Fetch winners for these events
      const { data: winners, error: winnersError } = await supabase
        .from('event_winners')
        .select('event_id, winner_email, winner_user_id, declared_at')
        .in('event_id', eventIds);

      if (winnersError) {
        console.warn('[HuntHistory] Error fetching winners:', winnersError.message);
      }

      const winnerMap = new Map<string, any>();
      for (const w of winners || []) {
        winnerMap.set((w as any).event_id, w);
      }

      return events.map((e: any) => {
        const winner = winnerMap.get(e.id);
        const rawDate: string | null = e.date ?? null;
        const parsedDate = rawDate ? new Date(rawDate) : null;
        const validDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;

        return {
          id: e.id,
          city: e.city || 'Unknown',
          date: validDate
            ? validDate.toLocaleDateString('en-GB', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'TBA',
          prize: (e as any).prize_amount ?? (e as any).prize ?? 0,
          status: e.status,
          winnerEmail: winner?.winner_email ?? null,
          winnerUserId: winner?.winner_user_id ?? null,
          declaredAt: winner?.declared_at ?? null,
        } as PastEvent;
      });
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  if (historyQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent.primary} size="small" />
      </View>
    );
  }

  const events = historyQuery.data ?? [];
  if (events.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionAccent} />
        <View>
          <Text style={styles.sectionTitle}>Past Hunts</Text>
          <Text style={styles.sectionSubtitle}>Legacy hunts &amp; winners</Text>
        </View>
      </View>

      <View style={styles.cardsContainer}>
        {events.map((event) => {
          const isMyWin = userId && event.winnerUserId === userId;
          return (
            <View key={event.id} style={styles.historyCard}>
              <View style={styles.cardLeft}>
                <View style={styles.trophyIconContainer}>
                  {isMyWin ? (
                    <Crown color={Colors.accent.primary} size={20} />
                  ) : (
                    <Trophy color={Colors.dark.textMuted} size={18} />
                  )}
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.cardCityRow}>
                    <MapPin color={Colors.dark.textMuted} size={12} />
                    <Text style={styles.cardCity}>{event.city}</Text>
                  </View>
                  <View style={styles.cardMetaRow}>
                    <Calendar color={Colors.dark.textMuted} size={11} />
                    <Text style={styles.cardDate}>{event.date}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardPrize}>{'\u20AC'}{event.prize}</Text>
                {event.winnerEmail ? (
                  <Text style={styles.cardWinner} numberOfLines={1}>
                    {isMyWin ? 'You won!' : event.winnerEmail}
                  </Text>
                ) : (
                  <Text style={styles.cardWinnerUnknown}>No winner</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    marginBottom: 20,
  },
  sectionAccent: {
    width: 4,
    height: 44,
    borderRadius: 2,
    backgroundColor: Colors.accent.primary,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '900' as const,
    color: Colors.dark.text,
    letterSpacing: 1,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: 'center' as const,
  },
  cardsContainer: {
    gap: 12,
  },
  historyCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    flex: 1,
  },
  trophyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent.primaryMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cardInfo: {
    flex: 1,
  },
  cardCityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginBottom: 4,
  },
  cardCity: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.dark.text,
  },
  cardMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  cardDate: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontWeight: '500' as const,
  },
  cardRight: {
    alignItems: 'flex-end' as const,
  },
  cardPrize: {
    fontSize: 18,
    fontWeight: '900' as const,
    color: Colors.accent.primary,
    marginBottom: 2,
  },
  cardWinner: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '500' as const,
    maxWidth: 120,
  },
  cardWinnerUnknown: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontWeight: '500' as const,
    fontStyle: 'italic' as const,
  },
});
