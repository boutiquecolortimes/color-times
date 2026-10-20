import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, themed } from '../../theme';
import { T } from './Text';
import { IconButton } from './Button';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Fraction of screen height the sheet may grow to. */
  maxHeight?: number;
  scroll?: boolean;
}

/** Bottom sheet with a dimmed backdrop and a soft spring entrance. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeight = 0.88,
  scroll = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translate = useRef(new Animated.Value(600)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translate, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 220,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translate, {
          toValue: 600,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible, mounted, translate, fade]);

  if (!mounted) return null;

  const Body = scroll ? ScrollView : View;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: fade }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              {
                maxHeight: Dimensions.get('window').height * maxHeight,
                transform: [{ translateY: translate }],
              },
            ]}
          >
            <View style={styles.grabber} />
            {title ? (
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <T variant="h2">{title}</T>
                  {subtitle ? <T variant="small">{subtitle}</T> : null}
                </View>
                <IconButton icon="X" onPress={onClose} size={36} accessibilityLabel="Close" />
              </View>
            ) : null}
            <Body
              {...(scroll
                ? {
                    keyboardShouldPersistTaps: 'handled' as const,
                    showsVerticalScrollIndicator: false,
                  }
                : {})}
              style={scroll ? undefined : { flexShrink: 1 }}
              contentContainerStyle={
                scroll
                  ? {
                      paddingHorizontal: space.lg,
                      paddingBottom: footer ? space.md : insets.bottom + space.lg,
                    }
                  : undefined
              }
            >
              {scroll ? (
                children
              ) : (
                <View style={{ paddingHorizontal: space.lg, flexShrink: 1 }}>{children}</View>
              )}
            </Body>
            {footer ? (
              <View
                style={{
                  paddingHorizontal: space.lg,
                  paddingTop: space.sm,
                  paddingBottom: insets.bottom + space.md,
                }}
              >
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    sheet: {
      backgroundColor: colors.bgElevated,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      paddingTop: space.sm,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      marginBottom: space.sm,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: space.lg,
      paddingBottom: space.md,
      gap: space.md,
    },
  })
);
