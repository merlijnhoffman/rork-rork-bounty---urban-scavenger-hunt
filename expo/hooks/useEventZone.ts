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

export interface BountyLocation {
  eventId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  isActive: boolean;
  updatedAt: string;
}

/**
 * Reads the current zone for an event from `event_zones` (one row per event)
 * and subscribes to realtime changes so the map updates as the admin
 * adjusts the zone during the game.
 *
 * Also fetches the live bounty location from `bounty_locations` (if the
 * bounty person is broadcasting) so the distance meter can track a moving
 * target instead of a fixed zone center.
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
    // Poll frequently so the bounty sees zone changes quickly even if
    // realtime publication isn't enabled for event_zones.
    refetchInterval: 5000,
    staleTime: 2000,
  });

  // --- Live bounty location ---
  const bountyQuery = useQuery<BountyLocation | null>({
    queryKey: ['bounty-location', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from('bounty_locations')
        .select('event_id, latitude, longitude, accuracy, heading, speed, is_active, updated_at')
        .eq('event_id', eventId)
        .maybeSingle();

      if (error) {
        console.error('[useEventZone] bounty fetch error:', error.message);
        // Don't throw — bounty location is optional, zone should still work
        return null;
      }
      if (!data) return null;

      const loc: BountyLocation = {
        eventId: (data as any).event_id,
        latitude: Number((data as any).latitude),
        longitude: Number((data as any).longitude),
        accuracy: (data as any).accuracy != null ? Number((data as any).accuracy) : null,
        heading: (data as any).heading != null ? Number((data as any).heading) : null,
        speed: (data as any).speed != null ? Number((data as any).speed) : null,
        isActive: Boolean((data as any).is_active),
        updatedAt: (data as any).updated_at,
      };
      return loc;
    },
    enabled: !!eventId && enabled,
    refetchInterval: 10000,
    staleTime: 3000,
  });

  // Realtime: event_zones
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

  // Realtime: bounty_locations
  useEffect(() => {
    if (!eventId || !enabled) return;
    const channelName = `bounty-location-${eventId}-${Date.now()}`;
    const sub = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bounty_locations',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['bounty-location', eventId] });
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

  const bountyLocation = bountyQuery.data ?? null;
  // Only use the bounty location if it's active and updated recently (within 5 minutes)
  const isBountyActive = (() => {
    if (!bountyLocation || !bountyLocation.isActive) return false;
    const updatedMs = new Date(bountyLocation.updatedAt).getTime();
    if (isNaN(updatedMs)) return false;
    return Date.now() - updatedMs < 5 * 60 * 1000;
  })();

  return {
    zone,
    currentRadius,
    bountyLocation: isBountyActive ? bountyLocation : null,
    isBountyActive,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
