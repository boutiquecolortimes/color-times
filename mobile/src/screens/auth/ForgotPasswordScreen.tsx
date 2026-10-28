import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Input, T, Tap, toast } from '../../components/ui';
import { colors, space } from '../../theme';
import { useAuth } from '../../auth/AuthContext';
import { useNav, useParams } from '../../navigation/nav';
import { api, errorMessage } from '../../api/client';
import { passwordIssues } from '../../lib/password';
import { AuthShell } from './LoginScreen';

const RESEND_SECONDS = 60;

/**
 * Forgot password, in two steps on one screen: email a 6-digit code
 * (POST /api/auth/forgot-password), then enter it with a new password
 * (POST /api/auth/reset-password). On success the user is signed straight in.
 */
export function ForgotPasswordScreen() {
  const nav = useNav();
  const { signIn } = useAuth();
  const params = useParams<{ email: string }>();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const cleanEmail = email.trim().toLowerCase();
  const pwIssue = passwordIssues(password);

  const sendCode = async () => {
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/forgot-password', { email: cleanEmail });
      setStep('reset');
      setWait(RESEND_SECONDS);
      setCode('');
      toast.success('Code sent', `Check ${cleanEmail}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setTouched(true);
    if (!/^\d{6}$/.test(code) || pwIssue) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/reset-password', { email: cleanEmail, code, password });
      toast.success('Password changed');
      await signIn(cleanEmail, password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'email') {
    return (
      <AuthShell title="Forgot password" back>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          icon="Mail"
          returnKeyType="send"
          onSubmitEditing={sendCode}
        />
        {error ? <ErrorText text={error} /> : null}
        <Button title="Send code" onPress={sendCode} loading={busy} size="lg" />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset password" back>
      <T variant="small" align="center" style={{ marginBottom: space.lg }}>
        Code sent to <T variant="smallStrong">{cleanEmail}</T>
      </T>
      <Input
        label="6-digit code"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        maxLength={6}
        icon="KeyRound"
        error={touched && !/^\d{6}$/.test(code) ? 'Enter the 6-digit code' : undefined}
      />
      <Input
        label="New password"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="new-password"
        icon="Lock"
        hint={password ? pwIssue ?? 'Strong ✓' : '8+ chars, A–Z, 0–9'}
        error={touched && pwIssue ? pwIssue : undefined}
        returnKeyType="go"
        onSubmitEditing={reset}
      />
      {error ? <ErrorText text={error} /> : null}
      <Button title="Reset password" onPress={reset} loading={busy} size="lg" />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg }}>
        <Tap onPress={() => setStep('email')} hapticOnPress={false}>
          <T variant="small">Change email</T>
        </Tap>
        <Tap onPress={sendCode} disabled={wait > 0 || busy} hapticOnPress={false}>
          <T variant="smallStrong" gold={wait <= 0} color={wait > 0 ? colors.textFaint : undefined}>
            {wait > 0 ? `Resend in ${wait}s` : 'Resend code'}
          </T>
        </Tap>
      </View>
      <Tap
        onPress={() => nav.goBack()}
        hapticOnPress={false}
        style={{ alignSelf: 'center', marginTop: space.lg }}
      >
        <T variant="small">Back to sign in</T>
      </Tap>
    </AuthShell>
  );
}

function ErrorText({ text }: { text: string }) {
  return (
    <T variant="small" color={colors.danger} style={{ marginBottom: space.md }}>
      {text}
    </T>
  );
}
