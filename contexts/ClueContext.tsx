import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { trpcClient } from '@/lib/trpc';
import { useAuth } from './AuthContext';

export interface Clue {
  id: string;
  text: string;
  hint?: string;
  timestamp: string;
  order: number;
  releaseTime: string;
}

export interface ClueState {
  clues: Clue[];
  hasAccess: boolean;
  isLoading: boolean;
  error: string | null;
  eventStatus: {
    isActive: boolean;
    hasStarted: boolean;
    startTime: string | null;
    city: string | null;
    prize: number | null;
  } | null;
  refreshClues: () => void;
  checkEventStatus: (eventId: string) => void;
}

const [ClueProviderInternal, useClueInternal] = createContextHook((): ClueState => {
  const { user } = useAuth();
  const [clues, setClues] = useState<Clue[]>([]);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState<ClueState['eventStatus']>(null);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);

  const refreshClues = useCallback(async () => {
    if (!currentEventId || !user) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await trpcClient.clues.getClues.query({
        eventId: currentEventId,
        userId: user.id,
      });

      setClues(response.clues);
      setHasAccess(response.hasAccess);

      if (!response.hasAccess) {
        setError(response.message);
      }
    } catch (err) {
      console.error('Error refreshing clues:', err);
      setError('Failed to load clues. Please check your connection.');
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  }, [currentEventId, user]);

  const checkEventStatus = useCallback(async (eventId: string) => {
    try {
      setCurrentEventId(eventId);
      setIsLoading(true);
      setError(null);

      const response = await trpcClient.clues.checkEventStatus.query({
        eventId,
      });

      setEventStatus({
        isActive: response.isActive,
        hasStarted: response.hasStarted || false,
        startTime: response.startTime,
        city: response.city || null,
        prize: response.prize || null,
      });

      // If user is logged in and event exists, try to get clues
      if (user && response.eventExists) {
        await refreshClues();
      }
    } catch (err) {
      console.error('Error checking event status:', err);
      setError('Failed to check event status.');
      setEventStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshClues]);

  // Auto-refresh clues every 30 seconds when user has access
  useEffect(() => {
    if (!hasAccess || !currentEventId || !user) return;

    const interval = setInterval(() => {
      refreshClues();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [hasAccess, currentEventId, user, refreshClues]);

  // Reset state when user logs out
  useEffect(() => {
    if (!user) {
      setClues([]);
      setHasAccess(false);
      setError(null);
      setEventStatus(null);
      setCurrentEventId(null);
    }
  }, [user]);

  return useMemo(() => ({
    clues,
    hasAccess,
    isLoading,
    error,
    eventStatus,
    refreshClues,
    checkEventStatus,
  }), [clues, hasAccess, isLoading, error, eventStatus, refreshClues, checkEventStatus]);
});

// Safe wrapper hook that ensures the context is available
export function useClues() {
  const context = useClueInternal();
  if (!context) {
    // Return default values instead of throwing error to prevent crashes
    return {
      clues: [],
      hasAccess: false,
      isLoading: false,
      error: null,
      eventStatus: null,
      refreshClues: () => {},
      checkEventStatus: () => {},
    };
  }
  return context;
}

export const ClueProvider = ClueProviderInternal;