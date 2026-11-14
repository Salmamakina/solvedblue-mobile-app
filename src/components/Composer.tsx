import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { contentTypeOf, MAX_MEDIA_BYTES, type LocalFile, type MediaKind } from '../api/media';
import { useTheme } from '../theme/useTheme';
import { emojiSafe } from '../theme/tokens';
import { clock, useVoiceRecorder } from './useVoiceRecorder';

/**
 * The emoji the web's composer offers, in the web's order
 * (EMOJIS in spyder-web/src/pages/inbox/Composer.tsx).
 *
 * Lower value on a phone than in a browser, because the system keyboard already
 * has an emoji key. It is here so the two apps offer the same set, and because
 * the keyboard's emoji panel costs a mode switch mid-sentence.
 */
const EMOJIS = [
  '😀', '😂', '😊', '😍', '😘', '😎', '🤔', '😅',
  '😢', '😮', '🙏', '👍', '👎', '👏', '🙌', '💪',
  '👋', '🤝', '❤️', '🔥', '🎉', '✅', '❗', '💯',
  '🏠', '🔑', '📅', '📞', '💬', '📍', '💰', '🚗',
];

export interface Attachment extends LocalFile {
  kind: MediaKind;
}

interface ComposerProps {
  value: string;
  onChangeText: (value: string) => void;
  attachment: Attachment | null;
  onAttach: (attachment: Attachment | null) => void;
  onSend: () => void;
  sending: boolean;
  /**
   * SMS carries text only, so pictures and recordings are offered only on an
   * iMessage conversation — the same rule as the web's `canAttach`.
   */
  viaText: boolean;
  /** Blocks the whole composer and says why. */
  optedOut: boolean;
  placeholder?: string;
  accessibilityLabel: string;
}

/**
 * The message composer: text, an emoji panel, a picture and a voice message.
 *
 * Ported from spyder-web/src/pages/inbox/Composer.tsx, including which controls
 * appear when. The microphone replaces nothing — on the web it is hidden once
 * there is something to send, and the same rule applies here, so the row never
 * holds both a record button and a send button competing for the same tap.
 */
