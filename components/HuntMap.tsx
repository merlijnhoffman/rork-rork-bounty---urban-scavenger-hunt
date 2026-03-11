import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Target } from 'lucide-react-native';
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

const MAPBOX_TOKEN = 'pk.eyJ1IjoicmVlZGJhcm5hcmQiLCJhIjoiY2t2b3YzYTNrMjE0NjJvcDJndHN4cXJiYSJ9.2lGv2LUrC8pNpFvNBBQ3dQ';
const AMBER = Colors.accent.primary;


let MapboxMap: any = null;
let MapboxMarker: any = null;
let MapboxLayer: any = null;
let MapboxSource: any = null;

if (Platform.OS === 'web') {
  try {
    const mapboxgl = require('react-map-gl');
    MapboxMap = mapboxgl.default || mapboxgl.Map;
    MapboxMarker = mapboxgl.Marker;
    MapboxLayer = mapboxgl.Layer;
    MapboxSource = mapboxgl.Source;
    
    require('mapbox-gl/dist/mapbox-gl.css');
  } catch (error) {
    console.warn('Mapbox GL not available:', error);
  }
}

export default function HuntMap({ visible, onClose, clueOrder, totalClues, targetLocation }: HuntMapProps) {
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) return;
    
    setMapLoaded(true);
    
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting user location:', error);
        }
      );
    }
  }, [visible]);

  const createCircleGeoJSON = () => {
    const points = 64;
    const coords = [];
    const distanceX = targetLocation.radius / (111.32 * 1000 * Math.cos((targetLocation.latitude * Math.PI) / 180));
    const distanceY = targetLocation.radius / (111.32 * 1000);

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = distanceX * Math.cos(angle);
      const dy = distanceY * Math.sin(angle);
      coords.push([targetLocation.longitude + dx, targetLocation.latitude + dy]);
    }
    coords.push(coords[0]);

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    };
  };

  if (!visible) return null;

  const zoneProgress = ((clueOrder / totalClues) * 100).toFixed(0);
  const remainingClues = totalClues - clueOrder;

  return (
    <View style={styles.webContainer}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.webHeader}>
          <View style={styles.webTitleContainer}>
            <Target color={AMBER} size={20} />
            <Text style={styles.webTitle}>Hunt Zone - Clue {clueOrder}/{totalClues}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X color="#FFF" size={24} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      
      <View style={styles.webMapPlaceholder}>
        <View style={styles.mapTemplate}>
          {!mapLoaded || !MapboxMap ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={AMBER} />
              <Text style={styles.loadingText}>{!MapboxMap ? 'Map unavailable' : 'Loading map...'}</Text>
            </View>
          ) : (
            <MapboxMap
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{
                longitude: targetLocation.longitude,
                latitude: targetLocation.latitude,
                zoom: 14,
              }}
              style={{ width: '100%', height: '100%', borderRadius: 16 }}
              mapStyle="mapbox://styles/mapbox/dark-v11"
            >
              <MapboxSource id="hunt-zone" type="geojson" data={createCircleGeoJSON() as any}>
                <MapboxLayer
                  id="hunt-zone-fill"
                  type="fill"
                  paint={{
                    'fill-color': AMBER,
                    'fill-opacity': 0.15,
                  }}
                />
                <MapboxLayer
                  id="hunt-zone-outline"
                  type="line"
                  paint={{
                    'line-color': AMBER,
                    'line-width': 3,
                  }}
                />
              </MapboxSource>
              
              <MapboxMarker
                longitude={targetLocation.longitude}
                latitude={targetLocation.latitude}
              >
                <View style={styles.targetMarker}>
                  <Target color={AMBER} size={24} />
                </View>
              </MapboxMarker>
              
              {userLocation && (
                <MapboxMarker
                  longitude={userLocation.longitude}
                  latitude={userLocation.latitude}
                >
                  <View style={styles.userMarker}>
                    <View style={styles.userMarkerInner} />
                  </View>
                </MapboxMarker>
              )}
            </MapboxMap>
          )}
        </View>
        
        <Text style={styles.webPlaceholderTitle}>{targetLocation.name}</Text>
        
        <View style={styles.zoneStats}>
          <View style={styles.zoneStat}>
            <Text style={styles.zoneStatLabel}>Search Zone</Text>
            <Text style={styles.zoneStatValue}>{targetLocation.radius}m</Text>
          </View>
          <View style={styles.zoneDivider} />
          <View style={styles.zoneStat}>
            <Text style={styles.zoneStatLabel}>Zone Narrowed</Text>
            <Text style={styles.zoneStatValue}>{zoneProgress}%</Text>
          </View>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${zoneProgress}%` as unknown as import('react-native').DimensionValue }]} />
          </View>
        </View>

        {remainingClues > 0 && (
          <View style={styles.progressInfo}>
            <Text style={styles.progressInfoText}>
              Zone will shrink with {remainingClues} more clue{remainingClues !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
        
        <Text style={styles.webPlaceholderSubtext}>
          This is a preview of the hunt zone
        </Text>
        <View style={styles.coordinatesContainer}>
          <Text style={styles.coordinatesLabel}>Zone Center:</Text>
          <Text style={styles.coordinatesText}>
            {targetLocation.latitude.toFixed(6)}, {targetLocation.longitude.toFixed(6)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const C = Colors;

const styles = StyleSheet.create({
  webContainer: {
    position: 'absolute',
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
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.dark.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.dark.border,
  },
  webTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: C.dark.text,
  },
  webMapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: 24,
    gap: 14,
  },
  mapTemplate: {
    width: '100%',
    maxWidth: 600,
    height: 380,
    backgroundColor: C.dark.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.accent.primary,
    position: 'relative' as const,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: C.accent.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  loadingContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: C.accent.primary,
    fontWeight: '600' as const,
  },
  targetMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.accent.primary,
  },
  webPlaceholderTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: C.dark.text,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  zoneStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.dark.surface,
    borderRadius: 12,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: C.dark.border,
    maxWidth: 600,
    width: '100%',
  },
  zoneStat: {
    flex: 1,
    alignItems: 'center',
  },
  zoneStatLabel: {
    fontSize: 11,
    color: C.dark.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    fontWeight: '600' as const,
  },
  zoneStatValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: C.accent.primary,
  },
  zoneDivider: {
    width: 1,
    height: 40,
    backgroundColor: C.dark.border,
  },
  progressBarContainer: {
    maxWidth: 600,
    width: '100%',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: C.dark.card,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: C.accent.primary,
    borderRadius: 4,
  },
  progressInfo: {
    backgroundColor: C.accent.primaryMuted,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    maxWidth: 600,
    width: '100%',
  },
  progressInfoText: {
    fontSize: 13,
    color: C.accent.primary,
    textAlign: 'center',
    fontWeight: '600' as const,
  },
  webPlaceholderSubtext: {
    fontSize: 13,
    color: C.dark.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  coordinatesContainer: {
    marginTop: 8,
    padding: 14,
    backgroundColor: C.dark.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  coordinatesLabel: {
    fontSize: 11,
    color: C.dark.textMuted,
    marginBottom: 4,
    textAlign: 'center',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  coordinatesText: {
    fontSize: 14,
    color: C.accent.primary,
    fontWeight: '600' as const,
    textAlign: 'center',
    fontFamily: 'monospace' as const,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  userMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
});
