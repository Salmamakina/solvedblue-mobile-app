import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, Text, View } from 'react-native';
import {
  ACCOUNT_QUERY_KEY,
  accountApi,
  MCP_URL,
  PUBLIC_API_URL,
  type AccountData,
} from '../../src/api/account';
import { apiErrorMessage, apiOrigin } from '../../src/api/client';
import { ApiKeys } from '../../src/components/ApiKeys';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Copyable } from '../../src/components/Copyable';
import { Screen } from '../../src/components/Screen';
import { ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';

/**
 * The MCP client config, the same snippet the web's developer docs show
 * (MCP_CONFIG in spyder-web/src/pages/developers/Developers.tsx).
 */
const mcpConfig = (url: string) =>
  `{
  "mcpServers": {
    "solvedblue": {
      "url": "${url}",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`;

/**
 * The public developer docs. The origin, not the /api base: the docs are a page
 * of the web app, served to anyone signed in or not
 * (the /developers route in spyder-web/src/App.tsx).
 */
const docsUrl = `${apiOrigin}/developers`;

/** What a plan without the API gets to see, mirroring the web's ComingSoon. */
const COMING: { title: string; body: string }[] = [
  {
    title: 'API keys',
    body: 'Send messages and read replies from your own systems, with keys you create and revoke yourself.',
  },
  {
    title: 'Webhooks',
    body: 'Get a call to your server the moment a reply, an opt-out or a delivery update arrives.',
  },
  {
    title: 'MCP server',
    body: 'Let an AI assistant that speaks MCP check your lines, send messages and manage webhooks for you.',
  },
];

/**
 * API & MCP, in the tab Campaigns used to hold.
 *
 * The same page the web puts in the same place: a plan with `api_access`
 * manages its keys and reads how to connect; a plan without it sees what is
 * coming and can ask to hear when it ships.
 *
 * The keys and MCP cards used to be buried at the bottom of Account, which was
 * already the longest screen in the app. They live here now.
 *
 * The reference documentation is not ported. It is eight sections of endpoint
 * detail (Authentication, Send a message, Message status, Lines, Webhooks, MCP
 * server, Errors, Rules) which the backend serves at /developers to anyone,
 * signed in or not. Two copies of that would drift, and the hosted one is
 * always current, so this opens it rather than restating it.
 */
export default function DevelopersScreen() {
  const { colors, type, space } = useTheme();
  const account = useQuery({ queryKey: [ACCOUNT_QUERY_KEY], queryFn: accountApi.get });

  if (account.isLoading) {
    return (
      <Screen>
        <AppHeader />
        <LoadingState label="Loading your plan" />
      </Screen>
    );
  }

  if (account.error || !account.data) {
    return (
      <Screen>
        <AppHeader />
        <ErrorState
          message={apiErrorMessage(account.error, 'Could not load your plan')}
          onRetry={() => account.refetch()}
        />
      </Screen>
    );
  }

  const { entitlements, user } = account.data;
  const hasApi = entitlements.features.api_access === true;
  const isAdmin = user.role_name === 'admin' || user.is_platform_admin === true;

  return (
    <Screen>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Text style={[type.largeTitle, { color: colors.label }]}>API &amp; MCP</Text>
          <Text style={[type.body, { color: colors.label2, marginTop: space.xs }]}>
            {hasApi
              ? 'Connect Solvedblue to your own tools with API keys and webhooks.'
              : 'Connect Solvedblue to your own tools. This is on its way.'}
          </Text>
        </View>

        {hasApi ? (
          <>
            <ApiKeys canManage={isAdmin} hasAccess />

            <Card title="MCP server">
              <View style={{ gap: space.md }}>
                <Text style={[type.footnote, { color: colors.label2 }]}>
                  Connect an AI assistant that speaks MCP and it can check your lines, send
                  messages and manage webhooks for you. It connects over Streamable HTTP with an
                  API key in the Authorization header. There is nothing to install.
                </Text>
                <Copyable label="MCP server" value={MCP_URL} />
                <Copyable label="API base" value={PUBLIC_API_URL} />
                <Copyable label="MCP client settings" value={mcpConfig(MCP_URL)} block />
              </View>
            </Card>

            <Card title="Documentation">
              <View style={{ gap: space.md }}>
                <Text style={[type.footnote, { color: colors.label2 }]}>
                  Every endpoint, the webhook events and how to check their signatures, the MCP
                  tools, and the error codes. It opens in your browser and is always current.
                </Text>
                <Button
                  label="Open the API docs"
                  variant="secondary"
                  onPress={() => void WebBrowser.openBrowserAsync(docsUrl)}
                />
              </View>
            </Card>
          </>
        ) : (
          <ComingSoon account={account.data} />
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * What a plan without API access sees: what is coming, and a way to be told
 * when it ships. `registerApiInterest` is the same endpoint the web calls, and
 * `api_interest_at` records that it already has been.
 */
function ComingSoon({ account }: { account: AccountData }) {
  const { colors, type, space } = useTheme();
  const queryClient = useQueryClient();

  const register = useMutation({
    mutationFn: accountApi.registerApiInterest,
    onSuccess: ({ at }) => {
      queryClient.setQueryData<AccountData | undefined>([ACCOUNT_QUERY_KEY], (old) =>
        old ? { ...old, api_interest_at: at } : old
      );
    },
  });

  const registered = Boolean(account.api_interest_at) || register.isSuccess;

  return (
    <>
      {COMING.map((feature) => (
        <Card key={feature.title} title={feature.title}>
          <View style={{ gap: space.sm }}>
            <Text style={[type.footnote, { color: colors.label2 }]}>{feature.body}</Text>
            <Text style={[type.caption, { color: colors.label2, fontWeight: '600' }]}>
              Coming soon
            </Text>
          </View>
        </Card>
      ))}

      <Card title="Want it sooner?">
        {registered ? (
          <Text accessibilityRole="alert" style={[type.body, { color: colors.label }]}>
            We&apos;ll let you know when it&apos;s ready.
          </Text>
        ) : (
          <View style={{ gap: space.md }}>
            <Text style={[type.footnote, { color: colors.label2 }]}>
              Tell us you&apos;re interested and we&apos;ll email you when it launches.
            </Text>
            <Button
              label="Tell me when it's ready"
              onPress={() => register.mutate()}
              loading={register.isPending}
            />
            {register.isError ? (
              <Text accessibilityRole="alert" style={[type.footnote, { color: colors.red }]}>
                Something went wrong. Please try again.
              </Text>
            ) : null}
          </View>
        )}
      </Card>
    </>
  );
}
