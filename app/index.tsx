import { Redirect } from 'expo-router';

/**
 * The entry route. The root layout's guard handles the signed-out case, so this
 * only needs to point at the first tab.
 */
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
