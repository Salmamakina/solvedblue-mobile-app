import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

/**
 * The web caps a recording at two minutes
 * (MAX_RECORDING_SECONDS in spyder-web/src/pages/inbox/useAudioRecorder.ts).
 * Same cap here, so a voice message is the same thing on both.
 */
export const MAX_RECORDING_SECONDS = 120;

/**
 * What the recorder produces. `audio/mp4` is in the backend's accepted set
 * (KINDS in spyder-backend/src/services/media.ts) and an iPhone plays it, which
 * is why the web records MP4 too rather than the WebM other browsers prefer.
 */
export const RECORDING_MIME = 'audio/mp4';

export interface VoiceRecorder {
  recording: boolean;
  /** Whole seconds elapsed, for the timer beside the stop button. */
  seconds: number;
  start: () => void;
  /** Stops and hands the file to `onRecorded`. */
  stop: () => void;
  /** Stops and throws the file away. */
  cancel: () => void;
}

/**
 * Records one voice message, mirroring the web's useAudioRecorder.
 *
 * Built on expo-audio, which replaced expo-av: `useAudioRecorder` with a
 * preset, then prepare, record, stop, and the file lands on `recorder.uri`.
 *
 * Two things this has to get right, both of which the web hook also handles:
 *
 * - The microphone must be released when the screen goes away mid-recording.
 *   Leaving a conversation while recording would otherwise leave the mic live,
 *   which on iOS shows the orange dot and on Android holds the input.
 * - Cancel and stop both end the recording, so "keep this file" cannot be read
 *   off the recorder's own state. A ref decides it, set before stopping.
 */
export function useVoiceRecorder(
  onRecorded: (file: { uri: string; mimeType: string }) => void,
  onError: (message: string) => void
): VoiceRecorder {
  // m4a, and into the documents directory rather than the cache: the OS may
  // clear the cache under storage pressure, and this file has to survive until
  // the upload finishes.
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const state = useAudioRecorderState(recorder);
  const keep = useRef(true);
  // The unmount cleanup must not close over one render's `recorder`, or it
  // could stop a stale instance and leave the live one holding the microphone.
  // Kept current in an effect rather than during render, which React forbids.
  const live = useRef(recorder);
  useEffect(() => {
    live.current = recorder;
  }, [recorder]);

  const start = useCallback(async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        onError('Allow microphone access in Settings to record a voice message.');
        return;
      }
      // Required before recording, and playsInSilentMode so playing a received
      // voice message is not silent with the ringer switch off.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      keep.current = true;
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      onError("Couldn't start recording. Check the microphone.");
    }
  }, [onError, recorder]);

  const stop = useCallback(async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (keep.current && uri) onRecorded({ uri, mimeType: RECORDING_MIME });
    } catch {
      onError("Couldn't finish the recording.");
    }
  }, [onError, onRecorded, recorder]);

  const cancel = useCallback(() => {
    keep.current = false;
    void stop();
  }, [stop]);

  // The two-minute cap. Checked off the recorder's own clock rather than a
  // timer of our own, so a stall in the recording cannot overrun it.
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= MAX_RECORDING_SECONDS * 1000) {
      void stop();
    }
  }, [state.isRecording, state.durationMillis, stop]);

  // Leaving the conversation mid-recording must not leave the microphone on.
  useEffect(
    () => () => {
      keep.current = false;
      void live.current.stop().catch(() => undefined);
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    },
    []
  );

  return {
    recording: state.isRecording,
    seconds: Math.floor(state.durationMillis / 1000),
    start: () => void start(),
    stop: () => void stop(),
    cancel,
  };
}

/** "1:05" from a count of seconds, as the web's `clock` does. */
export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
