import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  ACCOUNT_QUERY_KEY,
  accountApi,
  billingApi,
  DELETION_QUERY_KEY,
  isUnlimited,
  MCP_URL,
  planLimit,
  planPrice,
  PUBLIC_API_URL,
  SENDING_RULES,
  type AccountData,
  type PlanCard,
} from '../../src/api/account';
import { apiErrorMessage } from '../../src/api/client';
import {
  INVITES_QUERY_KEY,
  MEMBERS_QUERY_KEY,
  MEMBER_ROLES,
  organizationsApi,
  PREVIEW_COUNT,
  roleLabel,
  type MemberRole,
} from '../../src/api/organizations';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ContactSalesButton } from '../../src/components/ContactSalesButton';
import { Field } from '../../src/components/Field';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { ErrorState, LoadingState } from '../../src/components/StateView';
import { unregisterPushNotifications } from '../../src/notifications/push';
import { useAuthStore } from '../../src/stores/authStore';
import { THEME_OPTIONS, useThemeStore } from '../../src/stores/themeStore';
import { useTheme } from '../../src/theme/useTheme';
import { relativeTime } from '../../src/utils/format';

/**
 * Account: pricing, the organization's people, sending rules, API keys, MCP
 * and appearance. The same ground the web's Account and Integrations pages
 * cover.
 *
 * Buying a plan goes through Stripe Checkout, which has to happen in a browser,
 * so those buttons open one the way Contact sales does.
 */
