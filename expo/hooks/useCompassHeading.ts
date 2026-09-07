import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

/**
 * Watches the device heading (compass) in degrees (0 = north, 90 = east).
 * Returns null when disabled, permission isn't granted, or the device has no
 * magnetometer (e.g. the simulator) — callers should fall back to north-up.
 */
export function useCompassHeading(enabled: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) {
      setHeading(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const sub = await Location.watchHeadingAsync((h) => {
          if (cancelled) return;
          // expo-location exposes trueHeading (iOS, magnetometer + location)
          // and magHeading (compass-only); some versions/platforms use `heading`.
          // Negative values mean the heading is invalid (e.g. location off).
          const hAny = h as unknown as { trueHeading?: number; magHeading?: number; heading?: number };
          const value = hAny.trueHeading ?? hAny.magHeading ?? hAny.heading;
          if (typeof value === 'number' && value >= 0) {
            setHeading(value);
          }
        });

        if (cancelled) {
          sub.remove();
          return;
        }
        subRef.current = sub;
      } catch (e) {
        console.warn('[Compass] watchHeadingAsync unavailable:', e);
      }
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [enabled]);

  return heading;
}
