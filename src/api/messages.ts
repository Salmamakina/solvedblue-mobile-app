import { sendBlockMessage } from './account';
import type { CallStatus } from './calls';
import api from './client';
import { MediaError, type MediaKind } from './media';

export interface MessageReaction {
  id: string;
  message_id: string;
  reaction: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  /**
   * 'call' is a phone call placed in the conversation by when it started, from
   * the third branch of the backend's chat union (routes/messages.ts). It
   * carries none of the message fields: no text, no media_url, only the
   * `call_*` ones below.
   */
  type: 'sent' | 'received' | 'call';
  message_text?: string;
  reply_text?: string;
  phone_number: string;
  delivery_method: 'imessage' | 'sms' | 'rcs' | 'call';
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at?: string;
  delivered_at?: string;
  /** When the contact read it. Set by the line's relay, so iMessage only. */
  read_at?: string | null;
  /** A stored picture or recording, sent with or instead of the text. */
  media_url?: string | null;
  media_kind?: MediaKind | null;
  /** Why the message failed or is waiting, in words already safe to show. */
  error_note?: string | null;
  created_at?: string;
  received_at?: string;
  text_effect?: string;
  reactions?: MessageReaction[];
  /** Call items only (type 'call'); `created_at` is when the call started. */
  call_direction?: 'in' | 'out' | null;
  call_status?: CallStatus | null;
  call_duration_s?: number | null;
  /** The call has a recording — a voicemail, or a recorded conversation. */
  call_has_recording?: boolean;
  call_transcript?: string | null;
  call_user_id?: string | null;
}

export interface PaginationInfo {
  limit: number;
  hasMore: boolean;
  before?: string | null;
  since?: string | null;
}

export interface SendMessageRequest {
  phoneNumber: string;
  messageText: string;
  deliveryMethod?: 'imessage' | 'sms' | 'rcs';
  /** The `url` of an already-uploaded picture or recording (see src/api/media.ts). */
  mediaUrl?: string;
  /** 'new_message' is a first message from the Inbox: checked for opt-out, and a first contact waits for quiet hours. */
  source?: 'new_message';
  skipOptOut?: boolean;
}

/** The text of a message, whichever direction it went. */
export function messageText(message: ChatMessage): string {
  return (message.type === 'received' ? message.reply_text : message.message_text) ?? '';
}

/**
 * What to tell the sender when a send fails, ported from `sendFailureText` in
 * spyder-web/src/pages/inbox/Composer.tsx.
 *
 * Every branch says whether trying again is worth it, because the draft is kept
 * either way: an account block will keep failing, a lost connection will not.
 * The `media_*` codes carry the server's own wording, which already names the
 * limit and the accepted types.
 */
export function sendFailureText(error: unknown): string {
  const block = sendBlockMessage(error);
  if (block) return block;

  // A MediaError never reached the network: the file was refused before upload.
  if (error instanceof MediaError) return error.message;

  const response = (
    error as {
      response?: { status?: number; data?: { error?: unknown; code?: unknown } };
    } | null
  )?.response;
  if (!response) return "Can't reach Solvedblue. Check your connection, then try again.";

  const { code, error: message } = response.data ?? {};
  if (code === 'opted_out') return 'This contact opted out, so messages to them are blocked.';
  if (typeof code === 'string' && code.startsWith('media_') && typeof message === 'string') {
    return message;
  }
  if (response.status === 413) return 'That file is too large. The limit is 10 MB.';
  return "Couldn't send your message. It's still here, so try again.";
}

/** When the message happened, for sorting and for the timestamp label. */
export function messageAt(message: ChatMessage): string | undefined {
  return message.received_at ?? message.sent_at ?? message.created_at;
}

export const CHAT_QUERY_KEY = 'chat';

export const messagesApi = {
  getChatMessages: (phoneNumber: string, limit = 50) =>
    api
      .get<{ data: { messages: ChatMessage[]; pagination: PaginationInfo } }>(
        `/messages/chat/${encodeURIComponent(phoneNumber)}`,
        { params: { limit } }
      )
      .then((res) => res.data.data),
  sendMessage: (data: SendMessageRequest) =>
    api
      .post<{ success: boolean; messageId: string; message: string }>('/messages/send', data)
      .then((res) => res.data),
};
