import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { fonts, gradients } from '../../theme';
import { reduceMotion } from '../../lib/motion';
import { BRAND } from '../../config';
import { LOGO_BADGE } from './Monogram';

/** Diameter of the logo badge; must match the native launch screens (160dp / 160pt). */
const BADGE = 160;
/** Length of the whole animation (one timeline, 0 → 1). */
const TIMELINE_MS = 2300;
/** The splash stays at least this long on a cold start, so the name always finishes. */
const MIN_VISIBLE_MS = 2600;

// Website sign-in page colours (app/(auth)/login/page.tsx).
const KICKER = '#D9B876';
const MUTED = '#C9A6B4';
const GOLD = '#C9A45C';

// "Color Times Boutique" → "Color Times" written large, "BOUTIQUE" spaced beneath.
const NAME = BRAND.name;
const SUFFIX = BRAND.fullName.replace(NAME, '').trim().toUpperCase() || 'BOUTIQUE';

/** Timeline windows, as fractions of TIMELINE_MS. */
const T = {
  lift: [0.06, 0.38],
  halo: [0.08, 0.62],
  name: [0.22, 0.66], // letters of "Color Times", one after another
  suffix: [0.58, 0.8], // letters of "BOUTIQUE"
  rule: [0.74, 0.9],
  tagline: [0.84, 1],
} as const;

let playedThisLaunch = false;

/**
 * Launch animation, drawn over the app until it's ready. It opens on exactly
 * the native launch screen (logo badge centred on deep wine). The badge lifts
 * and a gold halo breathes out, then the name writes itself in: "Color Times"
 * letter by letter, "BOUTIQUE" spreading in gold beneath, a gold rule drawing
 * across, and "Wear the Moment". Plays once per launch; under Reduce Motion
 * everything is simply shown.
 */
export function BrandSplash({ ready }: { ready: boolean }) {
  const [done, setDone] = useState(playedThisLaunch);
  const [minElapsed, setMinElapsed] = useState(false);
  const { height } = useWindowDimensions();
  const still = reduceMotion();

  const t = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setMinElapsed(true), still ? 600 : MIN_VISIBLE_MS);
    if (still) t.setValue(1);
    else
      Animated.timing(t, {
        toValue: 1,
        duration: TIMELINE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    return () => clearTimeout(timer);
  }, [done, still, t]);

  useEffect(() => {
    if (done || !ready || !minElapsed) return;
    Animated.timing(exit, {
      toValue: 0,
      duration: still ? 150 : 420,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      playedThisLaunch = true;
      setDone(true);
    });
  }, [done, ready, minElapsed, still, exit]);

  if (done) return null;

  /** 0 → 1 across a window of the timeline, with an ease-out. */
  const seg = ([a, b]: readonly [number, number], easing = Easing.out(Easing.cubic)) =>
    t.interpolate({ inputRange: [0, a, b, 1], outputRange: [0, 0, 1, 1], easing, extrapolate: 'clamp' });

  const lift = seg(T.lift, Easing.bezier(0.2, 0.8, 0.2, 1));
  const halo = seg(T.halo);
  const rise = Math.min(64, height * 0.08);

  return (
    <Animated.View
      pointerEvents={ready && minElapsed ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.root, { opacity: exit }]}
      accessible
      accessibilityLabel={`${BRAND.fullName}. ${BRAND.tagline}`}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[...gradients.wine]}
        locations={[0, 0.6, 1]}
        start={{ x: 0.45, y: 0 }}
        end={{ x: 0.55, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft gold light from the top, like the website's sign-in backdrop. */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="0%" r="70%">
            <Stop offset="0" stopColor={GOLD} stopOpacity="0.16" />
            <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#glow)" />
      </Svg>

      <View style={styles.center}>
        <Animated.View
          style={{
            alignItems: 'center',
            transform: [
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }) },
            ],
          }}
        >
          {/* Gold halo that breathes out once behind the badge. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                opacity: halo.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] }),
                transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
              },
            ]}
          />
          <View style={styles.badge}>
            <Animated.Image source={LOGO_BADGE} style={{ width: BADGE, height: BADGE }} />
          </View>
        </Animated.View>

        <View
          style={[styles.words, { marginTop: (BADGE * 0.8) / 2 - rise + 30 }]}
          importantForAccessibility="no-hide-descendants"
        >
          <Letters text={NAME} window={T.name} t={t} style={styles.name} rise={14} />
          <Letters text={SUFFIX} window={T.suffix} t={t} style={styles.suffix} rise={0} spread />
          <Animated.View
            style={[
              styles.rule,
              {
                opacity: seg(T.rule),
                transform: [{ scaleX: seg(T.rule) }],
              },
            ]}
          />
          <Animated.Text
            maxFontSizeMultiplier={1.3}
            style={[
              styles.tagline,
              {
                opacity: seg(T.tagline),
                transform: [
                  { translateY: seg(T.tagline).interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                ],
              },
            ]}
          >
            {BRAND.tagline.toUpperCase()}
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * Writes `text` in one letter at a time across `window` of the timeline: each
 * letter fades up from `rise` px (or, with `spread`, drifts in from the centre
 * so the word opens outwards).
 */
function Letters({
  text,
  window: [from, to],
  t,
  style,
  rise,
  spread,
}: {
  text: string;
  window: readonly [number, number];
  t: Animated.Value;
  style: object;
  rise: number;
  spread?: boolean;
}) {
  const chars = Array.from(text);
  const n = chars.length;
  const step = (to - from) / Math.max(n, 1);
  const each = Math.min(step * 3, to - from); // letters overlap, so the writing flows
  return (
    // Letter-spacing trails each glyph; pad the start by the same amount so the word stays centred.
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        paddingLeft: (style as { letterSpacing?: number }).letterSpacing ?? 0,
      }}
    >
      {chars.map((ch, i) => {
        const a = Math.min(from + i * step, to - each);
        const b = a + each;
        const p = t.interpolate({
          inputRange: [0, a, b, 1],
          outputRange: [0, 0, 1, 1],
          easing: Easing.out(Easing.cubic),
          extrapolate: 'clamp',
        });
        const offset = spread ? (i - (n - 1) / 2) * -6 : 0;
        return (
          <Animated.Text
            key={`${ch}-${i}`}
            maxFontSizeMultiplier={1.3}
            style={[
              style,
              {
                opacity: p,
                transform: [
                  { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) },
                  { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
                ],
              },
            ]}
          >
            {ch === ' ' ? ' ' : ch}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    boxShadow: '0 10px 32px rgba(0,0,0,0.35)',
  },
  halo: {
    position: 'absolute',
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  words: { position: 'absolute', left: 0, right: 0, top: '50%', alignItems: 'center' },
  name: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 46,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  suffix: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: KICKER,
    letterSpacing: 7,
    marginTop: 2,
  },
  rule: {
    width: 56,
    height: 1,
    marginTop: 14,
    marginBottom: 12,
    backgroundColor: GOLD,
    opacity: 0.85,
  },
  tagline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 3.4,
    color: MUTED,
    textAlign: 'center',
  },
});
