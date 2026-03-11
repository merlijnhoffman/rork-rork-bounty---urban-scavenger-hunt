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
import { X, Target } from 'lucide-react-native';
import MapView, { Circle, Marker, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';

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

export default function HuntMap({ visible, onClose, clueOrder, totalClues, targetLocation }: HuntMapProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
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
        timeInterval: 5000,
        distanceInterval: 0,
      });
      console.log('Got location:', location.coords);

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setTimeout(() => {
        if (mapRef.current) {
          console.log('Fitting map to coordinates...');
          mapRef.current.fitToCoordinates(
            [
              { latitude: location.coords.latitude, longitude: location.coords.longitude },
              { latitude: targetLocation.latitude, longitude: targetLocation.longitude },
            ],
            {
              edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
              animated: true,
            }
          );
        }
      }, 500);
    } catch (error) {
      console.error('Error getting user location:', error);
      setIsLoadingLocation(false);
    } finally {
      setTimeout(() => {
        setIsLoadingLocation(false);
      }, 2000);
    }
  }, [targetLocation.latitude, targetLocation.longitude]);

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

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Target color="#00D4FF" size={20} />
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
            provider={PROVIDER_DEFAULT}
            style={styles.mapView}
            initialRegion={{
              latitude: targetLocation.latitude,
              longitude: targetLocation.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsCompass={true}
            mapType="standard"
            onMapReady={() => {
              console.log('Map is ready');
              setIsLoadingLocation(false);
            }}
          >
            <UrlTile
              urlTemplate="https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoicmVlZGJhcm5hcmQiLCJhIjoiY2t2b3YzYTNrMjE0NjJvcDJndHN4cXJiYSJ9.2lGv2LUrC8pNpFvNBBQ3dQ"
              maximumZ={19}
              flipY={false}
              zIndex={-1}
            />
            <Circle
              center={{
                latitude: targetLocation.latitude,
                longitude: targetLocation.longitude,
              }}
              radius={targetLocation.radius}
              fillColor="rgba(0, 212, 255, 0.2)"
              strokeColor="#00D4FF"
              strokeWidth={3}
            />

            <Marker
              coordinate={{
                latitude: targetLocation.latitude,
                longitude: targetLocation.longitude,
              }}
              title="Hunt Zone Center"
              description={targetLocation.name}
              pinColor="#00D4FF"
            />

            {userLocation && (
              <Marker
                coordinate={userLocation}
                title="Your Location"
                pinColor="#00FF88"
              />
            )}
          </MapView>
        )}

        {isLoadingLocation && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#00D4FF" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.safeAreaBottom}>
        <View style={styles.infoPanel}>
        <View style={styles.infoPanelHeader}>
          <Text style={styles.infoPanelTitle}>Target Zone Information</Text>
          <View style={styles.clueProgress}>
            <Text style={styles.clueProgressText}>Clue {clueOrder} of {totalClues}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Location</Text>
            <Text style={styles.statValue}>{targetLocation.name}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Search Radius</Text>
            <Text style={styles.statValue}>{targetLocation.radius}m</Text>
          </View>
        </View>

        <View style={styles.zoneProgressBar}>
          <View style={styles.zoneProgressBarBg}>
            <View style={[styles.zoneProgressBarFill, { width: `${zoneProgress}%` as unknown as import('react-native').DimensionValue }]} />
          </View>
          <Text style={styles.zoneProgressText}>Zone narrowed by {zoneProgress}%</Text>
        </View>

        {remainingClues > 0 ? (
          <Text style={styles.infoHint}>
            🎯 The zone will shrink with each new clue! {remainingClues} more clue{remainingClues !== 1 ? 's' : ''} remaining.
          </Text>
        ) : (
          <Text style={styles.infoHintFinal}>
            🏆 Final zone revealed! The target is within this area.
          </Text>
        )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0A0A0A',
    zIndex: 1000,
  },
  safeArea: {
    backgroundColor: '#1A1A1A',
  },
  safeAreaBottom: {
    backgroundColor: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  closeButton: {
    padding: 4,
  },
  map: {
    flex: 1,
    position: 'relative',
  },
  mapView: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#00D4FF',
    fontWeight: '600',
  },
  infoPanel: {
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderTopWidth: 2,
    borderTopColor: '#00D4FF',
  },
  infoPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoPanelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  clueProgress: {
    backgroundColor: '#00D4FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clueProgressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  statLabel: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    color: '#00D4FF',
    fontWeight: '700',
  },
  zoneProgressBar: {
    marginBottom: 16,
  },
  zoneProgressBarBg: {
    height: 12,
    backgroundColor: '#0A0A0A',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  zoneProgressBarFill: {
    height: '100%',
    backgroundColor: '#00D4FF',
    borderRadius: 6,
  },
  zoneProgressText: {
    fontSize: 12,
    color: '#FFF',
    textAlign: 'center',
  },
  infoHint: {
    fontSize: 13,
    color: '#00D4FF',
    lineHeight: 20,
    textAlign: 'center',
    backgroundColor: '#0A1A2A',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00D4FF',
    fontWeight: '600',
  },
  infoHintFinal: {
    fontSize: 13,
    color: '#00FF88',
    lineHeight: 20,
    textAlign: 'center',
    backgroundColor: '#0A2A1A',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00FF88',
    fontWeight: '700',
  },
});
