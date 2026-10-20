import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, T, Tap } from '../../components/ui';
import { colors, space } from '../../theme';
import { useAuth } from '../../auth/AuthContext';
import { useNav } from '../../navigation/nav';
import { errorMessage } from '../../api/client';
import { AuthShell } from './LoginScreen';

function passwordIssues(password: string): string | null {
  if (password.length < 8) return 'At least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Add an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Add a number';
  return null;
}

export function RegisterScreen() {
  const nav = useNav();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const pwIssue = passwordIssues(password);
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneError =
    phoneDigits && !/^[6-9]\d{9}$/.test(phoneDigits) ? 'Enter a valid 10-digit mobile number' : undefined;

  const submit = async () => {
    setTouched(true);
    if (name.trim().length < 2 || !email.includes('@') || pwIssue || phoneError) return;
    setBusy(true);
    setError(null);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phoneDigits || undefined,
        password,
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell kicker="Join Color Times" title="Create account" back>
      <Input
        label="Full name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        icon="Users"
        error={touched && name.trim().length < 2 ? 'Enter your name' : undefined}
      />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        icon="Mail"
        error={touched && !email.includes('@') ? 'Enter a valid email' : undefined}
      />
      <Input
        label="Mobile"
        hint="Optional"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        icon="Phone"
        prefix="+91"
        error={touched ? phoneError : undefined}
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="new-password"
        icon="Lock"
        hint={password ? pwIssue ?? 'Strong ✓' : '8+ chars, A–Z, 0–9'}
        error={touched && pwIssue ? pwIssue : undefined}
      />
      {error ? (
        <T variant="small" color={colors.danger} style={{ marginBottom: space.md }}>
          {error}
        </T>
      ) : null}
      <Button title="Create account" onPress={submit} loading={busy} size="lg" />
      <View style={{ alignItems: 'center', marginTop: space.xl }}>
        <Tap onPress={() => nav.navigate('Login')} hapticOnPress={false}>
          <T variant="small">
            Have an account?{' '}
            <T variant="smallStrong" gold>
              Sign in
            </T>
          </T>
        </Tap>
      </View>
      <T variant="small" align="center" color={colors.textFaint} style={{ marginTop: space.xl }}>
        By continuing you agree to Color Times’ terms and privacy policy.
      </T>
    </AuthShell>
  );
}
