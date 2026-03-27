import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

interface LocationContextType {
  hasPermission: boolean;
  permissionStatus: Location.PermissionStatus | null;
  requestPermission: () => Promise<boolean>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);

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
      const status = await checkPermission();
      
      if (status === Location.PermissionStatus.UNDETERMINED && !hasAskedRef.current && Platform.OS === 'web') {
        hasAskedRef.current = true;
        const granted = await requestPermission();
        console.log('Web location permission granted:', granted);
      }
    };

    initializePermission();
  }, []);

  const value = useMemo(
    () => ({
      hasPermission,
      permissionStatus,
      requestPermission,
    }),
    [hasPermission, permissionStatus]
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
