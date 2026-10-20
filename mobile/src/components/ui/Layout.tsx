import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { alpha, colors, fonts, gradients, radius, space, themed } from '../../theme';
import { T } from './Text';
import { IconButton } from './Button';
import { Icon } from './Icon';
import { Tap } from './Pressable';
import { DetailSkeleton, GridSkeleton, ListSkeleton, StatsSkeleton } from './Skeleton';
import type { Tone } from '../../lib/labels';
import { toneColor } from '../../lib/labels';
import { reduceMotion } from '../../lib/motion';

/** Top bar: back chevron, display-serif title, optional actions. */
export function Header({
  title,
  subtitle,
  back = true,
  right,
  large,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  large?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const canGoBack = back && navigation.canGoBack();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.headerRow}>
        {canGoBack ? (
          <IconButton icon="ChevronLeft" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        ) : null}
        {!large && title ? (
          <View style={{ flex: 1, marginHorizontal: canGoBack ? space.md : 0 }}>
            <T variant="h3" numberOfLines={1}>
              {title}
            </T>
            {subtitle ? (
              <T variant="small" numberOfLines={1}>
                {subtitle}
              </T>
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={styles.headerRight}>{right}</View>
      </View>
      {large && title ? (
        <View style={{ marginTop: space.md }}>
          {subtitle ? <T variant="caption">{subtitle}</T> : null}
          <T variant="h1">{title}</T>
        </View>
      ) : null}
    </View>
  );
}

interface ScreenProps extends ScrollViewProps {
  header?: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: React.ReactNode;
  padded?: boolean;
  children?: React.ReactNode;
}

/** Content settles in — a short fade and lift on first mount, like a page turning. */
export function Reveal({
  children,
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}) {
  const v = useRef(new Animated.Value(reduceMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion()) return;
    Animated.timing(v, {
      toValue: 1,
      duration: 320,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function Screen({
  header,
  scroll = true,
  refreshing,
  onRefresh,
  footer,
  padded = true,
  children,
  contentContainerStyle,
  ...rest
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      {header}
      {scroll ? (
        <ScrollView
          {...rest}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            padded && { paddingHorizontal: space.lg },
            {
              paddingBottom: (footer ? 110 : 40) + insets.bottom,
              paddingTop: space.sm,
            },
            contentContainerStyle,
          ]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={colors.gold}
                colors={[colors.gold]}
                progressBackgroundColor={colors.surface}
              />
            ) : undefined
          }
        >
          <Reveal>{children}</Reveal>
        </ScrollView>
      ) : (
        <Reveal style={[{ flex: 1 }, padded && { paddingHorizontal: space.lg }]}>{children}</Reveal>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <LinearGradient
            colors={[alpha(colors.bg, 0), colors.bg]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) {
  const body = (
    <LinearGradient
      colors={[...gradients.card]}
      style={[styles.card, padded && { padding: space.lg }, style]}
    >
      {children}
    </LinearGradient>
  );
  return onPress ? <Tap onPress={onPress}>{body}</Tap> : body;
}

export function Section({
  title,
  action,
  onAction,
  children,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginTop: space.xxl }, style]}>
      <View style={styles.sectionHead}>
        <T variant="caption">{title}</T>
        {action ? (
          <Tap onPress={onAction} hapticOnPress={false}>
            <T variant="smallStrong" gold>
              {action}
            </T>
          </Tap>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Pill({ label, tone = 'gold', small }: { label: string; tone?: Tone; small?: boolean }) {
  const c = toneColor[tone];
  return (
    <View
      style={[
        styles.pill,
        { borderColor: `${c}55`, backgroundColor: `${c}18` },
        small && { paddingVertical: 2, paddingHorizontal: 8 },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: c }]} />
      <T
        style={{
          color: c,
          fontSize: small ? 11 : 12,
          fontFamily: fonts.bodySemi,
        }}
      >
        {label}
      </T>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginVertical: space.md,
        },
        style,
      ]}
    />
  );
}

export function Row({
  children,
  style,
  gap = space.sm,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/** Label / value line used across detail screens. */
export function KV({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value?: React.ReactNode;
  strong?: boolean;
  tone?: Tone;
}) {
  return (
    <View style={styles.kv}>
      <T variant="small" style={{ flexShrink: 0 }}>
        {label}
      </T>
      {typeof value === 'string' || typeof value === 'number' ? (
        <T
          variant={strong ? 'bodyStrong' : 'body'}
          color={tone ? toneColor[tone] : undefined}
          style={{ flex: 1, textAlign: 'right', marginLeft: space.lg }}
        >
          {value}
        </T>
      ) : (
        <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: space.lg }}>
          {value ?? <T muted>—</T>}
        </View>
      )}
    </View>
  );
}

/** A tappable list row with optional leading icon/media and trailing value. */
export function ListRow({
  title,
  subtitle,
  meta,
  right,
  icon,
  leading,
  onPress,
  chevron = true,
  danger,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  right?: React.ReactNode;
  icon?: string;
  leading?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
}) {
  return (
    <Tap onPress={onPress} disabled={!onPress} scaleTo={0.985} style={styles.listRow}>
      {leading ??
        (icon ? (
          <View style={styles.rowIcon}>
            <Icon name={icon} size={18} color={danger ? colors.danger : colors.gold} />
          </View>
        ) : null)}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="bodyStrong" numberOfLines={1} color={danger ? colors.danger : undefined}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
        {meta ? (
          <T variant="small" color={colors.textFaint} numberOfLines={1}>
            {meta}
          </T>
        ) : null}
      </View>
      {right}
      {onPress && chevron ? <Icon name="ChevronRight" size={18} color={colors.textFaint} /> : null}
    </Tap>
  );
}

/**
 * Loading state. Without a label it renders a shimmering skeleton shaped like
 * the content to come (detail by default; `list` / `grid` / `stats`), which
 * feels calmer and more premium than a spinner. With a label it shows the
 * gold spinner + text, for explicit "working on it" moments.
 */
export function Loading({
  label,
  variant = 'detail',
  inset = false,
}: {
  label?: string;
  variant?: 'detail' | 'hero' | 'list' | 'grid' | 'stats';
  /** Add the page gutter when not inside a padded Screen. */
  inset?: boolean;
}) {
  if (!label) {
    return (
      <View style={{ paddingTop: space.md }}>
        {variant === 'list' ? (
          <ListSkeleton inset={inset} />
        ) : variant === 'grid' ? (
          <GridSkeleton inset={inset} />
        ) : variant === 'stats' ? (
          <StatsSkeleton inset={inset} />
        ) : (
          <DetailSkeleton hero={variant === 'hero'} inset={inset} />
        )}
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.gold} />
      {label ? (
        <T variant="small" style={{ marginTop: space.md }}>
          {label}
        </T>
      ) : null}
    </View>
  );
}

export function Empty({
  icon = 'Inbox',
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={[styles.center, { paddingVertical: space.xxxl * 1.5 }]}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={colors.gold} />
      </View>
      <T variant="h3" align="center" style={{ marginTop: space.lg }}>
        {title}
      </T>
      {body ? (
        <T variant="small" align="center" style={{ marginTop: space.xs, maxWidth: 280 }}>
          {body}
        </T>
      ) : null}
      {action ? <View style={{ marginTop: space.xl }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[styles.center, { paddingVertical: space.xxxl }]}>
      <Icon name="CircleAlert" size={28} color={colors.danger} />
      <T variant="body" align="center" style={{ marginTop: space.md, maxWidth: 300 }}>
        {message}
      </T>
      {onRetry ? (
        <Tap onPress={onRetry} style={{ marginTop: space.lg }}>
          <T variant="smallStrong" gold>
            Try again
          </T>
        </Tap>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingHorizontal: space.lg,
      paddingBottom: space.md,
      backgroundColor: colors.bg,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: space.lg,
      paddingTop: space.xl,
    },
    card: {
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    sectionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: space.md,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      alignSelf: 'flex-start',
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    kv: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 7,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      paddingHorizontal: space.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: space.sm,
    },
    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: alpha(colors.gold, 0.1),
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: space.xl,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.goldDeep,
      backgroundColor: alpha(colors.gold, 0.06),
    },
  })
);
