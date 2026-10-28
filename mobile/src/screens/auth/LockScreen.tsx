import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T, Tap, confirm } from '../../components/ui';
import { Monogram } from '../../components/brand/Monogram';
import { PinPad } from '../../components/PinPad';
import { colors, gradients, space, themed } from '../../theme';
import { useAuth } from '../../auth/AuthContext';
import { biometryType, prefs } from '../../lib/storage';
import { MPIN_LENGTH, hasMpin } from '../../lib/mpin';

/**
 * App lock. With an MPIN: the PIN pad, plus a Face ID / fingerprint key when
 * biometric lock is also on (tried automatically once). Without one: the
 * biometric button only.
 */
export function LockScreen() {
  const insets = useSafeAreaInsets();
  const { unlock, unlockWithPin, signOut, user } = useAuth();
  const [kind, setKind] = useState<string | null>(null);
  const [usePin, setUsePin] = useState<boolean | null>(null);
  const [bioOn, setBioOn] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);

  const tryBiometrics = async () => {
    setFailed(null);
    const ok = await unlock();
    if (!ok) setFailed('Couldn’t verify — try again.');
  };

  useEffect(() => {
    (async () => {
      const [k, pinSet, bio] = await Promise.all([biometryType(), hasMpin(), prefs.get('biometricLock')]);
      setKind(k);
      setUsePin(pinSet);
      setBioOn(bio === '1');
      if (bio === '1') {
        const ok = await unlock();
        if (!ok && !pinSet) setFailed('Couldn’t verify — try again.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPin = async (next: string) => {
    setFailed(null);
    setPin(next);
    if (next.length < MPIN_LENGTH) return;
    setBusy(true);
    const r = await unlockWithPin(next);
    setBusy(false);
    if (!r.ok) {
      setPin('');
      setShake((n) => n + 1);
      setFailed(`Wrong MPIN. ${r.attemptsLeft} ${r.attemptsLeft === 1 ? 'try' : 'tries'} left.`);
    }
  };

  const forgot = async () => {
    const ok = await confirm({
      title: 'Forgot MPIN?',
      message: 'You’ll be signed out. Sign in again with your password, then set a new MPIN.',
      confirmText: 'Sign out',
    });
    if (ok) await signOut();
  };

  const face = kind === 'FaceID' || kind === 'Face';
  const bioLabel = face ? 'Face ID' : kind ? 'fingerprint' : 'passcode';
  const firstName = user?.name?.split(' ')[0];

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}
    >
      <LinearGradient colors={[...gradients.ink]} style={StyleSheet.absoluteFill} />
      <View style={{ alignItems: 'center', paddingHorizontal: space.xl }}>
        <Monogram size={usePin ? 72 : 96} />
        <T variant="h2" align="center" style={{ marginTop: space.lg }}>
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </T>
        <T
          variant="small"
          align="center"
          color={failed ? colors.danger : undefined}
          style={{ marginTop: space.xs, minHeight: 20 }}
        >
          {failed ?? (usePin ? 'Enter your MPIN' : ' ')}
        </T>
      </View>

      {usePin ? (
        <>
          <PinPad
            value={pin}
            onChange={onPin}
            shake={shake}
            disabled={busy}
            length={MPIN_LENGTH}
            extraKey={
              bioOn && kind
                ? {
                    icon: face ? 'ScanFace' : 'FingerprintPattern',
                    label: `Unlock with ${bioLabel}`,
                    onPress: tryBiometrics,
                  }
                : undefined
            }
          />
          <View style={styles.links}>
            <Tap onPress={forgot} hapticOnPress={false}>
              <T variant="smallStrong" gold>
                Forgot MPIN?
              </T>
            </Tap>
            <Tap onPress={signOut} hapticOnPress={false}>
              <T variant="small">Use another account</T>
            </Tap>
          </View>
        </>
      ) : usePin === false ? (
        <View style={{ paddingHorizontal: space.xl, alignSelf: 'stretch' }}>
          <Button
            title={`Unlock with ${bioLabel}`}
            icon={face ? 'ScanFace' : 'FingerprintPattern'}
            onPress={tryBiometrics}
            size="lg"
          />
          <Tap onPress={signOut} hapticOnPress={false} style={{ alignSelf: 'center', marginTop: space.lg }}>
            <T variant="small">Use a different account</T>
          </Tap>
        </View>
      ) : (
        <View />
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between', alignItems: 'center' },
    links: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: space.xxl,
    },
  })
);
