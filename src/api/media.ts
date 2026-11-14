/**
 * Pictures and voice messages, mirroring spyder-web/src/api/media.ts.
 *
 * The contract is the backend's `POST /api/media`: the raw bytes of one file as
 * the body, its type in `Content-Type`, answering `{ id, url, kind }`. `url` is
 * the absolute path `/api/media/<uuid>`, and `GET` on it is public by that
 * random id alone (spyder-backend/src/services/media.ts) because an <img> tag
 * and the relay cannot send a sign-in token. So a stored file needs no auth to
 * display, which is what makes `mediaSrc` enough for <Image> and the player.
 *
 * Where this departs from the web: the web hands axios a `Blob` straight from
 * a file input or a MediaRecorder. React Native has neither. The pickers and
 * the recorder give back a `file://` URI instead, so the bytes are read off
 * disk first and posted as an ArrayBuffer, which axios passes through its
 * default transform untouched.
 */
import { File } from 'expo-file-system';
import api, { apiOrigin } from './client';

/** The server's cap for one upload. Over this it answers 413 `media_too_large`. */
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

/** A picture the server stores, matching KINDS in spyder-backend/src/services/media.ts. */
export const PICTURE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
] as const;

/**
 * A recording the server stores. `audio/mp4` is what an iPhone records and what
 * both platforms play, so it is the one the recorder asks for.
 */
export const AUDIO_TYPES = ['audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg'] as const;

export type MediaKind = 'image' | 'audio';

export interface UploadedMedia {
  id: string;
  /** The absolute path to store on the message as `mediaUrl`. */
  url: string;
  kind: MediaKind;
}

/** An upload is one request carrying a whole file, so it gets more room than JSON. */
const UPLOAD_TIMEOUT_MS = 60_000;

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
};

/** The accepted type of a content type, ignoring parameters such as `;codecs=mp4a`. */
export function mediaKindOf(contentType: string | null | undefined): MediaKind | null {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if ((PICTURE_TYPES as readonly string[]).includes(type)) return 'image';
  if ((AUDIO_TYPES as readonly string[]).includes(type)) return 'audio';
  return null;
}

/**
 * The content type to send for a picked or recorded file.
 *
 * The picker usually reports one, but not always, and the server decides what a
 * file is purely from this header, so a missing one has to be worked out from
 * the extension rather than left off.
 */
export function contentTypeOf(uri: string, reported?: string | null): string | null {
  const fromReport = (reported ?? '').split(';')[0].trim().toLowerCase();
  if (mediaKindOf(fromReport)) return fromReport;
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[extension] ?? null;
}

export interface LocalFile {
  /** A `file://` URI from a picker or the recorder. */
  uri: string;
  /** What the picker called it, when it said. */
  mimeType?: string | null;
}

/** A file too large to upload, or of a type the server will not store. */
export class MediaError extends Error {
  readonly code: 'media_too_large' | 'media_type' | 'media_empty';
  constructor(code: MediaError['code'], message: string) {
    super(message);
    this.name = 'MediaError';
    this.code = code;
  }
}

export const mediaApi = {
  /**
   * Stores one picture or recording and returns where it lives. Send `url` as
   * the message's `mediaUrl`.
   *
   * Size and type are checked here as well as on the server. Not to trust the
   * client, but so a file that was never going to be accepted fails straight
   * away with wording about that file, instead of after a 10 MB upload.
   */
  upload: async (file: LocalFile): Promise<UploadedMedia> => {
    const contentType = contentTypeOf(file.uri, file.mimeType);
    if (!contentType) {
      throw new MediaError(
        'media_type',
        'Send a JPEG, PNG, GIF, WebP or HEIC picture, or an M4A or MP3 recording.'
      );
    }

    const bytes = await new File(file.uri).arrayBuffer();
    if (bytes.byteLength === 0) {
      throw new MediaError('media_empty', 'That file is empty.');
    }
    if (bytes.byteLength > MAX_MEDIA_BYTES) {
      throw new MediaError('media_too_large', 'That file is too large. The limit is 10 MB.');
    }

    const { data } = await api.post<UploadedMedia>('/media', bytes, {
      headers: { 'Content-Type': contentType },
      timeout: UPLOAD_TIMEOUT_MS,
    });
    return data;
  },
};

/**
 * The full address of a stored file, for <Image> or the audio player.
 *
 * The server returns a path, which a browser resolves against the page it is
 * already on. A phone has no such origin, so the path has to be joined to the
 * API's own. An absolute URL is passed through, in case the server ever starts
 * returning one.
 */
export function mediaSrc(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
}
