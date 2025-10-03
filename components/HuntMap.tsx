import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
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

export default function HuntMap({ visible, onClose, clueOrder, totalClues, targetLocation }: HuntMapProps) {
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
            <View style={styles.mapGrid}>
              {[...Array(10)].map((_, i) => (
                <View key={`h-${i}`} style={[styles.gridLine, { top: `${i * 10}%` }]} />
              ))}
              {[...Array(10)].map((_, i) => (
                <View key={`v-${i}`} style={[styles.gridLine, styles.gridLineVertical, { left: `${i * 10}%` }]} />
              ))}
            </View>
            
            <View style={styles.mapRing}>
              <View style={styles.mapRingInner} />
            </View>
            
            <View style={styles.mapPin}>
              <Target color="#00D4FF" size={32} />
            </View>
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
            Interactive map with Google Maps is available on mobile devices
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
    padding: 40,
    gap: 20,
  },
  mapTemplate: {
    width: '100%',
    maxWidth: 500,
    aspectRatio: 1,
    backgroundColor: '#0F1419',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#333',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 20,
  },
  mapGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#1A2530',
  },
  gridLineVertical: {
    top: 0,
    bottom: 0,
    left: 0,
    width: 1,
    height: '100%',
  },
  mapRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '60%',
    aspectRatio: 1,
    marginLeft: '-30%',
    marginTop: '-30%',
    borderRadius: 9999,
    borderWidth: 3,
    borderColor: '#00D4FF',
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
  },
  mapRingInner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '50%',
    aspectRatio: 1,
    marginLeft: '-25%',
    marginTop: '-25%',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.4)',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  mapPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -16,
    marginTop: -16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 1,
  },
  zoneStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    gap: 20,
    borderWidth: 1,
    borderColor: '#333',
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00D4FF',
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
