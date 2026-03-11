import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Target, Navigation2 } from 'lucide-react-native';
import MapView, { Circle, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import Colors from '@/constants/colors';

interface HuntMapProps {
  visible: boolean;
  onClose: () => void;
  clueOrder: number;
  totalClues: number;
  targetLocation: {
    latitude: number;
    longitude: number;
    radius: number;
    name: string;
  };
}

const AMBER = Colors.accent.primary;
const AMBER_MUTED = 'rgba(245, 158, 11, 0.2)';

export default function HuntMap({ visible, onClose, clueOrder, totalClues, targetLocation }: HuntMapProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [_userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(true);
  const mapRef = useRef<MapView>(null);

  const getUserLocation = useCallback(async () => {
    try {
      setIsLoadingLocation(true);
      console.log('Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('Location permission status:', status);

      if (status !== 'granted') {
        console.log('Location permission not granted, proceeding without user location');
        setIsLoadingLocation(false);
        return;
      }

      console.log('Getting current position...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      console.log('Got location:', location.coords);

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting user location:', error);
    } finally {
      setTimeout(() => {
        setIsLoadingLocation(false);
      }, 1500);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      console.log('HuntMap visible, showing map for:', targetLocation.name);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      void getUserLocation();
    }
  }, [visible, pulseAnim, targetLocation.name, getUserLocation]);

  if (!visible) {
    console.log('HuntMap not visible');
    return null;
  }

  const zoneProgress = ((clueOrder / totalClues) * 100).toFixed(0);
  const remainingClues = totalClues - clueOrder;

  const initialRegion = {
    latitude: targetLocation.latitude,
    longitude: targetLocation.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  const handleRecenter = () => {
    mapRef.current?.animateToRegion(initialRegion, 500);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Target color={AMBER} size={20} />
            <Text style={styles.title}>Hunt Zone - Clue {clueOrder}/{totalClues}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X color="#FFF" size={24} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.map}>
        {visible && (
          <MapView
            ref={mapRef}
            style={styles.mapView}
            provider={PROVIDER_DEFAULT}
            initialRegion={initialRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsCompass={true}
            userInterfaceStyle="dark"
          >
            <Circle
              center={{
                latitude: targetLocation.latitude,
                longitude: targetLocation.longitude,
              }}
              radius={targetLocation.radius}
              fillColor={AMBER_MUTED}
              strokeColor={AMBER}
              strokeWidth={3}
            />
            <Marker
              coordinate={{
                latitude: targetLocation.latitude,
                longitude: targetLocation.longitude,
              }}
              title={targetLocation.name}
              description={`Search radius: ${targetLocation.radius}m`}
              pinColor={AMBER}
            />
          </MapView>
        )}

        <TouchableOpacity
          style={styles.recenterButton}
          onPress={handleRecenter}
          activeOpacity={0.8}
        >
          <Navigation2 color={AMBER} size={20} />
        </TouchableOpacity>

        {isLoadingLocation && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={AMBER} />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.safeAreaBottom}>
        <View style={styles.infoPanel}>
          <View style={styles.infoPanelHeader}>
            <Text style={styles.infoPanelTitle}>{targetLocation.name}</Text>
            <View style={styles.clueProgress}>
              <Text style={styles.clueProgressText}>Clue {clueOrder}/{totalClues}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Search Radius</Text>
              <Text style={styles.statValue}>{targetLocation.radius}m</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Zone Narrowed</Text>
              <Text style={styles.statValue}>{zoneProgress}%</Text>
            </View>
          </View>

          <View style={styles.zoneProgressBar}>
            <View style={styles.zoneProgressBarBg}>
              <View style={[styles.zoneProgressBarFill, { width: `${zoneProgress}%` as unknown as import('react-native').DimensionValue }]} />
            </View>
          </View>

          {remainingClues > 0 ? (
            <Text style={styles.infoHint}>
              Zone will shrink with {remainingClues} more clue{remainingClues !== 1 ? 's' : ''}
            </Text>
          ) : (
            <Text style={styles.infoHintFinal}>
              Final zone revealed! The target is within this area.
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const C = Colors;

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.dark.background,
    zIndex: 1000,
  },
  safeArea: {
    backgroundColor: C.dark.surface,
  },
  safeAreaBottom: {
    backgroundColor: C.dark.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.dark.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.dark.border,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: C.dark.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    flex: 1,
    position: 'relative' as const,
  },
  mapView: {
    width: '100%',
    height: '100%',
  },
  recenterButton: {
    position: 'absolute' as const,
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.accent.primaryMuted,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(12, 12, 14, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: C.accent.primary,
    fontWeight: '600' as const,
  },
  infoPanel: {
    backgroundColor: C.dark.surface,
    padding: 20,
    borderTopWidth: 2,
    borderTopColor: C.accent.primary,
  },
  infoPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  infoPanelTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: C.dark.text,
    letterSpacing: 0.5,
  },
  clueProgress: {
    backgroundColor: C.accent.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  clueProgressText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#000',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: C.dark.card,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  statLabel: {
    fontSize: 11,
    color: C.dark.textMuted,
    fontWeight: '600' as const,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    color: C.accent.primary,
    fontWeight: '800' as const,
  },
  zoneProgressBar: {
    marginBottom: 14,
  },
  zoneProgressBarBg: {
    height: 8,
    backgroundColor: C.dark.card,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  zoneProgressBarFill: {
    height: '100%',
    backgroundColor: C.accent.primary,
    borderRadius: 4,
  },
  infoHint: {
    fontSize: 13,
    color: C.accent.primary,
    lineHeight: 20,
    textAlign: 'center' as const,
    backgroundColor: C.accent.primaryMuted,
    padding: 12,
    borderRadius: 10,
    fontWeight: '600' as const,
  },
  infoHintFinal: {
    fontSize: 13,
    color: C.status.success,
    lineHeight: 20,
    textAlign: 'center' as const,
    backgroundColor: C.status.successMuted,
    padding: 12,
    borderRadius: 10,
    fontWeight: '700' as const,
  },
});
