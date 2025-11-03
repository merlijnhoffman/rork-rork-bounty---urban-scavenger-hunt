import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Target } from 'lucide-react-native';
import Map, { Marker, Layer, Source } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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

export default function HuntMap({ visible, onClose, clueOrder, totalClues, targetLocation }: HuntMapProps) {
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) return;
    
    setMapLoaded(true);
    
    if (navigator.geolocation) {
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
              <Target color="#00D4FF" size={20} />
              <Text style={styles.webTitle}>Hunt Zone - Clue {clueOrder}/{totalClues}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X color="#FFF" size={24} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        
        <View style={styles.webMapPlaceholder}>
          <View style={styles.mapTemplate}>
            {!mapLoaded ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00D4FF" />
                <Text style={styles.loadingText}>Loading map...</Text>
              </View>
            ) : (
              <Map
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
                <Source id="hunt-zone" type="geojson" data={createCircleGeoJSON() as any}>
                  <Layer
                    id="hunt-zone-fill"
                    type="fill"
                    paint={{
                      'fill-color': '#00D4FF',
                      'fill-opacity': 0.2,
                    }}
                  />
                  <Layer
                    id="hunt-zone-outline"
                    type="line"
                    paint={{
                      'line-color': '#00D4FF',
                      'line-width': 3,
                    }}
                  />
                </Source>
                
                <Marker
                  longitude={targetLocation.longitude}
                  latitude={targetLocation.latitude}
                >
                  <Text style={{ fontSize: 32 }}>🎯</Text>
                </Marker>
                
                {userLocation && (
                  <Marker
                    longitude={userLocation.longitude}
                    latitude={userLocation.latitude}
                  >
                    <View style={styles.userMarker}>
                      <View style={styles.userMarkerInner} />
                    </View>
                  </Marker>
                )}
              </Map>
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

          {remainingClues > 0 && (
            <View style={styles.progressInfo}>
              <Text style={styles.progressInfoText}>
                🎯 Zone will shrink with {remainingClues} more clue{remainingClues !== 1 ? 's' : ''}
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

const styles = StyleSheet.create({
  webContainer: {
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
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  webTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  webMapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: 60,
    gap: 16,
  },
  mapTemplate: {
    width: '100%',
    maxWidth: 600,
    height: 400,
    backgroundColor: '#0F1419',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#00D4FF',
    position: 'relative' as const,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
    color: '#00D4FF',
    fontWeight: '600',
  },
  zoneIndicator: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#00D4FF',
    marginBottom: 8,
  },
  webPlaceholderTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  zoneStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    borderWidth: 2,
    borderColor: '#00D4FF',
    maxWidth: 600,
    width: '100%',
  },
  zoneStat: {
    flex: 1,
    alignItems: 'center',
  },
  zoneStatLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  zoneStatValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00D4FF',
  },
  zoneDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
  },
  progressInfo: {
    backgroundColor: '#0A1A2A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00D4FF',
    maxWidth: 600,
    width: '100%',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  progressInfoText: {
    fontSize: 14,
    color: '#00D4FF',
    textAlign: 'center',
    fontWeight: '600',
  },
  webPlaceholderText: {
    fontSize: 16,
    color: '#00D4FF',
    textAlign: 'center',
    fontWeight: '600',
  },
  webPlaceholderSubtext: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  coordinatesContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  coordinatesLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    textAlign: 'center',
  },
  coordinatesText: {
    fontSize: 14,
    color: '#00D4FF',
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'monospace' as const,
  },
  closeButton: {
    padding: 4,
  },
  userMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00FF88',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#00FF88',
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
