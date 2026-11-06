import { RefreshControl } from 'react-native';
import { useTheme } from '../theme/useTheme';

/**
 * Pull-to-refresh wired to a react-query refetch. RefreshControl's onRefresh
 * must return void, while refetch returns a promise of the query result.
 */
export function Refresh({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => unknown;
}) {
  const { colors } = useTheme();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        void onRefresh();
      }}
      tintColor={colors.blue}
      colors={[colors.blue]}
    />
  );
}
