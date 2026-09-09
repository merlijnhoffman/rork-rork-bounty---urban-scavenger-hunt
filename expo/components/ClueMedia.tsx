import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { useEvent, useEventListener } from 'expo';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioSource,
} from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ImageIcon, Film, Volume2, VolumeX, Play, Pause, X, Maximize2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { buildPublicMediaUrl, getSignedMediaUrl } from '@/lib/media-url';
import { useLanguage } from '@/contexts/LanguageContext';

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

/**
 * Resolves a raw stored media value into a playable URI. Starts with the
 * public URL (normalized path); if loading fails once, retries with a
 * signed URL before giving up — covers non-public buckets and malformed paths.
 */
function useMediaSource(rawUrl: string) {
  const [uri, setUri] = useState<string>(() => buildPublicMediaUrl(rawUrl));
  const triedSignedRef = useRef<boolean>(false);

  useEffect(() => {
    setUri(buildPublicMediaUrl(rawUrl));
    triedSignedRef.current = false;
  }, [rawUrl]);

  const handleError = useCallback(async (): Promise<boolean> => {
    if (triedSignedRef.current) return false;
    triedSignedRef.current = true;
    const signed = await getSignedMediaUrl(rawUrl);
    if (signed && signed !== uri) {
      setUri(signed);
      return true;
    }
    return false;
  }, [rawUrl, uri]);

  return { uri, handleError };
}

function ClueImage({ url }: { url: string }) {
  const { t } = useLanguage();
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const { uri, handleError } = useMediaSource(url);

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
            <Text style={styles.mediaErrorText}>{t('failedImage')}</Text>
          </View>
        ) : (
          <Image
            source={{ uri }}
            style={styles.clueImage}
            resizeMode="cover"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              console.log('[ClueMedia] Image load error for:', url, '→ trying signed URL');
              void handleError().then((recovered) => {
                if (recovered) {
                  setLoading(true);
                } else {
                  setError(true);
                  setLoading(false);
                }
              });
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
            source={{ uri }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </>
  );
}

function ClueVideo({ url }: { url: string }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const { uri, handleError } = useMediaSource(url);

  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = false;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: false });

  // Re-sync the player when the resolved URI changes (public → signed fallback)
  const isFirstUriRef = useRef<boolean>(true);
  useEffect(() => {
    if (isFirstUriRef.current) {
      isFirstUriRef.current = false;
      return;
    }
    if (error) return;
    player.replace({ uri });
  }, [player, uri, error]);

  useEventListener(player, 'statusChange', (event) => {
    if (event.status === 'readyToPlay') {
      setLoading(false);
    } else if (event.status === 'error') {
      console.log('[ClueMedia] Video error:', event.error, '→ trying signed URL');
      void handleError().then((recovered) => {
        if (!recovered) {
          setError(true);
          setLoading(false);
        } else {
          setLoading(true);
        }
      });
    }
  });

  if (error) {
    return (
      <View style={styles.mediaError}>
        <Film color={Colors.dark.textMuted} size={24} />
        <Text style={styles.mediaErrorText}>{t('failedVideo')}</Text>
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
      <VideoView
        player={player}
        style={styles.clueVideo}
        contentFit="contain"
        nativeControls={true}
        fullscreenOptions={{ enable: true }}
      />
      {!loading && !isPlaying && (
        <TouchableOpacity
          style={styles.videoPlayOverlay}
          onPress={() => player.play()}
          activeOpacity={0.8}
        >
          <View style={styles.playButtonCircle}>
            <Play color="#FFF" size={22} fill="#FFF" />
          </View>
        </TouchableOpacity>
      )}
      <View style={styles.mediaLabel}>
        <Film color={Colors.accent.primary} size={12} />
        <Text style={styles.mediaLabelText}>{t('mediaVideo')}</Text>
      </View>
    </View>
  );
}

function ClueAudio({ url }: { url: string }) {
  const { t } = useLanguage();
  const [error, setError] = useState<boolean>(false);
  const { uri, handleError } = useMediaSource(url);

  const source = useMemo<AudioSource | null>(() => (error ? null : { uri }), [uri, error]);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // Re-sync the player when the resolved URI changes (public → signed fallback)
  const prevUriRef = useRef<string>(uri);
  useEffect(() => {
    if (prevUriRef.current === uri) return;
    prevUriRef.current = uri;
    if (error) return;
    player.replace({ uri });
  }, [player, uri, error]);

  // On load/playback errors, retry once with a signed URL before failing
  useEffect(() => {
    if (error || status.playbackState !== 'error') return;
    console.log('[ClueMedia] Audio error → trying signed URL');
    void handleError().then((recovered) => {
      if (!recovered) {
        setError(true);
      }
    });
  }, [status.playbackState, error, handleError]);

  useEffect(() => {
    if (status.didJustFinish) {
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const isPlaying = status.playing;
  const loading = !status.isLoaded && !error;
  const duration = status.duration * 1000;
  const position = status.currentTime * 1000;

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

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
        <Text style={styles.mediaErrorText}>{t('failedAudio')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.audioWrapper}>
      <View style={styles.audioRow}>
        <TouchableOpacity
          style={styles.audioPlayButton}
          onPress={togglePlayback}
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
        <Text style={styles.mediaLabelText}>{t('mediaAudio')}</Text>
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
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
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
