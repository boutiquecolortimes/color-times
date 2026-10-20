import { haptic } from '../../lib/haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space, themed } from '../../theme';
import { T } from './Text';
import { Icon } from './Icon';
import { Tap } from './Pressable';

type Kind = 'success' | 'error' | 'info';
interface ToastMsg {
  id: number;
  kind: Kind;
  title: string;
  body?: string;
  onPress?: () => void;
}

let push: ((msg: Omit<ToastMsg, 'id'>) => void) | null = null;
let seq = 0;

export const toast = {
  // A matching haptic with every outcome — the "click" of a well-made thing.
  success: (title: string, body?: string) => {
    haptic('success');
    push?.({ kind: 'success', title, body });
  },
  error: (title: string, body?: string) => {
    haptic('error');
    push?.({ kind: 'error', title, body });
  },
  info: (title: string, body?: string, onPress?: () => void) =>
    push?.({ kind: 'info', title, body, onPress }),
};

const ICON: Record<Kind, { name: string; color: string }> = themed(() => ({
  success: { name: 'Check', color: colors.success },
  error: { name: 'CircleAlert', color: colors.danger },
  info: { name: 'Bell', color: colors.gold },
}));

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ToastMsg | null>(null);
  const y = useRef(new Animated.Value(-140)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    push = (msg) => setCurrent({ ...msg, id: ++seq });
    return () => {
      push = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    Animated.spring(y, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 200,
    }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        Animated.timing(y, {
          toValue: -140,
          duration: 220,
          useNativeDriver: true,
        }).start(() => setCurrent(null));
      },
      current.kind === 'error' ? 4200 : 2800
    );
  }, [current, y]);

  if (!current) return null;
  const icon = ICON[current.kind];
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + space.sm, transform: [{ translateY: y }] }]}
    >
      <Tap onPress={current.onPress} hapticOnPress={false} style={[styles.toast, shadow]}>
        <View style={[styles.icon, { backgroundColor: `${icon.color}22` }]}>
          <Icon name={icon.name} size={16} color={icon.color} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="smallStrong">{current.title}</T>
          {current.body ? (
            <T variant="small" numberOfLines={2}>
              {current.body}
            </T>
          ) : null}
        </View>
      </Tap>
    </Animated.View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 1000 },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      padding: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceHigh,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    icon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);
