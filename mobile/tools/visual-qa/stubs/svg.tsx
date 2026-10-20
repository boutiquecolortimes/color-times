// Minimal react-native-svg for the browser harness: RN-web renders to the DOM,
// so each SVG primitive maps straight onto the real SVG element.
import React from 'react';
import { StyleSheet } from 'react-native';

type P = Record<string, unknown> & { children?: React.ReactNode };
const el = (tag: string) =>
  function SvgEl({ style, children, ...rest }: P) {
    const props: Record<string, unknown> = { ...rest };
    if (style) props.style = StyleSheet.flatten(style as never);
    for (const k of ['onPress', 'testID']) delete props[k];
    return React.createElement(tag, props, children);
  };

export default el('svg');
export const Svg = el('svg');
export const Path = el('path');
export const Circle = el('circle');
export const Ellipse = el('ellipse');
export const Rect = el('rect');
export const Line = el('line');
export const Polyline = el('polyline');
export const Polygon = el('polygon');
export const G = el('g');
export const Defs = el('defs');
export const LinearGradient = el('linearGradient');
export const RadialGradient = el('radialGradient');
export const Stop = el('stop');
export const ClipPath = el('clipPath');
export const Mask = el('mask');
export const Text = el('text');
export const TSpan = el('tspan');
