import React, { useEffect, useState } from 'react';
import { Modal, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PinPad } from './PinPad';
import { Monogram } from './brand/Monogram';
import { Button, T, toast } from './ui';
import { colors, currentScheme, space } from '../theme';
import { MPIN_LENGTH, setMpin, verifyMpin, weakPin } from '../lib/mpin';
import { haptic } from '../lib/haptics';

type Step = 'current' | 'new' | 'confirm';

const TITLES: Record<Step, string> = {
  current: 'Enter current MPIN',
  new: 'Create your MPIN',
  confirm: 'Confirm your MPIN',
};

/**
 * Full-screen MPIN setup. "create" asks for a new PIN twice; "change" first
 * checks the current one. `offer` adds a "Not now" for the one-time prompt
 * after signing in with a password.
 */
export function MpinSetup({
  visible,
  mode,
  offer,
  onDone,
  onCancel,
}: {
  visible: boolean;
  mode: 'create' | 'change';
  offer?: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(mode === 'change' ? 'current' : 'new');
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStep(mode === 'change' ? 'current' : 'new');
    setPin('');
    setFirst('');
    setNote(null);
  }, [visible, mode]);

  const fail = (message: string, back?: Step) => {
    setNote(message);
    setShake((n) => n + 1);
    setPin('');
    if (back) setStep(back);
  };

  const onChange = async (next: string) => {
    setNote(null);
    setPin(next);
    if (next.length < MPIN_LENGTH) return;
    if (step === 'current') {
      setBusy(true);
      const r = await verifyMpin(next);
      setBusy(false);
      if (r.ok) {
        setStep('new');
        setPin('');
      } else if (r.attemptsLeft === 0) {
        onCancel();
      } else fail(`Wrong MPIN. ${r.attemptsLeft} ${r.attemptsLeft === 1 ? 'try' : 'tries'} left.`);
      return;
    }
    if (step === 'new') {
      if (weakPin(next)) return fail('Too easy to guess. Avoid repeats and runs like 1234.');
      setFirst(next);
      setStep('confirm');
      setPin('');
      return;
    }
    if (next !== first) return fail("PINs didn't match. Try again.", 'new');
    setBusy(true);
    try {
      await setMpin(next);
      haptic('success');
      toast.success(mode === 'change' ? 'MPIN changed' : 'MPIN set', 'Use it to open Color Times');
      onDone();
    } catch {
      fail('Couldn’t save the MPIN. Try again.', 'new');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <StatusBar barStyle={currentScheme() === 'dark' ? 'light-content' : 'dark-content'} />
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.lg,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ alignItems: 'center', paddingHorizontal: space.xl }}>
          <Monogram size={64} />
          <T variant="h2" align="center" style={{ marginTop: space.lg }}>
            {TITLES[step]}
          </T>
          <T
            variant="small"
            align="center"
            color={note ? colors.danger : undefined}
            style={{ marginTop: space.xs, minHeight: 36 }}
          >
            {note ?? (step === 'new' ? `${MPIN_LENGTH} digits to open the app quickly` : ' ')}
          </T>
        </View>

        <PinPad value={pin} onChange={onChange} shake={shake} disabled={busy} length={MPIN_LENGTH} />

        <Button title={offer ? 'Not now' : 'Cancel'} variant="ghost" onPress={onCancel} />
      </View>
    </Modal>
  );
}
