import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface NearbyHunter {
  userId: string;
  latitude: number;
  longitude: number;
  distance: number;
  bearing: number;
  updatedAt: string;
}

const NEARBY_RADIUS_M = 500;
const STALE_MS = 2 * 60 * 1000;
const BROADCAST_INTERVAL_MS = 5000;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function bearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x =
    Math.cos(p1) * Math.sin(p2) -
    Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Broadcasts the player's GPS location to `hunter_locations` every 5 seconds
 * while the hunt is live, and queries nearby hunters within ~500m.
 */
export function useHunterRadar(
  eventId: string | null | undefined,
  userId: string | null | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const broadcastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // --- Broadcast player location ---
  const broadcast = useCallback(async () => {
    if (!eventId || !userId) return;

    try {
      let coords = lastLocationRef.current;
      if (!coords) {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        lastLocationRef.current = coords;
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      if (!supabaseUrl || !anonKey) return;

      const res = await fetch(`${supabaseUrl}/functions/v1/update-hunter-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          eventId,
          userId,
          latitude: coords.lat,
          longitude: coords.lng,
        }),
      });
      if (!res.ok) {
        console.warn('[HunterRadar] Broadcast failed:', res.status);
      }
    } catch (e) {
      console.warn('[HunterRadar] Broadcast error:', e);
    }
  }, [eventId, userId]);

  // Start/stop GPS watch + broadcast timer
  useEffect(() => {
    if (!enabled || !eventId || !userId) return;

    const start = async () => {
      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: BROADCAST_INTERVAL_MS },
          (pos) => {
            lastLocationRef.current = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            };
          },
        );
        watchRef.current = sub;
      } catch (e) {
        console.warn('[HunterRadar] GPS watch failed, falling back to polling:', e);
      }

      // Fallback broadcast interval — ensures we send even if watchPositionAsync isn't firing
      broadcastTimerRef.current = setInterval(() => {
        void broadcast();
      }, BROADCAST_INTERVAL_MS);

      // Initial broadcast
      void broadcast();
    };

    void start();

    return () => {
      if (broadcastTimerRef.current) {
        clearInterval(broadcastTimerRef.current);
        broadcastTimerRef.current = null;
      }
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [enabled, eventId, userId, broadcast]);

  // --- Query nearby hunters ---
  const nearbyQuery = useQuery<NearbyHunter[]>({
    queryKey: ['nearby-hunters', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const cutoff = new Date(Date.now() - STALE_MS).toISOString();
      const { data, error } = await supabase
        .from('hunter_locations')
        .select('user_id, latitude, longitude, updated_at')
        .eq('event_id', eventId)
        .neq('user_id', userId ?? '__none__')
        .gte('updated_at', cutoff);

      if (error) {
        console.warn('[HunterRadar] Query error:', error.message);
        return [];
      }
      if (!data || data.length === 0) return [];

      const myLoc = lastLocationRef.current;
      const hunters: NearbyHunter[] = (data as any[])
        .map((row) => {
          const lat = Number(row.latitude);
          const lng = Number(row.longitude);
          if (!myLoc) {
            return {
              userId: row.user_id as string,
              latitude: lat,
              longitude: lng,
              distance: 0,
              bearing: 0,
              updatedAt: row.updated_at as string,
            };
          }
          const dist = haversineMeters(myLoc.lat, myLoc.lng, lat, lng);
          return {
            userId: row.user_id as string,
            latitude: lat,
            longitude: lng,
            distance: dist,
            bearing: bearingDegrees(myLoc.lat, myLoc.lng, lat, lng),
            updatedAt: row.updated_at as string,
          };
        })
        .filter((h) => h.distance <= NEARBY_RADIUS_M)
        .sort((a, b) => a.distance - b.distance);

      return hunters;
    },
    enabled: !!eventId && !!enabled,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  // Realtime: refresh when any hunter location changes
  useEffect(() => {
    if (!eventId || !enabled) return;
    const channelName = `hunter-radar-${eventId}-${Date.now()}`;
    const sub = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hunter_locations',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['nearby-hunters', eventId] });
        },
      )
      .subscribe();

    return () => {
      void sub.unsubscribe();
    };
  }, [eventId, enabled, queryClient]);

  const nearbyHunters = nearbyQuery.data ?? [];
  const nearbyCount = nearbyHunters.length;

  // Group hunters into compass sectors for directional display
  const compassHunters = nearbyHunters.map((h) => ({
    ...h,
    sector: Math.round(h.bearing / 45) % 8, // 0=N, 1=NE, 2=E, ...
  }));

  return {
    nearbyHunters,
    nearbyCount,
    compassHunters,
  };
}
