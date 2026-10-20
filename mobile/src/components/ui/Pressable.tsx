import React, { useRef } from 'react';
import {
  Animated,
  Pressable as RNPressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { haptic } from '../../lib/haptics';
import { reduceMotion } from '../../lib/motion';

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticOnPress?: boolean;
  children?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

/** Press with a soft spring scale + light haptic — used for every tappable surface. */
export function Tap({
  style,
  scaleTo = 0.97,
  hapticOnPress = true,
  onPress,
  children,
  disabled,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) =>
    reduceMotion()
      ? undefined
      : Animated.spring(scale, {
          toValue: to,
          useNativeDriver: true,
          speed: 40,
          bounciness: 6,
        }).start();

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={() => animate(scaleTo)}
      onPressOut={() => animate(1)}
      onPress={(event) => {
        if (hapticOnPress) haptic('tap');
        onPress?.(event);
      }}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      accessibilityState={{ disabled: Boolean(disabled), ...rest.accessibilityState }}
      // Layout styles (flex, % widths, absolute fill) must sit on the pressable
      // itself — on an inner view they'd resolve against a content-sized box.
      style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}
    >
      {children}
    </AnimatedPressable>
  );
}
