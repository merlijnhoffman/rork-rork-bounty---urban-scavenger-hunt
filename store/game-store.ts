import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo } from 'react';
import { TicketTier } from '@/types/payment';

export interface GameEvent {
  id: string;
  city: string;
  date: string;
  ticketPrice: number;
  prize: number;
  registeredPlayers: number;
  startTime: string;
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
  
  const [currentEvent] = useState<GameEvent>({
    id: '00000000-0000-0000-0000-000000000001',
    city: 'New York City',
    date: 'Saturday, Dec 28, 2024 • 2:00 PM EST',
    ticketPrice: 25,
    prize: 5000,
    registeredPlayers: 247,
    startTime: '2024-12-28T14:00:00Z',
  });

  const [isGameActive, setIsGameActive] = useState<boolean>(false);
  const [userTicket, setUserTicket] = useState<UserTicket | null>(null);
  const [clues, setClues] = useState<Clue[]>([]);
  const [gameStartTime] = useState<string>('Saturday, Dec 28, 2024 • 2:00 PM EST');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ticketCheckEnabled, setTicketCheckEnabled] = useState<boolean>(false);

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
    isLoading,
    purchaseError,
    purchaseTicket,
    setGameActive: setIsGameActive,
    addClue,
    enableTicketChecking,
    disableTicketChecking,
    currentUserId,
    ticketCheckEnabled,
  }), [currentEvent, isGameActive, userTicket, clues, gameStartTime, isLoading, purchaseError, purchaseTicket, addClue, enableTicketChecking, disableTicketChecking, currentUserId, ticketCheckEnabled]);
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