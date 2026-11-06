import api from './client';

export interface MessageReaction {
  id: string;
  message_id: string;
  reaction: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  type: 'sent' | 'received';
  message_text?: string;
  reply_text?: string;
  phone_number: string;
  delivery_method: 'imessage' | 'sms' | 'rcs';
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at?: string;
  delivered_at?: string;
  created_at?: string;
  received_at?: string;
  text_effect?: string;
  reactions?: MessageReaction[];
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
  /** 'new_message' is a first message from the Inbox: checked for opt-out, and a first contact waits for quiet hours. */
  source?: 'new_message';
  skipOptOut?: boolean;
}

/** The text of a message, whichever direction it went. */
export function messageText(message: ChatMessage): string {
  return (message.type === 'received' ? message.reply_text : message.message_text) ?? '';
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
