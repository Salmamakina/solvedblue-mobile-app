/**
 * Tapping the tab you are already on scrolls that screen back to the top.
 *
 * Android's fling covers a fixed distance, so on a long screen like Home one
 * swipe up does not reach the top and you have to swipe again. Rather than
 * fight the scroll physics, this gives the standard mobile shortcut, which
 * works however long the content grows.
 *
 * React Navigation ships a `useScrollToTop` for exactly this, but it comes from
 * @react-navigation/native, which is not a dependency here: Expo Router's
 * navigation core does not re-export it. So the 'tabPress' event is handled
 * directly, which is all that hook does.
 */
import { useNavigation } from 'expo-router';
import { useEffect, useRef, type ComponentRef, type RefObject } from 'react';
import type { FlatList, ScrollView } from 'react-native';

/**
 * The instance types of the two scrollables, taken from the components so the
 * ref can be handed straight to `<ScrollView ref=...>` without a cast.
 */
export type ScrollViewInstance = ComponentRef<typeof ScrollView>;
export type FlatListInstance = ComponentRef<typeof FlatList>;

/** The methods used here, which the two instances do not share. */
interface Scrollable {
  scrollTo?: (options: { y?: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
}

/**
 * Put the returned ref on the screen's ScrollView or FlatList:
 *
 *   const ref = useScrollToTop<ScrollViewInstance>();
 */
export function useScrollToTop<T>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    // 'tabPress' fires even when the tab is already focused, which is the case
    // this exists for. It is not in the typed event map for a generic
    // navigator, though the tab navigator does emit it.
    const unsubscribe = navigation.addListener('tabPress' as never, (() => {
      const list = ref.current as Scrollable | null;
      if (!list) return;
      if (typeof list.scrollToOffset === 'function') {
        list.scrollToOffset({ offset: 0, animated: true });
      } else if (typeof list.scrollTo === 'function') {
        list.scrollTo({ y: 0, animated: true });
      }
    }) as never);
    return unsubscribe;
  }, [navigation]);

  return ref;
}
