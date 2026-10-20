import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useApi, useInvalidate } from '../../api/hooks';
import type { Me } from '../../api/types';
import { Button, Icon, IconButton, T, Tap, toast } from '../../components/ui';
import { Monogram } from '../../components/brand/Monogram';
import { alpha, colors, gradients, radius, space, themed } from '../../theme';
import { useNav } from '../../navigation/nav';
import {
  buyPlan,
  loadPlans,
  PRIVE_PERKS,
  purchasesAvailable,
  restorePlan,
  type PlanOption,
} from '../../lib/purchases';
import { fmtDate } from '../../lib/format';
import { errorMessage } from '../../api/client';
import { reduceMotion } from '../../lib/motion';

/** "Color Times Privé" — the premium membership paywall. */
export function PriveScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const invalidate = useInvalidate();
  const me = useApi<{ me: Me }>('/api/mobile/me');
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(purchasesAvailable());
  const [buying, setBuying] = useState(false);
  const shimmer = useRef(new Animated.Value(0)).current;
  const member = me.data?.me.premium;

  useEffect(() => {
    if (!reduceMotion())
      Animated.loop(Animated.timing(shimmer, { toValue: 1, duration: 3200, useNativeDriver: true })).start();
    if (!purchasesAvailable()) return;
    loadPlans()
      .then((p) => {
        setPlans(p);
        setSelected(p.find((x) => x.period === 'yearly')?.id ?? p[0]?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, [shimmer]);

  const purchase = async () => {
    const plan = plans.find((p) => p.id === selected);
    if (!plan) return;
    setBuying(true);
    try {
      const ok = await buyPlan(plan);
      if (ok) {
        toast.success('Welcome to Privé', 'Your membership is active.');
        // The store webhook updates the server within a few seconds.
        setTimeout(() => invalidate('/api/mobile'), 2500);
        nav.goBack();
      }
    } catch (e) {
      toast.error('Purchase failed', errorMessage(e));
    } finally {
      setBuying(false);
    }
  };

  const restore = async () => {
    try {
      const ok = await restorePlan();
      toast[ok ? 'success' : 'info'](ok ? 'Membership restored' : 'No active membership found');
      if (ok) setTimeout(() => invalidate('/api/mobile'), 2500);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const translateX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-300, 400] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={[...gradients.prive, colors.bg]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingBottom: insets.bottom + 180,
          paddingHorizontal: space.xl,
        }}
      >
        <IconButton icon="X" onPress={() => nav.goBack()} accessibilityLabel="Close" />
        <View style={{ alignItems: 'center', marginTop: space.lg }}>
          <View style={{ overflow: 'hidden', borderRadius: 60 }}>
            <Monogram size={120} />
            <Animated.View
              style={[StyleSheet.absoluteFill, { transform: [{ translateX }, { rotate: '20deg' }] }]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[
                  alpha(colors.goldBright, 0),
                  alpha(colors.goldBright, 0.25),
                  alpha(colors.goldBright, 0),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: 60, height: 200, marginTop: -40 }}
              />
            </Animated.View>
          </View>
          <T variant="caption" gold style={{ marginTop: space.xl }}>
            Membership
          </T>
          <T variant="hero" align="center" style={{ marginTop: space.xs }}>
            Color Times Privé
          </T>
          <T variant="body" muted align="center" style={{ marginTop: space.sm, maxWidth: 320 }}>
            For those who never want to miss the piece.
          </T>
        </View>

        {member?.isActive ? (
          <View style={[styles.activeCard]}>
            <Icon name="BadgeCheck" color={colors.gold} size={26} />
            <T variant="h2" style={{ marginTop: space.sm }}>
              You’re a member
            </T>
            <T variant="small">
              {member.plan ? `${member.plan[0].toUpperCase()}${member.plan.slice(1)} plan` : 'Active'}
              {member.expiresAt ? ` · renews ${fmtDate(member.expiresAt)}` : ''}
            </T>
            <T variant="small" style={{ marginTop: space.sm }}>
              Manage or cancel any time from your App Store / Google Play subscriptions.
            </T>
          </View>
        ) : null}

        <View style={{ marginTop: space.xxl, gap: space.lg }}>
          {PRIVE_PERKS.map((perk) => (
            <View key={perk.title} style={{ flexDirection: 'row', gap: space.md }}>
              <LinearGradient colors={[...gradients.gold]} style={styles.perkIcon}>
                <Icon name={perk.icon} size={18} color={colors.onGold} strokeWidth={2} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">{perk.title}</T>
                <T variant="small">{perk.body}</T>
              </View>
            </View>
          ))}
        </View>

        {!member?.isActive && plans.length > 0 ? (
          <View style={{ marginTop: space.xxl, gap: space.sm }}>
            {plans.map((plan) => {
              const active = plan.id === selected;
              return (
                <Tap
                  key={plan.id}
                  onPress={() => setSelected(plan.id)}
                  style={[styles.plan, active && styles.planActive]}
                >
                  <View style={[styles.radio, active && { borderColor: colors.gold }]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong">{plan.title}</T>
                    {plan.period === 'yearly' ? (
                      <T variant="small" gold>
                        Best value
                      </T>
                    ) : null}
                  </View>
                  <T variant="h3">{plan.price}</T>
                </Tap>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {!member?.isActive ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          {purchasesAvailable() ? (
            <>
              <Button
                title={plans.length ? 'Become a member' : 'Loading plans…'}
                size="lg"
                onPress={purchase}
                loading={buying || loadingPlans}
                disabled={!selected}
              />
              <Tap
                onPress={restore}
                hapticOnPress={false}
                style={{ alignSelf: 'center', marginTop: space.md }}
              >
                <T variant="small">Restore purchase</T>
              </Tap>
              <T
                variant="small"
                align="center"
                color={colors.textFaint}
                style={{ marginTop: space.sm, fontSize: 11 }}
              >
                Auto-renews until cancelled. Billed through your App Store / Google Play account.
              </T>
            </>
          ) : (
            <View style={styles.soon}>
              <T variant="bodyStrong" align="center">
                Memberships open soon
              </T>
              <T variant="small" align="center">
                Ask at the boutique to be added to the Privé list.
              </T>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    perkIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    plan: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      padding: space.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    planActive: { borderColor: colors.gold, backgroundColor: colors.accentBg },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: space.xl,
      paddingTop: space.lg,
      backgroundColor: alpha(colors.bg, 0.94),
    },
    activeCard: {
      marginTop: space.xxl,
      padding: space.xl,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.goldDeep,
      alignItems: 'center',
      backgroundColor: alpha(colors.gold, 0.06),
    },
    soon: {
      padding: space.lg,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.goldDeep,
    },
  })
);
