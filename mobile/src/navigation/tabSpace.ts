import { createContext, useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the floating tab bar's pill (padding + icon + label), without the bottom inset. */
export const TAB_BAR_PILL = 66;
/** Gap the tab bar keeps from the bottom edge when the phone has no home indicator. */
export const TAB_BAR_MIN_BOTTOM = 12;

/** True for screens rendered as tabs (set by AdminTabs / CustomerTabs in RootNavigator). */
export const InTabsContext = createContext(false);

/**
 * Space the floating tab bar takes at the bottom of the screen, or 0 on
 * screens that aren't inside the tabs. Anything pinned to the bottom (create
 * button, bulk-action bar) and the end of scrolling content must clear it.
 */
export function useTabBarSpace(): number {
  const insideTabs = useContext(InTabsContext);
  const insets = useSafeAreaInsets();
  return insideTabs ? TAB_BAR_PILL + Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM) : 0;
}
