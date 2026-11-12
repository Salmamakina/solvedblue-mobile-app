/**
 * Mirrors spyder-web/src/api/account.ts, src/api/billing.ts and
 * src/api/developer.ts: the plan, the API keys and the MCP address.
 */
import api, { apiBaseUrl } from './client';

export type PlanId = 'starter' | 'team' | 'brokerage';
export type PlanFeature = 'team_inbox' | 'ai_tagging' | 'crm_sync' | 'api_access';
export type BillingStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';

export interface PlanCard {
  id: PlanId;
  name: string;
  lines: number;
  seats: number;
  /** null means unlimited. */
  contacts: number | null;
  /** null means the price is quoted, not self-serve. */
  price_usd_month: number | null;
  /** False for plans that have to go through sales. */
  self_serve: boolean;
  features: Record<PlanFeature, boolean>;
}

export interface AccountData {
  organization: { id: string; name: string; plan: PlanId };
  entitlements: Omit<PlanCard, 'id' | 'name'>;
  usage: { lines: number; seats: number; contacts: number };
  billing: {
    status: BillingStatus;
    /** Invoiced directly rather than through Stripe, so there is no portal. */
    exempt: boolean;
    can_send: boolean;
    renews_at: string | null;
    offer: { trial_days: number; setup_fee_usd: number };
  };
  plans: PlanCard[];
  sending: { blocked: { reason: string; message: string } | null };
  settings: {
    quiet_hours_enabled: boolean;
    followup_limit_enabled: boolean;
    time_zone: string;
  };
  api_interest_at: string | null;
  user: {
    id: string;
    email: string;
    role_name: string | null;
    is_platform_admin: boolean;
  };
}

/** Why deleting the account is refused. Each message is written to be shown as it is. */
export type DeletionBlockedCode = 'last_admin' | 'active_subscription' | 'staff_account';

/**
 * What deleting this account would do, read before the confirmation is shown so
 * the dialog can name the consequence and a refusal is an explanation rather
 * than a button that fails.
 */
export interface DeletionPreview {
  /** Nobody else is in the organization, so it is deleted along with the account. */
  deletes_organization: boolean;
  organization: { id: string; name: string } | null;
  other_members: number;
  /** Lines handed back to Solvedblue rather than deleted. */
  lines_released: number;
  cancels_subscription: boolean;
  blocked: { code: DeletionBlockedCode; message: string } | null;
}

/** A key as listed. The secret itself is only ever returned once, on create. */
export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface CreatedApiKey {
  id: string;
  /** The full secret. Shown once and never retrievable again. */
  key: string;
  prefix: string;
  created_at: string;
}

export const ACCOUNT_QUERY_KEY = 'account';
export const API_KEYS_QUERY_KEY = 'api-keys';

/**
 * The hosted MCP server, mirroring MCP_URL in spyder-web/src/config/publicApi.ts.
 * An AI assistant connects here with an API key.
 */
export const MCP_URL = `${apiBaseUrl}/v1/mcp`;

/** The public API root, which is what an API key is used against. */
export const PUBLIC_API_URL = `${apiBaseUrl}/v1`;

/**
 * Enterprise carries 999 lines and 999 seats, which means "no practical limit"
 * rather than a real cap, so the number would mislead. It is matched exactly:
 * a `>=` test would also swallow a genuine large cap.
 *
 * Contacts never use the sentinel. There, null is how unlimited is expressed,
 * and a number like 1,500 is a real limit that has to be shown.
 */
const UNLIMITED_SENTINEL = 999;

/** True where the allowance is effectively unlimited, so no bar is drawn. */
export function isUnlimited(value: number | null): boolean {
  return value === null || value === UNLIMITED_SENTINEL;
}

export function planLimit(value: number | null): string {
  return isUnlimited(value) ? 'Unlimited' : value!.toLocaleString();
}

/**
 * The sending rules, worded from what the backend actually enforces in
 * spyder-backend/src/services/sendingRules.ts: outreach runs 9:00 AM to
 * 7:30 PM in the organization's time zone, and stops after an initial message
 * plus two unanswered follow-ups. Replies and messages you send by hand are
 * never held back.
 */
export const SENDING_RULES: {
  key: 'quiet_hours_enabled' | 'followup_limit_enabled';
  label: string;
  hint: string;
}[] = [
  {
    key: 'quiet_hours_enabled',
    label: 'Quiet hours',
    hint: 'Campaigns only send between 9:00 AM and 7:30 PM. Replies always go out straight away.',
  },
  {
    key: 'followup_limit_enabled',
    label: 'Follow-up limit',
    hint: 'Stop after two follow-ups when someone has not replied.',
  },
];

/** "$349/mo", or "Talk to us" where the price is quoted. */
export function planPrice(plan: Pick<PlanCard, 'price_usd_month'>): string {
  return plan.price_usd_month === null ? 'Talk to us' : `$${plan.price_usd_month}/mo`;
}

export const accountApi = {
  get: () => api.get<AccountData>('/account').then((res) => res.data),

  updateSettings: (patch: {
    quiet_hours_enabled?: boolean;
    followup_limit_enabled?: boolean;
  }) => api.patch<AccountData['settings']>('/account/settings', patch).then((res) => res.data),

  listKeys: () =>
    api.get<{ keys: ApiKeyRow[] }>('/account/api-keys').then((res) => res.data.keys),

  /** Admin only. The response carries the one and only copy of the secret. */
  createKey: (name: string) =>
    api.post<CreatedApiKey>('/account/api-keys', { name }).then((res) => res.data),

  /** Admin only. */
  revokeKey: (id: string) => api.delete(`/account/api-keys/${id}`).then(() => undefined),

  /** What deleting this account would do, and whether a rule refuses it. */
  deletionPreview: () =>
    api.get<DeletionPreview>('/account/deletion').then((res) => res.data),

  /**
   * Deletes the signed-in user's own account. Irreversible. A 409 carries one of
   * the DeletionBlockedCode reasons and a message meant for the customer.
   */
  deleteAccount: () =>
    api.delete<DeletionPreview & { deleted: true }>('/account').then((res) => res.data),

  /** Registers this handset for push notifications. Replaces whatever token it had. */
  registerPushToken: (body: { token: string; platform?: 'ios' | 'android'; device_name?: string }) =>
    api.post('/account/push-tokens', body).then(() => undefined),

  /** Drops this handset's token, on sign-out. */
  removePushToken: (token: string) =>
    api.delete('/account/push-tokens', { data: { token } }).then(() => undefined),
};

export const DELETION_QUERY_KEY = 'account-deletion';

export const billingApi = {
  /**
   * Starts Stripe Checkout and returns where to send the customer. Only the
   * self-serve plans can be bought this way.
   */
  checkout: (plan: PlanId) =>
    api.post<{ url: string }>('/billing/checkout', { plan }).then((res) => res.data.url),

  /** Opens the Stripe billing portal for an existing subscription. */
  portal: () => api.post<{ url: string }>('/billing/portal').then((res) => res.data.url),
};
