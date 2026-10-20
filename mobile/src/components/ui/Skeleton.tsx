import React, { createContext, useContext, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { alpha, colors, radius, space, themed } from '../../theme';
import { reduceMotion } from '../../lib/motion';

/**
 * Shimmering placeholders shown while content loads — a soft gold-tinted
 * sheen sweeping across ink blocks, in place of a bare spinner. One clock
 * drives every block on screen so they shimmer in unison.
 */
const Clock = createContext<Animated.Value | null>(null);

function useClock() {
  const own = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(own, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    if (!reduceMotion()) loop.start();
    return () => loop.stop();
  }, [own]);
  return own;
}

/** Wrap a group of blocks so they share one shimmer. */
export function SkeletonGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const clock = useClock();
  return (
    <Clock.Provider value={clock}>
      <View style={style} accessibilityLabel="Loading" accessibilityRole="progressbar">
        {children}
      </View>
    </Clock.Provider>
  );
}

export function Bone({
  width = '100%',
  height = 14,
  round = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const shared = useContext(Clock);
  const fallback = useRef(new Animated.Value(0)).current;
  const clock = shared ?? fallback;
  const translateX = clock.interpolate({ inputRange: [0, 1], outputRange: [-220, 420] });
  return (
    <View style={[styles.bone, { width, height, borderRadius: round }, style]}>
      <Animated.View style={[styles.sheen, { transform: [{ translateX }, { skewX: '-18deg' }] }]}>
        <LinearGradient
          colors={[alpha(colors.gold, 0), colors.sheen, alpha(colors.gold, 0)]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

/** List rows: thumbnail + two lines + trailing amount. */
export function ListSkeleton({
  rows = 7,
  thumb = true,
  inset = false,
}: {
  rows?: number;
  thumb?: boolean;
  /** Add the page gutter (when not already inside a padded screen). */
  inset?: boolean;
}) {
  return (
    <SkeletonGroup style={inset ? { paddingHorizontal: space.lg } : undefined}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          {thumb ? <Bone width={46} height={58} round={radius.sm} /> : null}
          <View style={{ flex: 1, gap: 8 }}>
            <Bone width={`${70 - (i % 3) * 12}%`} height={14} />
            <Bone width={`${45 + (i % 2) * 15}%`} height={11} />
          </View>
          <Bone width={56} height={16} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Two-column product tiles. */
export function GridSkeleton({
  tiles = 6,
  ratio = 1.3,
  inset = false,
}: {
  tiles?: number;
  ratio?: number;
  inset?: boolean;
}) {
  return (
    <SkeletonGroup style={[styles.grid, inset && { paddingHorizontal: space.lg }]}>
      {Array.from({ length: tiles }, (_, i) => (
        <View key={i} style={styles.tile}>
          <View style={{ aspectRatio: 1 / ratio }}>
            <Bone height="100%" round={radius.lg} />
          </View>
          <Bone width="80%" height={13} style={{ marginTop: space.sm }} />
          <Bone width="45%" height={11} style={{ marginTop: 6 }} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Detail page: hero block, title, a few key/value cards. */
export function DetailSkeleton({ hero = false, inset = false }: { hero?: boolean; inset?: boolean }) {
  return (
    <SkeletonGroup style={[{ gap: space.lg }, inset && { paddingHorizontal: space.lg }]}>
      {hero ? <Bone height={320} round={radius.xl} /> : null}
      <View style={{ gap: 10 }}>
        <Bone width="35%" height={11} />
        <Bone width="75%" height={26} />
        <Bone width="50%" height={13} />
      </View>
      {[0, 1].map((c) => (
        <View key={c} style={styles.card}>
          {[0, 1, 2, 3].map((r) => (
            <View key={r} style={styles.kv}>
              <Bone width="32%" height={12} />
              <Bone width={`${22 + ((r + c) % 3) * 8}%`} height={12} />
            </View>
          ))}
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Dashboard-style stat tiles. */
export function StatsSkeleton({ tiles = 4, inset = false }: { tiles?: number; inset?: boolean }) {
  return (
    <SkeletonGroup style={[styles.grid, inset && { paddingHorizontal: space.lg }]}>
      {Array.from({ length: tiles }, (_, i) => (
        <View key={i} style={[styles.tile, styles.card, { gap: 10 }]}>
          <Bone width="55%" height={11} />
          <Bone width="70%" height={24} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    bone: { backgroundColor: colors.surface, overflow: 'hidden' },
    sheen: { position: 'absolute', top: 0, bottom: 0, width: 160 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
    tile: { width: '47.5%', flexGrow: 1 },
    card: {
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: space.lg,
      gap: space.md,
    },
    kv: { flexDirection: 'row', justifyContent: 'space-between' },
  })
);
