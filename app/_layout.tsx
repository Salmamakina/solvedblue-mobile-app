import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DEV_BYPASS_AUTH } from '../src/config/devBypass';
import { usePushNotifications } from '../src/notifications/usePushNotifications';
import { useAuthStore } from '../src/stores/authStore';
import { useThemeStore } from '../src/stores/themeStore';
import { useTheme } from '../src/theme/useTheme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Sends the user to sign-in or into the app once the stored session is known.
 * This is the single place that decides, so no screen has to check for a token.
 */
function useAuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    // TEMPORARY: while DEV_BYPASS_AUTH is on, never send anyone to sign-in, and
    // push them out of it if they land there. See src/config/devBypass.ts.
    if (DEV_BYPASS_AUTH) {
      if (inAuthGroup) router.replace('/(tabs)/home');
      return;
    }

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [hydrated, token, segments, router]);
}

/**
 * Renders nothing: it exists only so usePushNotifications runs inside the
 * QueryClientProvider, which RootLayout itself is not. The hook invalidates the
 * inbox queries when a reply arrives, so it needs the client.
 */
function PushNotifications() {
  usePushNotifications();
  return null;
}

/**
 * Shown while the stored session and theme are being read. Uses the Solvedblue
 * mark rather than a text label, so the first frame matches the web app's
 * branding instead of spelling out the internal project name.
 */
function SplashBrand() {
  const { colors } = useTheme();
  return (
    <View style={[styles.splash, { backgroundColor: colors.bg }]}>
      <Image
        source={require('../assets/solvedblue-mark.png')}
        style={styles.mark}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Solvedblue"
      />
      <ActivityIndicator color={colors.blue} />
    </View>
  );
}

export default function RootLayout() {
  const { colors, dark } = useTheme();
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const authReady = useAuthStore((s) => s.hydrated);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const themeReady = useThemeStore((s) => s.hydrated);
  // A ref, not state: nothing renders differently because hydration has begun,
  // and setting state here would cascade a second render before the first
  // paint. `hydrated` on each store is what the UI actually waits on.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void hydrateAuth();
    void hydrateTheme();
  }, [hydrateAuth, hydrateTheme]);

  useAuthGuard();

  // Both stores must be read before the first paint, otherwise the app flashes
  // the signed-out screen or the wrong appearance on every cold start.
  const ready = authReady && themeReady;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={dark ? 'light' : 'dark'} />
          <PushNotifications />
          {ready ? (
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg2 },
                headerTitleStyle: { color: colors.label },
                headerTintColor: colors.blue,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="chat/[phone]"
                options={{ title: 'Conversation', headerBackTitle: 'Back' }}
              />
              {/* Presented as sheets: both are short tasks you come back from,
                  not places in the tab structure. */}
              <Stack.Screen
                name="contacts/new"
                options={{ title: 'New contact', presentation: 'modal' }}
              />
              <Stack.Screen
                name="contacts/import"
                options={{ title: 'Import contacts', presentation: 'modal' }}
              />
              <Stack.Screen
                name="workflows/new"
                options={{ title: 'New workflow', presentation: 'modal' }}
              />
              <Stack.Screen
                name="campaigns/new"
                options={{ title: 'New campaign', presentation: 'modal' }}
              />
              {/* Pushed rather than presented as sheets: these are the full
                  lists behind the Account tab's previews, and the only way in
                  is from there. */}
              {/* Pushed from their tab's list, and the only way in. Both are
                  places you read and come back from, not short tasks, so
                  neither is a sheet. */}
              <Stack.Screen
                name="campaigns/[id]"
                options={{ title: 'Campaign', headerBackTitle: 'Campaigns' }}
              />
              <Stack.Screen
                name="contacts/[id]"
                options={{ title: 'Contact', headerBackTitle: 'Contacts' }}
              />
              <Stack.Screen
                name="organization/members"
                options={{ title: 'Members', headerBackTitle: 'Account' }}
              />
              <Stack.Screen
                name="organization/invites"
                options={{ title: 'Pending invites', headerBackTitle: 'Account' }}
              />
            </Stack>
          ) : (
            <SplashBrand />
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  mark: { width: 140, height: 140 },
});