export default function AccountScreen() {
  const { colors, type, space, radius } = useTheme();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const queryClient = useQueryClient();

  const account = useQuery({ queryKey: [ACCOUNT_QUERY_KEY], queryFn: accountApi.get });

  const openStripe = useMutation({
    mutationFn: (plan: PlanCard | null) =>
      plan ? billingApi.checkout(plan.id) : billingApi.portal(),
    onSuccess: (url) => void WebBrowser.openBrowserAsync(url),
    onError: (err) => Alert.alert('Billing', apiErrorMessage(err, 'Could not open Stripe')),
  });

  async function signOut() {
    // Before the session goes: the request that retires this handset's push
    // token needs the token it is about to throw away. Otherwise the next
    // person to use the phone would keep getting this organization's replies.
    await unregisterPushNotifications();
    await clearAuth();
    // Drop every cached response so the next account cannot see this one's data.
    queryClient.clear();
  }

  if (account.isLoading) {
    return (
      <Screen>
        <AppHeader />
        <LoadingState label="Loading your account" />
      </Screen>
    );
  }
  if (account.error || !account.data) {
    return (
      <Screen>
        <AppHeader />
        <ErrorState
          message={apiErrorMessage(account.error, 'Could not load your account')}
          onRetry={() => void account.refetch()}
        />
      </Screen>
    );
  }

  const { organization, entitlements, usage, billing, plans, user: me } = account.data;
  const current = plans.find((plan) => plan.id === organization.plan);
  const isAdmin = me.is_platform_admin || me.role_name === 'admin' || me.role_name === 'owner';

  return (
    <Screen>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Card title="Signed in as">
          <Text style={[type.headline, { color: colors.label }]}>{me.email}</Text>
          {/* The organization's name used to sit here. It is already the
              heading of the Organization section below, so repeating it at the
              top of the screen said nothing new. */}
          {me.role_name ? (
            <Text style={[type.caption, { color: colors.label2, marginTop: space.xs }]}>
              {me.role_name}
            </Text>
          ) : null}
        </Card>

        {/* Sending being blocked is the most consequential thing on this screen,
            so it sits above the plan rather than inside it. */}
        {account.data.sending.blocked ? (
          <Card style={{ backgroundColor: colors.orangeTint, borderColor: colors.orange }}>
            <Text style={[type.headline, { color: colors.orange }]}>Sending is paused</Text>
            <Text style={[type.footnote, { color: colors.label, marginTop: space.xs }]}>
              {account.data.sending.blocked.message}
            </Text>
          </Card>
        ) : null}

        {/* Pricing: the plan you are on, then the rest. One section rather than
            two cards, so what you pay and what the alternatives cost read as
            one comparison. Each plan is its own bordered tile. */}
        <Section title="Pricing">
          <View style={{ gap: space.md }}>
            <PlanTile
              name={current?.name ?? organization.plan}
              price={current ? planPrice(current) : '—'}
              quoted={current?.price_usd_month === null}
              current
            >
              {billing.renews_at ? (
                <Text style={[type.caption, { color: colors.label2 }]}>
                  Renews {relativeTime(billing.renews_at)}
                </Text>
              ) : null}

              <Usage label="Lines" used={usage.lines} limit={entitlements.lines} />
              <Usage label="Seats" used={usage.seats} limit={entitlements.seats} />
              <Usage label="Contacts" used={usage.contacts} limit={entitlements.contacts} />

              {billing.exempt ? (
                <Text style={[type.caption, { color: colors.label2 }]}>
                  Billed by invoice, so there is nothing to manage here.
                </Text>
              ) : billing.status === 'none' ? (
                <Text style={[type.caption, { color: colors.label2 }]}>
                  {billing.offer.trial_days}-day trial, then{' '}
                  {current ? planPrice(current) : ''}
                  {billing.offer.setup_fee_usd > 0
                  ? ` plus a $${billing.offer.setup_fee_usd} one-time setup fee`
                  : ''}
                  .
                </Text>
              ) : (
                <Button
                  label="Manage billing"
                  variant="secondary"
                  onPress={() => openStripe.mutate(null)}
                  loading={openStripe.isPending}
                />
              )}
            </PlanTile>

            {plans
              .filter((plan) => plan.id !== organization.plan)
              .map((plan) => (
                <PlanTile
                  key={plan.id}
                  name={plan.name}
                  price={planPrice(plan)}
                  quoted={plan.price_usd_month === null}
                >
                  <Text style={[type.caption, { color: colors.label2 }]}>
                    {planLimit(plan.lines)} {plan.lines === 1 ? 'line' : 'lines'} ·{' '}
                    {planLimit(plan.seats)} {plan.seats === 1 ? 'seat' : 'seats'} ·{' '}
                    {planLimit(plan.contacts)} contacts
                  </Text>
                  {/* A plan that is not self-serve has no Stripe price, so the
                      only way onto it is a conversation. For those the price
                      slot in the header is the Talk to us button, so there is
                      nothing left to say here. */}
                  {plan.self_serve && !billing.exempt ? (
                    <Pressable
                      onPress={() => openStripe.mutate(plan)}
                      accessibilityRole="button"
                      accessibilityLabel={`Switch to ${plan.name}`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minHeight: 32 })}
                    >
                      <Text style={[type.footnote, { color: colors.blue, fontWeight: '600' }]}>
                        Switch to {plan.name}
                      </Text>
                    </Pressable>
                  ) : null}
                </PlanTile>
              ))}
          </View>
        </Section>

        {/* Everything that belongs to the organization rather than to you: its
            people, the invites it has out, and the rules its sending follows.
            One heading above the lot, so each card inside can keep its own
            smaller heading without competing. */}
        <Section title="Organization">
          <View style={{ gap: space.lg }}>
            <Organization orgId={organization.id} isAdmin={isAdmin} meId={me.id} />
            <SendingRules settings={account.data.settings} canEdit={isAdmin} />
          </View>
        </Section>

        <ApiKeys canManage={isAdmin} hasAccess={entitlements.features.api_access} />

        <Card title="MCP">
          <View style={{ gap: space.sm }}>
            <Text style={[type.footnote, { color: colors.label2 }]}>
              Connect an AI assistant to your workspace. Give it this address and an API key.
            </Text>
            <Copyable label="MCP server" value={MCP_URL} />
            <Copyable label="API base" value={PUBLIC_API_URL} />
          </View>
        </Card>

        {/* A Lines card used to sit here, listing the fleet phones. Only a
            platform admin can act on those, so for everyone else it was a
            read-only block of numbers in the middle of their own settings. */}
        <Card title="Preferences">
          <Text style={[type.footnote, { color: colors.label2, marginBottom: space.sm }]}>
            Appearance
          </Text>
          <View
            style={[
              styles.segment,
              { backgroundColor: colors.fill, borderRadius: radius.md, padding: 3 },
            ]}
          >
            {THEME_OPTIONS.map(({ key, label }) => {
              const active = key === preference;
              return (
                <Pressable
                  key={key}
                  onPress={() => void setPreference(key)}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.segmentItem,
                    {
                      backgroundColor: active ? colors.bg2 : 'transparent',
                      borderRadius: radius.sm,
                      opacity: pressed && !active ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      type.footnote,
                      {
                        color: active ? colors.label : colors.label2,
                        fontWeight: active ? '600' : '400',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[type.caption, { color: colors.label2, marginTop: space.sm }]}>
            {preference === 'system'
              ? 'Following your device appearance.'
              : `Always ${preference}.`}
          </Text>
        </Card>

        <Button label="Sign out" variant="secondary" onPress={signOut} />

        {/* Last on the screen, and the only thing below Sign out, so the
            destructive action is nowhere near anything routine. */}
        <DeleteAccount onDeleted={signOut} onManageBilling={() => openStripe.mutate(null)} />
      </ScrollView>
    </Screen>
  );
}

/**
 * A heading that sits outside its cards, the way the web groups a page into
 * named sections. Lets several cards read as one subject instead of each
 * repeating the subject in its own title.
 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors, type, space } = useTheme();

  return (
    <View style={{ gap: space.md }}>
      <Text
        accessibilityRole="header"
        style={[type.section, { color: colors.label, paddingHorizontal: space.xs }]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * One plan: its name and price on a line together, then whatever that plan has
 * to say underneath. The name is as heavy as the price because they are a pair,
 * and the price is set to the right so the column of prices can be scanned
 * without reading the names.
 *
 * A quoted plan has no number, so its price slot is the button that books a
 * call. That used to be the words "Talk to us" with a sentence below pointing
 * at a button elsewhere on the screen.
 */
function PlanTile({
  name,
  price,
  quoted,
  current = false,
  children,
}: {
  name: string;
  price: string;
  quoted: boolean;
  current?: boolean;
  children?: ReactNode;
}) {
  const { colors, type, space, radius } = useTheme();

  return (
    <View
      style={[
        styles.planTile,
        {
          backgroundColor: colors.bg2,
          // The plan you are on is outlined in blue, so which one is yours is
          // clear without a badge taking a line.
          borderColor: current ? colors.blue : colors.sep,
          borderWidth: current ? 1 : StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
          padding: space.lg,
          gap: space.md,
        },
      ]}
    >
      <View style={styles.planHead}>
        <Text style={[type.headline, { color: colors.label, flex: 1 }]}>{name}</Text>
        {quoted ? (
          <ContactSalesButton label="Talk to us" />
        ) : (
          <Text style={[type.title, { color: colors.label }]}>{price}</Text>
        )}
      </View>
      {children}
    </View>
  );
}

/**
 * The organization's people: a few members and any pending invites, each with a
 * way through to the full list. Inviting is admin-only on the server.
 */
function Organization({
  orgId,
  isAdmin,
  meId,
}: {
  orgId: string;
  isAdmin: boolean;
  meId: string;
}) {
  const { colors, type, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('member');

  const members = useQuery({
    queryKey: [MEMBERS_QUERY_KEY, orgId],
    queryFn: () => organizationsApi.members(orgId),
  });

  const invites = useQuery({
    queryKey: [INVITES_QUERY_KEY, orgId],
    queryFn: () => organizationsApi.invites(orgId),
  });

  const invite = useMutation({
    mutationFn: () => organizationsApi.invite(orgId, email.trim(), role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INVITES_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [MEMBERS_QUERY_KEY] });
      setInviting(false);
      setEmail('');
      setRole('member');
    },
    onError: (err) =>
      Alert.alert('Invite', apiErrorMessage(err, 'Could not send that invite')),
  });

  const memberList = members.data ?? [];
  const inviteList = invites.data ?? [];

  return (
    <>
      <Card>
        <View style={{ gap: space.md }}>
          <View style={styles.sectionHead}>
            <Text style={[type.headline, { color: colors.label }]}>
              Members{memberList.length > 0 ? ` · ${memberList.length}` : ''}
            </Text>
            {/* Only worth a second screen once the preview is hiding something. */}
            {memberList.length > PREVIEW_COUNT ? (
              <Pressable
                onPress={() => router.push('/organization/members')}
                accessibilityRole="button"
                accessibilityLabel="See all members"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={[type.footnote, { color: colors.blue, fontWeight: '600' }]}>
                  See all
                </Text>
              </Pressable>
            ) : null}
          </View>

          {members.isLoading ? (
            <Text style={[type.footnote, { color: colors.label2 }]}>Loading…</Text>
          ) : members.error ? (
            <Text style={[type.footnote, { color: colors.red }]}>
              {apiErrorMessage(members.error, 'Could not load members')}
            </Text>
          ) : (
            memberList.slice(0, PREVIEW_COUNT).map((member) => (
              <View key={member.id} style={styles.between}>
                <Text style={[type.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                  {member.email}
                  {member.id === meId ? ' (you)' : ''}
                </Text>
                <Badge label={roleLabel(member)} />
              </View>
            ))
          )}

          {isAdmin ? (
            inviting ? (
              <View style={{ gap: space.sm }}>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="teammate@example.com"
                  autoFocus
                />
                <Text style={[type.footnote, { color: colors.label2, fontWeight: '600' }]}>
                  Role
                </Text>
                <View style={styles.roles}>
                  {MEMBER_ROLES.map((option) => {
                    const active = option.key === role;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => setRole(option.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={option.label}
                        style={({ pressed }) => [
                          styles.role,
                          {
                            backgroundColor: active ? colors.blue : colors.fill,
                            opacity: pressed && !active ? 0.6 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            type.caption,
                            { color: active ? '#FFFFFF' : colors.label2, fontWeight: '600' },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[type.caption, { color: colors.label2 }]}>
                  {MEMBER_ROLES.find((option) => option.key === role)?.hint}
                </Text>
                <View style={styles.pair}>
                  <Button
                    label="Send invite"
                    onPress={() => invite.mutate()}
                    disabled={email.trim().length === 0}
                    loading={invite.isPending}
                    style={styles.half}
                  />
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={() => {
                      setInviting(false);
                      setEmail('');
                    }}
                    style={styles.half}
                  />
                </View>
              </View>
            ) : (
              <Button
                label="Invite someone"
                variant="secondary"
                onPress={() => setInviting(true)}
              />
            )
          ) : (
            <Text style={[type.caption, { color: colors.label2 }]}>
              Only an admin can invite people.
            </Text>
          )}
        </View>
      </Card>

      {/* Only shown when there is something pending: an empty card would be
          noise on the most crowded screen in the app. */}
      {inviteList.length > 0 ? (
        <Card>
          <View style={{ gap: space.md }}>
            <View style={styles.sectionHead}>
              <Text style={[type.headline, { color: colors.label }]}>
                Pending invites · {inviteList.length}
              </Text>
              {inviteList.length > PREVIEW_COUNT ? (
                <Pressable
                  onPress={() => router.push('/organization/invites')}
                  accessibilityRole="button"
                  accessibilityLabel="See all pending invites"
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={[type.footnote, { color: colors.blue, fontWeight: '600' }]}>
                    See all
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {inviteList.slice(0, PREVIEW_COUNT).map((pending) => (
              <View key={pending.email} style={styles.between}>
                <Text style={[type.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                  {pending.email}
                </Text>
                <Badge label={String(pending.role)} tone="info" />
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </>
  );
}

/**
 * Quiet hours and the follow-up limit. Both only ever hold back automated
 * outreach; a reply or a message sent by hand goes out immediately.
 */
function SendingRules({
  settings,
  canEdit,
}: {
  settings: AccountData['settings'];
  canEdit: boolean;
}) {
  const { colors, type, space } = useTheme();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof accountApi.updateSettings>[0]) =>
      accountApi.updateSettings(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] }),
    onError: (err) =>
      Alert.alert('Sending rules', apiErrorMessage(err, 'Could not save that change')),
  });

  return (
    <Card title="Sending rules">
      <View style={{ gap: space.lg }}>
        {SENDING_RULES.map((rule) => (
          <View key={rule.key} style={styles.ruleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: colors.label, fontWeight: '600' }]}>
                {rule.label}
              </Text>
              <Text style={[type.caption, { color: colors.label2, marginTop: space.xs }]}>
                {rule.hint}
              </Text>
            </View>
            <Switch
              value={settings[rule.key]}
              disabled={!canEdit || save.isPending}
              onValueChange={(value) => save.mutate({ [rule.key]: value })}
              accessibilityLabel={rule.label}
              trackColor={{ true: colors.toggle, false: colors.fill }}
            />
          </View>
        ))}
        {/* The toggles are already disabled for a member, which says the same
            thing without a line of prose. The API keys card keeps its note,
            where the controls are absent rather than greyed out. */}
        <Text style={[type.caption, { color: colors.label2 }]}>
          Times follow {settings.time_zone.replace(/_/g, ' ')}.
        </Text>
      </View>
    </Card>
  );
}

/** One usage bar. An unlimited allowance has no bar to fill. */
function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const { colors, type, space } = useTheme();
  const unlimited = isUnlimited(limit);
  const near = !unlimited && limit !== null && limit > 0 && used / limit >= 0.8;

  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.between}>
        <Text style={[type.footnote, { color: colors.label }]}>{label}</Text>
        <Text style={[type.footnote, { color: near ? colors.orange : colors.label2 }]}>
          {used.toLocaleString()} of {planLimit(limit)}
        </Text>
      </View>
      {unlimited || limit === null ? null : (
        <ProgressBar
          percent={limit > 0 ? (used / limit) * 100 : 0}
          color={near ? colors.orange : colors.blue}
          label={`${used} of ${limit} ${label.toLowerCase()} used`}
        />
      )}
    </View>
  );
}

/** A read-only value with a copy button, for the MCP and API addresses. */
function Copyable({ label, value }: { label: string; value: string }) {
  const { colors, type, space, radius } = useTheme();

  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.caption, { color: colors.label2, fontWeight: '600' }]}>{label}</Text>
      <Pressable
        onPress={() => {
          void Clipboard.setStringAsync(value);
          Alert.alert('Copied', `${label} copied to the clipboard.`);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Copy ${label}`}
        style={({ pressed }) => [
          styles.copyable,
          {
            backgroundColor: colors.fill2,
            borderColor: colors.sep,
            borderRadius: radius.md,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Text style={[type.caption, { color: colors.label, flex: 1 }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={[type.caption, { color: colors.blue, fontWeight: '600' }]}>Copy</Text>
      </Pressable>
    </View>
  );
}

/**
 * The organization's API keys. Creating and revoking are admin-only on the
 * server, so a member sees the list without the controls rather than buttons
 * that would 403.
 */
function ApiKeys({ canManage, hasAccess }: { canManage: boolean; hasAccess: boolean }) {
  const { colors, type, space } = useTheme();
  const queryClient = useQueryClient();
  // Naming happens inline rather than in Alert.prompt, which is iOS only.
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const keys = useQuery({
    queryKey: ['api-keys'],
    queryFn: accountApi.listKeys,
    enabled: hasAccess,
  });

  const create = useMutation({
    mutationFn: (keyName: string) => accountApi.createKey(keyName),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setNaming(false);
      setName('');
      // The secret exists in this response and nowhere else, so it is put on
      // the clipboard straight away rather than shown in a dialog that could
      // be dismissed before it is copied.
      void Clipboard.setStringAsync(created.key);
      Alert.alert(
        'Key created and copied',
        'The full key is on your clipboard. Save it somewhere safe: it cannot be shown again.'
      );
    },
    onError: (err) => Alert.alert('API keys', apiErrorMessage(err, 'Could not create the key')),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => accountApi.revokeKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
    onError: (err) => Alert.alert('API keys', apiErrorMessage(err, 'Could not revoke the key')),
  });

  if (!hasAccess) {
    return (
      <Card title="API keys">
        <Text style={[type.footnote, { color: colors.label2 }]}>
          Your plan does not include API access.
        </Text>
      </Card>
    );
  }

  return (
    <Card title="API keys">
      <View style={{ gap: space.md }}>
        {keys.isLoading ? (
          <Text style={[type.footnote, { color: colors.label2 }]}>Loading…</Text>
        ) : (keys.data?.length ?? 0) === 0 ? (
          <Text style={[type.footnote, { color: colors.label2 }]}>
            No keys yet. A key lets an assistant or a script use your workspace.
          </Text>
        ) : (
          keys.data?.map((key) => (
            <View key={key.id} style={styles.between}>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: colors.label }]} numberOfLines={1}>
                  {key.name}
                </Text>
                <Text style={[type.caption, { color: colors.label2 }]}>
                  {key.prefix}… ·{' '}
                  {key.last_used_at ? `used ${relativeTime(key.last_used_at)}` : 'never used'}
                </Text>
              </View>
              {canManage ? (
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      'Revoke this key?',
                      `Anything using "${key.name}" will stop working. This cannot be undone.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Revoke',
                          style: 'destructive',
                          onPress: () => revoke.mutate(key.id),
                        },
                      ]
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Revoke ${key.name}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginLeft: space.sm })}
                >
                  <Text style={[type.footnote, { color: colors.red, fontWeight: '600' }]}>
                    Revoke
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}

        {canManage ? (
          naming ? (
            <View style={{ gap: space.sm }}>
              <Field
                label="Key name"
                value={name}
                onChangeText={setName}
                placeholder="My assistant"
                hint="So you can tell it apart later."
                autoFocus
              />
              <View style={styles.pair}>
                <Button
                  label="Create"
                  onPress={() => create.mutate(name.trim())}
                  disabled={name.trim().length === 0}
                  loading={create.isPending}
                  style={styles.half}
                />
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setNaming(false);
                    setName('');
                  }}
                  style={styles.half}
                />
              </View>
            </View>
          ) : (
            <Button label="Create key" variant="secondary" onPress={() => setNaming(true)} />
          )
        ) : (
          <Text style={[type.caption, { color: colors.label2 }]}>
            Only an admin can create or revoke keys.
          </Text>
        )}
      </View>
    </Card>
  );
}

