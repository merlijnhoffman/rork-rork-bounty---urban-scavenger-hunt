import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Audio, Video, ResizeMode } from 'expo-av';
import { ImageIcon, Film, Volume2, VolumeX, Play, Pause, X, Maximize2 } from 'lucide-react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ClueMediaProps {
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
}

export default React.memo(function ClueMedia({ imageUrl, videoUrl, audioUrl }: ClueMediaProps) {
  const hasMedia = !!(imageUrl || videoUrl || audioUrl);
  if (!hasMedia) return null;

  return (
    <View style={styles.mediaContainer}>
      {imageUrl && <ClueImage url={imageUrl} />}
      {videoUrl && <ClueVideo url={videoUrl} />}
      {audioUrl && <ClueAudio url={audioUrl} />}
    </View>
  );
});

function ClueImage({ url }: { url: string }) {
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  return (
    <>
      <TouchableOpacity
        style={styles.imageWrapper}
        onPress={() => setFullscreen(true)}
        activeOpacity={0.85}
      >
        {loading && (
          <View style={styles.mediaLoading}>
            <ActivityIndicator color={Colors.accent.primary} size="small" />
          </View>
        )}
        {error ? (
          <View style={styles.mediaError}>
            <ImageIcon color={Colors.dark.textMuted} size={24} />
            <Text style={styles.mediaErrorText}>Failed to load image</Text>
          </View>
        ) : (
          <Image
            source={{ uri: url }}
            style={styles.clueImage}
            resizeMode="cover"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setError(true);
              setLoading(false);
              console.log('[ClueMedia] Image load error for:', url);
            }}
          />
        )}
        {!error && !loading && (
          <View style={styles.expandBadge}>
            <Maximize2 color="#FFF" size={14} />
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={fullscreen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={() => setFullscreen(false)}
            activeOpacity={0.7}
          >
            <X color="#FFF" size={24} />
          </TouchableOpacity>
          <Image
            source={{ uri: url }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </>
  );
}

function ClueVideo({ url }: { url: string }) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const togglePlayback = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (err) {
      console.log('[ClueMedia] Video playback error:', err);
    }
  }, [isPlaying]);

  if (error) {
    return (
      <View style={styles.mediaError}>
        <Film color={Colors.dark.textMuted} size={24} />
        <Text style={styles.mediaErrorText}>Failed to load video</Text>
      </View>
    );
  }

  return (
    <View style={styles.videoWrapper}>
      {loading && (
        <View style={styles.mediaLoading}>
          <ActivityIndicator color={Colors.accent.primary} size="small" />
        </View>
      )}
      <Video
        ref={videoRef}
        source={{ uri: url }}
        style={styles.clueVideo}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls={true}
        isLooping={false}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            if (loading) setLoading(false);
          }
        }}
        onError={(err) => {
          console.log('[ClueMedia] Video error:', err);
          setError(true);
          setLoading(false);
        }}
        onLoad={() => {
          console.log('[ClueMedia] Video loaded:', url);
          setLoading(false);
        }}
      />
      {!loading && !isPlaying && (
        <TouchableOpacity
          style={styles.videoPlayOverlay}
          onPress={togglePlayback}
          activeOpacity={0.8}
        >
          <View style={styles.playButtonCircle}>
            <Play color="#FFF" size={22} fill="#FFF" />
          </View>
        </TouchableOpacity>
      )}
      <View style={styles.mediaLabel}>
        <Film color={Colors.accent.primary} size={12} />
        <Text style={styles.mediaLabelText}>VIDEO</Text>
      </View>
    </View>
  );
}

function ClueAudio({ url }: { url: string }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [position, setPosition] = useState<number>(0);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        console.log('[ClueMedia] Unloading audio');
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const loadAndPlay = useCallback(async () => {
    try {
      if (soundRef.current) {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
          return;
        }
        await soundRef.current.playAsync();
        return;
      }

      setLoading(true);
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            setPosition(status.positionMillis || 0);
            setDuration(status.durationMillis || 0);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPosition(0);
              sound.setPositionAsync(0).catch(() => {});
            }
          }
        }
      );

      soundRef.current = sound;
      setLoading(false);
      console.log('[ClueMedia] Audio loaded and playing:', url);
    } catch (err) {
      console.log('[ClueMedia] Audio error:', err);
      setError(true);
      setLoading(false);
    }
  }, [isPlaying, url]);

  const formatTime = (millis: number): string => {
    const totalSec = Math.floor(millis / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  if (error) {
    return (
      <View style={styles.mediaError}>
        <VolumeX color={Colors.dark.textMuted} size={24} />
        <Text style={styles.mediaErrorText}>Failed to load audio</Text>
      </View>
    );
  }

  return (
    <View style={styles.audioWrapper}>
      <View style={styles.audioRow}>
        <TouchableOpacity
          style={styles.audioPlayButton}
          onPress={loadAndPlay}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : isPlaying ? (
            <Pause color="#000" size={18} />
          ) : (
            <Play color="#000" size={18} fill="#000" />
          )}
        </TouchableOpacity>

        <View style={styles.audioInfo}>
          <View style={styles.audioProgressBar}>
            <View style={[styles.audioProgressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <View style={styles.audioTimeRow}>
            <Text style={styles.audioTimeText}>{formatTime(position)}</Text>
            {duration > 0 && (
              <Text style={styles.audioTimeText}>{formatTime(duration)}</Text>
            )}
          </View>
        </View>

        <Volume2 color={Colors.accent.primary} size={16} />
      </View>
      <View style={styles.mediaLabel}>
        <Volume2 color={Colors.accent.primary} size={12} />
        <Text style={styles.mediaLabelText}>AUDIO</Text>
      </View>
    </View>
  );
}

const C = Colors;

const styles = StyleSheet.create({
  mediaContainer: {
    gap: 10,
    marginBottom: 14,
  },
  imageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: C.dark.cardElevated,
    position: 'relative' as const,
  },
  clueImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  expandBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 6,
  },
  videoWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: C.dark.cardElevated,
    position: 'relative' as const,
  },
  clueVideo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButtonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  audioWrapper: {
    backgroundColor: C.dark.cardElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.dark.borderLight,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioInfo: {
    flex: 1,
  },
  audioProgressBar: {
    height: 4,
    backgroundColor: C.dark.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  audioProgressFill: {
    height: '100%',
    backgroundColor: C.accent.primary,
    borderRadius: 2,
  },
  audioTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  audioTimeText: {
    fontSize: 11,
    color: C.dark.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mediaLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.dark.cardElevated,
    zIndex: 1,
    borderRadius: 12,
  },
  mediaError: {
    height: 120,
    backgroundColor: C.dark.cardElevated,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.dark.border,
  },
  mediaErrorText: {
    fontSize: 13,
    color: C.dark.textMuted,
    fontWeight: '500' as const,
  },
  mediaLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  mediaLabelText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: C.accent.primary,
    letterSpacing: 1.5,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullscreenImage: {
    width: SCREEN_WIDTH - 40,
    height: '70%',
  },
});
