import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../../theme';
import { IconButton } from './Button';
import { T } from './Text';
import { imageUrl } from './Media';

const { width, height } = Dimensions.get('window');

/** Full-screen, swipeable photo viewer — pinch or double-tap to zoom on iOS and Android. */
export function ImageViewer({
  images,
  index,
  onClose,
  actions,
}: {
  images: string[];
  index: number | null;
  onClose: () => void;
  actions?: (src: string, i: number) => React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(index ?? 0);
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    if (index !== null) {
      setPage(index);
      setZoomed(false);
    }
  }, [index]);
  if (index === null) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.viewer }}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(s, i) => `${s}-${i}`}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) =>
            Platform.OS === 'ios' ? (
              <ScrollView
                style={{ width, height }}
                contentContainerStyle={{ width, height, alignItems: 'center', justifyContent: 'center' }}
                maximumZoomScale={4}
                minimumZoomScale={1}
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={{ uri: imageUrl(item) ?? undefined }}
                  style={{ width, height: height * 0.8 }}
                  resizeMode="contain"
                />
              </ScrollView>
            ) : (
              <ZoomableImage uri={imageUrl(item) ?? undefined} onZoomChange={setZoomed} />
            )
          }
        />
        <View style={[styles.top, { top: insets.top + space.sm }]}>
          <IconButton icon="X" onPress={onClose} accessibilityLabel="Close" />
          <T variant="smallStrong" color={colors.text}>
            {page + 1} / {images.length}
          </T>
        </View>
        {actions ? (
          <View style={[styles.bottom, { bottom: insets.bottom + space.lg }]}>
            {actions(images[page], page)}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * Android has no zooming ScrollView, so pinch / double-tap / pan are handled
 * here with a PanResponder (1×–4×). While zoomed the pager is locked so a pan
 * moves the photo instead of changing page.
 */
function ZoomableImage({ uri, onZoomChange }: { uri?: string; onZoomChange: (zoomed: boolean) => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const st = useRef({ scale: 1, x: 0, y: 0, startDist: 0, startScale: 1, lastTap: 0 }).current;

  const apply = (next: { scale: number; x: number; y: number }, animate = false) => {
    const sc = Math.min(4, Math.max(1, next.scale));
    const maxX = ((sc - 1) * width) / 2;
    const maxY = ((sc - 1) * height * 0.8) / 2;
    st.scale = sc;
    st.x = sc === 1 ? 0 : Math.max(-maxX, Math.min(maxX, next.x));
    st.y = sc === 1 ? 0 : Math.max(-maxY, Math.min(maxY, next.y));
    if (animate) {
      Animated.parallel([
        Animated.spring(scale, { toValue: st.scale, useNativeDriver: true, friction: 7 }),
        Animated.spring(tx, { toValue: st.x, useNativeDriver: true, friction: 7 }),
        Animated.spring(ty, { toValue: st.y, useNativeDriver: true, friction: 7 }),
      ]).start();
    } else {
      scale.setValue(st.scale);
      tx.setValue(st.x);
      ty.setValue(st.y);
    }
    onZoomChange(st.scale > 1.01);
  };

  const dist = (t: ReadonlyArray<{ pageX: number; pageY: number }>) =>
    Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2 || st.scale > 1.01,
      onMoveShouldSetPanResponder: (e, g) =>
        e.nativeEvent.touches.length === 2 || (st.scale > 1.01 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2)),
      onPanResponderGrant: (e) => {
        const t = e.nativeEvent.touches;
        if (t.length === 2) {
          st.startDist = dist(t);
          st.startScale = st.scale;
        }
      },
      onPanResponderMove: (e, g) => {
        const t = e.nativeEvent.touches;
        if (t.length === 2) {
          if (!st.startDist) {
            st.startDist = dist(t);
            st.startScale = st.scale;
          }
          apply({ scale: (st.startScale * dist(t)) / st.startDist, x: st.x, y: st.y });
        } else if (st.scale > 1.01) {
          scale.setValue(st.scale);
          tx.setValue(
            Math.max(-((st.scale - 1) * width) / 2, Math.min(((st.scale - 1) * width) / 2, st.x + g.dx))
          );
          ty.setValue(
            Math.max(
              -((st.scale - 1) * height * 0.8) / 2,
              Math.min(((st.scale - 1) * height * 0.8) / 2, st.y + g.dy)
            )
          );
        }
      },
      onPanResponderRelease: (_, g) => {
        if (st.startDist) {
          st.startDist = 0;
          apply({ scale: st.scale, x: st.x, y: st.y }, true);
        } else if (st.scale > 1.01) {
          apply({ scale: st.scale, x: st.x + g.dx, y: st.y + g.dy });
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  // Double tap: zoom to 2.5× / back to fit.
  const onTouchEnd = (e: { nativeEvent: { touches: ReadonlyArray<unknown> } }) => {
    if (e.nativeEvent.touches.length) return;
    const now = Date.now();
    if (now - st.lastTap < 260) {
      apply({ scale: st.scale > 1.01 ? 1 : 2.5, x: 0, y: 0 }, true);
      st.lastTap = 0;
    } else st.lastTap = now;
  };

  return (
    <View
      style={{ width, height, alignItems: 'center', justifyContent: 'center' }}
      onTouchEnd={onTouchEnd}
      {...pan.panHandlers}
    >
      <Animated.Image
        source={{ uri }}
        style={{
          width,
          height: height * 0.8,
          transform: [{ translateX: tx }, { translateY: ty }, { scale }],
        }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottom: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
  },
});
