import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import { useApi, useInvalidate, useList } from '../../api/hooks';
import type { CustomerHome, Me, MyBooking, ProductCard, ProductDetail } from '../../api/types';
import {
  Button,
  GridSkeleton,
  ImageViewer,
  Card,
  Chips,
  DateField,
  Divider,
  Empty,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Img,
  Input,
  KV,
  ListRow,
  Loading,
  Pill,
  Row,
  Screen,
  SearchBar,
  Section,
  SelectField,
  Sheet,
  T,
  Tap,
  ToggleRow,
  toast,
  useDebounced,
} from '../../components/ui';
import { Monogram } from '../../components/brand/Monogram';
import { useContent } from './InfoScreens';
import { alpha, colors, gradients, radius, shadow, space, themed } from '../../theme';
import { useAuth } from '../../auth/AuthContext';
import { useNav, useParams } from '../../navigation/nav';
import { fmtDate, fmtRange, inr } from '../../lib/format';
import { BOOKING_STATUS } from '../../lib/labels';
import { haptic } from '../../lib/haptics';
import { openUrl, pdfUrl, shareLink } from '../../lib/share';
import { BRAND } from '../../config';
import { prefs } from '../../lib/storage';

const { width } = Dimensions.get('window');
const GRID_W = (width - space.lg * 2 - space.md) / 2;

// ---------------------------------------------------------------------------
// Shared bits

