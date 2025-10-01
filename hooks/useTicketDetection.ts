import { useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useGameStore } from '@/store/game-store';
import { useAuth } from '@/contexts/AuthContext';

export interface TicketStatus {
  hasTicket: boolean;
  ticketCount: number;
  activeTicket: {
    ticketId: string;
    verificationCode: string;
    eventId: string;
    userId: string;
    purchasedAt: string;
    isUsed: boolean;
    event: {
      id: string;
      city: string;
      date: string;
      startTime: string;
      price: number;
    } | null;
  } | null;
  allTickets: {
    ticketId: string;
    verificationCode: string;
    eventId: string;
    userId: string;
    purchasedAt: string;
    isUsed: boolean;
    event: {
      id: string;
      city: string;
      date: string;
      startTime: string;
      price: number;
    } | null;
  }[];
}

export function useTicketDetection() {
  const { user } = useAuth();
  const { 
    currentUserId, 
    ticketCheckEnabled, 
    enableTicketChecking, 
    disableTicketChecking,
    currentEvent 
  } = useGameStore();

  // Query to check ticket status - only runs when enabled and user exists
  const ticketStatusQuery = trpc.payment.checkTicketStatus.useQuery(
    {
      userId: currentUserId!,
      eventId: currentEvent?.id,
    },
    {
      enabled: ticketCheckEnabled && !!currentUserId,
      refetchInterval: 5000, // Check every 5 seconds
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0, // Always consider data stale to ensure fresh checks
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    }
  );

  // Log results when data changes
  useEffect(() => {
    if (ticketStatusQuery.data) {
      console.log('Ticket status check result:', ticketStatusQuery.data);
    }
  }, [ticketStatusQuery.data]);

  // Log errors when they occur
  useEffect(() => {
    if (ticketStatusQuery.error) {
      console.error('Ticket status check failed:', ticketStatusQuery.error);
    }
  }, [ticketStatusQuery.error]);

  // Start monitoring when user logs in
  const startMonitoring = useCallback((userId: string) => {
    console.log('Starting ticket monitoring for user:', userId);
    enableTicketChecking(userId);
  }, [enableTicketChecking]);

  // Stop monitoring when user logs out
  const stopMonitoring = useCallback(() => {
    console.log('Stopping ticket monitoring');
    disableTicketChecking();
  }, [disableTicketChecking]);

  // Auto-start/stop monitoring based on user auth state
  useEffect(() => {
    if (user?.id && !ticketCheckEnabled) {
      startMonitoring(user.id);
    } else if (!user && ticketCheckEnabled) {
      stopMonitoring();
    }
  }, [user, ticketCheckEnabled, startMonitoring, stopMonitoring]);

  // Manual refresh function
  const refreshTicketStatus = useCallback(() => {
    if (ticketCheckEnabled && currentUserId) {
      console.log('Manually refreshing ticket status');
      ticketStatusQuery.refetch();
    }
  }, [ticketCheckEnabled, currentUserId, ticketStatusQuery]);

  return {
    // Ticket status data
    ticketStatus: ticketStatusQuery.data,
    hasTicket: ticketStatusQuery.data?.hasTicket ?? false,
    activeTicket: ticketStatusQuery.data?.activeTicket ?? null,
    allTickets: ticketStatusQuery.data?.allTickets ?? [],
    ticketCount: ticketStatusQuery.data?.ticketCount ?? 0,
    
    // Query state
    isLoading: ticketStatusQuery.isLoading,
    isError: ticketStatusQuery.isError,
    error: ticketStatusQuery.error,
    isFetching: ticketStatusQuery.isFetching,
    isRefetching: ticketStatusQuery.isRefetching,
    
    // Control functions
    startMonitoring,
    stopMonitoring,
    refreshTicketStatus,
    
    // Status flags
    isMonitoring: ticketCheckEnabled,
    monitoringUserId: currentUserId,
  };
}