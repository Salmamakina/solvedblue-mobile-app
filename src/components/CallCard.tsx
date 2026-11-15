import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { callRecordingSource } from '../api/calls';
import type { ChatMessage } from '../api/messages';
import { useTheme } from '../theme/useTheme';
import { useRemoteAudio } from './useRemoteAudio';
import { clock } from './useVoiceRecorder';

/**
 * What the call was, in plain words. Ported from `callLabel` in
 * spyder-web/src/pages/inbox/CallCard.tsx, so a conversation reads the same on
 * both. Customers never see which provider carried the call.
 */
export function callLabel(message: ChatMessage): string {
  const duration =
    message.call_duration_s == null ? '' : ` · ${clock(Math.round(message.call_duration_s))}`;

  if (message.call_direction === 'in') {
    switch (message.call_status) {
      case 'ringing':
        return 'Incoming call…';
      case 'in_progress':
        return 'In call';
      case 'missed':
        return 'Missed call';
      case 'voicemail':
        return 'Voicemail';
      default:
        return `Incoming call${duration}`;
    }
  }

  switch (message.call_status) {
    case 'ringing':
      return 'Calling…';
    case 'in_progress':
      return 'In call';
    case 'no_answer':
      return 'No answer';
    case 'busy':
      return 'Busy';
    case 'canceled':
      return 'Call canceled';
    case 'failed':
      return 'Call failed';
    default:
      return `Outgoing call${duration}`;
  }
}

/**
 * One call in the conversation: what it was, its recording if it has one, and
 * the transcript if the provider returned one.
 *
 * A card rather than a bubble, on the side of whoever placed the call, because
 * a call is not something either party said.
 *
 * The recording is loaded on the first tap and not before. `GET
 * /api/calls/:id/recording` streams the whole file, and a thread can hold a
 * dozen calls; creating a player per card on render would fetch every one of
 * them to show a play button. `useAudioPlayer(null)` builds a player with no
 * source, and passing the real source only once `open` is set is what starts
 * the request.
 */
export function CallCard({ message }: { message: ChatMessage }) {
  const { colors, type, space, radius } = useTheme();

  // Built once per card. The recording is fetched on the first tap and not
  // before: a thread can hold a dozen calls, and `GET /api/calls/:id/recording`
  // streams a whole file, so preparing every card on render would download the
  // lot to draw a row of play buttons.
  //
  // `.mp3` because that is what the proxy asks the provider for and what it
  // answers with (`res.type('audio/mpeg')` in routes/calls.ts), and because on
  // iOS the extension is what tells AVFoundation how to read the file.
  const [source] = useState(() => {
    const authed = callRecordingSource(message.id);
    return authed ? { ...authed, name: `call-${message.id}.mp3` } : null;
  });
  const audio = useRemoteAudio(source);

  const inbound = message.call_direction === 'in';
  const label = callLabel(message);
  const playable = message.call_has_recording === true && source !== null;
  const { failed, loading } = audio;

  return (
    <View style={inbound ? styles.theirs : styles.mine}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bg2,
            borderColor: colors.sep,
            borderRadius: radius.lg,
            padding: space.md,
            gap: space.sm,
          },
        ]}
      >
        <View style={styles.head}>
          <Ionicons
            name={inbound ? 'call-outline' : 'arrow-up-circle-outline'}
            size={16}
            color={colors.label2}
            accessible={false}
          />
          <Text style={[type.footnote, { color: colors.label, fontWeight: '600' }]}>{label}</Text>
        </View>

        {playable ? (
          <Pressable
            onPress={audio.toggle}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={
              message.call_status === 'voicemail' ? 'Play voicemail' : 'Play recording'
            }
            accessibilityState={{ busy: loading, disabled: loading }}
            style={({ pressed }) => [
              styles.play,
              {
                backgroundColor: colors.fill,
                borderRadius: radius.pill,
                paddingHorizontal: space.sm,
                gap: space.sm,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons
              name={
                failed
                  ? 'refresh-circle'
                  : loading
                    ? 'ellipsis-horizontal'
                    : audio.playing
                      ? 'pause-circle'
                      : 'play-circle'
              }
              size={28}
              color={failed ? colors.red : colors.blue}
              accessible={false}
            />
            <Text
              style={[
                type.footnote,
                { color: failed ? colors.red : colors.label2, fontVariant: ['tabular-nums'] },
              ]}
            >
              {failed
                ? "Couldn't load it. Tap to retry"
                : loading
                  ? 'Loading…'
                  : audio.ready
                    ? clock(Math.round(audio.seconds))
                    : message.call_status === 'voicemail'
                      ? 'Play voicemail'
                      : 'Play recording'}
            </Text>
          </Pressable>
        ) : null}

        {message.call_transcript ? (
          <Text style={[type.caption, { color: colors.label2, fontStyle: 'italic' }]}>
            “{message.call_transcript}”
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mine: { alignItems: 'flex-end' },
  theirs: { alignItems: 'flex-start' },
  card: { maxWidth: '82%', borderWidth: StyleSheet.hairlineWidth, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  play: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
});
