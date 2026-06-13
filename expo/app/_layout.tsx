import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as ScreenCapture from "expo-screen-capture";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import Colors from '@/constants/colors';
import { GameProvider } from '@/store/game-store';
import { configureRevenueCat } from '@/hooks/useRevenueCat';

import { AuthProvider } from '@/contexts/AuthContext';
import { PaymentWrapper } from '@/contexts/PaymentContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { ErrorBoundary } from 'react-error-boundary';

void SplashScreen.preventAutoHideAsync();

try { configureRevenueCat(); } catch {}

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.dark.background} />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'modal' }} />
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
                  <RootLayoutNav />
                </GestureHandlerRootView>
              </GameProvider>
            </LocationProvider>
          </PaymentWrapper>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
