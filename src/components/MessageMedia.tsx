import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { mediaSrc } from '../api/media';
import { useTheme } from '../theme/useTheme';
import { clock } from './useVoiceRecorder';

/** How wide a bubble may be, matching the text bubbles in the thread. */
const MAX_WIDTH = '82%';
const IMAGE_HEIGHT = 200;

/**
 * A picture in a conversation, tappable to fill the screen.
 *
 * expo-image rather than React Native's Image: it caches to disk, so scrolling
 * back through a thread does not re-download every picture, and it decodes HEIC
 * on both platforms, which matters because an iPhone photo sent from the web
 * arrives as HEIC.
 *
 * The file needs no token — GET /api/media/:id is public by its random id
 * (spyder-backend/src/routes/media.ts) — so the URL can be handed straight to
 * the image loader.
 */
export function MessagePicture({ url }: { url: string }) {
  const { colors, radius, space } = useTheme();
  const [full, setFull] = useState(false);
  const source = mediaSrc(url);

  return (
    <>
      <Pressable
        onPress={() => setFull(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Picture, open full screen"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Image
          source={source}
          style={{
            width: 240,
            height: IMAGE_HEIGHT,
            borderRadius: radius.lg,
            backgroundColor: colors.fill,
          }}
          contentFit="cover"
          transition={150}
          accessible={false}
        />
      </Pressable>

      <Modal visible={full} transparent animationType="fade" onRequestClose={() => setFull(false)}>
        {/* The whole backdrop dismisses. A full-screen picture has nothing else
            to do, so a close button would only be a second way to do the same. */}
        <Pressable
          style={styles.lightbox}
          accessibilityRole="button"
          accessibilityLabel="Close picture"
          onPress={() => setFull(false)}
        >
          <Image
            source={source}
            style={styles.lightboxImage}
            contentFit="contain"
            accessibilityLabel="Picture"
          />
          <View style={[styles.lightboxHint, { padding: space.lg }]}>
            <Ionicons name="close" size={28} color="#FFFFFF" accessible={false} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * A voice message, with play and pause and a clock.
 *
 * Deliberately not an <audio> element's worth of controls: on a phone, play,
 * pause and how far through it is are the whole job, and a scrubber at bubble
 * width is too small to hit accurately.
 */
export function MessageVoice({ url, mine }: { url: string; mine: boolean }) {
  const { colors, type, radius, space } = useTheme();
  const player = useAudioPlayer(mediaSrc(url));
  const status = useAudioPlayerStatus(player);

  const foreground = mine ? '#FFFFFF' : colors.label;
  const muted = mine ? 'rgba(255,255,255,0.75)' : colors.label2;
  // `duration` is 0 until the file has loaded; showing the elapsed time while
  // playing and the total when idle is what a messaging app does.
  const seconds = status.playing ? status.currentTime : status.duration;

  function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    // A finished player sits at the end, so playing again would do nothing.
    if (status.duration > 0 && status.currentTime >= status.duration) player.seekTo(0);
    player.play();
  }

  return (
    <View
      style={[
        styles.voice,
        {
          backgroundColor: mine ? colors.blue : colors.bubbleIn,
          borderRadius: radius.xl,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          gap: space.sm,
        },
      ]}
    >
      <Pressable
        onPress={toggle}
        disabled={!status.isLoaded}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}
        accessibilityState={{ disabled: !status.isLoaded, busy: !status.isLoaded }}
        hitSlop={space.sm}
        style={({ pressed }) => ({ opacity: !status.isLoaded ? 0.5 : pressed ? 0.7 : 1 })}
      >
        <Ionicons
          name={status.playing ? 'pause-circle' : 'play-circle'}
          size={32}
          color={foreground}
          accessible={false}
        />
      </Pressable>
      <Ionicons name="mic-outline" size={16} color={muted} accessible={false} />
      <Text style={[type.footnote, { color: muted, fontVariant: ['tabular-nums'] }]}>
        {status.isLoaded ? clock(Math.round(seconds)) : '--:--'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  voice: { flexDirection: 'row', alignItems: 'center', maxWidth: MAX_WIDTH, minHeight: 48 },
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: { width: '100%', height: '80%' },
  lightboxHint: { position: 'absolute', top: 24, right: 8 },
});
