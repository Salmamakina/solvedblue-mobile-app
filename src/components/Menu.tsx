import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface MenuItem {
  label: string;
  onPress: () => void;
  /** An Ionicons glyph shown before the label. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Red, for something that blocks or closes. */
  destructive?: boolean;
  /** Shown as chosen, for a menu that is a set of options. */
  selected?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  /** Names the menu for a screen reader: "Conversation settings", "Assign to". */
  label: string;
  /** What opens it. Given `open` so a chevron can turn. */
  children: (state: { open: boolean }) => ReactNode;
}

/** How far the card may spread, and how far it stays from the screen edge. */
const MIN_WIDTH = 200;
const EDGE_MARGIN = 8;

/**
 * A dropdown anchored under its trigger, for the actions on a conversation.
 *
 * A Modal rather than an absolutely positioned view, because the trigger lives
 * in the navigator's header: anything drawn inside that is clipped by it, so a
 * menu would be cut off after its first row.
 *
 * Right-aligned to the trigger, since every use is a header button near the
 * right edge, and clamped so the card cannot hang off either side.
 *
 * The backdrop fills the screen and closes on press, which is both how a
 * dropdown is dismissed and what stops a tap landing on the screen behind it.
 */
export function Menu({ items, label, children }: MenuProps) {
  const { colors, type, space, radius } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  // Where to draw the card, measured from the trigger when it is opened.
  const [anchor, setAnchor] = useState({ top: 0, right: 0 });
  // ComponentRef, because View is a function component in RN 0.88: its
  // instance type is ReactNativeElement, which is what carries measureInWindow.
  const triggerRef = useRef<ComponentRef<typeof View>>(null);

  function show() {
    // measureInWindow, not onLayout: the position needed is relative to the
    // screen, because the Modal is not inside the header's coordinate space.
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ top: y + height + space.xs, right: Math.max(EDGE_MARGIN, screenWidth - (x + width)) });
      setOpen(true);
    });
  }

  function choose(item: MenuItem) {
    setOpen(false);
    item.onPress();
  }

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        hitSlop={space.sm}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        {children({ open })}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        // Android's hardware back must close the menu, not leave the screen.
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={() => setOpen(false)}
        />
        <View
          accessibilityRole="menu"
          accessibilityLabel={label}
          style={[
            styles.card,
            {
              top: anchor.top,
              right: anchor.right,
              maxWidth: screenWidth - EDGE_MARGIN * 2,
              backgroundColor: colors.bg2,
              borderColor: colors.sep,
              borderRadius: radius.lg,
            },
          ]}
        >
          {items.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => choose(item)}
              disabled={item.disabled}
              accessibilityRole="menuitem"
              accessibilityLabel={item.label}
              accessibilityState={{ disabled: item.disabled, selected: item.selected }}
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: pressed ? colors.fill2 : 'transparent',
                  paddingHorizontal: space.md,
                  paddingVertical: space.md,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.sep,
                  opacity: item.disabled ? 0.4 : 1,
                },
              ]}
            >
              {item.icon ? (
                <Ionicons
                  name={item.icon}
                  size={17}
                  color={item.destructive ? colors.red : colors.label2}
                  accessible={false}
                />
              ) : null}
              <Text
                style={[
                  type.body,
                  { color: item.destructive ? colors.red : colors.label, flexShrink: 1 },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {/* A tick, so a menu of options shows which one is current
                  without the label having to say "(current)". */}
              {item.selected ? (
                <Ionicons
                  name="checkmark"
                  size={17}
                  color={colors.blue}
                  style={styles.tick}
                  accessible={false}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  card: {
    position: 'absolute',
    minWidth: MIN_WIDTH,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    // Enough lift to read as floating above the screen on both platforms.
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  tick: { marginLeft: 'auto' },
});
