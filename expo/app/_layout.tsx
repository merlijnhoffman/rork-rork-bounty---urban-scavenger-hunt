import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as ScreenCapture from "expo-screen-capture";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, AppState, Linking, Platform, TouchableOpacity } from "react-native";
import Colors from '@/constants/colors';
import * as Location from 'expo-location';
import { Crosshair } from 'lucide-react-native';
import { GameProvider } from '@/store/game-store';
import { configureRevenueCat } from '@/hooks/useRevenueCat';
import { useNotificationTapHandler, registerForPushNotificationsAsync, unregisterPushToken } from '@/hooks/useNotifications';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PaymentWrapper } from '@/contexts/PaymentContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { ErrorBoundary } from 'react-error-boundary';

void SplashScreen.preventAutoHideAsync();

try { configureRevenueCat(); } catch {}

// Bug 5: Disable font scaling globally — prevents UI breakage when iOS users
// have large accessibility fonts enabled in their phone settings.
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.allowFontScaling = false;

const queryClient = new QueryClient();

function NotificationRegistrar() {
  const { user } = useAuth();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (userId === lastUserId.current) return;
    lastUserId.current = userId;

    if (userId) {
      registerForPushNotificationsAsync(userId).catch((err) => {
        console.error('[Push] Registration failed:', err);
      });
    } else {
      // Cleanup previous token on logout
      if (lastUserId.current) {
        unregisterPushToken(lastUserId.current).catch(() => {});
      }
    }
  }, [user]);

  return null;
}

function LocationPermissionGate({ children }: { children: React.ReactNode }) {
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [canAskAgain, setCanAskAgain] = useState<boolean>(true);

  const checkPermission = useCallback(async () => {
    const { status, canAskAgain: canAsk } = await Location.getForegroundPermissionsAsync();
    setPermissionStatus(status);
    setCanAskAgain(canAsk);

    // If never asked before, request now (shows system dialog)
    if (status === 'undetermined') {
      const result = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(result.status);
      setCanAskAgain(result.canAskAgain);
    }
  }, []);

  useEffect(() => {
    void checkPermission();
  }, [checkPermission]);

  // Re-check when app returns to foreground (user may have enabled it in Settings)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkPermission();
      }
    });
    return () => sub.remove();
  }, [checkPermission]);

  const isGranted = permissionStatus === 'granted';

  // Bug 7: Block the entire app if location permission is denied
  if (!isGranted && permissionStatus !== null) {
    return (
      <View style={styles.permissionBlocked}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconContainer}>
            <Crosshair color={Colors.accent.primary} size={32} />
          </View>
          <Text style={styles.permissionTitle}>Location Required</Text>
          <Text style={styles.permissionMessage}>
            Bounty needs location access to track distances, show hunt zones, and verify hunter connections. Please enable location in your settings.
          </Text>
          {canAskAgain ? (
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={() => { void checkPermission(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionButtonText}>Enable Location</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionButtonText}>Open Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.dark.background} />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="privacy" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="bounty-mode" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.dark.background,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.status.danger,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.dark.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionBlocked: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    padding: 24,
  },
  permissionCard: {
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    maxWidth: 360,
  },
  permissionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.dark.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: Colors.accent.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
  },
});

function ErrorFallback({ error }: { error: Error }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>
    </View>
  );
}

export default function RootLayout() {
  useNotificationTapHandler();

  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

    // Hide splash screen immediately for faster perceived load time
    setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 0);
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PaymentWrapper>
            <LocationProvider>
              <GameProvider>
                <GestureHandlerRootView style={styles.container}>
                  <LocationPermissionGate>
                    <NotificationRegistrar />
                    <RootLayoutNav />
                  </LocationPermissionGate>
                </GestureHandlerRootView>
              </GameProvider>
            </LocationProvider>
          </PaymentWrapper>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
