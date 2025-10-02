import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import * as Location from 'expo-location';
import { Platform, Alert } from 'react-native';

interface LocationContextType {
  hasPermission: boolean;
  permissionStatus: Location.PermissionStatus | null;
  requestPermission: () => Promise<boolean>;
  isLoading: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const requestPermission = async (): Promise<boolean> => {
    try {
      console.log('Requesting location permission...');
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      console.log('Location permission status:', status);
      setPermissionStatus(status);
      
      const granted = status === Location.PermissionStatus.GRANTED;
      setHasPermission(granted);
      
      return granted;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  };

  const checkPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      console.log('Current location permission status:', status);
      
      setPermissionStatus(status);
      setHasPermission(status === Location.PermissionStatus.GRANTED);
      
      return status;
    } catch (error) {
      console.error('Error checking location permission:', error);
      return Location.PermissionStatus.UNDETERMINED;
    }
  };

  const hasAskedRef = useRef(false);

  useEffect(() => {
    const initializePermission = async () => {
      setIsLoading(true);
      
      const status = await checkPermission();
      
      if (status === Location.PermissionStatus.UNDETERMINED && !hasAskedRef.current) {
        hasAskedRef.current = true;
        
        if (Platform.OS === 'web') {
          const granted = await requestPermission();
          console.log('Web location permission granted:', granted);
        } else {
          setTimeout(async () => {
            Alert.alert(
              'Location Permission',
              'This app needs access to your location to show your distance from the bounty during hunts.',
              [
                {
                  text: 'Not Now',
                  style: 'cancel',
                  onPress: () => {
                    console.log('User declined location permission');
                    setIsLoading(false);
                  },
                },
                {
                  text: 'Allow',
                  onPress: async () => {
                    const granted = await requestPermission();
                    console.log('Location permission granted:', granted);
                    setIsLoading(false);
                  },
                },
              ]
            );
          }, 1000);
        }
      } else {
        setIsLoading(false);
      }
    };

    initializePermission();
  }, []);

  const value = useMemo(
    () => ({
      hasPermission,
      permissionStatus,
      requestPermission,
      isLoading,
    }),
    [hasPermission, permissionStatus, isLoading]
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
