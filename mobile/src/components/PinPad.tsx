import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Icon, T, Tap } from './ui';
import { colors, fonts, space, themed } from '../theme';
import { haptic } from '../lib/haptics';
import { reduceMotion } from '../lib/motion';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'extra', '0', 'del'] as const;

/**
 * Four dots and a phone-style number pad. `shake` (bump the number) plays a
 * short shake + error haptic for a wrong or mismatched PIN. The bottom-left
 * key is optional (e.g. Face ID / fingerprint).
 */
export function PinPad({
  value,
  onChange,
  length = 4,
  shake = 0,
  disabled,
  extraKey,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  shake?: number;
  disabled?: boolean;
  extraKey?: { icon: string; label: string; onPress: () => void };
}) {
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shake) return;
    haptic('error');
    if (reduceMotion()) return;
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((v) =>
        Animated.timing(x, { toValue: v, duration: 45, useNativeDriver: true })
      )
    ).start();
  }, [shake, x]);

  const press = (k: (typeof KEYS)[number]) => {
    if (disabled) return;
    if (k === 'del') onChange(value.slice(0, -1));
    else if (k === 'extra') extraKey?.onPress();
    else if (value.length < length) onChange(value + k);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View
        style={[styles.dots, { transform: [{ translateX: x }] }]}
        accessible
        accessibilityLabel={`${value.length} of ${length} digits entered`}
      >
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotOn]} />
        ))}
      </Animated.View>

      <View style={styles.grid}>
        {KEYS.map((k) => {
          if (k === 'extra' && !extraKey) return <View key={k} style={[styles.key, styles.keyPlain]} />;
          const label = k === 'del' ? 'Delete' : k === 'extra' ? extraKey!.label : k;
          return (
            <Tap
              key={k}
              onPress={() => press(k)}
              disabled={disabled || (k === 'del' && !value)}
              accessibilityLabel={label}
              style={[styles.key, (k === 'del' || k === 'extra') && styles.keyPlain]}
              scaleTo={0.9}
            >
              {k === 'del' ? (
                <Icon name="Delete" size={24} color={value ? colors.text : colors.textDisabled} />
              ) : k === 'extra' ? (
                <Icon name={extraKey!.icon} size={26} color={colors.gold} />
              ) : (
                <T style={styles.digit}>{k}</T>
              )}
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

const KEY = 74;

const styles = themed(() =>
  StyleSheet.create({
    dots: { flexDirection: 'row', gap: space.lg, marginBottom: space.xxl },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
    },
    dotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    grid: {
      width: KEY * 3 + space.xl * 2,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: space.lg,
    },
    key: {
      width: KEY,
      height: KEY,
      borderRadius: KEY / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    keyPlain: { backgroundColor: 'transparent', borderColor: 'transparent' },
    digit: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text },
  })
);
