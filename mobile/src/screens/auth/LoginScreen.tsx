import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Button, IconButton, Input, T, Tap } from '../../components/ui';
import { Monogram } from '../../components/brand/Monogram';
import { colors, fonts, gradients, space } from '../../theme';
import { useAuth } from '../../auth/AuthContext';
import { useNav } from '../../navigation/nav';
import { BRAND, DEV_LOGIN_EMAIL } from '../../config';
import { NetLogSheet } from '../../components/NetLogSheet';
import { errorMessage } from '../../api/client';

// Website sign-in page colours (app/(auth)/login/page.tsx) - the same in both themes.
const ON_WINE = '#FFFFFF';
const ON_WINE_MUTED = '#C9A6B4';
const ON_WINE_LINK = '#D9B876';
const GOLD_LINE = '#C9A45C';

/**
 * Sign-in / sign-up layout, matching colortimesboutique.com/login: the deep
 * wine backdrop with a soft gold glow, the logo badge and name, and the form
 * on a raised card with a gold hairline. The card follows the app theme
 * (ivory by day, midnight by night); the backdrop is brand and never changes.
 */
export function AuthShell({
  title,
  kicker,
  subtitle,
  children,
  footer,
  back,
}: {
  title: string;
  kicker?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Shown under the card, on the wine backdrop. */
  footer?: React.ReactNode;
  back?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  return (
    <View style={{ flex: 1, backgroundColor: gradients.wine[1] }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[...gradients.wine]}
        locations={[0, 0.6, 1]}
        start={{ x: 0.45, y: 0 }}
        end={{ x: 0.55, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="authGlow" cx="50%" cy="0%" r="65%">
            <Stop offset="0" stopColor={GOLD_LINE} stopOpacity="0.16" />
            <Stop offset="1" stopColor={GOLD_LINE} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#authGlow)" />
      </Svg>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingTop: insets.top + space.sm,
            paddingHorizontal: space.xl,
            paddingBottom: insets.bottom + space.xl,
          }}
        >
          <View style={{ height: 44, justifyContent: 'center' }}>
            {back && nav.canGoBack() ? (
              <IconButton
                icon="ChevronLeft"
                color={ON_WINE}
                filled={false}
                onPress={() => nav.goBack()}
                accessibilityLabel="Back"
              />
            ) : null}
          </View>

          <View style={{ alignItems: 'center', marginBottom: space.xl }}>
            <Monogram size={84} />
            <T
              style={{
                marginTop: space.md,
                color: ON_WINE,
                fontFamily: fonts.display,
                fontSize: 24,
                lineHeight: 30,
                letterSpacing: 0.4,
              }}
            >
              {BRAND.fullName}
            </T>
          </View>

          <View style={[authStyles.card, { backgroundColor: colors.bgElevated }]}>
            <View style={authStyles.hairline} />
            {kicker ? (
              <T variant="caption" align="center" color={colors.textFaint}>
                {kicker}
              </T>
            ) : null}
            <T variant="h1" align="center" style={{ marginTop: kicker ? space.xs : 0 }}>
              {title}
            </T>
            {subtitle ? (
              <T variant="small" align="center" style={{ marginTop: space.xs }}>
                {subtitle}
              </T>
            ) : null}
            <View style={{ marginTop: space.xl }}>{children}</View>
          </View>

          {footer ? <View style={{ marginTop: space.xl, alignItems: 'center' }}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Text link for the wine backdrop under the card. */
export function WineLink({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  return (
    <Tap onPress={onPress} hapticOnPress={false} style={{ paddingVertical: space.xs }}>
      <T
        variant={muted ? 'small' : 'smallStrong'}
        align="center"
        style={{ color: muted ? ON_WINE_MUTED : ON_WINE_LINK }}
      >
        {label}
      </T>
    </Tap>
  );
}

export function WineNote({ children }: { children: React.ReactNode }) {
  return (
    <T variant="small" align="center" style={{ color: ON_WINE_MUTED, marginTop: space.sm }}>
      {children}
    </T>
  );
}

const authStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xl,
    boxShadow: '0 30px 70px rgba(10,2,7,0.35)',
  },
  hairline: {
    position: 'absolute',
    top: 0,
    left: '14%',
    right: '14%',
    height: 2,
    borderRadius: 1,
    backgroundColor: GOLD_LINE,
    opacity: 0.85,
  },
});

export function LoginScreen() {
  const nav = useNav();
  const { signIn } = useAuth();
  const [email, setEmail] = useState(__DEV__ ? DEV_LOGIN_EMAIL : '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

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
    <AuthShell
      title="Sign in"
      back
      footer={__DEV__ ? <WineLink muted label="API log" onPress={() => setLogOpen(true)} /> : undefined}
    >
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
      <Tap
        onPress={() => nav.navigate('ForgotPassword', { email: email.trim() })}
        hapticOnPress={false}
        style={{
          alignSelf: 'flex-end',
          marginTop: -space.sm,
          marginBottom: space.lg,
          paddingVertical: space.xs,
        }}
      >
        <T variant="smallStrong" gold>
          Forgot password?
        </T>
      </Tap>
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
      {__DEV__ ? <NetLogSheet visible={logOpen} onClose={() => setLogOpen(false)} /> : null}
    </AuthShell>
  );
}
