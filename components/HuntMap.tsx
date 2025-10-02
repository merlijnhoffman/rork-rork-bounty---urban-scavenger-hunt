import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { X, MapPin } from 'lucide-react-native';

let MapView: any;
let Circle: any;
let Marker: any;
let PROVIDER_GOOGLE: any;

if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Circle = maps.Circle;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
}

interface HuntMapProps {
  visible: boolean;
  onClose: () => void;
  clueOrder: number;
  targetLocation: {
    latitude: number;
    longitude: number;
    radius: number;
    name: string;
  };
}

export default function HuntMap({ visible, onClose, clueOrder, targetLocation }: HuntMapProps) {
  if (!visible) return null;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <View style={styles.webHeader}>
          <View style={styles.webTitleContainer}>
            <MapPin color="#00D4FF" size={20} />
            <Text style={styles.webTitle}>Hunt Zone - Clue {clueOrder}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X color="#FFF" size={24} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.webMapPlaceholder}>
          <MapPin color="#00D4FF" size={48} />
          <Text style={styles.webPlaceholderTitle}>{targetLocation.name}</Text>
          <Text style={styles.webPlaceholderText}>
            Search zone: ~{targetLocation.radius}m radius
          </Text>
          <Text style={styles.webPlaceholderSubtext}>
            Map view is available on mobile devices
          </Text>
          <View style={styles.coordinatesContainer}>
            <Text style={styles.coordinatesLabel}>Approximate Center:</Text>
            <Text style={styles.coordinatesText}>
              {targetLocation.latitude.toFixed(6)}, {targetLocation.longitude.toFixed(6)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <MapPin color="#00D4FF" size={20} />
          <Text style={styles.title}>Hunt Zone - Clue {clueOrder}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X color="#FFF" size={24} />
        </TouchableOpacity>
      </View>

      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: targetLocation.latitude,
          longitude: targetLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
        showsMyLocationButton
        showsCompass
      >
        <Circle
          center={{
            latitude: targetLocation.latitude,
            longitude: targetLocation.longitude,
          }}
          radius={targetLocation.radius}
          fillColor="rgba(0, 212, 255, 0.15)"
          strokeColor="rgba(0, 212, 255, 0.8)"
          strokeWidth={3}
        />
        
        <Marker
          coordinate={{
            latitude: targetLocation.latitude,
            longitude: targetLocation.longitude,
          }}
          title={targetLocation.name}
          description={`Search within ${targetLocation.radius}m radius`}
        >
          <View style={styles.markerContainer}>
            <View style={styles.markerPulse} />
            <View style={styles.marker}>
              <MapPin color="#FFF" size={20} />
            </View>
          </View>
        </Marker>
      </MapView>

      <View style={styles.infoPanel}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Target Zone:</Text>
          <Text style={styles.infoValue}>{targetLocation.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Search Radius:</Text>
          <Text style={styles.infoValue}>~{targetLocation.radius}m</Text>
        </View>
        <Text style={styles.infoHint}>
          The target is somewhere within the highlighted circle. Use the clue to narrow down the exact location!
        </Text>
      </View>
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
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 212, 255, 0.3)',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00D4FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  infoPanel: {
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  infoHint: {
    fontSize: 13,
    color: '#00D4FF',
    lineHeight: 18,
    marginTop: 8,
    fontStyle: 'italic',
  },
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
    padding: 40,
    gap: 16,
  },
  webPlaceholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  webPlaceholderText: {
    fontSize: 16,
    color: '#00D4FF',
    textAlign: 'center',
    fontWeight: '600',
  },
  webPlaceholderSubtext: {
    fontSize: 14,
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
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
});
