import { StyleSheet, Text, View } from 'react-native';
import type { LineHealth } from '../api/home';
import { useTheme } from '../theme/useTheme';

type Tone = 'neutral' | 'info' | 'good' | 'warn' | 'bad';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colors, type, radius, space } = useTheme();

  const tones: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: colors.fill, fg: colors.label2 },
    info: { bg: colors.blueTint, fg: colors.blue },
    good: { bg: colors.greenTint, fg: colors.green },
    warn: { bg: colors.orangeTint, fg: colors.orange },
    bad: { bg: colors.redTint, fg: colors.red },
  };
  const { bg, fg } = tones[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingHorizontal: space.sm,
          paddingVertical: space.xs / 2,
        },
      ]}
    >
      <Text style={[type.caption, { color: fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function healthTone(health: LineHealth): Tone {
  if (health === 'healthy') return 'good';
  if (health === 'attention') return 'warn';
  return 'bad';
}

export function campaignTone(status: string): Tone {
  if (status === 'active') return 'good';
  if (status === 'scheduled') return 'info';
  if (status === 'paused') return 'warn';
  if (status === 'completed') return 'neutral';
  return 'neutral';
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start' },
});
