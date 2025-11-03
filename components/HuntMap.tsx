import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { X, Target } from 'lucide-react-native';

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

declare global {
  interface Window {
    google: any;
  }
}

export default function HuntMap({ visible, onClose, clueOrder, totalClues, targetLocation }: HuntMapProps) {
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);


  useEffect(() => {
    if (!visible) return;

    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setMapLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, [visible]);

  useEffect(() => {
    if (!mapLoaded || !visible) return;

    const mapElement = document.getElementById('google-map');
    if (!mapElement) return;

    const googleMap = new window.google.maps.Map(mapElement, {
      center: { lat: targetLocation.latitude, lng: targetLocation.longitude },
      zoom: 14,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: false,
    });

    new window.google.maps.Circle({
      map: googleMap,
      center: { lat: targetLocation.latitude, lng: targetLocation.longitude },
      radius: targetLocation.radius,
      fillColor: '#00D4FF',
      fillOpacity: 0.2,
      strokeColor: '#00D4FF',
      strokeWeight: 3,
    });

    new window.google.maps.Marker({
      position: { lat: targetLocation.latitude, lng: targetLocation.longitude },
      map: googleMap,
      title: 'Hunt Zone Center',
      label: {
        text: '🎯',
        fontSize: '24px',
      },
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          new window.google.maps.Marker({
            position: userPos,
            map: googleMap,
            title: 'Your Location',
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#00FF88',
              fillOpacity: 1,
              strokeColor: '#FFF',
              strokeWeight: 2,
            },
          });

          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend(userPos);
          bounds.extend({ lat: targetLocation.latitude, lng: targetLocation.longitude });
          googleMap.fitBounds(bounds, { padding: 100 });
        },
        (error) => {
          console.error('Error getting user location:', error);
        }
      );
    }
  }, [mapLoaded, visible, targetLocation]);

  if (!visible) return null;

  const zoneProgress = ((clueOrder / totalClues) * 100).toFixed(0);
  const remainingClues = totalClues - clueOrder;

  return (
      <View style={styles.webContainer}>
        <View style={styles.webHeader}>
          <View style={styles.webTitleContainer}>
            <Target color="#00D4FF" size={20} />
            <Text style={styles.webTitle}>Hunt Zone - Clue {clueOrder}/{totalClues}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X color="#FFF" size={24} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.webMapPlaceholder}>
          <View style={styles.mapTemplate}>
            {!mapLoaded ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00D4FF" />
                <Text style={styles.loadingText}>Loading map...</Text>
              </View>
            ) : (
              <div id="google-map" style={{ width: '100%', height: '100%', borderRadius: 16 }} />
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
    justifyContent: 'center',
    padding: 20,
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
});
