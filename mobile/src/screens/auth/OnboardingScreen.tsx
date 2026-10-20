import React, { useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Button, T, Tap } from '../../components/ui';
import { ArchArt, Monogram } from '../../components/brand/Monogram';
import { colors, gradients, space, themed } from '../../theme';
import { useAuth } from '../../auth/AuthContext';
import { useNav } from '../../navigation/nav';
import { haptic } from '../../lib/haptics';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    kicker: 'Color Times Boutique',
    title: 'Couture,\non loan.',
    body: 'Bridal lehengas, festive gowns and designer pieces — worn once, remembered forever.',
  },
  {
    kicker: 'Reserve in a tap',
    title: 'Your date.\nYour dress.',
    body: 'Check availability for your event, request a fitting and follow every booking from pickup to return.',
  },
  {
    kicker: 'Color Times Privé',
    title: 'First look,\nalways.',
    body: 'Members see new arrivals a week early and get priority from our atelier.',
  },
];

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const { finishOnboarding } = useAuth();
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList>(null);

  const go = async (route: 'Register' | 'Login') => {
    haptic('success');
    await finishOnboarding();
    nav.navigate(route);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[gradients.ink[0], colors.bg, colors.bg]} style={StyleSheet.absoluteFill} />
      <View style={[styles.top, { paddingTop: insets.top + space.md }]}>
        <Monogram size={44} />
        <Tap onPress={() => go('Login')} hapticOnPress={false}>
          <T variant="smallStrong" gold>
            Sign in
          </T>
        </Tap>
      </View>

      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.kicker}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / width);
          if (next !== index) haptic('select');
          setIndex(next);
        }}
        renderItem={({ item, index: i }) => {
          const range = [(i - 1) * width, i * width, (i + 1) * width];
          const artY = scrollX.interpolate({
            inputRange: range,
            outputRange: [40, 0, 40],
            extrapolate: 'clamp',
          });
          const fade = scrollX.interpolate({
            inputRange: range,
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          });
          return (
            <View style={{ width, paddingHorizontal: space.xxl }}>
              <Animated.View
                style={{
                  alignItems: 'center',
                  marginTop: space.xl,
                  opacity: fade,
                  transform: [{ translateY: artY }],
                }}
              >
                <ArchArt variant={i} size={width * 0.62} />
              </Animated.View>
              <Animated.View style={{ opacity: fade, marginTop: space.xxl }}>
                <T variant="caption" gold>
                  {item.kicker}
                </T>
                <T variant="hero" style={{ marginTop: space.sm }}>
                  {item.title}
                </T>
                <T variant="body" muted style={{ marginTop: space.md, maxWidth: 340 }}>
                  {item.body}
                </T>
              </Animated.View>
            </View>
          );
        }}
      />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const w = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [6, 22, 6],
              extrapolate: 'clamp',
            });
            const o = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });
            return <Animated.View key={i} style={[styles.dot, { width: w, opacity: o }]} />;
          })}
        </View>
        {index < SLIDES.length - 1 ? (
          <Button
            title="Continue"
            icon="ArrowRight"
            onPress={() =>
              listRef.current?.scrollToIndex({
                index: index + 1,
                animated: true,
              })
            }
          />
        ) : (
          <Button title="Create your account" onPress={() => go('Register')} />
        )}
        <Tap
          onPress={() => go('Login')}
          hapticOnPress={false}
          style={{ alignSelf: 'center', marginTop: space.lg }}
        >
          <T variant="small">
            Already with us?{' '}
            <T variant="smallStrong" gold>
              Sign in
            </T>
          </T>
        </Tap>
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    top: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: space.xl,
    },
    bottom: { paddingHorizontal: space.xl },
    dots: { flexDirection: 'row', gap: 6, marginBottom: space.xl },
    dot: { height: 6, borderRadius: 3, backgroundColor: colors.gold },
  })
);
