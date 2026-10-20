import React, { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import { api, errorMessage } from '../../api/client';
import { useApi, useList } from '../../api/hooks';
import type { CustomerHome, ProductCard } from '../../api/types';
import {
  Button,
  Card,
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
  Section,
  SelectField,
  T,
  Tap,
  toast,
} from '../../components/ui';
import { Monogram } from '../../components/brand/Monogram';
import { colors, gradients, radius, space, themed } from '../../theme';
import { useNav, useParams } from '../../navigation/nav';
import { fmtDate, fmtRange } from '../../lib/format';
import { BOOKING_STATUS } from '../../lib/labels';
import { call, openUrl, whatsapp } from '../../lib/share';
import { useAuth } from '../../auth/AuthContext';
import { haptic } from '../../lib/haptics';

const { width } = Dimensions.get('window');

// ------------------------------------------------------------- content ---

export interface SiteContent {
  brand: {
    name: string;
    nameHi: string;
    shortName: string;
    tagline: string;
    description: string;
    url: string;
  };
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    addressHi: string;
    hours: string;
    intro: string;
  };
  social: { instagram: string; facebook: string; pinterest: string };
  stats: { label: string; value: number; suffix: string; decimals: number }[];
  whyChooseUs: { title: string; description: string; icon: string }[];
  rentalProcess: { step: string; title: string; description: string }[];
  testimonials: { name: string; role: string; rating: number; quote: string; avatar: string }[];
  testimonialSummary: string;
  faqs: { question: string; answer: string }[];
  offers: { icon: string; code: string; title: string; description: string }[];
  offersNote: string;
  about: { kicker: string; title: string; image: string; paragraphs: string[] };
  blog: {
    slug: string;
    title: string;
    excerpt: string;
    coverImage: string;
    author: string;
    publishedAt: string;
    readingTime: string;
    content: string[];
  }[];
  terms: { updated: string; sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[] };
  privacy: { updated: string; sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[] };
}

/** Website copy (About, Offers, FAQ, Blog, policies…) — public, cached for the session. */
export function useContent() {
  return useApi<SiteContent>('/api/mobile/content');
}

function Kicker({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <View style={{ marginBottom: space.xl }}>
      <T variant="caption" gold>
        {kicker}
      </T>
      <T variant="hero" style={{ marginTop: space.xs }}>
        {title}
      </T>
      {body ? (
        <T variant="body" muted style={{ marginTop: space.sm }}>
          {body}
        </T>
      ) : null}
    </View>
  );
}

function ContentGate({ children }: { children: (c: SiteContent) => React.ReactNode }) {
  const q = useContent();
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <>{children(q.data)}</>;
}

// -------------------------------------------------------------- hub -------

/** Everything from the website's menu and footer, in one list. */
export function InfoHubScreen() {
  const nav = useNav();
  const { status } = useAuth();
  const signedIn = status === 'signedIn';
  const items = [
    { label: 'About us', icon: 'Sparkles', route: 'About' },
    { label: 'Offers', icon: 'Gift', route: 'Offers' },
    ...(signedIn
      ? [
          { label: 'Collections', icon: 'FolderTree', route: 'Collections' },
          { label: 'Gallery', icon: 'Image', route: 'Gallery' },
        ]
      : []),
    { label: 'Testimonials', icon: 'Star', route: 'Testimonials' },
    { label: 'Journal (blog)', icon: 'FileText', route: 'Blog' },
    { label: 'FAQ', icon: 'Info', route: 'Faq' },
    { label: 'Contact us', icon: 'Phone', route: 'Contact' },
    { label: 'Track a booking', icon: 'Truck', route: 'TrackOrder' },
    { label: 'Terms & conditions', icon: 'ShieldCheck', route: 'Legal', params: { kind: 'terms' } },
    { label: 'Privacy policy', icon: 'Lock', route: 'Legal', params: { kind: 'privacy' } },
  ];
  return (
    <Screen header={<Header title="Color Times" subtitle="About the boutique" />}>
      <View style={{ alignItems: 'center', marginVertical: space.lg }}>
        <Monogram size={72} />
      </View>
      {items.map((i) => (
        <ListRow
          key={i.label}
          icon={i.icon}
          title={i.label}
          onPress={() => nav.navigate(i.route, i.params)}
        />
      ))}
    </Screen>
  );
}

