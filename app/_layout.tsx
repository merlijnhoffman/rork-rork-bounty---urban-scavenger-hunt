import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { GameProvider } from '@/store/game-store';
import { UserProvider } from '@/store/user-store';
import { AuthProvider } from '@/contexts/AuthContext';
import { PaymentWrapper } from '@/contexts/PaymentContext';
import { trpc, trpcClient } from '@/lib/trpc';
import { ErrorBoundary } from 'react-error-boundary';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#0A0A0A" />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen 
          name="modal" 
          options={{ 
            presentation: "modal",
            headerShown: false,
          }} 
        />
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
    backgroundColor: '#0A0A0A',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF6B6B',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#FFF',
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
    SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <UserProvider>
              <PaymentWrapper>
                <GameProvider>
                  <GestureHandlerRootView style={styles.container}>
                    <RootLayoutNav />
                  </GestureHandlerRootView>
                </GameProvider>
              </PaymentWrapper>
            </UserProvider>
          </AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}