function useWishlist() {
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return async (productId: string, on: boolean) => {
    haptic(on ? 'success' : 'tap');
    try {
      if (on) await api.post('/api/mobile/me/wishlist', { productId });
      else await api.delete(`/api/mobile/me/wishlist?productId=${productId}`);
      invalidate('/api/mobile/me/wishlist', '/api/mobile/me');
      client.setQueryData(
        [`/api/mobile/products/${productId}`, {}],
        (old: { isWishlisted: boolean } | undefined) => (old ? { ...old, isWishlisted: on } : old)
      );
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
}

export function DressCard({
  product,
  w = GRID_W,
  onPress,
}: {
  product: ProductCard;
  w?: number;
  onPress: () => void;
}) {
  return (
    <Tap onPress={onPress} style={{ width: w }} scaleTo={0.97}>
      <View style={[{ borderRadius: radius.lg, overflow: 'hidden' }, shadow]}>
        <Img src={product.images[0]} style={{ width: w, height: w * 1.38 }} rounded={radius.lg} />
        <LinearGradient colors={[...gradients.veil]} style={[StyleSheet.absoluteFill, { top: '55%' }]} />
        {product.isNewArrival ? (
          <View style={{ position: 'absolute', top: space.sm, left: space.sm }}>
            <Pill label="New" tone="gold" small />
          </View>
        ) : null}
        <View style={{ position: 'absolute', left: space.md, right: space.md, bottom: space.md }}>
          <T variant="h3" numberOfLines={1} style={{ fontSize: 18 }}>
            {product.name}
          </T>
          <T variant="smallStrong" color={colors.gold}>
            {inr(product.rentalPricePerDay)} <T variant="small">rent</T>
          </T>
        </View>
      </View>
    </Tap>
  );
}

// ---------------------------------------------------------------------------
// Home

export function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const { user } = useAuth();
  const q = useApi<CustomerHome>('/api/mobile/home');
  const scrollY = useRef(new Animated.Value(0)).current;
  const d = q.data;

  const heroScale = scrollY.interpolate({
    inputRange: [-120, 0],
    outputRange: [1.25, 1],
    extrapolateRight: 'clamp',
  });
  const hero = d?.featured[0] ?? d?.newArrivals[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => {
              q.refetch();
            }}
            tintColor={colors.gold}
          />
        }
      >
        {/* Editorial hero */}
        <View style={{ height: 520 }}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: heroScale }] }]}>
            {hero ? (
              <Img src={hero.images[0]} style={StyleSheet.absoluteFill} rounded={0} />
            ) : (
              <LinearGradient colors={[...gradients.ink]} style={StyleSheet.absoluteFill} />
            )}
          </Animated.View>
          <LinearGradient
            colors={[gradients.shade[0], gradients.shade[1], alpha(colors.bg, 0.2), colors.bg]}
            locations={[0, 0.28, 0.52, 0.86]}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              position: 'absolute',
              top: insets.top + space.sm,
              left: space.lg,
              right: space.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Monogram size={40} onImage />
            <Row>
              <IconButton
                icon="Search"
                onPress={() => nav.navigate('Explore', { focus: true })}
                accessibilityLabel="Search"
              />
              <IconButton
                icon="Heart"
                onPress={() => nav.navigate('Wishlist')}
                accessibilityLabel="Wishlist"
              />
            </Row>
          </View>
          <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.xl }}>
            <T variant="caption" gold>
              {d?.premium.isActive
                ? 'Privé · Welcome back'
                : `Hello, ${user?.name?.split(' ')[0] ?? 'there'}`}
            </T>
            <T variant="hero" style={{ marginTop: space.xs, fontSize: 44, lineHeight: 46 }}>
              {BRAND.tagline}
            </T>
            {hero ? (
              <Tap
                onPress={() => nav.navigate('Dress', { id: hero._id })}
                style={{ marginTop: space.md, alignSelf: 'flex-start' }}
                hapticOnPress={false}
              >
                <Row>
                  <T variant="smallStrong" gold>
                    Discover {hero.name}
                  </T>
                  <Icon name="ArrowRight" size={16} color={colors.gold} />
                </Row>
              </Tap>
            ) : null}
            <Row gap={space.sm} style={{ marginTop: space.lg }}>
              <Button title="Explore collection" size="sm" onPress={() => nav.navigate('Explore')} />
              <Button
                title="Book an appointment"
                size="sm"
                variant="outline"
                onPress={() => nav.navigate('Contact')}
              />
            </Row>
          </View>
        </View>

        {q.isLoading ? <GridSkeleton tiles={4} ratio={1.4} inset /> : null}
        {q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : null}

        {d && !d.premium.isActive ? (
          <Tap onPress={() => nav.navigate('Prive')} style={{ marginHorizontal: space.lg }}>
            <LinearGradient
              colors={[...gradients.prive]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.priveBanner}
            >
              <Icon name="Crown" color={colors.gold} size={22} />
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">Color Times Privé</T>
                <T variant="small">
                  {d.lockedEarlyAccessCount > 0
                    ? `${d.lockedEarlyAccessCount} new arrival${
                        d.lockedEarlyAccessCount === 1 ? '' : 's'
                      } waiting for members`
                    : 'See new arrivals a week early'}
                </T>
              </View>
              <Icon name="ChevronRight" color={colors.gold} />
            </LinearGradient>
          </Tap>
        ) : null}

        <VerifyEmailBanner />

        {d?.categories.length ? (
          <Section
            title="Collections"
            action="All"
            onAction={() => nav.navigate('Explore')}
            style={{ paddingHorizontal: space.lg }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.md }}
              style={{ marginHorizontal: -space.lg, paddingHorizontal: space.lg }}
            >
              {d.categories.map((c) => (
                <Tap
                  key={c._id}
                  onPress={() => nav.navigate('Explore', { category: c.slug, title: c.name })}
                  style={{ width: 120, alignItems: 'center' }}
                >
                  <View style={styles.arch}>
                    <Img src={c.heroImage} style={StyleSheet.absoluteFill} rounded={0} />
                  </View>
                  <T variant="smallStrong" align="center" numberOfLines={1} style={{ marginTop: space.sm }}>
                    {c.name}
                  </T>
                </Tap>
              ))}
              <View style={{ width: space.lg }} />
            </ScrollView>
          </Section>
        ) : null}

        {d?.newArrivals.length ? (
          <Section
            title={d.premium.isActive ? 'New arrivals · early access' : 'New arrivals'}
            action="See all"
            onAction={() => nav.navigate('Explore')}
            style={{ paddingHorizontal: space.lg }}
          >
            <FlatList
              horizontal
              data={d.newArrivals}
              keyExtractor={(p) => p._id}
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -space.lg }}
              contentContainerStyle={{ gap: space.md, paddingHorizontal: space.lg }}
              renderItem={({ item }) => (
                <DressCard
                  product={item}
                  w={width * 0.56}
                  onPress={() => nav.navigate('Dress', { id: item._id })}
                />
              )}
            />
          </Section>
        ) : null}

        {d?.featured.length ? (
          <Section title="The edit" style={{ paddingHorizontal: space.lg }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {d.featured.slice(0, 6).map((p) => (
                <DressCard key={p._id} product={p} onPress={() => nav.navigate('Dress', { id: p._id })} />
              ))}
            </View>
          </Section>
        ) : null}

        {d?.designers?.length ? (
          <Section
            title="Designers"
            action="All"
            onAction={() => nav.navigate('Collections')}
            style={{ paddingHorizontal: space.lg }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -space.lg }}
              contentContainerStyle={{ gap: space.md, paddingHorizontal: space.lg }}
            >
              {d.designers.map((dz) => (
                <Tap
                  key={dz.name}
                  onPress={() => nav.navigate('Collection', { designer: dz.name, title: dz.name })}
                  style={{ width: 96, alignItems: 'center' }}
                >
                  <Img src={dz.image} style={{ width: 84, height: 84 }} rounded={42} />
                  <T variant="smallStrong" align="center" numberOfLines={2} style={{ marginTop: space.sm }}>
                    {dz.name}
                  </T>
                </Tap>
              ))}
            </ScrollView>
          </Section>
        ) : null}

        <HomeStory />
      </Animated.ScrollView>
    </View>
  );
}

