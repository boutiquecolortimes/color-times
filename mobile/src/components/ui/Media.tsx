import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { alpha, colors, fonts, radius, space, themed } from '../../theme';
import { T } from './Text';
import { Icon } from './Icon';
import { Tap } from './Pressable';
import { initials } from '../../lib/format';
import { api } from '../../api/client';

/** Resolves relative /images/... paths from the web app against the API host. */
export function imageUrl(src?: string | null): string | null {
  if (!src) return null;
  if (/^https?:\/\//.test(src)) return src;
  return api.url(src.startsWith('/') ? src : `/${src}`);
}

/** Image that fades in over a warm placeholder; falls back to a monogram icon. */
export function Img({
  src,
  style,
  rounded = radius.md,
}: {
  src?: string | null;
  style?: StyleProp<ImageStyle>;
  rounded?: number;
}) {
  const uri = imageUrl(src);
  const [failed, setFailed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setFailed(false);
    opacity.setValue(0);
  }, [uri, opacity]);
  return (
    <View style={[styles.placeholder, { borderRadius: rounded }, style as StyleProp<ViewStyle>]}>
      {uri && !failed ? (
        <Animated.Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { borderRadius: rounded, opacity }]}
          resizeMode="cover"
          onLoad={() =>
            Animated.timing(opacity, {
              toValue: 1,
              duration: 260,
              useNativeDriver: true,
            }).start()
          }
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon name="Shirt" size={22} color={colors.goldDeep} />
      )}
    </View>
  );
}

export function Avatar({ name, size = 40, gold }: { name?: string | null; size?: number; gold?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: gold ? colors.gold : colors.surfaceHigh,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: gold ? colors.goldBright : colors.borderStrong,
      }}
    >
      <T
        style={{
          fontFamily: fonts.displayBold,
          fontSize: size * 0.4,
          color: gold ? colors.onGold : colors.gold,
        }}
      >
        {initials(name)}
      </T>
    </View>
  );
}

/** KPI tile: caption, big serif number, optional delta. */
export function Stat({
  label,
  value,
  delta,
  icon,
  style,
  onPress,
}: {
  label: string;
  value: string;
  delta?: { value: number; label?: string } | null;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const up = (delta?.value ?? 0) >= 0;
  const body = (
    <View style={[styles.stat, onPress ? { flex: undefined, minWidth: undefined } : null, !onPress && style]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <T variant="caption" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </T>
        {icon ? <Icon name={icon} size={16} color={colors.goldDeep} /> : null}
      </View>
      <T variant="number" style={{ marginTop: space.sm }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      {delta ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 2,
          }}
        >
          <Icon
            name={up ? 'ArrowUpRight' : 'ArrowDownRight'}
            size={14}
            color={up ? colors.success : colors.danger}
          />
          <T variant="small" color={up ? colors.success : colors.danger}>
            {Math.abs(delta.value).toFixed(0)}%{delta.label ? ` ${delta.label}` : ''}
          </T>
        </View>
      ) : null}
    </View>
  );
  return onPress ? (
    <Tap onPress={onPress} style={[{ flex: 1, minWidth: '45%' }, style]}>
      {body}
    </Tap>
  ) : (
    body
  );
}

/** Simple vertical bar chart drawn with Views (no chart lib). */
export function Bars({
  data,
  height = 120,
  format,
}: {
  data: { label: string; value: number }[];
  height?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 6 }}>
        {data.map((d, i) => {
          const h = Math.max(3, (d.value / max) * (height - 18));
          return (
            <View
              key={`${d.label}-${i}`}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {i === peak && format ? (
                <T
                  variant="small"
                  color={colors.gold}
                  style={{ fontSize: 10, marginBottom: 2 }}
                  numberOfLines={1}
                >
                  {format(d.value)}
                </T>
              ) : null}
              <LinearGradient
                colors={
                  i === peak
                    ? [colors.goldBright, colors.goldDeep]
                    : [alpha(colors.gold, 0.38), alpha(colors.gold, 0.2)]
                }
                style={{ width: '100%', height: h, borderRadius: 6 }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
        {data.map((d, i) => (
          <T
            key={`${d.label}-l-${i}`}
            variant="small"
            align="center"
            style={{ flex: 1, fontSize: 10 }}
            numberOfLines={1}
          >
            {d.label}
          </T>
        ))}
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    placeholder: {
      backgroundColor: colors.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    stat: {
      flex: 1,
      minWidth: '45%',
      padding: space.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  })
);

export { Image };
