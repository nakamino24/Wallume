import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Single source of truth for bottom/top positioning of floating elements.
// Always: bottomInset + designSpacing (never a hardcoded pixel).
export function useBottomSpacing(design = 0): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + design;
}

export function useTopSpacing(design = 0): number {
  const insets = useSafeAreaInsets();
  return insets.top + design;
}