// ------------------------------------------------------------ about -------

export function AboutScreen() {
  return (
    <Screen header={<Header title="" />}>
      <ContentGate>
        {(c) => (
          <>
            <Kicker kicker={c.about.kicker} title={c.about.title} />
            <Img src={c.about.image} style={{ width: '100%', height: 380 }} rounded={radius.xl} />
            {c.about.paragraphs.map((p, i) => (
              <T key={i} variant="body" muted style={{ marginTop: space.lg }}>
                {p}
              </T>
            ))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xxl }}>
              {c.stats.map((s) => (
                <Card key={s.label} style={{ flexGrow: 1, minWidth: '45%' }}>
                  <T variant="number" gold>
                    {s.value.toLocaleString('en-IN', { maximumFractionDigits: s.decimals })}
                    {s.suffix}
                  </T>
                  <T variant="small">{s.label}</T>
                </Card>
              ))}
            </View>
            <Section title="Our promise to you">
              {c.whyChooseUs.map((w) => (
                <Row
                  key={w.title}
                  gap={space.md}
                  style={{ alignItems: 'flex-start', marginBottom: space.lg }}
                >
                  <LinearGradient colors={[...gradients.gold]} style={styles.round}>
                    <Icon name={w.icon} size={18} color={colors.onGold} strokeWidth={2} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong">{w.title}</T>
                    <T variant="small">{w.description}</T>
                  </View>
                </Row>
              ))}
            </Section>
          </>
        )}
      </ContentGate>
    </Screen>
  );
}

// ----------------------------------------------------------- offers -------

export function OffersScreen() {
  const nav = useNav();
  const { status } = useAuth();
  return (
    <Screen header={<Header title="" />}>
      <ContentGate>
        {(c) => (
          <>
            <Kicker kicker="Save more" title="Current offers" body={c.offersNote} />
            {c.offers.map((o) => (
              <Card key={o.code} style={{ marginBottom: space.md }}>
                <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
                  <LinearGradient colors={[...gradients.gold]} style={styles.round}>
                    <Icon name={o.icon} size={18} color={colors.onGold} strokeWidth={2} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <T variant="h3">{o.title}</T>
                    <T variant="small" style={{ marginTop: 4 }}>
                      {o.description}
                    </T>
                    <View style={styles.code}>
                      <T variant="bodyStrong" gold selectable style={{ letterSpacing: 2 }}>
                        {o.code}
                      </T>
                    </View>
                    <T variant="small" color={colors.textFaint}>
                      Mention this code when you book. Long-press to copy.
                    </T>
                  </View>
                </Row>
              </Card>
            ))}
            {status === 'signedIn' ? (
              <Button
                title="Start browsing"
                onPress={() => nav.navigate('Explore')}
                style={{ marginTop: space.lg }}
              />
            ) : null}
          </>
        )}
      </ContentGate>
    </Screen>
  );
}

// ------------------------------------------------------ testimonials ------

export function TestimonialsScreen() {
  return (
    <Screen header={<Header title="" />}>
      <ContentGate>
        {(c) => (
          <>
            <Kicker kicker="Loved by our customers" title="Testimonials" />
            <Row style={{ marginTop: -space.md, marginBottom: space.xl }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Icon key={i} name="Star" size={16} color={colors.gold} fill={colors.gold} />
              ))}
              <T variant="small">{c.testimonialSummary}</T>
            </Row>
            {c.testimonials.map((t) => (
              <Card key={t.name} style={{ marginBottom: space.md }}>
                <T variant="h1" gold style={{ lineHeight: 30 }}>
                  “
                </T>
                <T variant="body" style={{ fontStyle: 'italic' }}>
                  {t.quote}
                </T>
                <Row gap={space.md} style={{ marginTop: space.lg }}>
                  <Img src={t.avatar} style={{ width: 44, height: 44 }} rounded={22} />
                  <View>
                    <T variant="bodyStrong">{t.name}</T>
                    <T variant="small">{t.role}</T>
                  </View>
                </Row>
              </Card>
            ))}
          </>
        )}
      </ContentGate>
    </Screen>
  );
}

// --------------------------------------------------------------- faq ------

