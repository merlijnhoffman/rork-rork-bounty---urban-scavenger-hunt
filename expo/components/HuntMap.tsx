import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Target, MapPin } from 'lucide-react-native';
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
    fullRadius?: number;
    name: string;
  };
  zoneNarrowed?: number | null;
}

const AMBER = Colors.accent.primary;

export default function HuntMap({ visible, onClose, clueOrder, totalClues, targetLocation, zoneNarrowed }: HuntMapProps) {
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const fullRadius: number = targetLocation.fullRadius ?? targetLocation.radius;
  const narrowedFactor: number = useMemo(() => {
    if (typeof zoneNarrowed === 'number' && zoneNarrowed >= 0 && zoneNarrowed <= 100) {
      return Math.sqrt(zoneNarrowed / 100);
    }
    return 1;
  }, [zoneNarrowed]);
  const currentRadius: number = Math.max(1, Math.round(fullRadius * narrowedFactor));

  useEffect(() => {
    if (!visible || !mapLoaded) return;
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage({ type: 'setRadius', radius: currentRadius, duration: 600 }, '*');
      console.log('[HuntMap] Posted setRadius', currentRadius);
    } catch (err) {
      console.error('[HuntMap] postMessage failed:', err);
    }
  }, [currentRadius, mapLoaded, visible]);

  useEffect(() => {
    if (!visible) return;

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
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

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setMapLoaded(true), 300);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const zoneProgress = ((clueOrder / totalClues) * 100).toFixed(0);
  const remainingClues = totalClues - clueOrder;

  const buildMapHtml = () => {
    const userMarkerHtml = userLocation
      ? `
        var userIcon = L.divIcon({
          className: 'user-marker',
          html: '<div style="width:16px;height:16px;border-radius:50%;background:#10B981;border:3px solid #FFF;box-shadow:0 0 8px rgba(16,185,129,0.6);"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([${userLocation.latitude}, ${userLocation.longitude}], { icon: userIcon }).addTo(map).bindPopup('You are here');
      `
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { width: 100%; height: 100vh; }
          .leaflet-control-attribution { display: none !important; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', {
            zoomControl: true,
            attributionControl: false,
          }).setView([${targetLocation.latitude}, ${targetLocation.longitude}], 14);

          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
          }).addTo(map);

          var huntCircle = L.circle([${targetLocation.latitude}, ${targetLocation.longitude}], {
            radius: ${currentRadius},
            color: '${AMBER}',
            weight: 3,
            fillColor: '${AMBER}',
            fillOpacity: 0.15,
          }).addTo(map);

          var rafId = null;
          function easeInOut(t) {
            return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          }
          function animateRadius(target, duration) {
            if (rafId) cancelAnimationFrame(rafId);
            var startRadius = huntCircle.getRadius();
            var startTime = performance.now();
            function step(now) {
              var t = Math.min(1, (now - startTime) / duration);
              var eased = easeInOut(t);
              var r = startRadius + (target - startRadius) * eased;
              huntCircle.setRadius(r);
              if (t < 1) {
                rafId = requestAnimationFrame(step);
              }
            }
            rafId = requestAnimationFrame(step);
          }
          window.addEventListener('message', function(e) {
            if (e && e.data && e.data.type === 'setRadius') {
              animateRadius(e.data.radius, e.data.duration || 600);
            }
          });

          var targetIcon = L.divIcon({
            className: 'target-marker',
            html: '<div style="width:32px;height:32px;border-radius:50%;background:rgba(245,158,11,0.25);border:2px solid ${AMBER};display:flex;align-items:center;justify-content:center;"><div style="width:12px;height:12px;border-radius:50%;background:${AMBER};"></div></div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });
          L.marker([${targetLocation.latitude}, ${targetLocation.longitude}], { icon: targetIcon }).addTo(map).bindPopup('${targetLocation.name}');

          ${userMarkerHtml}
        </script>
      </body>
      </html>
    `;
  };

  const mapDataUri = `data:text/html;charset=utf-8,${encodeURIComponent(buildMapHtml())}`;

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

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mapTemplate}>
          {!mapLoaded ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={AMBER} />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          ) : (
            <iframe
              ref={iframeRef}
              src={mapDataUri}
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 } as any}
              title="Hunt Zone Map"
            />
          )}
        </View>

        <Text style={styles.webPlaceholderTitle}>{targetLocation.name}</Text>

        <View style={styles.zoneStats}>
          <View style={styles.zoneStat}>
            <Text style={styles.zoneStatLabel}>Search Zone</Text>
            <Text style={styles.zoneStatValue}>{currentRadius}m</Text>
          </View>
          <View style={styles.zoneDivider} />
          <View style={styles.zoneStat}>
            <Text style={styles.zoneStatLabel}>Zone Narrowed</Text>
            <Text style={styles.zoneStatValue}>
              {typeof zoneNarrowed === 'number' ? `${100 - zoneNarrowed}%` : `${zoneProgress}%`}
            </Text>
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
          <MapPin color={Colors.dark.textMuted} size={14} />
          <Text style={styles.coordinatesText}>
            {targetLocation.latitude.toFixed(6)}, {targetLocation.longitude.toFixed(6)}
          </Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coordinatesText: {
    fontSize: 14,
    color: C.accent.primary,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
