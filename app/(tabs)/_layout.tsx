import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { INBOX_BADGE_QUERY_KEY, inboxApi } from '../../src/api/inbox';
// import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/theme/useTheme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Tabs types the icon colour as ColorValue, which allows null, while Ionicons
 * wants a plain string. One wrapper keeps the narrowing in a single place.
 */
function tabIcon(name: IconName) {
  // Named, because Tabs renders it as a component and an anonymous one shows up
  // as `Unknown` in a stack trace or the React devtools.
  function TabIcon({ color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <Ionicons name={name} color={(color as string) ?? undefined} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  // TEMPORARY: Campaigns is hidden from everyone, so nothing reads this.
  // const isPlatformAdmin = useAuthStore((s) => s.user?.is_platform_admin === true);

  // Unread conversations, not every conversation needing a reply: the badge is
  // there to say "there is something new you have not seen".
  const { data: badge } = useQuery({
    queryKey: [INBOX_BADGE_QUERY_KEY],
    queryFn: inboxApi.unreadCount,
    refetchInterval: 60_000,
  });

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.label2,
        tabBarStyle: { backgroundColor: colors.bg2, borderTopColor: colors.sep },
        // Every tab screen draws its own AppHeader, which carries the brand and
        // the Contact sales button the way the web header does. The stock
        // header would sit above it showing the title twice.
        headerShown: false,
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
        name="contacts"
        options={{ title: 'Contacts', tabBarIcon: tabIcon('people-outline') }}
      />
      {/* API & MCP takes the slot Campaigns had. Same decision as the web,
          whose customer sidebar is Home, Inbox, Contacts, API & MCP, Account
          (buildNavSections in spyder-web/src/components/shell/navigation.ts). */}
      <Tabs.Screen
        name="developers"
        options={{ title: 'API & MCP', tabBarIcon: tabIcon('code-slash-outline') }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: tabIcon('person-circle-outline') }}
      />
      {/* Campaigns is hidden from customers and kept for platform admins, the
          same rule and the same reason as the web's HIDDEN_CUSTOMER_FEATURES
          (spyder-web/src/features.tsx). The route and src/api/campaigns.ts
          stay: this is a navigation change, not a deletion, and an admin still
          reaches the screen. href null removes the tab without unregistering
          it, so a push to /campaigns still works. */}
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'Campaigns',
          tabBarIcon: tabIcon('send-outline'),
          // TEMPORARY: hidden from platform admins too, so the bar is the five
          // customer tabs. Put the line below back to restore the admin tab.
          // href: isPlatformAdmin ? undefined : null,
          href: null,
        }}
      />
    </Tabs>
  );
}
