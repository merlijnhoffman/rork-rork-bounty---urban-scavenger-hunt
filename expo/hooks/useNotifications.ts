import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useEffect, useRef } from 'react';
import { router } from 'expo-router';

let notificationHandlerConfigured = false;

function configureNotificationHandler() {
  if (notificationHandlerConfigured) return;
  notificationHandlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPushNotificationsAsync(
  userId: string,
): Promise<string | undefined> {
  if (!Device.isDevice) {
    console.log('[Push] Not a physical device — skipping push registration');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F59E0B',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted');
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.log('[Push] No projectId available');
    return;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenData.data;
  console.log('[Push] Token obtained:', token.slice(0, 12) + '...');

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      push_token: token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    console.error('[Push] Failed to store token:', error.message);
  } else {
    console.log('[Push] Token stored for user:', userId);
  }

  return token;
}

export async function unregisterPushToken(userId: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId);
  if (error) {
    console.error('[Push] Failed to delete token:', error.message);
  }
}

export function useNotificationTapHandler() {
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    configureNotificationHandler();

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('[Push] Notification tapped:', data);
        const screen = data?.screen as string | undefined;
        if (screen === 'hunt') {
          router.push('/(tabs)/hunt');
        }
      },
    );

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);
}
