import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '../../api/client';
import { NetLogSheet } from '../../components/NetLogSheet';
import { MpinSetup } from '../../components/MpinSetup';
import { clearMpin, hasMpin } from '../../lib/mpin';
import { useApi, useInvalidate } from '../../api/hooks';
import type { Me } from '../../api/types';
import {
  Avatar,
  Button,
  Card,
  Header,
  Input,
  ListRow,
  Pill,
  Screen,
  Section,
  Sheet,
  Segmented,
  T,
  ToggleRow,
  confirm,
  toast,
} from '../../components/ui';
import { colors, space } from '../../theme';
import { THEME_MODES, useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../auth/AuthContext';
import { useNav } from '../../navigation/nav';
import { ROLE_LABELS, isAdmin } from '../../lib/roles';
import { biometryType, disableBiometricLock, enableBiometricLock, prefs } from '../../lib/storage';
import { fmtDate } from '../../lib/format';
import { BRAND } from '../../config';

export function AccountScreen() {
  const theme = useTheme();
  const nav = useNav();
  const { user, signOut, replaceTokens, refreshUser } = useAuth();
  const invalidate = useInvalidate();
  const me = useApi<{ me: Me }>('/api/mobile/me');
  const [bio, setBio] = useState(false);
  const [bioKind, setBioKind] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [mpin, setMpinOn] = useState(false);
  const [mpinSetup, setMpinSetup] = useState<'create' | 'change' | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    prefs.get('biometricLock').then((v) => setBio(v === '1'));
    hasMpin().then(setMpinOn);
    biometryType().then(setBioKind);
  }, []);
  useEffect(() => {
    if (me.data) {
      setName(me.data.me.name);
      setPhone(me.data.me.phone);
    }
  }, [me.data]);

  const toggleBio = async (on: boolean) => {
    if (on) {
      const ok = await enableBiometricLock();
      setBio(ok);
      if (!ok)
        toast.error('Biometrics unavailable', 'Set up Face ID / fingerprint in device settings first.');
      else toast.success('App lock on');
    } else {
      await disableBiometricLock();
      setBio(false);
    }
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      await api.patch('/api/mobile/me', { name, phone: phone.replace(/\D/g, '') });
      invalidate('/api/mobile/me');
      refreshUser();
      toast.success('Profile updated');
      setEditOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ accessToken: string; refreshToken: string }>('/api/mobile/me/password', pw);
      await replaceTokens(r.accessToken, r.refreshToken);
      toast.success('Password changed', 'Other devices have been signed out.');
      setPwOpen(false);
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const m = me.data?.me;
  const customer = !isAdmin(user?.role);

  return (
    <Screen
      header={<Header title="Account" back={!customer} />}
      refreshing={me.isRefetching}
      onRefresh={() => me.refetch()}
    >
      <View style={{ alignItems: 'center', marginTop: space.md }}>
        <Avatar name={user?.name} size={88} gold />
        <T variant="h1" style={{ marginTop: space.md }}>
          {user?.name}
        </T>
        <T variant="small">{user?.email}</T>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <Pill label={ROLE_LABELS[user?.role ?? 'customer']} />
          {m?.premium.isActive ? <Pill label="Privé member" tone="gold" /> : null}
        </View>
        {m ? (
          <T variant="small" color={colors.textFaint} style={{ marginTop: space.sm }}>
            Member since {fmtDate(m.memberSince)}
          </T>
        ) : null}
      </View>

      {customer ? (
        <Section title="Membership">
          <ListRow
            icon="Crown"
            title={m?.premium.isActive ? 'Color Times Privé' : 'Join Color Times Privé'}
            subtitle={
              m?.premium.isActive
                ? m.premium.expiresAt
                  ? `Renews ${fmtDate(m.premium.expiresAt)}`
                  : 'Active'
                : 'Early access, priority requests & more'
            }
            onPress={() => nav.navigate('Prive')}
          />
        </Section>
      ) : null}

      <Section title="Profile">
        <ListRow
          icon="Pencil"
          title="Edit name & phone"
          subtitle={[m?.name, m?.phone].filter(Boolean).join(' · ')}
          onPress={() => setEditOpen(true)}
        />
        {customer ? (
          <ListRow
            icon="MapPin"
            title="Addresses"
            subtitle={`${m?.addresses.length ?? 0} saved`}
            onPress={() => nav.navigate('Addresses')}
          />
        ) : null}
        <ListRow icon="KeyRound" title="Change password" onPress={() => setPwOpen(true)} />
      </Section>

      {customer ? (
        <Section title="Color Times">
          <ListRow
            icon="Store"
            title="About, offers & help"
            subtitle="Journal, FAQ, contact, policies"
            onPress={() => nav.navigate('InfoHub')}
          />
          <ListRow icon="Truck" title="Track a booking" onPress={() => nav.navigate('TrackOrder')} />
        </Section>
      ) : null}
      {m && !m.isEmailVerified ? (
        <Section title="Email">
          <ListRow
            icon="Mail"
            title="Verify your email"
            subtitle={`Resend the link to ${m.email}`}
            onPress={async () => {
              try {
                await api.post('/api/auth/resend-verification');
                toast.success('Verification email sent');
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          />
        </Section>
      ) : null}

      <Section title="Appearance">
        <Card>
          <Segmented
            options={THEME_MODES}
            value={theme.mode}
            onChange={(next) => {
              theme.setMode(next);
            }}
          />
          <T variant="small" style={{ marginTop: space.sm }}>
            {theme.mode === 'system'
              ? `Following your phone — ${
                  theme.scheme === 'dark' ? 'Midnight (dark)' : 'Ivory (light)'
                } right now.`
              : theme.mode === 'dark'
              ? 'Midnight — warm charcoal with champagne gold.'
              : 'Ivory — warm paper with deep wine accents.'}
          </T>
        </Card>
      </Section>

      <Section title="Security">
        <Card>
          <ToggleRow
            label={bioKind === 'FaceID' || bioKind === 'Face' ? 'Face ID lock' : 'Biometric lock'}
            description="Ask for Face ID / fingerprint when opening the app"
            value={bio}
            onChange={toggleBio}
          />
        </Card>
        <ListRow
          icon="KeyRound"
          title={mpin ? 'Change MPIN' : 'Set up MPIN'}
          subtitle={mpin ? 'On · 4-digit PIN to open the app' : 'A 4-digit PIN to open the app quickly'}
          onPress={() => setMpinSetup(mpin ? 'change' : 'create')}
        />
        {mpin ? (
          <ListRow
            icon="X"
            title="Turn off MPIN"
            onPress={async () => {
              const ok = await confirm({
                title: 'Turn off MPIN?',
                message: 'The app will open without a PIN.',
                confirmText: 'Turn off',
                destructive: true,
              });
              if (!ok) return;
              await clearMpin();
              setMpinOn(false);
              toast.success('MPIN off');
            }}
          />
        ) : null}
      </Section>
      <MpinSetup
        visible={mpinSetup !== null}
        mode={mpinSetup ?? 'create'}
        onDone={() => {
          setMpinSetup(null);
          setMpinOn(true);
        }}
        onCancel={() => setMpinSetup(null)}
      />

      <Section title="About">
        <Card>
          <T variant="small">{BRAND.fullName}</T>
          <T variant="small" color={colors.textFaint}>
            Server · {api.baseUrl}
          </T>
        </Card>
        {__DEV__ ? (
          <ListRow
            icon="Server"
            title="API log"
            subtitle="Every request with its parameters and response (debug builds)"
            onPress={() => setLogOpen(true)}
          />
        ) : null}
      </Section>
      {__DEV__ ? <NetLogSheet visible={logOpen} onClose={() => setLogOpen(false)} /> : null}

      <Button
        title="Sign out"
        icon="LogOut"
        variant="danger"
        style={{ marginTop: space.xxl }}
        onPress={async () => {
          if (await confirm({ title: 'Sign out?', confirmText: 'Sign out', destructive: true })) signOut();
        }}
      />

      <Sheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit profile"
        footer={<Button title="Save" onPress={saveProfile} loading={busy} />}
      >
        <Input label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input label="Mobile" value={phone} onChangeText={setPhone} keyboardType="phone-pad" prefix="+91" />
      </Sheet>
      <Sheet
        visible={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change password"
        footer={<Button title="Update password" onPress={changePassword} loading={busy} />}
      >
        <Input
          label="Current password"
          value={pw.currentPassword}
          onChangeText={(v) => setPw((s) => ({ ...s, currentPassword: v }))}
          secure
        />
        <Input
          label="New password"
          hint="8+ chars, A–Z, 0–9"
          value={pw.newPassword}
          onChangeText={(v) => setPw((s) => ({ ...s, newPassword: v }))}
          secure
        />
        <Input
          label="Confirm new password"
          value={pw.confirmPassword}
          onChangeText={(v) => setPw((s) => ({ ...s, confirmPassword: v }))}
          secure
        />
      </Sheet>
    </Screen>
  );
}
