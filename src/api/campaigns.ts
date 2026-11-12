import api from './client';

export interface Campaign {
  id: string;
  user_id: string;
  workflow_id?: string;
  workflow_name?: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'scheduled';
  created_at: string;
  last_modified?: string;
  started_at?: string;
  scheduled_start_at?: string;
  estimated_end_date?: string;
  property_id?: string;
}

export interface Metrics {
  reply_rate: number;
  close_rate: number;
  imessage_reply_rate: number;
  sms_reply_rate: number;
  rcs_reply_rate: number;
  total_sent: number;
  total_replies: number;
  total_failed: number;
  pending_messages: number;
  pending_recipients: number;
  imessage_sent: number;
  sms_sent: number;
  rcs_sent: number;
  imessage_replies: number;
  sms_replies: number;
  rcs_replies: number;
}

export interface CampaignRecipient {
  id?: string;
  phone_number?: string | null;
  email?: string | null;
  name?: string | null;
  status?: string;
  message_status?: string | null;
  sent_at?: string | null;
  delivery_method?: string | null;
  device_id?: string | null;
  device_name?: string | null;
  error_message?: string | null;
}

/**
 * What a new campaign needs. `workflow_id` is what makes the campaign send the
 * workflow's sequence; without one the backend falls back to a single
 * `message_text`, which is not how this app creates campaigns.
 */
export interface CampaignInput {
  name: string;
  workflow_id: string;
  recipients: { phone_number?: string | null; email?: string | null; name?: string | null }[];
  /** ISO timestamp. Omit to leave the campaign as a draft to start by hand. */
  scheduled_start_at?: string;
}

export const CAMPAIGNS_QUERY_KEY = 'campaigns';

/** Statuses the server lets you edit; 'active' has to be ended first. */
export const EDITABLE_STATUSES = ['draft', 'scheduled'] as const;

export const campaignsApi = {
  getAll: () => api.get<{ campaigns: Campaign[] }>('/campaigns').then((res) => res.data.campaigns),
  create: (input: CampaignInput) =>
    api.post<{ campaign: Campaign }>('/campaigns', input).then((res) => res.data.campaign),
  remove: (id: string) => api.delete(`/campaigns/${id}`).then(() => undefined),
  get: (id: string) =>
    api
      .get<{ campaign: Campaign; recipients: CampaignRecipient[] }>(`/campaigns/${id}`)
      .then((res) => res.data),
  getMetrics: (id: string) =>
    api.get<{ metrics: Metrics }>(`/campaigns/${id}/metrics`).then((res) => res.data.metrics),
  start: (id: string) => api.post(`/campaigns/${id}/start`).then(() => undefined),
  end: (id: string) =>
    api.post<{ success: boolean; message: string }>(`/campaigns/${id}/end`).then((res) => res.data),
};