export function FaqScreen() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen header={<Header title="" />}>
      <ContentGate>
        {(c) => (
          <>
            <Kicker kicker="Help" title="Frequently asked" />
            {c.faqs.map((f, i) => (
              <Tap
                key={f.question}
                onPress={() => {
                  haptic('select');
                  setOpen(open === i ? null : i);
                }}
                hapticOnPress={false}
                scaleTo={0.99}
                style={[styles.faq, open === i && { borderColor: colors.goldDeep }]}
              >
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <T variant="bodyStrong" style={{ flex: 1 }}>
                    {f.question}
                  </T>
                  <Icon name={open === i ? 'X' : 'Plus'} size={18} color={colors.gold} />
                </Row>
                {open === i ? (
                  <T variant="body" muted style={{ marginTop: space.sm }}>
                    {f.answer}
                  </T>
                ) : null}
              </Tap>
            ))}
            <Card style={{ marginTop: space.lg }}>
              <T variant="bodyStrong">Still have a question?</T>
              <T variant="small">Our team usually replies within 24 hours.</T>
              <Row style={{ marginTop: space.md }}>
                <Button
                  title="Call"
                  icon="Phone"
                  size="sm"
                  variant="surface"
                  onPress={() => call(c.contact.phone)}
                />
                <Button
                  title="WhatsApp"
                  icon="MessageCircle"
                  size="sm"
                  variant="surface"
                  onPress={() => whatsapp(c.contact.whatsapp)}
                />
              </Row>
            </Card>
          </>
        )}
      </ContentGate>
    </Screen>
  );
}

// -------------------------------------------------------------- blog ------

export function BlogScreen() {
  const nav = useNav();
  return (
    <Screen header={<Header title="" />}>
      <ContentGate>
        {(c) => (
          <>
            <Kicker kicker="The journal" title="Style notes" />
            {c.blog.map((p) => (
              <Tap
                key={p.slug}
                onPress={() => nav.navigate('BlogPost', { slug: p.slug })}
                style={{ marginBottom: space.xl }}
              >
                <Img src={p.coverImage} style={{ width: '100%', height: 220 }} rounded={radius.xl} />
                <T variant="caption" style={{ marginTop: space.md }}>
                  {fmtDate(p.publishedAt)} · {p.readingTime}
                </T>
                <T variant="h2" style={{ marginTop: 4 }}>
                  {p.title}
                </T>
                <T variant="small">{p.excerpt}</T>
              </Tap>
            ))}
          </>
        )}
      </ContentGate>
    </Screen>
  );
}

export function BlogPostScreen() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <Screen header={<Header title="" />}>
      <ContentGate>
        {(c) => {
          const p = c.blog.find((b) => b.slug === slug);
          if (!p) return <Empty title="Article not found" />;
          return (
            <>
              <T variant="caption" gold>
                {p.author}
              </T>
              <T variant="hero" style={{ marginTop: space.xs }}>
                {p.title}
              </T>
              <T variant="small" style={{ marginTop: space.sm }}>
                {fmtDate(p.publishedAt)} · {p.readingTime}
              </T>
              <Img
                src={p.coverImage}
                style={{ width: '100%', height: 260, marginTop: space.lg }}
                rounded={radius.xl}
              />
              {p.content.map((para, i) => (
                <T key={i} variant="body" style={{ marginTop: space.lg, lineHeight: 25 }}>
                  {para}
                </T>
              ))}
            </>
          );
        }}
      </ContentGate>
    </Screen>
  );
}

// ------------------------------------------------------------ legal -------

