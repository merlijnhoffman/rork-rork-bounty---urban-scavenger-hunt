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
  const iframeReadyRef = useRef<boolean>(false);
  const pendingZoneRef = useRef<Record<string, unknown> | null>(null);
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
    prevRadiusRef.current = radiusMeters;

    const payload = {
      type: 'updateZone',
      latitude: centerLatitude,
      longitude: centerLongitude,
      radius: Math.max(1, Math.round(radiusMeters)),
      duration: 600,
    };

    if (iframeReadyRef.current) {
      sendMessage(payload);
    } else {
      pendingZoneRef.current = payload;
    }
  }, [centerLatitude, centerLongitude, radiusMeters, mapLoaded, sendMessage]);

  // Send user location to iframe when available (doesn't trigger iframe reload)
  useEffect(() => {
    if (!userLocation || !iframeReadyRef.current) return;
    sendMessage({
      type: 'userLocation',
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    });
  }, [userLocation, sendMessage]);

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

  // Listen for iframe 'ready' signal and flush pending messages
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'zoneMapReady') return;
      iframeReadyRef.current = true;

      // Flush any pending zone update
      if (pendingZoneRef.current) {
        sendMessage(pendingZoneRef.current);
        pendingZoneRef.current = null;
      }

      // Re-send user location if available
      if (userLocation) {
        sendMessage({
          type: 'userLocation',
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sendMessage, userLocation]);

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
          body { margin: 0; padding: 0; background: #000; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
          #map { width: 100%; height: 100vh; }
          .leaflet-control-attribution { display: none !important; }
          .map-controls {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .map-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(0,0,0,0.7);
            border: 1px solid rgba(255,255,255,0.15);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #F59E0B;
            font-size: 16px;
            line-height: 1;
            padding: 0;
            transition: background 0.15s;
          }
          .map-btn:hover { background: rgba(0,0,0,0.85); }
          .map-btn.btn-locate { color: #10B981; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div class="map-controls">
          <button class="map-btn" id="btnCenterZone" title="Center on hunt zone">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
          </button>
          <button class="map-btn btn-locate" id="btnCenterUser" title="Center on my location">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="8" opacity="0.35"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/></svg>
          </button>
        </div>
        <script>
          var ZONE_LAT = ${centerLatitude};
          var ZONE_LNG = ${centerLongitude};
          var ZONE_RAD = ${initialRadius};

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
          }).addTo(map);

          var userMarker = null;
          var userIcon = L.divIcon({
            className: 'user-marker',
            html: '<div style="width:14px;height:14px;border-radius:50%;background:#10B981;border:3px solid #FFF;box-shadow:0 0 8px rgba(16,185,129,0.6);"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          // --- Animate zone changes ---
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
              ZONE_LAT = targetLat;
              ZONE_LNG = targetLng;
              ZONE_RAD = targetRadius;
              if (t < 1) rafId = requestAnimationFrame(step);
            }
            rafId = requestAnimationFrame(step);
          }

          // --- Center buttons ---
          document.getElementById('btnCenterZone').addEventListener('click', function() {
            var d = Math.max(0.005, (ZONE_RAD / 50000) * 2);
            map.flyTo([ZONE_LAT, ZONE_LNG], Math.max(13, map.getZoom()), { duration: 0.6 });
          });

          document.getElementById('btnCenterUser').addEventListener('click', function() {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(function(pos) {
                map.flyTo([pos.coords.latitude, pos.coords.longitude], Math.max(14, map.getZoom()), { duration: 0.6 });
              });
            }
          });

          // --- Message bridge ---
          window.addEventListener('message', function(e) {
            if (!e || !e.data) return;
            if (e.data.type === 'updateZone') {
              animateZone(e.data.latitude, e.data.longitude, e.data.radius, e.data.duration || 600);
            } else if (e.data.type === 'userLocation') {
              if (!userMarker) {
                userMarker = L.marker([e.data.latitude, e.data.longitude], { icon: userIcon }).addTo(map);
              } else {
                userMarker.setLatLng([e.data.latitude, e.data.longitude]);
              }
            }
          });

          // Signal parent that iframe is ready
          window.parent.postMessage({ type: 'zoneMapReady' }, '*');
        </script>
      </body>
      </html>
    `;
  }, [initialRadius]);

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
