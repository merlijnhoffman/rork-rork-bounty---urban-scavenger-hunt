import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MapPin, Target, Crosshair, LocateFixed, RadioTower } from 'lucide-react-native';
import MapView, { Circle, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';

interface EventZoneMapProps {
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  zoneName?: string;
  /** Live bounty position — when provided, renders a pulsing target marker */
  bountyLatitude?: number | null;
  bountyLongitude?: number | null;
  /** Whether the bounty is actively broadcasting (affects marker styling) */
  bountyActive?: boolean;
}

const AMBER = Colors.accent.primary;
const AMBER_MUTED = 'rgba(245, 158, 11, 0.2)';

export default function EventZoneMap({
  centerLatitude,
  centerLongitude,
  radiusMeters,
  zoneName,
  bountyLatitude,
  bountyLongitude,
  bountyActive,
}: EventZoneMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted' && mounted) {
          const loc = await Location.getLastKnownPositionAsync({});
          if (loc && mounted) {
            setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }
        }
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

  const centerOnZone = () => {
    mapRef.current?.animateToRegion(
      {
        latitude: centerLatitude,
        longitude: centerLongitude,
        latitudeDelta: Math.max(0.005, (radiusMeters / 50000) * 2),
        longitudeDelta: Math.max(0.005, (radiusMeters / 50000) * 2),
      },
      600
    );
  };

  const centerOnUser = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: Math.max(0.005, (radiusMeters / 50000) * 2),
          longitudeDelta: Math.max(0.005, (radiusMeters / 50000) * 2),
        },
        600
      );
    } catch (err) {
      if (__DEV__) console.warn('[EventZoneMap] getCurrentPosition error:', err);
    }
  };

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

          {/* Live bounty marker */}
          {bountyLatitude != null && bountyLongitude != null && (
            <Marker
              coordinate={{ latitude: bountyLatitude, longitude: bountyLongitude }}
              tracksViewChanges={false}
            >
              <View style={bountyActive ? styles.bountyMarkerActive : styles.bountyMarkerIdle}>
                <RadioTower
                  color={bountyActive ? '#EF4444' : '#6B7280'}
                  size={18}
                />
              </View>
            </Marker>
          )}
        </MapView>

        {/* Map control buttons */}
        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.mapBtn} onPress={centerOnZone} activeOpacity={0.7}>
            <Crosshair color={AMBER} size={18} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapBtn} onPress={centerOnUser} activeOpacity={0.7}>
            <LocateFixed color="#10B981" size={18} />
          </TouchableOpacity>
        </View>

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
  mapControls: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    gap: 6,
    zIndex: 20,
  },
  mapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
  bountyMarkerActive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  bountyMarkerIdle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(107, 114, 128, 0.85)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
