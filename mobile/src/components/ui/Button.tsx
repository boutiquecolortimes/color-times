import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { alpha, colors, fonts, gradients, radius, space, themed } from '../../theme';
import { Tap } from './Pressable';
import { T } from './Text';
import { Icon } from './Icon';

type Variant = 'gold' | 'outline' | 'ghost' | 'danger' | 'surface';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'sm' | 'lg';
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'gold',
  icon,
  loading,
  disabled,
  size = 'md',
  style,
  full,
}: Props) {
  const height = size === 'sm' ? 38 : size === 'lg' ? 56 : 48;
  const fg =
    variant === 'gold'
      ? colors.onPrimary
      : variant === 'danger'
      ? colors.danger
      : variant === 'outline' || variant === 'ghost'
      ? colors.gold
      : colors.text;

  const content = (
    <View style={[styles.inner, { height, paddingHorizontal: size === 'sm' ? space.md : space.xl }]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={fg} strokeWidth={1.9} /> : null}
          <T
            style={{
              color: fg,
              fontFamily: fonts.bodySemi,
              fontSize: size === 'sm' ? 13 : 15,
              letterSpacing: variant === 'gold' ? 0.4 : 0.2,
            }}
          >
            {title}
          </T>
        </>
      )}
    </View>
  );

  return (
    <Tap
      onPress={onPress}
      disabled={disabled || loading}
      style={[full && { alignSelf: 'stretch' }, style]}
      accessibilityLabel={title}
    >
      {variant === 'gold' ? (
        <LinearGradient
          colors={[...gradients.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            { borderRadius: radius.pill },
            !disabled && { boxShadow: `0 6px 18px ${alpha(colors.primary, 0.28)}` },
          ]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.base,
            variant === 'outline' && {
              borderWidth: 1,
              borderColor: colors.goldDeep,
            },
            variant === 'danger' && {
              borderWidth: 1,
              borderColor: alpha(colors.danger, 0.45),
            },
            variant === 'surface' && { backgroundColor: colors.surfaceHigh },
          ]}
        >
          {content}
        </View>
      )}
    </Tap>
  );
}

/** "Share2" → "Share", "ChevronLeft" → "Chevron left": a readable fallback for screen readers. */
function iconLabel(icon: string): string {
  const words = icon
    .replace(/\d+$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function IconButton({
  icon,
  onPress,
  color = colors.text,
  badge,
  size = 40,
  filled = true,
  accessibilityLabel,
}: {
  icon: string;
  onPress?: () => void;
  color?: string;
  badge?: number;
  size?: number;
  filled?: boolean;
  accessibilityLabel?: string;
}) {
  // Grow the touch area to ≥48pt without changing the visual size.
  const slop = Math.max(0, Math.ceil((48 - size) / 2));
  return (
    <Tap
      onPress={onPress}
      scaleTo={0.9}
      hitSlop={slop}
      accessibilityLabel={accessibilityLabel ?? iconLabel(icon)}
    >
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
          },
          filled && {
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          },
        ]}
      >
        <Icon name={icon} size={size * 0.48} color={color} />
        {badge ? (
          <View style={styles.badge}>
            <T
              style={{
                fontSize: 10,
                lineHeight: 13,
                color: colors.onPrimary,
                fontFamily: fonts.bodyBold,
              }}
            >
              {badge > 99 ? '99+' : badge}
            </T>
          </View>
        ) : null}
      </View>
    </Tap>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    base: { borderRadius: radius.pill, overflow: 'hidden' },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm,
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);