/**
 * Deleting your own account. Apple requires this of any app that lets you make
 * one (App Store Review 5.1.1(v)) and Google Play requires a path to it, so it
 * is a review gate rather than a nicety.
 *
 * It asks the backend what deletion would actually do before offering it. That
 * buys two things: the confirmation can name the consequence — your
 * organization and everyone's contacts, or just you — instead of hedging, and
 * a rule that refuses deletion is shown as an explanation with a way out
 * rather than as a button that fails.
 *
 * Opening the panel is one tap, and confirming is a second in a destructive
 * system alert. The panel in between is the part that matters: it is where the
 * consequence is read.
 */
function DeleteAccount({
  onDeleted,
  onManageBilling,
}: {
  onDeleted: () => Promise<void>;
  onManageBilling: () => void;
}) {
  const { colors, type, space } = useTheme();
  const [open, setOpen] = useState(false);

  const preview = useQuery({
    queryKey: [DELETION_QUERY_KEY],
    queryFn: accountApi.deletionPreview,
    // Membership and billing both change under us, and this decides what a
    // destructive confirmation claims, so it is never served from cache.
    staleTime: 0,
  });

  const remove = useMutation({
    mutationFn: accountApi.deleteAccount,
    onSuccess: () => {
      // The guard in app/_layout.tsx sends them to sign-in once the session is
      // gone, so there is nothing to navigate here.
      void onDeleted();
    },
    onError: (err) => Alert.alert('Delete account', apiErrorMessage(err, 'Could not delete your account')),
  });

  function confirm() {
    const data = preview.data;
    const consequence = data?.deletes_organization
      ? `This deletes ${data.organization?.name || 'your organization'} and everything in it: contacts, conversations, campaigns and API keys.` +
        (data.cancels_subscription ? ' Your plan is cancelled.' : '')
      : 'Your account is removed. Your organization and its conversations stay with the rest of the team.';

    Alert.alert('Delete your account?', `${consequence}\n\nThis cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
    ]);
  }

  // No card at all until the answer is in: an empty destructive section, or one
  // that promises something the server would refuse, is worse than a late one.
  if (preview.isLoading || !preview.data) return null;

  const data = preview.data;

  if (data.blocked) {
    return (
      <Card title="Delete account">
        <View style={{ gap: space.md }}>
          <Text style={[type.footnote, { color: colors.label2 }]}>{data.blocked.message}</Text>
          {data.blocked.code === 'active_subscription' ? (
            <Button label="Manage billing" variant="secondary" onPress={onManageBilling} />
          ) : null}
        </View>
      </Card>
    );
  }

  return (
    <Card title="Delete account">
      <View style={{ gap: space.md }}>
        {open ? (
          <>
            <Text style={[type.footnote, { color: colors.label }]}>
              {data.deletes_organization
                ? `You are the only person in ${data.organization?.name || 'your organization'}, so it is deleted with your account.`
                : `Your account is removed from ${data.organization?.name || 'your organization'}. Its ${data.other_members} other ${data.other_members === 1 ? 'member keeps' : 'members keep'} the contacts, conversations and campaigns.`}
            </Text>

            {data.deletes_organization ? (
              <View style={{ gap: space.xs }}>
                <Consequence text="Contacts, conversations and campaigns are deleted." />
                <Consequence text="API keys and webhooks stop working immediately." />
                {data.cancels_subscription ? <Consequence text="Your plan is cancelled." /> : null}
                {data.lines_released > 0 ? (
                  <Consequence
                    text={`${data.lines_released} ${data.lines_released === 1 ? 'line goes' : 'lines go'} back to Solvedblue.`}
                  />
                ) : null}
              </View>
            ) : null}

            <Text style={[type.caption, { color: colors.label2 }]}>This cannot be undone.</Text>

            <View style={styles.pair}>
              <Button
                label="Delete account"
                variant="danger"
                onPress={confirm}
                loading={remove.isPending}
                style={styles.half}
              />
              <Button
                label="Keep it"
                variant="secondary"
                onPress={() => setOpen(false)}
                disabled={remove.isPending}
                style={styles.half}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={[type.footnote, { color: colors.label2 }]}>
              {data.deletes_organization
                ? 'Deletes your account and the organization you are the only member of.'
                : 'Removes your account. The rest of your organization is untouched.'}
            </Text>
            <Button label="Delete account" variant="secondary" onPress={() => setOpen(true)} />
          </>
        )}
      </View>
    </Card>
  );
}

/** One thing that goes, bulleted. Spelling each out beats one long sentence nobody finishes. */
function Consequence({ text }: { text: string }) {
  const { colors, type, space } = useTheme();
  return (
    <View style={styles.consequence}>
      <Text style={[type.footnote, { color: colors.red }]}>•</Text>
      <Text style={[type.footnote, { color: colors.label2, flex: 1, marginLeft: space.xs }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  consequence: { flexDirection: 'row', alignItems: 'flex-start' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segment: { flexDirection: 'row', gap: 3 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  copyable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  pair: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  roles: { flexDirection: 'row', gap: 6 },
  role: {
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planTile: { borderCurve: 'continuous' },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
