import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { X, Users, QrCode, Camera } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { trpcClient } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';
import { useConnection } from '@/contexts/ConnectionContext';

interface PlayerConnectionProps {
  visible: boolean;
  onClose: () => void;
  eventId: string;
}

export default function PlayerConnection({ visible, onClose, eventId }: PlayerConnectionProps) {
  const { user } = useAuth();
  const { addConnection } = useConnection();
  const [mode, setMode] = useState<'menu' | 'generate' | 'scan'>('menu');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (expiresAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        setTimeLeft(remaining);
        
        if (remaining === 0) {
          setQrCode(null);
          setExpiresAt(null);
          setMode('menu');
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [expiresAt]);

  const handleGenerateCode = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to generate a connection code');
      return;
    }

    setIsGenerating(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        const simulationCode = JSON.stringify({
          userId: 'simulation-user',
          eventId: 'simulation-event',
          timestamp: Date.now(),
          token: 'SIMULATION-TOKEN-' + Math.random().toString(36).substring(7).toUpperCase(),
        });
        
        setQrCode(simulationCode);
        setExpiresAt(Date.now() + 60000);
        setMode('generate');
        setIsGenerating(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const result = await trpcClient.connection.generateCode.mutate({
        userId: user.id,
        eventId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setQrCode(result.code);
      setExpiresAt(result.expiresAt);
      setMode('generate');
    } catch (error) {
      console.error('Error generating code:', error);
      Alert.alert('Error', 'Failed to generate connection code. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScanCode = async () => {
    if (!cameraPermission) {
      Alert.alert('Error', 'Camera permissions not loaded');
      return;
    }

    if (!cameraPermission.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera permissions to scan QR codes.'
        );
        return;
      }
    }

    setMode('scan');
  };

  const handleBarcodeScanned = async (data: string) => {
    if (isScanning || !user) return;

    setIsScanning(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location permissions to verify your proximity.'
        );
        setIsScanning(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const result = await trpcClient.connection.verifyConnection.mutate({
        code: data,
        scannerUserId: user.id,
        scannerLatitude: location.coords.latitude,
        scannerLongitude: location.coords.longitude,
      });

      addConnection({
        connectedUserId: result.generatorUserId,
        timestamp: new Date().toISOString(),
        distance: result.distance,
      });

      Alert.alert(
        '🎉 Connection Successful!',
        `You've connected with another player!\n\nReward: +1 Distance Meter Use\n\nDistance: ${result.distance}m`,
        [
          {
            text: 'OK',
            onPress: () => {
              setMode('menu');
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error verifying connection:', error);
      Alert.alert('Connection Failed', error.message || 'Failed to verify connection. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleClose = () => {
    setMode('menu');
    setQrCode(null);
    setExpiresAt(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Users color="#00D4FF" size={24} />
              <Text style={styles.title}>Connect with Player</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X color="#FFF" size={24} />
            </TouchableOpacity>
          </View>

          {mode === 'menu' && (
            <View style={styles.content}>
              <Text style={styles.description}>
                Connect with another player to gain an extra Distance Meter use!
              </Text>

              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>How it works:</Text>
                <Text style={styles.infoText}>
                  • Both players must be within 5 meters{'\n'}
                  • One player generates a QR code{'\n'}
                  • The other player scans it{'\n'}
                  • Both players get +1 Distance Meter use
                </Text>
              </View>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleGenerateCode}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <QrCode color="#000" size={24} />
                    <Text style={styles.actionButtonText}>Generate QR Code</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.scanButton]}
                onPress={handleScanCode}
              >
                <Camera color="#00D4FF" size={24} />
                <Text style={[styles.actionButtonText, styles.scanButtonText]}>
                  Scan QR Code
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'generate' && qrCode && (
            <View style={styles.content}>
              <Text style={styles.description}>
                Show this QR code to another player to connect
              </Text>

              <View style={styles.qrContainer}>
                {qrCode.includes('SIMULATION') ? (
                  <Image
                    source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/18pwwnhwwzn279k1ivt1w' }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                ) : (
                  <QRCode value={qrCode} size={200} backgroundColor="#FFF" />
                )}
              </View>

              <View style={styles.timerContainer}>
                <Text style={styles.timerText}>
                  Expires in: {timeLeft}s
                </Text>
              </View>

              <Text style={styles.proximityWarning}>
                ⚠️ Both players must be within 5 meters
              </Text>

              <TouchableOpacity
                style={[styles.actionButton, styles.backButton]}
                onPress={() => {
                  setMode('menu');
                  setQrCode(null);
                  setExpiresAt(null);
                }}
              >
                <Text style={[styles.actionButtonText, styles.backButtonText]}>
                  Back to Menu
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'scan' && (
            <View style={styles.scannerContainer}>
              {Platform.OS === 'web' ? (
                <View style={styles.webScannerPlaceholder}>
                  <Camera color="#888" size={64} />
                  <Text style={styles.webScannerText}>
                    QR code scanning is not available on web.{'\n'}
                    Please use the mobile app.
                  </Text>
                </View>
              ) : (
                <CameraView
                  style={styles.camera}
                  facing="back"
                  onBarcodeScanned={(result: { data: string }) => {
                    if (result.data && !isScanning) {
                      handleBarcodeScanned(result.data);
                    }
                  }}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                >
                  <View style={styles.scannerOverlay}>
                    <View style={styles.scannerFrame} />
                    <Text style={styles.scannerText}>
                      {isScanning ? 'Verifying connection...' : 'Align QR code within frame'}
                    </Text>
                  </View>
                </CameraView>
              )}

              <TouchableOpacity
                style={[styles.actionButton, styles.backButton, styles.scanBackButton]}
                onPress={() => setMode('menu')}
              >
                <Text style={[styles.actionButtonText, styles.backButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 24,
    gap: 20,
  },
  description: {
    fontSize: 16,
    color: '#CCC',
    textAlign: 'center',
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: '#0A1A2A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00D4FF',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00D4FF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 22,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4FF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  scanButton: {
    backgroundColor: '#0A1A2A',
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  scanButtonText: {
    color: '#00D4FF',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFF',
    borderRadius: 16,
    alignSelf: 'center',
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  timerContainer: {
    backgroundColor: '#2A1A1A',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  proximityWarning: {
    fontSize: 14,
    color: '#FFA500',
    textAlign: 'center',
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#333',
  },
  backButtonText: {
    color: '#FFF',
  },
  scannerContainer: {
    height: 500,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#00D4FF',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  scannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  scanBackButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  webScannerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    padding: 40,
  },
  webScannerText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
});
