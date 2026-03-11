import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TicketTier } from '@/types/payment';
import { supabase } from '@/lib/supabase';

export interface GameEvent {
  id: string;
  city: string;
  date: string;
  ticketPrice: number;
  prize: number;
  registeredPlayers: number;
  startTime: string;
  status: 'scheduled' | 'live' | 'completed';
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
}

const [GameProvider, useGameStoreInternal] = createContextHook(() => {
  
  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null);

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const query = supabase
          .from('events')
          .select('*')
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data, error } = await Promise.race([
          query,
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error('Request timeout'));
            });
          }),
        ]);

        clearTimeout(timeoutId);

        if (error) {
          console.warn('Supabase query error:', error.message || 'Unknown');
          throw new Error(error.message || 'Failed to fetch event');
        }

        if (!data) {
          console.log('No events found in database');
          return null;
        }

        console.log('Event fetched successfully:', data.id);
        const event: GameEvent = {
          id: data.id,
          city: data.city || 'Amsterdam',
          date: new Date(data.start_time).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          ticketPrice: (data as any).ticket_price ?? (data as any).price ?? 25,
          prize: (data as any).prize_amount ?? (data as any).prize ?? 1000,
          registeredPlayers: 189,
          startTime: data.start_time,
          status: (data.status as 'scheduled' | 'live' | 'completed') || 'scheduled',
        };
        return event;
      } catch (err: any) {
        clearTimeout(timeoutId);
        const message = err?.message || 'Unknown error';
        const isNetworkError = message === 'Load failed' || message === 'Network request failed' || message === 'Failed to fetch' || message === 'The operation was aborted.' || err?.name === 'AbortError';
        if (isNetworkError) {
          console.warn('Network error fetching event - will retry automatically');
        } else {
          console.warn('Error fetching event:', message);
        }
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
    staleTime: 120000,
    gcTime: 300000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (eventQuery.data !== undefined) {
      setCurrentEvent(eventQuery.data);
    }
  }, [eventQuery.data]);

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
  }), [currentEvent, isGameActive, userTicket, clues, gameStartTime, isLoading, eventQuery.isLoading, purchaseError, purchaseTicket, addClue, enableTicketChecking, disableTicketChecking, currentUserId, ticketCheckEnabled, eventQuery.error, eventQuery.refetch, eventQuery.isFetching]);
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
      refetchEvent: async () => ({ data: null, error: null, isError: false, isSuccess: false, failureCount: 0, failureReason: null, errorUpdateCount: 0, status: 'success' as const, fetchStatus: 'idle' as const, dataUpdatedAt: 0, errorUpdatedAt: 0, isLoading: false, isFetching: false, isFetched: false, isFetchedAfterMount: false, isPaused: false, isPending: false, isPlaceholderData: false, isRefetchError: false, isRefetching: false, isStale: false, isInitialLoading: false }),
      isEventFetching: false,
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