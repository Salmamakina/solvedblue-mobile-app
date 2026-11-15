import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Plays a remote audio file by downloading it first.
 *
 * Streaming the URL straight into the player is what the app used to do, and it
 * works on Android and fails on iOS. Three reasons, all of them about how
 * AVPlayer loads a remote asset, and none of them fixable in the player:
 *
 *   1. **No extension.** Our files are addressed by id — `/api/media/<uuid>`,
 *      `/api/calls/<uuid>/recording`. AVFoundation leans on the path extension
 *      to pick a parser and gives up when it cannot infer a type, which
 *      expo-audio's own source says in as many words (`resolveSource.ts`:
 *      "iOS AVPlayer fails to load the asset if the type is not set or can't
 *      be inferred"). Android's ExoPlayer sniffs the container instead.
 *   2. **No byte ranges.** AVPlayer opens a remote asset with a `Range`
 *      request and wants `206 Partial Content`. Both of our routes answer
 *      `200` with the whole body: `GET /api/media/:id` sends a buffer
 *      (routes/media.ts) and the recording proxy pipes the provider's stream
 *      (routes/calls.ts).
 *   3. **No headers on a call recording.** `/api/calls/:id/recording` is
 *      behind customer auth, and a URL cannot carry a bearer token.
 *
 * A local file answers all three: the name carries an extension, a file needs
 * no range requests, and the download is a normal request that can carry the
 * token. It is also what the web does, for the same reason — it fetches the
 * recording as a blob and plays an object URL.
 *
 * The file lands in the cache directory, which the system may clear when it
 * needs space. That is the right place for it: it can always be fetched again.
 */
export interface RemoteAudioSource {
  uri: string;
  /** Sent with the download, for a route behind auth. */
  headers?: Record<string, string>;
  /**
   * The cache file name, extension included. The extension is not decoration:
   * see reason 1 above. `.m4a` for a stored voice message (what the recorder
   * and an iPhone both produce), `.mp3` for a call recording (what the proxy
   * asks the provider for).
   */
  name: string;
}

export interface RemoteAudio {
  /** Fetches the file if needed, then plays or pauses. Retries after a failure. */
  toggle: () => void;
  playing: boolean;
  /** Fetching, or fetched and not yet loaded by the player. */
  loading: boolean;
  /** The download or the player failed. Tapping again tries once more. */
  failed: boolean;
  /** Elapsed while playing, the total length otherwise. 0 until known. */
  seconds: number;
  /** The player has the file and can play it. */
  ready: boolean;
}

const CACHE_FOLDER = 'audio';

export function useRemoteAudio(source: RemoteAudioSource | null): RemoteAudio {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);

  const player = useAudioPlayer(localUri);
  const status = useAudioPlayerStatus(player);

  /** Set when the tap that started a download is still waiting to hear sound. */
  const playWhenReady = useRef(false);

  const download = useCallback(async () => {
    if (!source) return;
    setDownloading(true);
    setDownloadFailed(false);
    try {
      const folder = new Directory(Paths.cache, CACHE_FOLDER);
      if (!folder.exists) folder.create({ intermediates: true });

      const file = new File(folder, source.name);
      // Already fetched in an earlier session, or earlier in this one: the id
      // in the name is immutable, so a file that exists is the right file.
      if (!file.exists) {
        await File.downloadFileAsync(source.uri, file, {
          headers: source.headers,
          idempotent: true,
        });
      }
      setLocalUri(file.uri);
    } catch {
      setDownloadFailed(true);
      playWhenReady.current = false;
    } finally {
      setDownloading(false);
    }
  }, [source]);

  // Play once, when the file the tap asked for has loaded. A ref, not state:
  // nothing renders differently for it, and setting state in an effect would
  // cost a second render for a latch only the effect reads.
  useEffect(() => {
    if (playWhenReady.current && status.isLoaded) {
      playWhenReady.current = false;
      player.play();
    }
  }, [player, status.isLoaded]);

  const playerFailed = localUri !== null && status.error !== null && !status.isLoaded;
  const failed = downloadFailed || playerFailed;

  const toggle = useCallback(() => {
    if (!source) return;

    if (failed) {
      // The file on disk may be a half-written download or an unplayable one,
      // so start over rather than retrying the same bytes.
      try {
        new File(new Directory(Paths.cache, CACHE_FOLDER), source.name).delete();
      } catch {
        // Nothing there to remove, which is the state we wanted anyway.
      }
      setLocalUri(null);
      setDownloadFailed(false);
      playWhenReady.current = true;
      void download();
      return;
    }

    if (!localUri) {
      playWhenReady.current = true;
      void download();
      return;
    }

    if (status.playing) {
      player.pause();
      return;
    }
    // A finished player sits at the end, so playing again would do nothing.
    if (status.duration > 0 && status.currentTime >= status.duration) void player.seekTo(0);
    player.play();
  }, [download, failed, localUri, player, source, status.currentTime, status.duration, status.playing]);

  return {
    toggle,
    playing: status.playing,
    loading: downloading || (localUri !== null && !status.isLoaded && !failed),
    failed,
    seconds: status.playing ? status.currentTime : status.duration,
    ready: status.isLoaded,
  };
}
