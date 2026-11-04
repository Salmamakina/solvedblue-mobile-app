import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { INBOX_BADGE_QUERY_KEY, inboxApi } from '../../src/api/inbox';
import { useTheme } from '../../src/theme/useTheme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Tabs types the icon colour as ColorValue, which allows null, while Ionicons
 * wants a plain string. One wrapper keeps the narrowing in a single place.
 */
function tabIcon(name: IconName) {
  return ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={name} color={(color as string) ?? undefined} size={size} />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();

  // The needs-reply count, the same badge the web sidebar shows.
  const { data: badge } = useQuery({
    queryKey: [INBOX_BADGE_QUERY_KEY],
    queryFn: () => inboxApi.list({ folder: 'needs_reply', limit: 1 }),
    select: (page) => page.counts.needs_reply,
    refetchInterval: 60_000,
  });

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.label2,
        tabBarStyle: { backgroundColor: colors.bg2, borderTopColor: colors.sep },
        headerStyle: { backgroundColor: colors.bg2 },
        headerTitleStyle: { color: colors.label },
        headerTintColor: colors.blue,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarBadge: badge && badge > 0 ? badge : undefined,
          tabBarIcon: tabIcon('chatbubbles-outline'),
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{ title: 'Campaigns', tabBarIcon: tabIcon('send-outline') }}
      />
      <Tabs.Screen
        name="contacts"
        options={{ title: 'Contacts', tabBarIcon: tabIcon('people-outline') }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: tabIcon('person-circle-outline') }}
      />
    </Tabs>
  );
}
