import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T, Tap } from '../../components/ui';
import { Monogram } from '../../components/brand/Monogram';
import { colors, gradients, space, themed } from '../../theme';
import { useAuth } from '../../auth/AuthContext';
import { biometryType } from '../../lib/storage';

export function LockScreen() {
  const insets = useSafeAreaInsets();
  const { unlock, signOut, user } = useAuth();
  const [kind, setKind] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const attempt = async () => {
    setFailed(false);
    const ok = await unlock();
    if (!ok) setFailed(true);
  };

  useEffect(() => {
    biometryType().then(setKind);
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = kind === 'FaceID' || kind === 'Face' ? 'Face ID' : kind ? 'fingerprint' : 'passcode';

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space.xl }]}>
      <LinearGradient colors={[...gradients.ink]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Monogram size={96} />
        <T variant="h1" style={{ marginTop: space.xl }}>
          Welcome back
        </T>
        <T variant="body" muted style={{ marginTop: space.xs }}>
          {user?.name}
        </T>
        {failed ? (
          <T variant="small" color={colors.danger} style={{ marginTop: space.lg }}>
            Couldn’t verify — try again.
          </T>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: space.xl }}>
        <Button
          title={`Unlock with ${label}`}
          icon={kind === 'FaceID' ? 'ScanFace' : 'FingerprintPattern'}
          onPress={attempt}
          size="lg"
        />
        <Tap onPress={signOut} hapticOnPress={false} style={{ alignSelf: 'center', marginTop: space.lg }}>
          <T variant="small">Use a different account</T>
        </Tap>
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
  })
);