export function Composer({
  value,
  onChangeText,
  attachment,
  onAttach,
  onSend,
  sending,
  viaText,
  optedOut,
  placeholder,
  accessibilityLabel,
}: ComposerProps) {
  const { colors, type, space, radius } = useTheme();
  const [emojisOpen, setEmojisOpen] = useState(false);

  const onRecorded = useCallback(
    (file: { uri: string; mimeType: string }) => onAttach({ ...file, kind: 'audio' }),
    [onAttach]
  );
  const onRecorderError = useCallback(
    (message: string) => Alert.alert('Voice message', message),
    []
  );
  const recorder = useVoiceRecorder(onRecorded, onRecorderError);

  const ready = value.trim().length > 0 || attachment !== null;
  const canSend = ready && !sending && !optedOut && !recorder.recording;
  // Attachments are an iMessage feature; an opted-out contact gets nothing.
  const canAttach = !viaText && !optedOut;

  async function pickPicture(fromCamera: boolean) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        fromCamera
          ? 'Allow camera access in Settings to take a picture.'
          : 'Allow photo access in Settings to send a picture.'
      );
      return;
    }

    // mediaTypes takes an array of strings now; the old MediaTypeOptions enum
    // is gone. Images only: the backend stores pictures and audio, not video.
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;

    // Checked before upload so a file that was never going to be accepted
    // fails now, with wording about that file, rather than after a long upload.
    if (!contentTypeOf(asset.uri, asset.mimeType)) {
      Alert.alert('Picture', 'Choose a JPEG, PNG, GIF, WebP or HEIC picture.');
      return;
    }
    if (asset.fileSize !== undefined && asset.fileSize > MAX_MEDIA_BYTES) {
      Alert.alert('Picture', 'That picture is too large. The limit is 10 MB.');
      return;
    }

    onAttach({ uri: asset.uri, mimeType: asset.mimeType ?? null, kind: 'image' });
  }

  function addEmoji(emoji: string) {
    // Appended rather than inserted at the cursor: React Native gives no
    // reliable selection offset for a controlled multiline TextInput across
    // both platforms, and a misplaced insert is worse than one at the end.
    onChangeText(value + emoji);
    setEmojisOpen(false);
  }

  const toolColor = optedOut ? colors.label2 : colors.blue;

  return (
    <View style={{ backgroundColor: colors.bg2, borderTopColor: colors.sep, borderTopWidth: StyleSheet.hairlineWidth }}>
      {/* What is about to be sent, with a way to drop it, before it goes. */}
      {attachment ? (
        <View
          style={[
            styles.attachment,
            { borderBottomColor: colors.sep, padding: space.md, gap: space.md },
          ]}
        >
          {attachment.kind === 'image' ? (
            <Image
              source={attachment.uri}
              style={[styles.preview, { borderRadius: radius.md, backgroundColor: colors.fill }]}
              contentFit="cover"
              accessibilityLabel="Picture to send"
            />
          ) : (
            <View style={[styles.voiceChip, { backgroundColor: colors.fill, borderRadius: radius.md, paddingHorizontal: space.md }]}>
              <Ionicons name="mic" size={18} color={colors.label2} accessible={false} />
              <Text style={[type.footnote, { color: colors.label }]}>Voice message ready</Text>
            </View>
          )}
          <Pressable
            onPress={() => onAttach(null)}
            accessibilityRole="button"
            accessibilityLabel="Remove attachment"
            hitSlop={space.sm}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginLeft: 'auto' })}
          >
            <Ionicons name="close-circle" size={24} color={colors.label2} />
          </Pressable>
        </View>
      ) : null}

      {emojisOpen ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="menu"
          accessibilityLabel="Emojis"
          style={{ borderBottomColor: colors.sep, borderBottomWidth: StyleSheet.hairlineWidth }}
          contentContainerStyle={{ paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs }}
        >
          {EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => addEmoji(emoji)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${emoji}`}
              style={({ pressed }) => [styles.emoji, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Text style={styles.emojiGlyph}>{emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {recorder.recording ? (
        // Recording takes over the row: there is nothing else to do until it
        // stops, and leaving the field live would invite typing into a draft
        // that the recording is about to be attached to anyway.
        <View style={[styles.row, { padding: space.md, gap: space.md }]} accessibilityRole="progressbar" accessibilityLabel="Recording">
          <View style={[styles.recDot, { backgroundColor: colors.red }]} accessible={false} />
          <Text style={[type.body, { color: colors.label, fontVariant: ['tabular-nums'] }]}>
            {clock(recorder.seconds)}
          </Text>
          <Pressable
            onPress={recorder.cancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel recording"
            style={({ pressed }) => [styles.recAction, { opacity: pressed ? 0.6 : 1, marginLeft: 'auto' }]}
          >
            <Text style={[type.headline, { color: colors.label2 }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={recorder.stop}
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
            style={({ pressed }) => [
              styles.recAction,
              {
                backgroundColor: colors.blue,
                borderRadius: radius.pill,
                paddingHorizontal: space.lg,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[type.headline, { color: '#FFFFFF' }]}>Stop</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.row, { padding: space.md, gap: space.sm }]}>
          {canAttach ? (
            <Pressable
              onPress={() => void pickPicture(false)}
              onLongPress={() => void pickPicture(true)}
              accessibilityRole="button"
              accessibilityLabel="Add a picture"
              accessibilityHint="Long press to take one with the camera"
              hitSlop={space.sm}
              style={({ pressed }) => [styles.tool, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="image-outline" size={24} color={toolColor} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setEmojisOpen(!emojisOpen)}
            disabled={optedOut}
            accessibilityRole="button"
            accessibilityLabel="Add an emoji"
            accessibilityState={{ expanded: emojisOpen, disabled: optedOut }}
            hitSlop={space.sm}
            style={({ pressed }) => [styles.tool, { opacity: optedOut ? 0.4 : pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="happy-outline" size={24} color={toolColor} />
          </Pressable>

          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={optedOut ? 'Opted out' : placeholder ?? (viaText ? 'Text message' : 'iMessage')}
            placeholderTextColor={colors.label2}
            editable={!optedOut}
            multiline
            accessibilityLabel={accessibilityLabel}
            // emojiSafe: this holds an emoji the moment the panel is used, and
            // the ramp's body line height crops one on Android.
            style={[
              emojiSafe(type.body),
              {
                flex: 1,
                backgroundColor: colors.fill2,
                borderRadius: radius.xl,
                color: colors.label,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                maxHeight: 120,
                minHeight: 40,
              },
            ]}
          />

          {/* The microphone gives way to Send as soon as there is something to
              send, so the two never sit side by side. */}
          {canAttach && !ready ? (
            <Pressable
              onPress={recorder.start}
              accessibilityRole="button"
              accessibilityLabel="Record a voice message"
              hitSlop={space.sm}
              style={({ pressed }) => [styles.tool, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="mic-outline" size={24} color={toolColor} />
            </Pressable>
          ) : (
            <Pressable
              onPress={onSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !canSend, busy: sending }}
              style={({ pressed }) => [
                styles.send,
                {
                  backgroundColor: colors.blue,
                  borderRadius: radius.pill,
                  opacity: !canSend ? 0.4 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" accessible={false} />
            </Pressable>
          )}
        </View>
      )}

      {optedOut ? (
        <Text
          style={[
            type.caption,
            { color: colors.label2, paddingHorizontal: space.md, paddingBottom: space.sm },
          ]}
        >
          This contact opted out, so messages to them are blocked.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  tool: { minWidth: 36, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  send: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  preview: { width: 56, height: 56 },
  voiceChip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  emoji: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  // Line height well clear of the glyph: an emoji at this size is the whole
  // content of the button, so clipping it would leave an empty square.
  emojiGlyph: { fontSize: 26, lineHeight: 34 },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  recAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
