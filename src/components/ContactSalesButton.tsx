import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { DEMO_LINK_QUERY_KEY, fetchDemoLink } from '../api/landing';
import { useTheme } from '../theme/useTheme';

/**
 * Opens the booking calendar. The URL comes from the backend
 * (DEMO_BOOKING_URL), the same source the web uses, so neither side hardcodes
 * a destination. Cached because it is the same answer everywhere it is asked.
 */
export function useBooking() {
  const { data: demo } = useQuery({
    queryKey: [DEMO_LINK_QUERY_KEY],
    queryFn: fetchDemoLink,
    staleTime: 60 * 60 * 1000,
  });

  return useCallback(async () => {
    // configured:false means the backend has no URL set. Say so rather than
    // opening something invented, matching the web's wording.
    if (!demo?.configured || !demo.url) {
      Alert.alert(
        'Contact sales',
        'Online booking is not connected yet. Please reach out and we will arrange a time.'
      );
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(demo.url);
    } catch {
      Alert.alert('Contact sales', 'Could not open the booking page. Please try again.');
    }
  }, [demo]);
}

/**
 * The pill that opens the booking calendar. Lives in the header as "Contact
 * sales" and on a quoted plan as "Talk to us", so both lead to the same place
 * and there is only one implementation of getting there.
 */
export function ContactSalesButton({
  label = 'Contact sales',
  style,
}: {
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, type, space } = useTheme();
  const openBooking = useBooking();

  return (
    <Pressable
      onPress={() => void openBooking()}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens a booking calendar to schedule a call"
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: colors.blueTint,
          paddingHorizontal: space.md,
          opacity: pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Ionicons name="calendar-outline" size={14} color={colors.blue} />
      <Text style={[type.caption, { color: colors.blue, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    minHeight: 32,
  },
});
