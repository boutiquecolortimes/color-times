import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, T, Tap } from '../components/ui';
import { colors, fonts, radius, shadow, space, themed } from '../theme';
import { haptic } from '../lib/haptics';
import { reduceMotion } from '../lib/motion';

export const TAB_ICONS: Record<string, string> = {
  Dashboard: 'LayoutDashboard',
  BookingsTab: 'CalendarCheck',
  Catalogue: 'Shirt',
  Billing: 'FileText',
  More: 'Menu',
  Home: 'House',
  Explore: 'Search',
  WishlistTab: 'Heart',
  MyBookings: 'CalendarCheck',
  Profile: 'Users',
};

/** Floating pill tab bar with a gold active state. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.md) }]}
      pointerEvents="box-none"
    >
      <View style={[styles.bar, shadow]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel as string) ?? options.title ?? route.name;
          return (
            <Tap
              key={route.key}
              hapticOnPress={false}
              scaleTo={0.9}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  haptic('select');
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={styles.item}
            >
              <TabIcon name={TAB_ICONS[route.name] ?? 'Ellipsis'} focused={focused} />
              <T
                style={{
                  fontFamily: focused ? fonts.bodySemi : fonts.bodyMedium,
                  fontSize: 10,
                  marginTop: 3,
                  color: focused ? colors.gold : colors.textFaint,
                }}
                numberOfLines={1}
              >
                {label}
              </T>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

/** Gold pill that blooms in behind the active tab's icon. */
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const v = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion()) {
      v.setValue(focused ? 1 : 0);
      return;
    }
    Animated.timing(v, {
      toValue: focused ? 1 : 0,
      duration: focused ? 280 : 160,
      easing: focused ? Easing.out(Easing.back(1.6)) : Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [focused, v]);
  return (
    <View style={styles.iconWrap}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.iconActive,
          {
            opacity: v,
            transform: [{ scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          },
        ]}
      />
      <Icon
        name={name}
        size={20}
        color={focused ? colors.onGold : colors.textMuted}
        strokeWidth={focused ? 2.1 : 1.7}
      />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg },
    bar: {
      flexDirection: 'row',
      paddingVertical: space.sm,
      paddingHorizontal: space.xs,
      borderRadius: radius.xl,
      backgroundColor: colors.tabBar,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    item: { flex: 1, alignItems: 'center' },
    iconWrap: { width: 44, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    iconActive: { backgroundColor: colors.gold, borderRadius: 15 },
  })
);