function VerifyEmailBanner() {
  const me = useApi<{ me: Me }>('/api/mobile/me');
  const [sent, setSent] = useState(false);
  if (!me.data || me.data.me.isEmailVerified) return null;
  return (
    <View style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Icon name="Mail" color={colors.warning} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">Verify your email</T>
            <T variant="small">
              We sent a link to {me.data.me.email}. Verified accounts get booking updates by email.
            </T>
            <Tap
              hapticOnPress={false}
              style={{ marginTop: space.sm }}
              onPress={async () => {
                try {
                  await api.post('/api/auth/resend-verification');
                  setSent(true);
                  toast.success('Verification email sent');
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              <T variant="smallStrong" gold>
                {sent ? 'Sent — check your inbox' : 'Resend link'}
              </T>
            </Tap>
          </View>
        </Row>
      </Card>
    </View>
  );
}

/** The website's home-page story: stats, how it works, why us, testimonials, FAQ. */
function HomeStory() {
  const nav = useNav();
  const q = useContent();
  const c = q.data;
  if (!c) return null;
  return (
    <View style={{ paddingHorizontal: space.lg }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xxl }}>
        {c.stats.map((st) => (
          <View key={st.label} style={styles.statCell}>
            <T variant="number" gold>
              {st.value.toLocaleString('en-IN', { maximumFractionDigits: st.decimals })}
              {st.suffix}
            </T>
            <T variant="small">{st.label}</T>
          </View>
        ))}
      </View>

      <Section title="How renting works">
        <Card>
          {c.rentalProcess.map((p) => (
            <Row key={p.step} gap={space.md} style={{ marginBottom: space.lg, alignItems: 'flex-start' }}>
              <View style={styles.stepIcon}>
                <T variant="smallStrong" gold>
                  {p.step}
                </T>
              </View>
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">{p.title}</T>
                <T variant="small">{p.description}</T>
              </View>
            </Row>
          ))}
        </Card>
      </Section>

      <Section title="Why Color Times" action="About us" onAction={() => nav.navigate('About')}>
        {c.whyChooseUs.map((w) => (
          <Row key={w.title} gap={space.md} style={{ marginBottom: space.md, alignItems: 'flex-start' }}>
            <View style={styles.stepIcon}>
              <Icon name={w.icon} size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong">{w.title}</T>
              <T variant="small">{w.description}</T>
            </View>
          </Row>
        ))}
      </Section>

      <Section title="Loved by brides & guests" action="All" onAction={() => nav.navigate('Testimonials')}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -space.lg }}
        >
          {c.testimonials.map((t) => (
            <View key={t.name} style={{ width, paddingHorizontal: space.lg }}>
              <Card>
                <T variant="body" style={{ fontStyle: 'italic' }}>
                  “{t.quote}”
                </T>
                <Row gap={space.md} style={{ marginTop: space.md }}>
                  <Img src={t.avatar} style={{ width: 36, height: 36 }} rounded={18} />
                  <View>
                    <T variant="smallStrong">{t.name}</T>
                    <T variant="small">{t.role}</T>
                  </View>
                </Row>
              </Card>
            </View>
          ))}
        </ScrollView>
      </Section>

      <Section title="Questions" action="FAQ" onAction={() => nav.navigate('Faq')}>
        {c.faqs.slice(0, 3).map((f) => (
          <ListRow key={f.question} icon="Info" title={f.question} onPress={() => nav.navigate('Faq')} />
        ))}
      </Section>

      <Row style={{ flexWrap: 'wrap', marginTop: space.xl }}>
        <Button
          title="Offers"
          icon="Gift"
          size="sm"
          variant="surface"
          onPress={() => nav.navigate('Offers')}
        />
        <Button
          title="Journal"
          icon="FileText"
          size="sm"
          variant="surface"
          onPress={() => nav.navigate('Blog')}
        />
        <Button
          title="Gallery"
          icon="Image"
          size="sm"
          variant="surface"
          onPress={() => nav.navigate('Gallery')}
        />
        <Button
          title="Contact"
          icon="Phone"
          size="sm"
          variant="surface"
          onPress={() => nav.navigate('Contact')}
        />
      </Row>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Explore (search + category + grid)

export function ExploreScreen() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const params = useParams<{ category: string; title: string; designer: string }>();
  const cats = useApi<CustomerHome>('/api/mobile/home');
  const [text, setText] = useState('');
  const term = useDebounced(text);
  const [category, setCategory] = useState(params.category ?? '');
  const [sort, setSort] = useState('newest');
  useEffect(() => {
    if (params.category) setCategory(params.category);
  }, [params.category]);
  const recent = useRecentSearches();
  // Remember a search once the shopper has paused on it and it found something.
  useEffect(() => {
    if (term.trim().length >= 2) recent.add(term.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);
  const collection = (cats.data?.categories ?? []).find((c) => c.slug === category);

  const list = useList<ProductCard>(
    '/api/mobile/products',
    'products',
    {
      search: term || undefined,
      category: category || undefined,
      designer: params.designer || undefined,
      sort,
    },
    20
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={params.title ?? 'Explore'} large back={Boolean(params.title)} />
      <SearchBar
        value={text}
        onChangeText={setText}
        placeholder="Lehenga, gown, colour, designer…"
        style={{ marginHorizontal: space.lg, marginBottom: space.md }}
      />
      <Chips
        options={[
          { value: '', label: 'All' },
          ...(cats.data?.categories ?? []).map((c) => ({ value: c.slug, label: c.name })),
        ]}
        value={category}
        onChange={setCategory}
        style={{ marginBottom: space.sm }}
      />
      <Chips
        options={[
          { value: 'newest', label: 'Newest' },
          { value: 'price_asc', label: 'Price ↑' },
          { value: 'price_desc', label: 'Price ↓' },
          { value: 'rating', label: 'Top rated' },
        ]}
        value={sort}
        onChange={setSort}
        style={{ marginBottom: space.md }}
      />
      {!text && recent.items.length ? (
        <View style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: space.xs }}>
            <T variant="caption">Recent searches</T>
            <Tap onPress={recent.clear} hitSlop={8} accessibilityLabel="Clear recent searches">
              <T variant="caption" gold>
                Clear
              </T>
            </Tap>
          </Row>
          <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
            {recent.items.map((r) => (
              <Tap key={r} onPress={() => setText(r)} style={exploreStyles.recent}>
                <Icon name="Clock" size={12} color={colors.textMuted} />
                <T variant="small">{r}</T>
              </Tap>
            ))}
          </Row>
        </View>
      ) : null}
      {collection?.description && !text ? (
        <T variant="small" style={{ paddingHorizontal: space.lg, marginBottom: space.md }} numberOfLines={4}>
          {collection.description}
        </T>
      ) : null}
      {list.isLoading ? (
        <Loading variant="grid" inset />
      ) : (
        <FlatList
          data={list.items}
          numColumns={2}
          keyExtractor={(p) => p._id}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            gap: space.md,
            paddingBottom: insets.bottom + 120,
          }}
          renderItem={({ item }) => (
            <DressCard product={item} onPress={() => nav.navigate('Dress', { id: item._id })} />
          )}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            list.isFetchingNextPage ? <ActivityIndicator color={colors.gold} /> : undefined
          }
          ListEmptyComponent={
            <Empty icon="Shirt" title="Nothing matches" body="Try another colour or collection." />
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching && !list.isFetchingNextPage}
              onRefresh={() => {
                list.refetch();
              }}
              tintColor={colors.gold}
            />
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Dress detail + request

export function DressScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const q = useApi<{ product: ProductDetail; isWishlisted: boolean; related: ProductCard[] }>(
    id ? `/api/mobile/products/${id}` : null
  );
  const toggleWish = useWishlist();
  const [page, setPage] = useState(0);
  const [requestOpen, setRequestOpen] = useState(false);
  const [wish, setWish] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => setWish(Boolean(q.data?.isWishlisted)), [q.data?.isWishlisted]);

  if (q.isLoading)
    return (
      <Screen header={<Header />}>
        <Loading variant="hero" />
      </Screen>
    );
  const p = q.data?.product;
  if (!p)
    return (
      <Screen header={<Header />}>
        <ErrorState message={errorMessage(q.error)} />
      </Screen>
    );
  const images = p.images.length ? p.images : [''];
  const H = width * 1.3;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ImageViewer images={p.images} index={zoom} onClose={() => setZoom(null)} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <View>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(s, i) => `${s}-${i}`}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item, index }) => (
              <Tap
                onPress={() => item && setZoom(index)}
                hapticOnPress={false}
                scaleTo={1}
                accessibilityLabel="View photo full screen"
              >
                <Img src={item} style={{ width, height: H }} rounded={0} />
              </Tap>
            )}
          />
          <LinearGradient
            colors={[...gradients.shade]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140 }}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[alpha(colors.bg, 0), colors.bg]}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 }}
            pointerEvents="none"
          />
          <View
            style={{
              position: 'absolute',
              top: insets.top + space.sm,
              left: space.lg,
              right: space.lg,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <IconButton icon="ChevronLeft" onPress={() => nav.goBack()} accessibilityLabel="Back" />
            <Row>
              <IconButton
                icon="Share2"
                onPress={() => shareLink(`${p.name} — rent it at ${BRAND.fullName}`)}
                accessibilityLabel="Share"
              />
              <IconButton
                icon="Heart"
                color={wish ? colors.rose : colors.text}
                onPress={() => {
                  setWish(!wish);
                  toggleWish(p._id, !wish);
                }}
                accessibilityLabel={wish ? 'Remove from wishlist' : 'Save to wishlist'}
              />
            </Row>
          </View>
          {images.length > 1 ? (
            <Row style={{ position: 'absolute', bottom: space.xl, alignSelf: 'center' }} gap={6}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === page ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === page ? colors.gold : alpha(colors.onImage, 0.5),
                  }}
                />
              ))}
            </Row>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: space.lg }}>
          {p.category ? (
            <T variant="caption" gold>
              {p.category.name}
            </T>
          ) : null}
          <T variant="hero" style={{ marginTop: space.xs }}>
            {p.name}
          </T>
          {p.designer ? (
            <T variant="body" muted>
              by {p.designer}
            </T>
          ) : null}
          {p.reviewCount > 0 ? (
            <Row style={{ marginTop: space.sm }} gap={4}>
              <Icon name="Star" size={14} color={colors.gold} fill={colors.gold} />
              <T variant="small">
                {p.averageRating.toFixed(1)} · {p.reviewCount} reviews
              </T>
            </Row>
          ) : null}

          <Row gap={space.sm} style={{ marginTop: space.xl }}>
            <Card style={{ flex: 1 }}>
              <T variant="caption">Rent</T>
              <T variant="number" gold>
                {inr(p.rentalPricePerDay)}
              </T>
            </Card>
            <Card style={{ flex: 1 }}>
              <T variant="caption">Refundable deposit</T>
              <T variant="number">{inr(p.securityDeposit)}</T>
            </Card>
          </Row>
          {p.retailValue ? (
            <T variant="small" style={{ marginTop: space.sm }}>
              Retail value {inr(p.retailValue)} — wear it for a fraction.
            </T>
          ) : null}

          {p.sizes.length ? (
            <Section title="Sizes">
              <Row style={{ flexWrap: 'wrap' }}>
                {p.sizes.map((s) => (
                  <View key={s} style={styles.size}>
                    <T variant="smallStrong">{s}</T>
                  </View>
                ))}
              </Row>
            </Section>
          ) : null}

          <Section title="The details">
            <Card>
              {p.color ? <KV label="Colour" value={p.color} /> : null}
              {p.fabric ? <KV label="Fabric" value={p.fabric} /> : null}
              {p.dressType ? <KV label="Style" value={p.dressType} /> : null}
              {p.work ? <KV label="Work" value={p.work} /> : null}
              {p.description ? (
                <>
                  <Divider />
                  <T variant="body" muted>
                    {p.description}
                  </T>
                </>
              ) : null}
            </Card>
          </Section>

          {q.data?.related.length ? (
            <Section title="You may also love">
              <FlatList
                horizontal
                data={q.data.related}
                keyExtractor={(r) => r._id}
                style={{ marginHorizontal: -space.lg }}
                contentContainerStyle={{ gap: space.md, paddingHorizontal: space.lg }}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <DressCard
                    product={item}
                    w={width * 0.42}
                    onPress={() => nav.push('Dress', { id: item._id })}
                  />
                )}
              />
            </Section>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.cta, { paddingBottom: insets.bottom + space.md }]}>
        <LinearGradient
          colors={[alpha(colors.bg, 0), colors.bg]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Button
          title="Request this dress"
          icon="CalendarCheck"
          size="lg"
          onPress={() => setRequestOpen(true)}
        />
      </View>
      <RequestSheet product={p} visible={requestOpen} onClose={() => setRequestOpen(false)} />
    </View>
  );
}

