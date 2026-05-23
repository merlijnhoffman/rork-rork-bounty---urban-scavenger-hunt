import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { MapPin, Target } from 'lucide-react-native';
import MapView, { Circle, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';

interface EventZoneMapProps {
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  zoneName?: string;
}

const AMBER = Colors.accent.primary;
const AMBER_MUTED = 'rgba(245, 158, 11, 0.2)';

export default function EventZoneMap({
  centerLatitude,
  centerLongitude,
  radiusMeters,
  zoneName,
}: EventZoneMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !mounted) return;
      } catch (err) {
        if (__DEV__) console.warn('[EventZoneMap] location permission error:', err);
      } finally {
        if (mounted) setTimeout(() => setIsLoading(false), 800);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: centerLatitude,
        longitude: centerLongitude,
        latitudeDelta: Math.max(0.005, (radiusMeters / 50000) * 2),
        longitudeDelta: Math.max(0.005, (radiusMeters / 50000) * 2),
      },
      600
    );
  }, [centerLatitude, centerLongitude, radiusMeters]);

  return (
    <View style={styles.container}>
      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: centerLatitude,
            longitude: centerLongitude,
            latitudeDelta: Math.max(0.005, (radiusMeters / 50000) * 2),
            longitudeDelta: Math.max(0.005, (radiusMeters / 50000) * 2),
          }}
          showsUserLocation
          userInterfaceStyle="dark"
        >
          <Circle
            center={{ latitude: centerLatitude, longitude: centerLongitude }}
            radius={Math.max(1, radiusMeters)}
            fillColor={AMBER_MUTED}
            strokeColor={AMBER}
            strokeWidth={3}
          />
          <Marker
            coordinate={{ latitude: centerLatitude, longitude: centerLongitude }}
            title={zoneName ?? 'Hunt Zone'}
            pinColor={AMBER}
          />
        </MapView>

        {isLoading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={AMBER} />
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Target color={AMBER} size={14} />
          <Text style={styles.statLabel}>Zone</Text>
          <Text style={styles.statValue}>{Math.max(1, Math.round(radiusMeters))}m</Text>
        </View>
        {!!zoneName && (
          <View style={styles.statBox}>
            <MapPin color={AMBER} size={14} />
            <Text style={styles.statLabel} numberOfLines={1}>{zoneName}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const C = Colors;
const styles = StyleSheet.create({
  container: {
    backgroundColor: C.dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.dark.border,
    padding: 10,
    gap: 10,
  },
  mapWrapper: {
    height: 240,
    borderRadius: 14,
    overflow: 'hidden' as const,
    backgroundColor: C.dark.background,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statsRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  statBox: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: C.dark.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    color: C.dark.textMuted,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 13,
    color: C.accent.primary,
    fontWeight: '800' as const,
    marginLeft: 'auto' as const,
  },
});
