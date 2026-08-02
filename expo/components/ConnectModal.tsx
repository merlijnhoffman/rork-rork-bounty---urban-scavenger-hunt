import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Share,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import {
  X,
  QrCode,
  ScanLine,
  Users,
  Check,
  AlertCircle,
  Clock,
  Navigation,
  Zap,
  RefreshCw,
  Share2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CODE_EXPIRY_SECONDS = 120;
const MAX_DISTANCE_METERS = 100;

type ConnectMode = 'generate' | 'scan';
type ConnectState = 'idle' | 'loading' | 'success' | 'error';

interface ConnectModalProps {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  onConnectionMade: () => void;
}

export default function ConnectModal({
  visible,
  onClose,
  eventId,
  onConnectionMade,
}: ConnectModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mode, setMode] = useState<ConnectMode>('generate');
  const [connectState, setConnectState] = useState<ConnectState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successDistance, setSuccessDistance] = useState<number | null>(null);

  // QR generation state
  const [connectionCode, setConnectionCode] = useState<string | null>(null);
  const [codeTimeLeft, setCodeTimeLeft] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const pulseAnim = useMemo(() => new Animated.Value(0), []);

  // Camera/scanner state
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Reset everything when modal closes
  useEffect(() => {
    if (!visible) {
      setMode('generate');
      setConnectState('idle');
      setErrorMessage('');
      setSuccessDistance(null);
      setConnectionCode(null);
      setCodeTimeLeft(0);
      setHasScanned(false);
      setIsVerifying(false);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      Animated.spring(fadeAnim, { toValue: 0, useNativeDriver: true }).start();
    } else {
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }).start();
    }
  }, [visible, fadeAnim]);

  // QR pulse animation
  useEffect(() => {
    if (mode === 'generate' && connectionCode) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [mode, connectionCode, pulseAnim]);

  // Countdown timer for code expiry
  useEffect(() => {
    if (codeTimeLeft <= 0) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      if (connectionCode && visible && mode === 'generate') {
        setConnectionCode(null);
      }
      return;
    }
    if (!countdownRef.current) {
      countdownRef.current = setInterval(() => {
        setCodeTimeLeft((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [codeTimeLeft, connectionCode, visible, mode]);

  const generateCode = useCallback(async () => {
    if (!user || !eventId) return;
    setIsGenerating(true);
    setConnectState('idle');
    setErrorMessage('');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setConnectState('error');
        setErrorMessage('Location access is needed to verify proximity. Enable it in Settings.');
        setIsGenerating(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Generate a short, human-readable code
      const code = Array.from({ length: 6 }, () =>
        'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()  * 32)],
      ).join('');

      const expiresAt = new Date(Date.now() + CODE_EXPIRY_SECONDS * 1000).toISOString();

      // Delete any previous codes for this user+event
      await supabase
        .from('connection_codes')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', eventId);

      const { error } = await supabase.from('connection_codes').insert({
        code,
        user_id: user.id,
        event_id: eventId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        expires_at: expiresAt,
      });

      if (error) {
        console.error('[Connect] Error creating code:', error.message);
        setConnectState('error');
        setErrorMessage('Failed to generate code. Try again.');
        setIsGenerating(false);
        return;
      }

      setConnectionCode(code);
      setCodeTimeLeft(CODE_EXPIRY_SECONDS);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[Connect] Generate error:', err);
      setConnectState('error');
      setErrorMessage('Could not get your location. Try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [user, eventId]);

  const handleShareCode = useCallback(async () => {
    if (!connectionCode) return;
    try {
      await Share.share({
        message: `Connect with me on Bounty! Scan my QR code or use code: ${connectionCode}`,
      });
    } catch (err) {
      console.error('[Connect] Share error:', err);
    }
  }, [connectionCode]);

  const handleBarcodeScanned = useCallback(
    async (result: { type: string; data: string }) => {
      if (hasScanned || isVerifying) return;
      setHasScanned(true);
      setIsVerifying(true);
      setConnectState('loading');
      setErrorMessage('');

      const scannedData = result.data.trim();

      // The QR data might be a plain code or a JSON payload
      let code = scannedData;
      try {
        const parsed = JSON.parse(scannedData);
        if (parsed && typeof parsed.code === 'string') {
          code = parsed.code;
        }
      } catch {
        // Not JSON, treat as plain code
      }

      if (!user) {
        setConnectState('error');
        setErrorMessage('You must be logged in to connect.');
        setIsVerifying(false);
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setConnectState('error');
          setErrorMessage('Location access is needed to verify proximity.');
          setIsVerifying(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const functionsUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(
          '.supabase.co',
          '',
        );
        const functionEndpoint = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-connection`;

        const response = await fetch(functionEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            code,
            scannerUserId: user.id,
            scannerLatitude: location.coords.latitude,
            scannerLongitude: location.coords.longitude,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setConnectState('success');
          setSuccessDistance(data.distance ?? null);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onConnectionMade();
        } else {
          setConnectState('error');
          setErrorMessage(data.error || 'Connection failed. Try again.');
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          // Allow re-scan after a brief delay
          setTimeout(() => setHasScanned(false), 2000);
        }
      } catch (err) {
        console.error('[Connect] Verify error:', err);
        setConnectState('error');
        setErrorMessage('Could not verify connection. Check your internet and try again.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => setHasScanned(false), 2000);
      } finally {
        setIsVerifying(false);
      }
    },
    [hasScanned, isVerifying, user, onConnectionMade],
  );

  const switchMode = useCallback((newMode: ConnectMode) => {
    setMode(newMode);
    setConnectState('idle');
    setErrorMessage('');
    setHasScanned(false);
    if (newMode === 'scan' && cameraPermission && !cameraPermission.granted) {
      void requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const qrPayload = useMemo(() => {
    if (!connectionCode) return '';
    return JSON.stringify({ code: connectionCode, eventId });
  }, [connectionCode, eventId]);

  const qrExpiring = codeTimeLeft <= 30;
  const qrExpired = codeTimeLeft <= 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16, opacity: fadeAnim },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Users color={Colors.accent.primary} size={20} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Hunter Connect</Text>
                <Text style={styles.headerSubtitle}>Earn bonus hint tokens</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X color={Colors.dark.textSecondary} size={20} />
            </TouchableOpacity>
          </View>

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Zap color={Colors.accent.primary} size={14} />
            <Text style={styles.infoText}>
              Meet up with another hunter, scan their QR, and both earn an extra hint token.
            </Text>
          </View>

          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'generate' && styles.modeButtonActive]}
              onPress={() => switchMode('generate')}
              activeOpacity={0.8}
            >
              <QrCode
                color={mode === 'generate' ? '#000' : Colors.dark.textMuted}
                size={18}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  mode === 'generate' && styles.modeButtonTextActive,
                ]}
              >
                My QR
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'scan' && styles.modeButtonActive]}
              onPress={() => switchMode('scan')}
              activeOpacity={0.8}
            >
              <ScanLine
                color={mode === 'scan' ? '#000' : Colors.dark.textMuted}
                size={18}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  mode === 'scan' && styles.modeButtonTextActive,
                ]}
              >
                Scan
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {mode === 'generate' && (
            <View style={styles.generateContent}>
              {!connectionCode && connectState !== 'loading' && (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <QrCode color={Colors.accent.primary} size={48} />
                  </View>
                  <Text style={styles.emptyTitle}>Generate Your QR Code</Text>
                  <Text style={styles.emptyText}>
                    Show this QR to another hunter. They scan it to connect, and you both
                    earn a bonus hint token. You must be within {MAX_DISTANCE_METERS}m of
                    each other.
                  </Text>
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={generateCode}
                    disabled={isGenerating}
                    activeOpacity={0.8}
                  >
                    {isGenerating ? (
                      <Text style={styles.generateButtonText}>Generating...</Text>
                    ) : (
                      <>
                        <QrCode color="#000" size={18} />
                        <Text style={styles.generateButtonText}>Generate QR Code</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {connectionCode && !qrExpired && (
                <View style={styles.qrDisplay}>
                  <View style={styles.qrCard}>
                    <View style={styles.qrCardHeader}>
                      <Clock
                        color={qrExpiring ? Colors.status.danger : Colors.dark.textMuted}
                        size={14}
                      />
                      <Text
                        style={[
                          styles.qrTimer,
                          qrExpiring && styles.qrTimerExpiring,
                        ]}
                      >
                        Expires in {formatTime(codeTimeLeft)}
                      </Text>
                    </View>

                    <View style={styles.qrImageContainer}>
                      <Animated.View
                        style={[
                          styles.qrPulseRing,
                          {
                            opacity: pulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 0.6],
                            }),
                            transform: [
                              {
                                scale: pulseAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [1, 1.15],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                      <View style={styles.qrWhiteBg}>
                        <QRCode
                          value={qrPayload}
                          size={200}
                          color={Colors.dark.background}
                          backgroundColor="#FFFFFF"
                        />
                      </View>
                    </View>

                    <View style={styles.codeDisplayRow}>
                      <Text style={styles.codeLabel}>CODE</Text>
                      <Text style={styles.codeValue}>{connectionCode}</Text>
                    </View>
                  </View>

                  <View style={styles.qrActions}>
                    <TouchableOpacity
                      style={styles.qrActionButton}
                      onPress={handleShareCode}
                      activeOpacity={0.7}
                    >
                      <Share2 color={Colors.accent.primary} size={16} />
                      <Text style={styles.qrActionButtonText}>Share Code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.qrActionButton}
                      onPress={generateCode}
                      activeOpacity={0.7}
                    >
                      <RefreshCw color={Colors.accent.primary} size={16} />
                      <Text style={styles.qrActionButtonText}>Refresh</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.waitingIndicator}>
                    <View style={styles.waitingDot} />
                    <Text style={styles.waitingText}>
                      Waiting for another hunter to scan...
                    </Text>
                  </View>
                </View>
              )}

              {connectionCode && qrExpired && (
                <View style={styles.expiredState}>
                  <View style={styles.expiredIconContainer}>
                    <Clock color={Colors.status.danger} size={36} />
                  </View>
                  <Text style={styles.expiredTitle}>Code Expired</Text>
                  <Text style={styles.expiredText}>
                    Your QR code has expired. Generate a new one to connect.
                  </Text>
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={generateCode}
                    activeOpacity={0.8}
                  >
                    <QrCode color="#000" size={18} />
                    <Text style={styles.generateButtonText}>New QR Code</Text>
                  </TouchableOpacity>
                </View>
              )}

              {connectState === 'error' && !connectionCode && (
                <View style={styles.errorRow}>
                  <AlertCircle color={Colors.status.danger} size={14} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}
            </View>
          )}

          {mode === 'scan' && (
            <View style={styles.scanContent}>
              {connectState === 'success' ? (
                <View style={styles.successState}>
                  <View style={styles.successIconContainer}>
                    <Check color={Colors.status.success} size={48} />
                  </View>
                  <Text style={styles.successTitle}>Connected!</Text>
                  <Text style={styles.successText}>
                    You've connected with another hunter.
                    {successDistance !== null &&
                      ` You were ${successDistance}m apart.`}{' '}
                    You both earned a bonus hint token!
                  </Text>
                  <TouchableOpacity
                    style={styles.successButton}
                    onPress={onClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.successButtonText}>Back to Hunt</Text>
                  </TouchableOpacity>
                </View>
              ) : connectState === 'loading' ? (
                <View style={styles.verifyingState}>
                  <View style={styles.verifyingPulse} />
                  <Text style={styles.verifyingTitle}>Verifying connection...</Text>
                  <Text style={styles.verifyingText}>
                    Checking proximity and validating tickets
                  </Text>
                </View>
              ) : !cameraPermission?.granted ? (
                <View style={styles.permissionState}>
                  <View style={styles.permissionIconContainer}>
                    <ScanLine color={Colors.accent.primary} size={40} />
                  </View>
                  <Text style={styles.permissionTitle}>Camera Access Needed</Text>
                  <Text style={styles.permissionText}>
                    Allow camera access to scan another hunter's QR code.
                  </Text>
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={requestCameraPermission}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.generateButtonText}>Allow Camera</Text>
                  </TouchableOpacity>
                  {cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain === false && (
                    <TouchableOpacity
                      style={styles.settingsLink}
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Linking.openURL('app-settings:');
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.settingsLinkText}>Open Settings</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.cameraContainer}>
                  <View style={styles.cameraWrapper}>
                    <CameraView
                      style={styles.camera}
                      facing="back"
                      onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    />
                    {/* Scan overlay frame */}
                    <View style={styles.scanOverlay} pointerEvents="none">
                      <View style={styles.scanFrame}>
                        <View style={[styles.scanCorner, styles.scanCornerTL]} />
                        <View style={[styles.scanCorner, styles.scanCornerTR]} />
                        <View style={[styles.scanCorner, styles.scanCornerBL]} />
                        <View style={[styles.scanCorner, styles.scanCornerBR]} />
                      </View>
                    </View>
                  </View>

                  <View style={styles.scanInstructions}>
                    <ScanLine color={Colors.accent.primary} size={20} />
                    <Text style={styles.scanInstructionsTitle}>
                      Point at a hunter's QR code
                    </Text>
                    <Text style={styles.scanInstructionsText}>
                      Make sure you're within {MAX_DISTANCE_METERS}m of each other
                    </Text>
                  </View>

                  {connectState === 'error' && (
                    <View style={styles.scanError}>
                      <AlertCircle color={Colors.status.danger} size={14} />
                      <Text style={styles.scanErrorText}>{errorMessage}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Footer hint */}
          <View style={styles.footer}>
            <Navigation color={Colors.dark.textMuted} size={12} />
            <Text style={styles.footerText}>
              Proximity verified via GPS. Anti-cheat protected.
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const C = Colors;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.dark.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: C.dark.border,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: C.dark.text,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: C.dark.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accent.primaryMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: C.dark.text,
    lineHeight: 18,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: C.dark.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: C.accent.primary,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: C.dark.textMuted,
  },
  modeButtonTextActive: {
    color: '#000',
  },

  // Generate mode
  generateContent: {
    alignItems: 'center',
    minHeight: 360,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    flex: 1,
    justifyContent: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: C.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
    marginBottom: 24,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent.primary,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
    gap: 8,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
    letterSpacing: 0.3,
  },

  // QR display
  qrDisplay: {
    alignItems: 'center',
    width: '100%',
  },
  qrCard: {
    backgroundColor: C.dark.card,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  qrCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  qrTimer: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: C.dark.textMuted,
  },
  qrTimerExpiring: {
    color: C.status.danger,
  },
  qrImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  qrPulseRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2,
    borderColor: C.accent.primary,
  },
  qrWhiteBg: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  codeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.dark.cardElevated,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: C.dark.textMuted,
    letterSpacing: 2,
  },
  codeValue: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: C.accent.primary,
    letterSpacing: 4,
  },
  qrActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  qrActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.dark.card,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  qrActionButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: C.accent.primary,
  },
  waitingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  waitingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent.primary,
  },
  waitingText: {
    fontSize: 13,
    color: C.dark.textSecondary,
    fontWeight: '500' as const,
  },

  // Expired
  expiredState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  expiredIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.status.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  expiredTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginBottom: 8,
  },
  expiredText: {
    fontSize: 14,
    color: C.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 24,
  },

  // Scan mode
  scanContent: {
    minHeight: 360,
  },
  cameraContainer: {
    flex: 1,
  },
  cameraWrapper: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    height: 300,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: C.accent.primary,
  },
  scanCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  scanCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  scanCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  scanCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanInstructions: {
    alignItems: 'center',
    gap: 6,
  },
  scanInstructionsTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: C.dark.text,
  },
  scanInstructionsText: {
    fontSize: 13,
    color: C.dark.textSecondary,
  },
  scanError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.status.dangerMuted,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  scanErrorText: {
    flex: 1,
    fontSize: 13,
    color: C.status.danger,
    fontWeight: '500' as const,
  },

  // Permission state
  permissionState: {
    alignItems: 'center',
    paddingVertical: 32,
    flex: 1,
    justifyContent: 'center',
  },
  permissionIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: C.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: C.dark.text,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: C.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 24,
  },
  settingsLink: {
    marginTop: 12,
  },
  settingsLinkText: {
    fontSize: 14,
    color: C.accent.primary,
    fontWeight: '600' as const,
  },

  // Success state
  successState: {
    alignItems: 'center',
    paddingVertical: 32,
    flex: 1,
    justifyContent: 'center',
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: C.status.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: C.status.success,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  successText: {
    fontSize: 15,
    color: C.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: 28,
  },
  successButton: {
    backgroundColor: C.accent.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  successButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
  },

  // Verifying state
  verifyingState: {
    alignItems: 'center',
    paddingVertical: 48,
    flex: 1,
    justifyContent: 'center',
  },
  verifyingPulse: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.accent.primaryMuted,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: C.accent.primary,
  },
  verifyingTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: C.dark.text,
    marginBottom: 8,
  },
  verifyingText: {
    fontSize: 14,
    color: C.dark.textSecondary,
  },

  // Error row (generate mode)
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.status.dangerMuted,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: C.status.danger,
    fontWeight: '500' as const,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.dark.border,
  },
  footerText: {
    fontSize: 12,
    color: C.dark.textMuted,
    fontWeight: '500' as const,
  },
});
