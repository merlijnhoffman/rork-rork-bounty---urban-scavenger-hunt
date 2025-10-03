import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo } from 'react';

export interface PlayerConnection {
  connectedUserId: string;
  timestamp: string;
  distance: number;
}

export const [ConnectionProvider, useConnection] = createContextHook(() => {
  const [connections, setConnections] = useState<PlayerConnection[]>([]);
  const [extraDistanceMeterUses, setExtraDistanceMeterUses] = useState<number>(0);

  const addConnection = useCallback((connection: PlayerConnection) => {
    setConnections(prev => {
      const exists = prev.find(c => c.connectedUserId === connection.connectedUserId);
      if (exists) return prev;
      return [...prev, connection];
    });
    
    setExtraDistanceMeterUses(prev => prev + 1);
    
    console.log('Connection added:', connection);
    console.log('Extra distance meter uses:', extraDistanceMeterUses + 1);
  }, [extraDistanceMeterUses]);

  const useExtraDistanceMeter = useCallback(() => {
    if (extraDistanceMeterUses > 0) {
      setExtraDistanceMeterUses(prev => prev - 1);
      return true;
    }
    return false;
  }, [extraDistanceMeterUses]);

  const resetForNewHunt = useCallback(() => {
    setConnections([]);
    setExtraDistanceMeterUses(0);
  }, []);

  return useMemo(() => ({
    connections,
    extraDistanceMeterUses,
    addConnection,
    useExtraDistanceMeter,
    resetForNewHunt,
  }), [connections, extraDistanceMeterUses, addConnection, useExtraDistanceMeter, resetForNewHunt]);
});
