import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Button, IconButton, Input, Sheet, T, Tap, toast } from '../../components/ui';
import { Monogram } from '../../components/brand/Monogram';
import { colors, gradients, space } from '../../theme';
import { useAuth } from '../../auth/AuthContext';
import { useNav } from '../../navigation/nav';
import { DEV_LOGIN_EMAIL } from '../../config';
import { NetLogSheet } from '../../components/NetLogSheet';
import { api, errorMessage } from '../../api/client';

export function AuthShell({
  title,
  kicker,
  children,
  back,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
  back?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={[...gradients.ink]} style={[StyleSheet.absoluteFill, { height: 380 }]} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + space.md,
            paddingHorizontal: space.xl,
            paddingBottom: insets.bottom + space.xxl,
          }}
        >
          <View style={{ height: 44, justifyContent: 'center' }}>
            {back && nav.canGoBack() ? (
              <IconButton icon="ChevronLeft" onPress={() => nav.goBack()} accessibilityLabel="Back" />
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-start', marginTop: space.lg }}>
            <Monogram size={64} />
            <T variant="caption" gold style={{ marginTop: space.xl }}>
              {kicker}
            </T>
            <T variant="hero" style={{ marginTop: space.xs }}>
              {title}
            </T>
          </View>
          <View style={{ marginTop: space.xxl }}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function LoginScreen() {
  const nav = useNav();
  const { signIn } = useAuth();
  const [email, setEmail] = useState(__DEV__ ? DEV_LOGIN_EMAIL : '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOpen, setServerOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [server, setServer] = useState(api.baseUrl);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell kicker="Welcome back" title="Sign in" back>
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        icon="Mail"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="password"
        icon="Lock"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {error ? (
        <T variant="small" color={colors.danger} style={{ marginBottom: space.md }}>
          {error}
        </T>
      ) : null}
      <Button title="Sign in" onPress={submit} loading={busy} size="lg" />
      <Tap
        onPress={() => nav.navigate('Register')}
        hapticOnPress={false}
        style={{ alignSelf: 'center', marginTop: space.xl }}
      >
        <T variant="small">
          New to Color Times?{' '}
          <T variant="smallStrong" gold>
            Create an account
          </T>
        </T>
      </Tap>
      <T variant="small" align="center" color={colors.textFaint} style={{ marginTop: space.xxl }}>
        Staff and owners sign in with the same account they use on the web admin.
      </T>
      <Tap
        onPress={() => nav.navigate('InfoHub')}
        hapticOnPress={false}
        style={{ alignSelf: 'center', marginTop: space.lg }}
      >
        <T variant="smallStrong" gold>
          About Color Times · Offers · Track a booking
        </T>
      </Tap>
      {__DEV__ ? (
        <Tap
          onPress={() => setServerOpen(true)}
          hapticOnPress={false}
          style={{ alignSelf: 'center', marginTop: space.md }}
        >
          <T variant="small" color={colors.textFaint}>
            Server: {api.baseUrl}
          </T>
        </Tap>
      ) : null}
      {__DEV__ ? (
        <Tap
          onPress={() => setLogOpen(true)}
          hapticOnPress={false}
          style={{ alignSelf: 'center', marginTop: space.sm }}
        >
          <T variant="smallStrong" gold>
            API log (requests & responses)
          </T>
        </Tap>
      ) : null}
      {__DEV__ ? <NetLogSheet visible={logOpen} onClose={() => setLogOpen(false)} /> : null}
      <Sheet
        visible={serverOpen}
        onClose={() => setServerOpen(false)}
        title="API server"
        subtitle="Debug builds only — where the Next.js app is running."
        footer={
          <Button
            title="Save"
            onPress={async () => {
              await api.setBaseUrl(server.trim());
              setServerOpen(false);
              toast.success('Server updated');
            }}
          />
        }
      >
        <Input
          label="Base URL"
          value={server}
          onChangeText={setServer}
          autoCapitalize="none"
          keyboardType="url"
        />
        <T variant="small">
          Android emulator: http://10.0.2.2:3000 · Phone on Wi-Fi: http://&lt;your Mac's IP&gt;:3000
        </T>
      </Sheet>
    </AuthShell>
  );
}