export function LegalScreen() {
  const { kind } = useParams<{ kind: 'terms' | 'privacy' }>();
  return (
    <Screen header={<Header title="" />}>
      <ContentGate>
        {(c) => {
          const doc = kind === 'privacy' ? c.privacy : c.terms;
          return (
            <>
              <Kicker
                kicker="Legal"
                title={kind === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
                body={`Last updated: ${doc.updated}`}
              />
              {doc.sections.map((s) => (
                <View key={s.heading} style={{ marginBottom: space.xl }}>
                  <T variant="h3">{s.heading}</T>
                  {s.paragraphs?.map((p, i) => (
                    <T key={i} variant="body" muted style={{ marginTop: space.sm }}>
                      {p}
                    </T>
                  ))}
                  {s.bullets?.map((b, i) => (
                    <Row key={i} gap={space.sm} style={{ alignItems: 'flex-start', marginTop: space.sm }}>
                      <T variant="body" gold>
                        •
                      </T>
                      <T variant="body" muted style={{ flex: 1 }}>
                        {b}
                      </T>
                    </Row>
                  ))}
                </View>
              ))}
            </>
          );
        }}
      </ContentGate>
    </Screen>
  );
}

// ---------------------------------------------------------- contact -------

export function ContactScreen() {
  const { user } = useAuth();
  const [f, setF] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: '',
    reason: 'general',
    message: '',
  });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async () => {
    if (f.message.trim().length < 10) return toast.error('Tell us a little more (min 10 characters)');
    setBusy(true);
    try {
      await api.post('/api/contact', { ...f, phone: f.phone.replace(/\D/g, '') });
      haptic('success');
      setSent(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen header={<Header title="" />}>
      <ContentGate>
        {(c) => (
          <>
            <Kicker kicker="We'd love to hear from you" title="Get in touch" body={c.contact.intro} />
            <Card>
              <ListRow
                icon="MapPin"
                title="Visit our showroom"
                subtitle={c.contact.address}
                onPress={() => openUrl(`https://maps.google.com/?q=${encodeURIComponent(c.contact.address)}`)}
              />
              <ListRow
                icon="Phone"
                title="Call"
                subtitle={c.contact.phone}
                onPress={() => call(c.contact.phone)}
              />
              <ListRow
                icon="MessageCircle"
                title="WhatsApp"
                subtitle={c.contact.whatsapp}
                onPress={() => whatsapp(c.contact.whatsapp)}
              />
              <ListRow
                icon="Mail"
                title="Email"
                subtitle={c.contact.email}
                onPress={() => openUrl(`mailto:${c.contact.email}`)}
              />
              <ListRow icon="Clock" title="Showroom hours" subtitle={c.contact.hours} chevron={false} />
            </Card>
            <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
              <Button
                title="Instagram"
                size="sm"
                variant="surface"
                onPress={() => openUrl(c.social.instagram)}
              />
              <Button
                title="Facebook"
                size="sm"
                variant="surface"
                onPress={() => openUrl(c.social.facebook)}
              />
              <Button
                title="Pinterest"
                size="sm"
                variant="surface"
                onPress={() => openUrl(c.social.pinterest)}
              />
            </Row>
            <Section title="Send us a message">
              {sent ? (
                <Card>
                  <Row>
                    <Icon name="BadgeCheck" color={colors.success} />
                    <T variant="bodyStrong">Message received — we’ll be in touch soon.</T>
                  </Row>
                </Card>
              ) : (
                <>
                  <Input label="Name" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} required />
                  <Input
                    label="Email"
                    value={f.email}
                    onChangeText={(v) => setF({ ...f, email: v })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    required
                  />
                  <Input
                    label="Mobile"
                    hint="optional"
                    value={f.phone}
                    onChangeText={(v) => setF({ ...f, phone: v })}
                    keyboardType="phone-pad"
                  />
                  <SelectField
                    label="Reason"
                    value={f.reason}
                    onChange={(v) => setF({ ...f, reason: v })}
                    options={[
                      { value: 'general', label: 'General question' },
                      { value: 'booking_inquiry', label: 'Booking enquiry' },
                      { value: 'support', label: 'Support' },
                      { value: 'partnership', label: 'Partnership' },
                    ]}
                  />
                  <Input
                    label="Message"
                    value={f.message}
                    onChangeText={(v) => setF({ ...f, message: v })}
                    multiline
                    required
                  />
                  <Button title="Send message" onPress={submit} loading={busy} />
                </>
              )}
            </Section>
          </>
        )}
      </ContentGate>
    </Screen>
  );
}

// ------------------------------------------------------- track order ------

export function TrackOrderScreen() {
  const { user } = useAuth();
  const [number, setNumber] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    bookingNumber: string;
    status: keyof typeof BOOKING_STATUS;
    rentalStartDate: string;
    rentalEndDate: string;
    eventDate: string;
  } | null>(null);
  const track = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(
        await api.post('/api/bookings/track', {
          bookingNumber: number.trim(),
          email: email.trim().toLowerCase(),
        })
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const st = result ? BOOKING_STATUS[result.status] : null;
  return (
    <Screen header={<Header title="" />}>
      <Kicker
        kicker="Order tracking"
        title="Where’s my dress?"
        body="Enter your booking number and the email you booked with."
      />
      <Input
        label="Booking number"
        value={number}
        onChangeText={setNumber}
        autoCapitalize="characters"
        placeholder="CTB-…"
      />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Button title="Track" icon="Search" onPress={track} loading={busy} />
      {result && st ? (
        <Card style={{ marginTop: space.xl }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h2">{result.bookingNumber}</T>
            <Pill label={st.label} tone={st.tone} />
          </Row>
          <Divider />
          <KV label="Rental" value={fmtRange(result.rentalStartDate, result.rentalEndDate)} />
          <KV label="Event" value={fmtDate(result.eventDate)} />
        </Card>
      ) : null}
    </Screen>
  );
}

// -------------------------------------------------- collections / gallery --

export function CollectionsScreen() {
  const nav = useNav();
  const q = useApi<CustomerHome>('/api/mobile/home');
  return (
    <Screen
      header={<Header title="Collections" large />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      {q.isLoading ? <Loading variant="grid" /> : null}
      {q.data?.categories.map((c) => (
        <Tap
          key={c._id}
          onPress={() => nav.navigate('Collection', { category: c.slug, title: c.name })}
          style={{ marginBottom: space.lg }}
        >
          <View style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
            <Img src={c.heroImage} style={{ width: '100%', height: 220 }} rounded={radius.xl} />
            <LinearGradient colors={[...gradients.veil]} style={StyleSheet.absoluteFill} />
            <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg }}>
              <T variant="h1">{c.name}</T>
              {c.description ? (
                <T variant="small" color={colors.text} numberOfLines={2}>
                  {c.description}
                </T>
              ) : null}
            </View>
          </View>
        </Tap>
      ))}
      {q.data?.designers?.length ? (
        <Section title="Designers">
          {q.data.designers.map((d) => (
            <ListRow
              key={d.name}
              leading={<Img src={d.image} style={{ width: 44, height: 44 }} rounded={22} />}
              title={d.name}
              subtitle={`${d.productCount} pieces`}
              onPress={() => nav.navigate('Collection', { designer: d.name, title: d.name })}
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

export function GalleryScreen() {
  const nav = useNav();
  const list = useList<ProductCard>('/api/mobile/products', 'products', {}, 40);
  const colW = (width - space.lg * 2 - space.sm) / 2;
  const left = list.items.filter((_, i) => i % 2 === 0);
  const right = list.items.filter((_, i) => i % 2 === 1);
  const tile = (p: ProductCard, i: number) => (
    <Tap key={p._id} onPress={() => nav.navigate('Dress', { id: p._id })} style={{ marginBottom: space.sm }}>
      <Img
        src={p.images[0]}
        style={{ width: colW, height: colW * (i % 3 === 0 ? 1.45 : 1.2) }}
        rounded={radius.lg}
      />
      <T variant="smallStrong" numberOfLines={1} style={{ marginTop: 4 }}>
        {p.name}
      </T>
      {p.designer ? <T variant="small">{p.designer}</T> : null}
    </Tap>
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 80 }}>
      <Header title="Gallery" large subtitle="Styled moments" />
      {list.isLoading ? <Loading variant="grid" inset /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg }}>
        <View>{left.map((p, i) => tile(p, i * 2))}</View>
        <View>{right.map((p, i) => tile(p, i * 2 + 1))}</View>
      </View>
      {list.hasNextPage ? (
        <Button
          title="Load more"
          variant="ghost"
          onPress={() => list.fetchNextPage()}
          loading={list.isFetchingNextPage}
        />
      ) : null}
    </ScrollView>
  );
}

// ----------------------------------------------------------- review -------

interface ReviewInfo {
  bookingNumber: string;
  customerName: string;
  items: { name: string; image: string }[];
  minPhotos: number;
  maxPhotos: number;
  review: { rating: number; comment: string; images: string[]; createdAt: string } | null;
}

/** Native version of the web review page (/review/[token]) — stars, words and 1–4 photos. */
export function ReviewScreen() {
  const nav = useNav();
  const { token } = useParams<{ token: string }>();
  const q = useApi<ReviewInfo>(token ? `/api/reviews/${token}` : null);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const info = q.data;

  const addPhotos = async () => {
    const r = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: (info?.maxPhotos ?? 4) - photos.length,
      maxWidth: 2000,
      maxHeight: 2400,
      quality: 0.8,
    });
    if (r.assets) setPhotos((p) => [...p, ...r.assets!].slice(0, info?.maxPhotos ?? 4));
  };

  const submit = async () => {
    if (!rating) return toast.error('Choose a star rating');
    if (photos.length < (info?.minPhotos ?? 1))
      return toast.error(`Add at least ${info?.minPhotos ?? 1} photo`);
    setBusy(true);
    try {
      const form = new FormData();
      form.append('customerName', (name || info?.customerName || '').trim());
      form.append('rating', String(rating));
      form.append('comment', comment.trim());
      photos.forEach((p, i) =>
        form.append('images', {
          uri: p.uri,
          name: p.fileName ?? `review-${i}.jpg`,
          type: p.type ?? 'image/jpeg',
        } as unknown as Blob)
      );
      await api.upload(`/api/reviews/${token}`, form);
      haptic('success');
      setDone(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading)
    return (
      <Screen header={<Header title="Review" />}>
        <Loading />
      </Screen>
    );
  if (!info)
    return (
      <Screen header={<Header title="Review" />}>
        <ErrorState message={errorMessage(q.error)} />
      </Screen>
    );

  if (done || info.review) {
    const r = info.review;
    return (
      <Screen header={<Header title="Review" />}>
        <View style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Monogram size={80} />
          <T variant="h1" align="center" style={{ marginTop: space.lg }}>
            Thank you
          </T>
          <T variant="body" muted align="center">
            Your review for {info.bookingNumber} is in.
          </T>
          {r ? (
            <Row style={{ marginTop: space.md }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Icon
                  key={n}
                  name="Star"
                  size={20}
                  color={colors.gold}
                  fill={n <= r.rating ? colors.gold : 'none'}
                />
              ))}
            </Row>
          ) : null}
          <Button title="Done" style={{ marginTop: space.xl }} onPress={() => nav.goBack()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={<Header title="Leave a review" subtitle={info.bookingNumber} />}
      footer={<Button title="Submit review" onPress={submit} loading={busy} />}
    >
      <Row style={{ flexWrap: 'wrap' }}>
        {info.items.map((it) => (
          <Row key={it.name} gap={space.sm} style={{ marginBottom: space.sm }}>
            <Img src={it.image} style={{ width: 44, height: 56 }} rounded={8} />
            <T variant="bodyStrong">{it.name}</T>
          </Row>
        ))}
      </Row>
      <T variant="caption" style={{ marginTop: space.lg }}>
        Your rating
      </T>
      <Row style={{ marginVertical: space.md }} gap={space.md}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Tap
            key={n}
            onPress={() => {
              haptic('select');
              setRating(n);
            }}
            hapticOnPress={false}
            scaleTo={0.85}
          >
            <Icon
              name="Star"
              size={36}
              color={colors.gold}
              fill={n <= rating ? colors.gold : 'none'}
              strokeWidth={1.4}
            />
          </Tap>
        ))}
      </Row>
      <Input label="Your name" value={name || info.customerName} onChangeText={setName} />
      <Input label="Tell us about it" hint="optional" value={comment} onChangeText={setComment} multiline />
      <T variant="caption" style={{ marginBottom: space.sm }}>
        Photos ({info.minPhotos}–{info.maxPhotos})
      </T>
      <Row style={{ flexWrap: 'wrap' }}>
        {photos.map((p, i) => (
          <View key={`${p.uri}-${i}`}>
            <Img src={p.uri} style={{ width: 80, height: 100 }} />
            <View style={{ position: 'absolute', top: 2, right: 2 }}>
              <IconButton icon="X" size={24} onPress={() => setPhotos((s) => s.filter((_, j) => j !== i))} />
            </View>
          </View>
        ))}
        {photos.length < info.maxPhotos ? (
          <Tap onPress={addPhotos} style={styles.addPhoto}>
            <Icon name="Camera" color={colors.gold} />
            <T variant="small">Add</T>
          </Tap>
        ) : null}
      </Row>
    </Screen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    code: {
      alignSelf: 'flex-start',
      marginTop: space.md,
      marginBottom: space.xs,
      paddingVertical: space.sm,
      paddingHorizontal: space.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.goldDeep,
    },
    faq: {
      padding: space.lg,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: space.sm,
    },
    addPhoto: {
      width: 80,
      height: 100,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.goldDeep,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);
