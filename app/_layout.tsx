import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingState } from '../src/components/StateView';
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
    if (!token && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [hydrated, token, segments, router]);
}

export default function RootLayout() {
  const { colors, dark } = useTheme();
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const authReady = useAuthStore((s) => s.hydrated);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const themeReady = useThemeStore((s) => s.hydrated);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) {
      setStarted(true);
      void hydrateAuth();
      void hydrateTheme();
    }
  }, [started, hydrateAuth, hydrateTheme]);

  useAuthGuard();

  // Both stores must be read before the first paint, otherwise the app flashes
  // the signed-out screen or the wrong appearance on every cold start.
  const ready = authReady && themeReady;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={dark ? 'light' : 'dark'} />
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
            </Stack>
          ) : (
            <LoadingState label="Starting Spyder" />
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
