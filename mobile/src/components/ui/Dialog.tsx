import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { colors, radius, space, themed } from '../../theme';
import { T } from './Text';
import { Button } from './Button';
import { haptic } from '../../lib/haptics';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

let open: ((opts: ConfirmOptions, resolve: (ok: boolean) => void) => void) | null = null;

/** `if (await confirm({ title: 'Delete?' })) …` — a styled replacement for Alert.alert. */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!open) return resolve(false);
    if (opts.destructive) haptic('warning');
    open(opts, resolve);
  });
}

export function DialogHost() {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);

  useEffect(() => {
    open = (opts, resolve) => setState({ opts, resolve });
    return () => {
      open = null;
    };
  }, []);

  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  return (
    <Modal
      transparent
      visible={Boolean(state)}
      animationType="fade"
      onRequestClose={() => close(false)}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {state ? (
          <View style={styles.box}>
            <T variant="h2" align="center">
              {state.opts.title}
            </T>
            {state.opts.message ? (
              <T variant="body" muted align="center" style={{ marginTop: space.sm }}>
                {state.opts.message}
              </T>
            ) : null}
            <View style={{ gap: space.sm, marginTop: space.xl }}>
              <Button
                title={state.opts.confirmText ?? 'Confirm'}
                variant={state.opts.destructive ? 'danger' : 'gold'}
                onPress={() => close(true)}
              />
              <Button
                title={state.opts.cancelText ?? 'Cancel'}
                variant="ghost"
                onPress={() => close(false)}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: space.xl,
    },
    box: {
      backgroundColor: colors.bgElevated,
      borderRadius: radius.xl,
      padding: space.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
  })
);