function RequestSheet({
  product,
  visible,
  onClose,
}: {
  product: ProductDetail;
  visible: boolean;
  onClose: () => void;
}) {
  const me = useApi<{ me: Me }>('/api/mobile/me');
  const [eventDate, setEventDate] = useState('');
  const [pickup, setPickup] = useState('');
  const [ret, setRet] = useState('');
  const [size, setSize] = useState(product.sizes[0] ?? '');
  const [trial, setTrial] = useState(false);
  const [message, setMessage] = useState('');
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const premium = me.data?.me.premium.isActive;

  useEffect(() => {
    if (!pickup || !ret) return setAvailability(null);
    api
      .get<{ availability: { available: boolean } | null }>(`/api/mobile/products/${product._id}`, {
        from: pickup,
        to: ret,
      })
      .then((r) => setAvailability(r.availability?.available ?? null))
      .catch(() => setAvailability(null));
  }, [pickup, ret, product._id]);

  const submit = async () => {
    if (!eventDate) return toast.error('When is your event?');
    setBusy(true);
    try {
      await api.post('/api/mobile/enquiries', {
        productId: product._id,
        eventDate,
        pickupDate: pickup || undefined,
        returnDate: ret || undefined,
        size,
        wantsTrial: trial,
        message,
      });
      haptic('success');
      setDone(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setDone(false);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={done ? undefined : 'Request this dress'}
      subtitle={done ? undefined : product.name}
      footer={
        done ? (
          <Button title="Done" onPress={close} />
        ) : (
          <Button
            title={premium ? 'Send priority request' : 'Send request'}
            icon={premium ? 'Crown' : 'Send'}
            onPress={submit}
            loading={busy}
          />
        )
      }
    >
      {done ? (
        <View style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Monogram size={80} />
          <T variant="h1" align="center" style={{ marginTop: space.lg }}>
            Request received
          </T>
          <T variant="body" muted align="center" style={{ marginTop: space.sm }}>
            {premium ? 'As a Privé member you’re first in line — ' : ''}our atelier will call you shortly to
            confirm fitting, dates and price.
          </T>
        </View>
      ) : (
        <>
          <DateField
            label="Event date"
            value={eventDate}
            onChange={setEventDate}
            required
            minimumDate={new Date()}
          />
          <Row gap={space.md}>
            <DateField
              label="Pickup"
              value={pickup}
              onChange={(v) => {
                setPickup(v);
                if (!ret || ret < v) setRet(v);
              }}
              minimumDate={new Date()}
              style={{ flex: 1 }}
            />
            <DateField
              label="Return"
              value={ret}
              onChange={setRet}
              minimumDate={pickup ? new Date(`${pickup}T00:00:00`) : new Date()}
              style={{ flex: 1 }}
            />
          </Row>
          {availability !== null ? (
            <Card style={{ marginBottom: space.lg }}>
              <Row>
                <Icon
                  name={availability ? 'BadgeCheck' : 'CircleAlert'}
                  color={availability ? colors.success : colors.warning}
                />
                <T variant="bodyStrong" color={availability ? colors.success : colors.warning}>
                  {availability
                    ? 'Available for your dates'
                    : 'Booked on some of these dates — we’ll suggest options'}
                </T>
              </Row>
            </Card>
          ) : null}
          {product.sizes.length ? (
            <SelectField
              label="Size"
              value={size}
              onChange={setSize}
              options={product.sizes.map((s) => ({ value: s, label: s }))}
            />
          ) : null}
          <ToggleRow label="I’d like a trial fitting" value={trial} onChange={setTrial} />
          <Input
            label="Anything we should know?"
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="Height, alterations, styling…"
          />
          {!me.data?.me.phone ? (
            <T variant="small" color={colors.warning}>
              Add your mobile number in Profile so we can call you back.
            </T>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Wishlist

export function WishlistScreen() {
  const nav = useNav();
  const q = useApi<{ products: ProductCard[] }>('/api/mobile/me/wishlist');
  return (
    <Screen
      header={<Header title="Wishlist" large />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      {q.isLoading ? <Loading variant="grid" /> : null}
      {q.data?.products.length === 0 ? (
        <Empty
          icon="Heart"
          title="Nothing saved yet"
          body="Tap the heart on any dress to keep it here."
          action={<Button title="Explore dresses" onPress={() => nav.navigate('Explore')} />}
        />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {q.data?.products.map((p) => (
          <DressCard key={p._id} product={p} onPress={() => nav.navigate('Dress', { id: p._id })} />
        ))}
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// My bookings

const TIMELINE: MyBooking['status'][] = ['confirmed', 'in_use', 'returned'];

export function MyBookingsScreen() {
  const nav = useNav();
  const q = useApi<{ bookings: MyBooking[] }>('/api/mobile/me/bookings');
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const all = q.data?.bookings ?? [];
  const upcoming = all.filter((b) => b.status !== 'returned' && b.status !== 'cancelled');
  const past = all.filter((b) => b.status === 'returned' || b.status === 'cancelled');
  const list = tab === 'upcoming' ? upcoming : past;
  return (
    <Screen
      header={<Header title="My bookings" large />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      <Chips
        options={[
          { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { value: 'past', label: 'Past', count: past.length },
        ]}
        value={tab}
        onChange={setTab}
        style={{ marginHorizontal: -space.lg, marginBottom: space.lg }}
      />
      {q.isLoading ? <Loading variant="list" /> : null}
      {!q.isLoading && list.length === 0 ? (
        <Empty
          icon="CalendarCheck"
          title={tab === 'upcoming' ? 'No upcoming rentals' : 'No past rentals'}
          body="Bookings made at the boutique with your email appear here automatically."
          action={
            tab === 'upcoming' ? (
              <Button title="Find your look" onPress={() => nav.navigate('Explore')} />
            ) : undefined
          }
        />
      ) : null}
      {list.map((b) => {
        const st = BOOKING_STATUS[b.status];
        return (
          <Card
            key={b._id}
            style={{ marginBottom: space.md }}
            onPress={() => nav.navigate('MyBooking', { id: b._id })}
          >
            <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
              <Img src={b.items[0]?.image} style={{ width: 72, height: 92 }} />
              <View style={{ flex: 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T variant="caption">{b.bookingNumber}</T>
                  <Pill label={st.label} tone={st.tone} small />
                </Row>
                <T variant="h3" numberOfLines={1} style={{ marginTop: 4 }}>
                  {b.items.map((i) => i.name).join(', ')}
                </T>
                <T variant="small">{fmtRange(b.rentalStartDate, b.rentalEndDate)}</T>
                {b.remainingDue > 0 && b.status !== 'cancelled' ? (
                  <T variant="smallStrong" color={colors.warning} style={{ marginTop: 4 }}>
                    {inr(b.remainingDue)} due at pickup
                  </T>
                ) : null}
              </View>
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}

export function MyBookingScreen() {
  const nav = useNav();
  const { id } = useParams<{ id: string }>();
  const q = useApi<{
    booking: MyBooking;
    invoices: {
      _id: string;
      invoiceNumber: string;
      status: string;
      total: number;
      amountDue: number;
      issuedAt: string;
    }[];
  }>(id ? `/api/mobile/me/bookings/${id}` : null);
  if (q.isLoading)
    return (
      <Screen header={<Header title="Booking" />}>
        <Loading />
      </Screen>
    );
  const b = q.data?.booking;
  if (!b)
    return (
      <Screen header={<Header title="Booking" />}>
        <ErrorState message={errorMessage(q.error)} />
      </Screen>
    );
  const st = BOOKING_STATUS[b.status];
  const step = TIMELINE.indexOf(b.status);
  const rent = b.totalAmount - b.securityDeposit;

  return (
    <Screen
      header={<Header title={b.bookingNumber} />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      <Pill label={st.label} tone={st.tone} />
      {b.status !== 'cancelled' ? (
        <Card style={{ marginTop: space.lg }}>
          {[
            { key: 'confirmed', title: 'Confirmed', body: 'Your dress is reserved for you.' },
            {
              key: 'in_use',
              title: `Pickup · ${fmtDate(b.rentalStartDate)}`,
              body: 'Collect from the boutique.',
            },
            {
              key: 'returned',
              title: `Return · ${fmtDate(b.rentalEndDate)}`,
              body: 'Bring it back — we take care of cleaning.',
            },
          ].map((s, i) => {
            const reached = step >= i;
            return (
              <Row
                key={s.key}
                gap={space.md}
                style={{ alignItems: 'flex-start', marginBottom: i < 2 ? space.lg : 0 }}
              >
                <View
                  style={[styles.dot, reached && { backgroundColor: colors.gold, borderColor: colors.gold }]}
                >
                  {reached ? <Icon name="Check" size={12} color={colors.onGold} strokeWidth={3} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong" color={reached ? colors.text : colors.textMuted}>
                    {s.title}
                  </T>
                  <T variant="small">{s.body}</T>
                </View>
              </Row>
            );
          })}
        </Card>
      ) : null}

      <Section title="Your dresses">
        {b.items.map((i, idx) => (
          <ListRow
            key={idx}
            leading={<Img src={i.image} style={{ width: 48, height: 60 }} rounded={8} />}
            title={i.name}
            subtitle={[i.color, i.size, i.wearerName].filter(Boolean).join(' · ')}
            right={<T variant="bodyStrong">{inr(i.rentalFee)}</T>}
            chevron={false}
          />
        ))}
      </Section>

      <Section title="Payment">
        <Card>
          <KV label="Rent" value={inr(rent)} />
          <KV label="Security deposit" value={inr(b.securityDeposit)} />
          <KV label="Paid so far" value={inr(b.advancePaid)} />
          <Divider />
          <KV
            label="Balance"
            value={inr(b.remainingDue)}
            strong
            tone={b.remainingDue > 0 ? 'warning' : 'success'}
          />
          {b.status === 'returned' && (b.depositRefundAmount ?? 0) > 0 ? (
            <KV
              label="Deposit refund"
              value={`${inr(b.depositRefundAmount)} · ${b.depositRefunded ? 'refunded' : 'processing'}`}
              tone={b.depositRefunded ? 'success' : 'info'}
            />
          ) : null}
        </Card>
      </Section>

      {q.data?.invoices.length ? (
        <Section title="Bills">
          {q.data.invoices.map((inv) => (
            <ListRow
              key={inv._id}
              icon="FileText"
              title={inv.invoiceNumber}
              subtitle={`${inr(inv.total)} · ${fmtDate(inv.issuedAt)}`}
              right={
                <Tap
                  onPress={() => openUrl(api.url(`/bill/${inv._id}/hi`))}
                  hitSlop={8}
                  accessibilityLabel="Hindi bill"
                  style={{ paddingHorizontal: space.sm }}
                >
                  <T variant="smallStrong" gold>
                    हिंदी
                  </T>
                </Tap>
              }
              chevron={false}
              onPress={() => openUrl(pdfUrl('invoices', inv._id))}
            />
          ))}
        </Section>
      ) : null}

      {b.reviewToken ? (
        <Section title="How was it?">
          <Button
            title="Leave a review"
            icon="Star"
            variant="outline"
            onPress={() => nav.navigate('Review', { token: b.reviewToken })}
          />
        </Section>
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Addresses

export function AddressesScreen() {
  const invalidate = useInvalidate();
  const q = useApi<{ me: Me }>('/api/mobile/me');
  const [editing, setEditing] = useState<{
    index: number;
    label: string;
    line1: string;
    city: string;
    state: string;
    postalCode: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const addresses = q.data?.me.addresses ?? [];

  const save = async (next: Me['addresses']) => {
    setBusy(true);
    try {
      await api.patch('/api/mobile/me', { addresses: next });
      invalidate('/api/mobile/me');
      setEditing(null);
      toast.success('Addresses saved');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Header title="Addresses" />}
      footer={
        <Button
          title="Add address"
          icon="Plus"
          onPress={() =>
            setEditing({ index: -1, label: 'Home', line1: '', city: '', state: '', postalCode: '' })
          }
        />
      }
    >
      {addresses.length === 0 && !q.isLoading ? <Empty icon="MapPin" title="No saved addresses" /> : null}
      {addresses.map((a, i) => (
        <ListRow
          key={i}
          icon="MapPin"
          title={a.label}
          subtitle={[a.line1, a.city, a.state, a.postalCode].filter(Boolean).join(', ')}
          right={a.isDefault ? <Pill label="Default" small /> : undefined}
          onPress={() =>
            setEditing({
              index: i,
              label: a.label,
              line1: a.line1,
              city: a.city,
              state: a.state,
              postalCode: a.postalCode,
            })
          }
        />
      ))}
      <Sheet
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.index === -1 ? 'New address' : 'Edit address'}
        footer={
          <View style={{ gap: space.sm }}>
            <Button
              title="Save"
              loading={busy}
              onPress={() => {
                if (!editing) return;
                const { index, ...addr } = editing;
                const next = [...addresses];
                if (index === -1) next.push({ ...addr, isDefault: next.length === 0 });
                else next[index] = { ...next[index], ...addr };
                save(next);
              }}
            />
            {editing && editing.index >= 0 ? (
              <>
                <Button
                  title="Make default"
                  variant="outline"
                  onPress={() => save(addresses.map((a, i) => ({ ...a, isDefault: i === editing.index })))}
                />
                <Button
                  title="Delete"
                  variant="danger"
                  onPress={() => save(addresses.filter((_, i) => i !== editing.index))}
                />
              </>
            ) : null}
          </View>
        }
      >
        <Input
          label="Label"
          value={editing?.label ?? ''}
          onChangeText={(v) => setEditing((s) => (s ? { ...s, label: v } : s))}
        />
        <Input
          label="Address"
          value={editing?.line1 ?? ''}
          onChangeText={(v) => setEditing((s) => (s ? { ...s, line1: v } : s))}
          multiline
        />
        <Row gap={space.md}>
          <Input
            label="City"
            value={editing?.city ?? ''}
            onChangeText={(v) => setEditing((s) => (s ? { ...s, city: v } : s))}
            style={{ flex: 1 }}
          />
          <Input
            label="PIN"
            value={editing?.postalCode ?? ''}
            keyboardType="number-pad"
            onChangeText={(v) => setEditing((s) => (s ? { ...s, postalCode: v } : s))}
            style={{ flex: 1 }}
          />
        </Row>
        <Input
          label="State"
          value={editing?.state ?? ''}
          onChangeText={(v) => setEditing((s) => (s ? { ...s, state: v } : s))}
        />
      </Sheet>
    </Screen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    statCell: {
      flexGrow: 1,
      minWidth: '45%',
      padding: space.md,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    priveBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      padding: space.lg,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.goldDeep,
    },
    arch: {
      width: 104,
      height: 136,
      borderTopLeftRadius: 52,
      borderTopRightRadius: 52,
      borderBottomLeftRadius: radius.md,
      borderBottomRightRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.goldDeep,
      backgroundColor: colors.surfaceHigh,
    },
    stepIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.goldDeep,
    },
    size: {
      minWidth: 48,
      height: 40,
      paddingHorizontal: space.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      marginRight: space.sm,
      marginBottom: space.sm,
    },
    cta: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: space.lg,
      paddingTop: space.xl,
    },
    dot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
  })
);

/** Last 8 searches, kept on the device (Explore). */
function useRecentSearches() {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    prefs.get('recentSearches').then((raw) => {
      try {
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) setItems(parsed.filter((x) => typeof x === 'string').slice(0, 8));
      } catch {
        // ignore bad data
      }
    });
  }, []);
  const save = (next: string[]) => {
    setItems(next);
    prefs.set('recentSearches', JSON.stringify(next));
  };
  return {
    items,
    add: (q: string) =>
      setItems((prev) => {
        const next = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
        prefs.set('recentSearches', JSON.stringify(next));
        return next;
      }),
    clear: () => save([]),
  };
}

const exploreStyles = themed(() =>
  StyleSheet.create({
    recent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: space.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
  })
);
