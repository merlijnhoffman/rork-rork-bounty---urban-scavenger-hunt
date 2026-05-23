import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface EventZone {
  eventId: string;
  centerLatitude: number;
  centerLongitude: number;
  initialRadius: number;
  narrowedPercent: number;
  zoneName: string | null;
  updatedAt: string;
}

/**
 * Reads the current zone for an event from `event_zones` (one row per event)
 * and subscribes to realtime changes so the map updates as the admin
 * adjusts the zone during the game.
 */
export function useEventZone(eventId: string | null | undefined, enabled: boolean = true) {
  const queryClient = useQueryClient();

  const query = useQuery<EventZone | null>({
    queryKey: ['event-zone', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from('event_zones')
        .select('event_id, center_latitude, center_longitude, initial_radius, narrowed_percent, zone_name, updated_at')
        .eq('event_id', eventId)
        .maybeSingle();

      if (error) {
        console.error('[useEventZone] fetch error:', error.message);
        throw error;
      }
      if (!data) return null;

      const zone: EventZone = {
        eventId: (data as any).event_id,
        centerLatitude: Number((data as any).center_latitude),
        centerLongitude: Number((data as any).center_longitude),
        initialRadius: Number((data as any).initial_radius),
        narrowedPercent: Math.max(0, Math.min(100, Number((data as any).narrowed_percent ?? 0))),
        zoneName: (data as any).zone_name ?? null,
        updatedAt: (data as any).updated_at,
      };
      return zone;
    },
    enabled: !!eventId && enabled,
    refetchInterval: 15000,
    staleTime: 5000,
  });

  useEffect(() => {
    if (!eventId || !enabled) return;
    const channelName = `event-zone-${eventId}-${Date.now()}`;
    const sub = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_zones',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['event-zone', eventId] });
        }
      )
      .subscribe();

    return () => {
      void sub.unsubscribe();
    };
  }, [eventId, enabled, queryClient]);

  const zone = query.data ?? null;
  const currentRadius = zone
    ? Math.max(1, Math.round(zone.initialRadius * Math.max(0, 1 - zone.narrowedPercent / 100)))
    : null;

  return {
    zone,
    currentRadius,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
