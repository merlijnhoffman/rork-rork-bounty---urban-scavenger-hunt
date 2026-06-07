import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { MapPin, Target } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface EventZoneMapProps {
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  zoneName?: string;
}

const AMBER = Colors.accent.primary;

export default function EventZoneMap({
  centerLatitude,
  centerLongitude,
  radiusMeters,
  zoneName,
}: EventZoneMapProps) {
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const prevRadiusRef = useRef<number>(radiusMeters);
  const initialRadius = useMemo<number>(() => Math.max(1, Math.round(radiusMeters)), []);

  const sendMessage = useCallback((data: Record<string, unknown>) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(data, '*');
    } catch (err) {
      console.error('[EventZoneMap] postMessage failed:', err);
    }
  }, []);

  // Post zone updates to the iframe map
  useEffect(() => {
    if (!mapLoaded) return;
    const radiusChanged = prevRadiusRef.current !== radiusMeters;
    prevRadiusRef.current = radiusMeters;

    sendMessage({
      type: 'updateZone',
      latitude: centerLatitude,
      longitude: centerLongitude,
      radius: Math.max(1, Math.round(radiusMeters)),
      duration: 600,
      triggerBurst: radiusChanged,
    });
  }, [centerLatitude, centerLongitude, radiusMeters, mapLoaded, sendMessage]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('[EventZoneMap] Geolocation error:', error?.message);
        }
      );
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMapLoaded(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const mapHtml = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; background: #000; }
          #map { width: 100%; height: 100vh; }
          .leaflet-control-attribution { display: none !important; }
          @keyframes pulse-ring {
            0% { r: 18; opacity: 0.6; }
            100% { r: 28; opacity: 0; }
          }
          @keyframes burst-ring {
            0% { r: 18; opacity: 1; stroke-width: 3; }
            100% { r: 52; opacity: 0; stroke-width: 1; }
          }
          .pulse-ring {
            animation: pulse-ring 2s ease-out infinite;
          }
          .burst-ring {
            animation: burst-ring 1s ease-out forwards;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: true, attributionControl: false })
            .setView([${centerLatitude}, ${centerLongitude}], 14);

          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
          }).addTo(map);

          var huntCircle = L.circle([${centerLatitude}, ${centerLongitude}], {
            radius: ${initialRadius},
            color: '${AMBER}',
            weight: 3,
            fillColor: '${AMBER}',
            fillOpacity: 0.15,
            className: 'pulse-circle',
          }).addTo(map);

          var pulseRing = L.circleMarker([${centerLatitude}, ${centerLongitude}], {
            radius: 18,
            color: '${AMBER}',
            weight: 2.5,
            fillColor: 'transparent',
            fillOpacity: 0,
            className: 'pulse-ring',
            interactive: false,
          }).addTo(map);

          var targetIcon = L.divIcon({
            className: 'target-marker',
            html: '<div style="width:28px;height:28px;border-radius:50%;background:rgba(245,158,11,0.25);border:2px solid ${AMBER};display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;border-radius:50%;background:${AMBER};"></div></div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          var targetMarker = L.marker([${centerLatitude}, ${centerLongitude}], { icon: targetIcon }).addTo(map);

          var userMarker = null;
          ${userLocation ? `
            var userIcon = L.divIcon({
              className: 'user-marker',
              html: '<div style="width:14px;height:14px;border-radius:50%;background:#10B981;border:3px solid #FFF;box-shadow:0 0 8px rgba(16,185,129,0.6);"></div>',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            });
            userMarker = L.marker([${userLocation.latitude}, ${userLocation.longitude}], { icon: userIcon }).addTo(map);
          ` : ''}

          var rafId = null;
          function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
          function animateZone(targetLat, targetLng, targetRadius, duration) {
            if (rafId) cancelAnimationFrame(rafId);
            var startLatLng = huntCircle.getLatLng();
            var startRadius = huntCircle.getRadius();
            var startTime = performance.now();
            function step(now) {
              var t = Math.min(1, (now - startTime) / duration);
              var e = easeInOut(t);
              var lat = startLatLng.lat + (targetLat - startLatLng.lat) * e;
              var lng = startLatLng.lng + (targetLng - startLatLng.lng) * e;
              var r = startRadius + (targetRadius - startRadius) * e;
              huntCircle.setLatLng([lat, lng]);
              huntCircle.setRadius(r);
              targetMarker.setLatLng([lat, lng]);
              pulseRing.setLatLng([lat, lng]);
              if (t < 1) rafId = requestAnimationFrame(step);
            }
            rafId = requestAnimationFrame(step);
          }

          window.addEventListener('message', function(e) {
            if (e && e.data && e.data.type === 'updateZone') {
              animateZone(e.data.latitude, e.data.longitude, e.data.radius, e.data.duration || 600);

              // Trigger burst ripple when radius changes (admin adjusts zone)
              if (e.data.triggerBurst) {
                var burstEl = pulseRing.getElement();
                burstEl.classList.remove('burst-ring');
                void burstEl.offsetWidth; // force reflow
                burstEl.classList.add('burst-ring');
                burstEl.addEventListener('animationend', function handler() {
                  burstEl.removeEventListener('animationend', handler);
                  burstEl.classList.remove('burst-ring');
                });
              }
            }
          });
        </script>
      </body>
      </html>
    `;
  }, [initialRadius, userLocation]);

  const mapDataUri = `data:text/html;charset=utf-8,${encodeURIComponent(mapHtml)}`;

  return (
    <View style={styles.container}>
      <View style={styles.mapWrapper}>
        {!mapLoaded ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={AMBER} />
            <Text style={styles.loadingText}>Loading zone...</Text>
          </View>
        ) : (
          <iframe
            ref={iframeRef}
            src={mapDataUri}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 14 } as any}
            title="Event Zone Map"
          />
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
    overflow: 'hidden',
    backgroundColor: C.dark.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: C.accent.primary,
    fontSize: 13,
    fontWeight: '600' as const,
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
});
