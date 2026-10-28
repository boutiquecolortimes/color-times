import React from 'react';
import { Platform, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, type as typeScale } from '../../theme';

type Variant =
  | 'hero'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'smallStrong'
  | 'caption'
  | 'overline'
  | 'number';

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  align?: TextStyle['textAlign'];
  muted?: boolean;
  gold?: boolean;
}

export function T({ variant = 'body', color, align, muted, gold, style, ...rest }: Props) {
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        typeScale[variant],
        ANDROID_TRIM,
        muted && { color: colors.textMuted },
        gold && { color: colors.gold },
        color ? { color } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

// Android adds extra top/bottom padding to every line (worst with Cormorant's tall
// ascenders), which makes headings sit low and buttons look off-centre. iOS doesn't.
const ANDROID_TRIM: TextStyle | null = Platform.OS === 'android' ? { includeFontPadding: false } : null;
