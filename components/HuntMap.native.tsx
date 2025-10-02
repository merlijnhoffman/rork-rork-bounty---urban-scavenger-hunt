import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
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

export default function HuntMap({ visible, onClose, clueOrder, totalClues, targetLocation }: HuntMapProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
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
    }
  }, [visible, pulseAnim]);

  if (!visible) return null;

  const zoneProgress = ((clueOrder / totalClues) * 100).toFixed(0);
  const remainingClues = totalClues - clueOrder;
  const latitudeDelta = (targetLocation.radius / 111000) * 2.5;
  const longitudeDelta = latitudeDelta;

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

      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: targetLocation.latitude,
          longitude: targetLocation.longitude,
          latitudeDelta,
          longitudeDelta,
        }}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        mapType="standard"
      >
        <Circle
          center={{
            latitude: targetLocation.latitude,
            longitude: targetLocation.longitude,
          }}
          radius={targetLocation.radius}
          fillColor="rgba(0, 212, 255, 0.2)"
          strokeColor="#00D4FF"
          strokeWidth={2}
        />
        
        <Circle
          center={{
            latitude: targetLocation.latitude,
            longitude: targetLocation.longitude,
          }}
          radius={targetLocation.radius * 0.7}
          fillColor="rgba(0, 212, 255, 0.1)"
          strokeColor="rgba(0, 212, 255, 0.5)"
          strokeWidth={1}
        />
        
        <Marker
          coordinate={{
            latitude: targetLocation.latitude,
            longitude: targetLocation.longitude,
          }}
          title={targetLocation.name}
          description={`Search within ${targetLocation.radius}m radius`}
        >
          <Animated.View 
            style={[
              styles.markerContainer,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <View style={styles.markerPulse} />
            <View style={styles.marker}>
              <Target color="#FFF" size={20} />
            </View>
          </Animated.View>
        </Marker>
      </MapView>

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
            <View style={[styles.zoneProgressBarFill, { width: `${zoneProgress}%` }]} />
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
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
    height: 8,
    backgroundColor: '#0A0A0A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  zoneProgressBarFill: {
    height: '100%',
    backgroundColor: '#00D4FF',
    borderRadius: 4,
  },
  zoneProgressText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  infoHint: {
    fontSize: 13,
    color: '#00D4FF',
    lineHeight: 20,
    textAlign: 'center',
    backgroundColor: '#0A1A2A',
    padding: 12,
    borderRadius: 8,
  },
  infoHintFinal: {
    fontSize: 13,
    color: '#00FF88',
    lineHeight: 20,
    textAlign: 'center',
    backgroundColor: '#0A2A1A',
    padding: 12,
    borderRadius: 8,
    fontWeight: '600',
  },
});
