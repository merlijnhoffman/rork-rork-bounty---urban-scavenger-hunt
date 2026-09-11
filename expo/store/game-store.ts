import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TicketTier } from '@/types/payment';
import { supabase } from '@/lib/supabase';

export interface GameEvent {
  id: string;
  city: string;
  date: string;
  ticketPrice: number;
  /** Live prize pool = prizeBase + prizePerTicket * playerCount */
  prize: number;
  /** Starting prize configured by the admin. */
  prizeBase: number;
  /** Amount added to the pool for every ticket sold. */
  prizePerTicket: number;
  /** Number of tickets sold for this event (drives the live pool). */
  playerCount: number;
  registeredPlayers: number;
  startTime: string;
  status: 'scheduled' | 'live' | 'completed';
  /** Last time the admin modified this event (used to detect hunt resets). */
  updatedAt: string;
}

export interface UserTicket {
  id: string;
  eventId: string;
  tier: TicketTier;
  purchaseDate: string;
  paymentIntentId: string;
}

export interface Clue {
  id: string;
  text: string;
  hint?: string;
  timestamp: string;
  order: number;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
}

const [GameProvider, useGameStoreInternal] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [isGameActive, setIsGameActive] = useState<boolean>(false);
  const [userTicket, setUserTicket] = useState<UserTicket | null>(null);
  const [clues, setClues] = useState<Clue[]>([]);
  const [gameStartTime] = useState<string>('Saturday, Dec 28, 2024 • 2:00 PM EST');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ticketCheckEnabled, setTicketCheckEnabled] = useState<boolean>(false);

  const eventQuery = useQuery({
    queryKey: ['current-event'],
    queryFn: async () => {
      console.log('Fetching current event from Supabase...');

      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn('Supabase query error:', error.message || 'Unknown');
          throw new Error(error.message || 'Failed to fetch event');
        }

        if (!data) {
          console.log('No events found in database');
          return null;
        }

        console.log('Event fetched successfully:', data.id);
        const rawDate: string | null = (data as any).date ?? null;
        const parsedDate = rawDate ? new Date(rawDate) : null;
        const validDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;
        const event: Omit<GameEvent, 'prize' | 'playerCount' | 'registeredPlayers'> = {
          id: data.id,
          city: data.city || 'Amsterdam',
          date: validDate
            ? validDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '',
          ticketPrice: (data as any).ticket_price ?? (data as any).price ?? 25,
          prizeBase: (data as any).prize_base ?? 500,
          prizePerTicket: (data as any).prize_per_ticket ?? 10,
          startTime: validDate ? validDate.toISOString() : '',
          status: (data.status as 'scheduled' | 'live' | 'completed') || 'scheduled',
          updatedAt: (data as any).updated_at ?? (data as any).created_at ?? '',
        };
        return event;
      } catch (err: any) {
        const message = err?.message || 'Unknown error';
        console.warn('Error fetching event:', message);
        throw err;
      }
    },
    retry: (failureCount, error: any) => {
      const message = error?.message || '';
      const isNetworkError = message === 'Load failed' || message === 'Network request failed' || message === 'Failed to fetch' || error?.name === 'AbortError';
      if (isNetworkError) return failureCount < 3;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 20000),
    staleTime: 15000,
    gcTime: 300000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const eventId = eventQuery.data?.id ?? null;

  // Live prize pool: number of tickets sold for this event. Uses the
  // `event_prize_pool` view (set up via the admin SQL script) so every
  // player can see how the pot grows — without reading other users' tickets.
  const poolQuery = useQuery({
    queryKey: ['prize-pool', eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<number> => {
      if (!eventId) return 0;
      try {
        const { data, error } = await supabase
          .from('event_prize_pool')
          .select('event_id, player_count')
          .eq('event_id', eventId)
          .maybeSingle();
        if (error) {
          console.warn('[PrizePool] View query error (run the prize-pool SQL script):', error.message);
          return 0;
        }
        return ((data as any)?.player_count as number) ?? 0;
      } catch (err) {
        console.warn('[PrizePool] Failed to fetch player count:', err);
        return 0;
      }
    },
    staleTime: 10000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Realtime: as soon as anyone buys a ticket, every player's prize pool
  // updates within seconds. Falls back to the 15s polling above.
  useEffect(() => {
    if (!eventId) return;
    const subscription = supabase
      .channel('ticket-sales-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          console.log('[PrizePool] New ticket sold via realtime:', (payload.new as any)?.event_id);
          void queryClient.invalidateQueries({ queryKey: ['prize-pool', eventId] });
        }
      )
      .subscribe();

    return () => {
      void subscription.unsubscribe();
    };
  }, [eventId, queryClient]);

  const currentEvent: GameEvent | null = useMemo(() => {
    const base = eventQuery.data;
    if (!base) return null;
    const playerCount = poolQuery.data ?? 0;
    return {
      ...base,
      playerCount,
      registeredPlayers: playerCount,
      prize: base.prizeBase + base.prizePerTicket * playerCount,
    };
  }, [eventQuery.data, poolQuery.data]);

  useEffect(() => {
    console.log('Setting up realtime subscription for event status changes');
    const subscription = supabase
      .channel('event-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
        },
        (payload) => {
          console.log('Event updated via realtime:', payload.new);
          void queryClient.invalidateQueries({ queryKey: ['current-event'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
        },
        (payload) => {
          console.log('New event created via realtime:', payload.new);
          void queryClient.invalidateQueries({ queryKey: ['current-event'] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up event realtime subscription');
      void subscription.unsubscribe();
    };
  }, [queryClient]);

  // Enable ticket checking when user is set
  const enableTicketChecking = useCallback((userId: string) => {
    console.log('Enabling ticket checking for user:', userId);
    setCurrentUserId(userId);
    setTicketCheckEnabled(true);
  }, []);

  // Disable ticket checking (e.g., when user logs out)
  const disableTicketChecking = useCallback(() => {
    console.log('Disabling ticket checking');
    setCurrentUserId(null);
    setTicketCheckEnabled(false);
    setUserTicket(null);
  }, []);

  const purchaseTicket = useCallback(async (tier: TicketTier, paymentIntentId: string, isLoggedIn: boolean, user: any) => {
    if (!currentEvent) return;

    // Check if user is logged in
    if (!isLoggedIn || !user) {
      setPurchaseError('You must create an account before purchasing a ticket');
      throw new Error('Authentication required');
    }

    // Check if user already has a ticket
    if (userTicket) {
      setPurchaseError('You already have a ticket for this event');
      throw new Error('Ticket already purchased');
    }

    setIsLoading(true);
    setPurchaseError(null);

    try {
      // Create ticket record
      const ticket: UserTicket = {
        id: `ticket_${Date.now()}`,
        eventId: currentEvent.id,
        tier,
        purchaseDate: new Date().toISOString(),
        paymentIntentId,
      };

      console.log('Ticket purchased successfully:', ticket);

      setUserTicket(ticket);
      setIsLoading(false);

      // Enable ticket checking for this user
      enableTicketChecking(user.id);

      return ticket;
    } catch (error) {
      setIsLoading(false);
      setPurchaseError('Failed to create ticket. Please contact support.');
      throw error;
    }
  }, [currentEvent, userTicket, enableTicketChecking]);

  const addClue = useCallback((clue: Clue) => {
    setClues(prev => [...prev, clue].sort((a, b) => a.order - b.order));
  }, []);

  return useMemo(() => ({
    currentEvent,
    isGameActive,
    userTicket,
    hasTicket: !!userTicket,
    clues,
    gameStartTime,
    isLoading: isLoading || eventQuery.isLoading,
    purchaseError,
    purchaseTicket,
    setGameActive: setIsGameActive,
    addClue,
    enableTicketChecking,
    disableTicketChecking,
    currentUserId,
    ticketCheckEnabled,
    eventError: eventQuery.error ? (eventQuery.error as Error).message || 'Failed to load event' : null,
    refetchEvent: eventQuery.refetch,
    isEventFetching: eventQuery.isFetching,
    refetchPool: poolQuery.refetch,
  }), [currentEvent, isGameActive, userTicket, clues, gameStartTime, isLoading, eventQuery.isLoading, eventQuery.error, eventQuery.refetch, eventQuery.isFetching, purchaseError, purchaseTicket, addClue, enableTicketChecking, disableTicketChecking, currentUserId, ticketCheckEnabled, poolQuery.refetch]);
});

// Safe wrapper hook that ensures the context is available
export function useGameStore() {
  const context = useGameStoreInternal();
  if (!context) {
    // Return default values instead of throwing error to prevent crashes
    return {
      currentEvent: null,
      isGameActive: false,
      userTicket: null,
      hasTicket: false,
      clues: [],
      gameStartTime: '',
      isLoading: false,
      purchaseError: null,
      purchaseTicket: async () => null,
      setGameActive: () => {},
      addClue: () => {},
      enableTicketChecking: () => {},
      disableTicketChecking: () => {},
      currentUserId: null,
      ticketCheckEnabled: false,
      eventError: null,
      refetchEvent: async () => ({ data: null, error: null, isError: false, isSuccess: false, failureCount: 0, failureReason: null, errorUpdateCount: 0, errorUpdatedAt: 0, dataUpdatedAt: 0, status: 'success' as const, fetchStatus: 'idle' as const, isFetching: false, isFetched: false, isFetchedAfterMount: false, isPaused: false, isPending: false, isPlaceholderData: false, isRefetchError: false, isRefetching: false, isStale: false, isInitialLoading: false }),
      isEventFetching: false,
      refetchPool: async () => ({ data: null, error: null, isError: false, isSuccess: false, failureCount: 0, failureReason: null, errorUpdateCount: 0, errorUpdatedAt: 0, dataUpdatedAt: 0, status: 'success' as const, fetchStatus: 'idle' as const, isFetching: false, isFetched: false, isFetchedAfterMount: false, isPaused: false, isPending: false, isPlaceholderData: false, isRefetchError: false, isRefetching: false, isStale: false, isInitialLoading: false }),
    };
  }
  return context;
}

export { GameProvider };

export const mockClues: Clue[] = [
  {
    id: '1',
    text: 'Where the city never sleeps, find the bronze bull that charges through the financial district. Look for the artist\'s signature near its mighty horns.',
    hint: 'Wall Street\'s most famous sculpture',
    timestamp: '2:00 PM',
    order: 1,
  },
  {
    id: '2',
    text: 'Ascend to where King Kong once climbed, but stop at the observation deck where art meets sky. The target awaits where the city spreads below like a glittering carpet.',
    hint: 'The most famous building in NYC',
    timestamp: '2:30 PM',
    order: 2,
  },
  {
    id: '3',
    text: 'In the heart of the theater district, find the red steps where the world watches. The target hides where Broadway dreams come true under the bright lights.',
    hint: 'Times Square\'s iconic gathering place',
    timestamp: '3:00 PM',
    order: 3,
  },
];
