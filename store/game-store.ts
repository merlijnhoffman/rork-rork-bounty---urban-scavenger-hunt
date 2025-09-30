import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo } from 'react';
import { useUserStore } from './user-store';

export interface GameEvent {
  id: string;
  city: string;
  date: string;
  ticketPrice: number;
  prize: number;
  registeredPlayers: number;
  startTime: string;
}

export interface Clue {
  id: string;
  text: string;
  hint?: string;
  timestamp: string;
  order: number;
}

export const [GameProvider, useGameStore] = createContextHook(() => {
  const { isLoggedIn, user } = useUserStore();
  
  const [currentEvent] = useState<GameEvent>({
    id: '1',
    city: 'New York City',
    date: 'Saturday, Dec 28, 2024 • 2:00 PM EST',
    ticketPrice: 25,
    prize: 5000,
    registeredPlayers: 247,
    startTime: '2024-12-28T14:00:00Z',
  });

  const [isGameActive, setIsGameActive] = useState<boolean>(false);
  const [hasTicket, setHasTicket] = useState<boolean>(false);
  const [clues, setClues] = useState<Clue[]>([]);
  const [gameStartTime] = useState<string>('Saturday, Dec 28, 2024 • 2:00 PM EST');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const purchaseTicket = useCallback(async () => {
    if (!currentEvent) return;
    
    // Check if user is logged in
    if (!isLoggedIn || !user) {
      setPurchaseError('You must create an account before purchasing a ticket');
      throw new Error('Authentication required');
    }
    
    // Check if user already has a ticket
    if (hasTicket) {
      setPurchaseError('You already have a ticket for this event');
      throw new Error('Ticket already purchased');
    }
    
    setIsLoading(true);
    setPurchaseError(null);
    
    try {
      await new Promise(resolve => {
        if (typeof resolve === 'function') {
          setTimeout(resolve, 2000);
        }
      });
      
      console.log('Processing payment with Stripe for user:', user.email);
      
      setHasTicket(true);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      setPurchaseError('Payment failed. Please try again.');
      throw error;
    }
  }, [currentEvent, isLoggedIn, user, hasTicket]);

  const addClue = useCallback((clue: Clue) => {
    setClues(prev => [...prev, clue].sort((a, b) => a.order - b.order));
  }, []);

  return useMemo(() => ({
    currentEvent,
    isGameActive,
    hasTicket,
    clues,
    gameStartTime,
    isLoading,
    purchaseError,
    purchaseTicket,
    setGameActive: setIsGameActive,
    addClue,
    canPurchaseTicket: isLoggedIn && !hasTicket,
  }), [currentEvent, isGameActive, hasTicket, clues, gameStartTime, isLoading, purchaseError, purchaseTicket, addClue, isLoggedIn]);
});

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