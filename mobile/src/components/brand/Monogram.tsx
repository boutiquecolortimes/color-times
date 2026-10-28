import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '../../theme';

/** The website's logo (public/logo.png), framed in a white circle like its sign-in badge. */
export const LOGO_BADGE = require('../../assets/brand/logo-badge.png');
/** The website's transparent navbar mark (public/logo-icon.png). */
export const LOGO_MARK = require('../../assets/brand/logo-mark.png');

/**
 * The Color Times logo - the CT monogram with the gown - on its white badge,
 * exactly as colortimesboutique.com shows it on the sign-in page. The badge
 * keeps the purple / pink artwork legible in both themes and over photos.
 * `onImage` is kept for call sites over photographs (adds a deeper shadow).
 */
export function Monogram({ size = 96, onImage = false }: { size?: number; onImage?: boolean }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Color Times Boutique"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        boxShadow: `0 ${Math.round(size / 16)}px ${Math.round(size / 5)}px rgba(10,2,7,${
          onImage ? 0.4 : 0.22
        })`,
      }}
    >
      <Image source={LOGO_BADGE} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

/** Decorative arch with a hanging gown silhouette, used on onboarding. */
export function ArchArt({ variant = 0, size = 280 }: { variant?: number; size?: number }) {
  const gown =
    variant === 1
      ? 'M100 70 C92 70 88 78 88 86 L80 96 C76 120 66 150 52 200 L148 200 C134 150 124 120 120 96 L112 86 C112 78 108 70 100 70 Z'
      : variant === 2
      ? 'M100 66 L90 78 L84 96 C80 118 72 140 60 200 L140 200 C128 140 120 118 116 96 L110 78 Z'
      : 'M100 68 C94 68 90 74 90 82 L84 94 C78 116 62 160 44 200 L156 200 C138 160 122 116 116 94 L110 82 C110 74 106 68 100 68 Z';
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 200 220">
      <Defs>
        <LinearGradient id="arch" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.surfaceHigh} />
          <Stop offset="1" stopColor={colors.bgElevated} />
        </LinearGradient>
        <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.goldBright} />
          <Stop offset="1" stopColor={colors.goldDeep} />
        </LinearGradient>
        <LinearGradient id="gown" x1="0" y1="0" x2="0" y2="1">
          <Stop
            offset="0"
            // Gown colours are artwork (fabric), deliberately the same in both themes.
            stopColor={variant === 1 ? '#C98A7A' : variant === 2 ? '#C9A35C' : '#8E3B46'}
            stopOpacity="0.95"
          />
          <Stop
            offset="1"
            stopColor={variant === 1 ? '#6E4038' : variant === 2 ? '#6B5228' : '#3E1820'}
            stopOpacity="0.95"
          />
        </LinearGradient>
      </Defs>
      <Path
        d="M20 220 L20 90 A80 80 0 0 1 180 90 L180 220 Z"
        fill="url(#arch)"
        stroke="url(#gold)"
        strokeWidth="1"
      />
      <Path
        d="M30 220 L30 92 A70 70 0 0 1 170 92 L170 220"
        fill="none"
        stroke={colors.goldDeep}
        strokeWidth="0.5"
        opacity={0.6}
      />
      <Path
        d="M100 40 L100 62 M92 66 Q100 56 108 66"
        stroke="url(#gold)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <Path d={gown} fill="url(#gown)" />
      <Path d="M70 200 Q100 190 130 200" stroke="url(#gold)" strokeWidth="0.8" fill="none" opacity={0.8} />
    </Svg>
  );
}
