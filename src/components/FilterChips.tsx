import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface FilterChip<K extends string> {
  key: K;
  label: string;
}

interface FilterChipsProps<K extends string> {
  chips: readonly FilterChip<K>[];
  selected: K;
  onSelect: (key: K) => void;
  /** The server's count per chip, appended to the label and the spoken name. */
  counts?: Partial<Record<K, number>> | null;
  /** Names the set for a screen reader: "Folders", "Filters". */
  label: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * One scrolling line of filter chips, as the web's FolderTabs does on phones
 * (spyder-web/src/pages/inbox/FolderTabs.tsx, `variant="bar"`).
 *
 * One line that scrolls, not a wrapping row. Five folders with counts do not
 * fit across a narrow phone, and wrapping pushed "Flagged" and "Closed" onto a
 * second line, which cost the list below a row of height and moved the first
 * conversation down the screen whenever a count grew a digit.
 *
 * The chosen chip is scrolled into view, because a chip can sit past the edge:
 * tapping the Inbox tab badge selects a folder, and landing on a row of chips
 * where none looks selected reads as nothing having happened.
 */
export function FilterChips<K extends string>({
  chips,
  selected,
  onSelect,
  counts,
  label,
  style,
  contentStyle,
}: FilterChipsProps<K>) {
  const { colors, type, space, radius } = useTheme();
  // ComponentRef, not the component type: ScrollView is a function component
  // in RN 0.88, so ScrollView names the component rather than its instance.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  // Where each chip sits in the scrolling content, filled in as it lays out.
  const positions = useRef<Partial<Record<K, { x: number; width: number }>>>({});
  const viewportWidth = useRef(0);

  const onChipLayout = useCallback((key: K) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    positions.current[key] = { x, width };
  }, []);

  useEffect(() => {
    const chip = positions.current[selected];
    const viewport = viewportWidth.current;
    if (!chip || viewport === 0) return;
    // Centre it when it would otherwise be clipped at either edge, and clamp at
    // 0 so the first chip does not leave a gap on the left.
    const target = Math.max(0, chip.x - (viewport - chip.width) / 2);
    scrollRef.current?.scrollTo({ x: target, animated: true });
  }, [selected]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(event) => {
        viewportWidth.current = event.nativeEvent.layout.width;
      }}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      // flexShrink: 0 is load-bearing. A ScrollView is a flex child like any
      // other, and when the column it sits in runs out of room — Contacts has
      // two buttons and a search field above it — the default flexShrink of 1
      // let this row give up height, which clipped the chips in half. The row
      // is one line of chips; it must keep the height its content asks for.
      style={[{ flexGrow: 0, flexShrink: 0 }, style]}
      contentContainerStyle={[{ gap: space.sm, paddingHorizontal: space.lg }, contentStyle]}
    >
      {chips.map((chip) => {
        const active = chip.key === selected;
        const count = counts?.[chip.key];
        return (
          <View key={chip.key} onLayout={onChipLayout(chip.key)}>
            <Pressable
              onPress={() => onSelect(chip.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={count ? `${chip.label}, ${count}` : chip.label}
              style={({ pressed }) => ({
                backgroundColor: active ? colors.blue : colors.fill,
                borderRadius: radius.pill,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                opacity: pressed && !active ? 0.6 : 1,
              })}
            >
              <Text
                style={[
                  type.footnote,
                  { color: active ? '#FFFFFF' : colors.label2, fontWeight: '600' },
                ]}
              >
                {chip.label}
                {count ? ` ${count}` : ''}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}
