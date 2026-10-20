import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api, errorMessage } from '../../../api/client';
import { useAction, useApi, useInvalidate } from '../../../api/hooks';
import {
  Button,
  Card,
  Chips,
  Divider,
  Empty,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Input,
  KV,
  ListRow,
  ListScreen,
  Loading,
  Pill,
  Row,
  Screen,
  SearchBar,
  Section,
  Segmented,
  SelectField,
  Sheet,
  Stat,
  T,
  Tap,
  ToggleRow,
  confirm,
  toast,
  useDebounced,
} from '../../../components/ui';
import { alpha, colors, currentScheme, fonts, radius, space, themed } from '../../../theme';
import { useNav, useParams } from '../../../navigation/nav';
import { fmtDateTime, relativeTime, titleCase } from '../../../lib/format';
import { call, openUrl, shareLink } from '../../../lib/share';
import Clipboard from '@react-native-clipboard/clipboard';
import type { Tone } from '../../../lib/labels';

// ---------------------------------------------------------------- types ---

interface Unwrapped<T> {
  data: T | null;
  error: string | null;
}
interface Overview {
  config: Record<string, boolean>;
  phone: Unwrapped<{
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    messaging_limit_tier?: string;
    name_status?: string;
    account_mode?: string;
    status?: string;
    throughput?: { level?: string };
    is_official_business_account?: boolean;
  }>;
  profile: Unwrapped<{
    about?: string;
    description?: string;
    address?: string;
    email?: string;
    websites?: string[];
    vertical?: string;
    profile_picture_url?: string;
  }>;
  waba: Unwrapped<{
    id: string;
    name?: string;
    currency?: string;
    timezone_id?: string;
    message_template_namespace?: string;
    account_review_status?: string;
    business_verification_status?: string;
    ownership_type?: string;
    country?: string;
    health_status?: { can_send_message?: string };
  }>;
  phoneNumbers: Unwrapped<
    { id: string; display_phone_number?: string; verified_name?: string; quality_rating?: string }[]
  >;
  analytics: Unwrapped<{ start: number; end: number; sent: number; delivered: number }[]>;
  subscribedApps: Unwrapped<{ whatsapp_business_api_data?: { id?: string; name?: string } }[]>;
  commerce: Unwrapped<{ is_cart_enabled?: boolean; is_catalog_visible?: boolean }>;
  webhook: {
    lastVerifiedAt: string | null;
    lastEventAt: string | null;
    lastInboundAt: string | null;
    recent: { kind: string; ok: boolean; summary?: string; createdAt: string }[];
  };
  stats: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    inbound: number;
    unreadInbound: number;
  };
}

interface MetaComponent {
  type: string;
  format?: string;
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: { type: string; text: string; url?: string; phone_number?: string }[];
}
interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: MetaComponent[];
  rejected_reason?: string;
  quality_score?: { score?: string };
}
interface LocalTemplate {
  _id: string;
  name: string;
  triggerEvent: string;
  metaTemplateName?: string;
  /** Legacy Brevo-era templates: kept on save (not editable, same as web). */
  brevoTemplateId?: number;
  metaLanguageCode?: string;
  metaTemplateId?: string;
  metaStatus?: string;
  metaHeaderType: 'none' | 'document';
  previewBody: string;
  isActive: boolean;
}

const TRIGGER_EVENTS: { value: string; label: string; vars: string[] }[] = [
  {
    value: 'booking_confirmed',
    label: 'Booking Confirmed',
    vars: [
      'customerName',
      'bookingNumber',
      'productName',
      'eventDate',
      'rentalStartDate',
      'rentalEndDate',
      'totalAmount',
    ],
  },
  {
    value: 'booking_reminder',
    label: 'Booking Reminder',
    vars: ['customerName', 'bookingNumber', 'productName', 'eventDate', 'rentalStartDate'],
  },
  {
    value: 'booking_return_reminder',
    label: 'Return Reminder',
    vars: ['customerName', 'bookingNumber', 'productName', 'rentalEndDate'],
  },
  {
    value: 'booking_returned',
    label: 'Booking Returned',
    vars: ['customerName', 'bookingNumber', 'productName'],
  },
  {
    value: 'booking_cancelled',
    label: 'Booking Cancelled',
    vars: ['customerName', 'bookingNumber', 'productName'],
  },
  {
    value: 'invoice_sent',
    label: 'Invoice Sent',
    vars: ['customerName', 'invoiceNumber', 'totalAmount', 'amountDue', 'dueDate'],
  },
  {
    value: 'payment_received',
    label: 'Payment Received',
    vars: ['customerName', 'invoiceNumber', 'amountPaid', 'amountDue'],
  },
  {
    value: 'payment_reminder',
    label: 'Payment Reminder',
    vars: ['customerName', 'invoiceNumber', 'amountDue', 'dueDate'],
  },
  {
    value: 'customisation_bill_sent',
    label: 'Customisation Bill Sent',
    vars: ['customerName', 'billNumber', 'totalAmount', 'advancePayment', 'dueAmount'],
  },
  { value: 'sale_bill_sent', label: 'Sale Bill Sent', vars: ['customerName', 'billNumber', 'totalAmount'] },
  { value: 'custom', label: 'Custom / Manual', vars: ['customerName'] },
];
const triggerLabel = (v: string) => TRIGGER_EVENTS.find((t) => t.value === v)?.label ?? titleCase(v);

const BUSINESS_VERTICALS = [
  'UNDEFINED',
  'OTHER',
  'AUTO',
  'BEAUTY',
  'APPAREL',
  'EDU',
  'ENTERTAIN',
  'EVENT_PLAN',
  'FINANCE',
  'GROCERY',
  'GOVT',
  'HOTEL',
  'HEALTH',
  'NONPROFIT',
  'PROF_SERVICES',
  'RETAIL',
  'TRAVEL',
  'RESTAURANT',
];

const countParams = (text?: string) => {
  if (!text) return 0;
  let max = 0;
  for (const m of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
};
const fill = (text: string, values: string[]) =>
  text.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, i: string) => values[Number(i) - 1] || m);
const comp = (t: MetaTemplate, type: string) => t.components.find((c) => c.type === type);

function statusTone(status?: string): Tone {
  const s = (status ?? '').toUpperCase();
  if (['APPROVED', 'GREEN', 'CONNECTED', 'VERIFIED', 'AVAILABLE', 'READ', 'DELIVERED'].includes(s))
    return 'success';
  if (['PENDING', 'YELLOW', 'IN_APPEAL', 'PAUSED', 'SENT'].includes(s)) return 'warning';
  if (['REJECTED', 'RED', 'DISABLED', 'FAILED', 'BLOCKED', 'LIMITED'].includes(s)) return 'danger';
  return 'muted';
}

// =============================================================== HOME ====

export function WhatsAppScreen() {
  const nav = useNav();
  const invalidate = useInvalidate();
  const q = useApi<Overview>('/api/admin/whatsapp/overview');
  const subscribe = useAction(() => api.post('/api/admin/whatsapp/subscribe'), {
    success: 'App subscribed to webhooks',
    onSuccess: () => invalidate('/api/admin/whatsapp/overview'),
  });
  const o = q.data;
  const phone = o?.phone.data;
  const waba = o?.waba.data;
  const checklist = o
    ? [
        { label: 'Access token', ok: o.config.accessToken },
        { label: 'Phone number ID', ok: o.config.phoneNumberId },
        { label: 'Business account ID', ok: o.config.businessAccountId },
        { label: 'Webhook verify token', ok: o.config.webhookVerifyToken },
        { label: 'App secret (signature check)', ok: o.config.appSecret },
        { label: 'Webhook verified by Meta', ok: Boolean(o.webhook.lastVerifiedAt) },
        { label: 'App subscribed to account', ok: (o.subscribedApps.data?.length ?? 0) > 0 },
      ]
    : [];

  const sections = [
    { label: 'Inbox', icon: 'MessageCircle', route: 'WaInbox', badge: o?.stats.unreadInbound },
    { label: 'Send a template', icon: 'Send', route: 'WaSend' },
    { label: 'Meta templates', icon: 'FileText', route: 'WaMetaTemplates' },
    { label: 'Automations (trigger mappings)', icon: 'Sparkles', route: 'WaMappings' },
    { label: 'Delivery logs', icon: 'ListFilter', route: 'WaLogs' },
    { label: 'Business profile', icon: 'Store', route: 'WaProfile' },
    { label: 'QR codes & links', icon: 'Share2', route: 'WaQr' },
    { label: 'Settings', icon: 'Settings', route: 'WaSettings' },
  ];

  return (
    <Screen
      header={<Header title="WhatsApp" subtitle={phone?.verified_name ?? phone?.display_phone_number} />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      {q.isLoading ? <Loading variant="stats" /> : null}
      {q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : null}
      {o ? (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T variant="h2">{phone?.display_phone_number ?? 'Not connected'}</T>
                <T variant="small">{phone?.verified_name ?? o.phone.error ?? ''}</T>
              </View>
              {phone?.quality_rating ? (
                <Pill label={`Quality ${phone.quality_rating}`} tone={statusTone(phone.quality_rating)} />
              ) : null}
            </Row>
            {phone ? (
              <>
                <Divider />
                <KV label="Messaging limit" value={titleCase(phone.messaging_limit_tier ?? '—')} />
                <KV label="Name status" value={titleCase(phone.name_status ?? '—')} />
                <KV label="Mode" value={titleCase(phone.account_mode ?? '—')} />
                <KV label="Throughput" value={titleCase(phone.throughput?.level ?? '—')} />
                {phone.is_official_business_account ? (
                  <KV label="Official account" value="Yes ✓" tone="success" />
                ) : null}
              </>
            ) : null}
          </Card>

          <Section title="Messages — last 30 days">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <Stat label="Sent by app" value={String(o.stats.sent)} icon="Send" />
              <Stat label="Delivered" value={String(o.stats.delivered)} icon="Check" />
              <Stat label="Read" value={String(o.stats.read)} icon="Eye" />
              <Stat label="Failed" value={String(o.stats.failed)} icon="CircleAlert" />
              <Stat label="Received" value={String(o.stats.inbound)} icon="Inbox" />
              <Stat
                label="Unread in inbox"
                value={String(o.stats.unreadInbound)}
                icon="MessageCircle"
                onPress={() => nav.navigate('WaInbox')}
              />
            </View>
          </Section>

          <Section title="Manage">
            {sections.map((s) => (
              <ListRow
                key={s.route}
                icon={s.icon}
                title={s.label}
                right={s.badge ? <Pill label={String(s.badge)} small /> : undefined}
                onPress={() => nav.navigate(s.route)}
              />
            ))}
          </Section>

          <Section title="Setup checklist">
            <Card>
              {checklist.map((c) => (
                <Row key={c.label} style={{ paddingVertical: 6 }}>
                  <Icon
                    name={c.ok ? 'BadgeCheck' : 'CircleAlert'}
                    size={18}
                    color={c.ok ? colors.success : colors.warning}
                  />
                  <T variant="body" style={{ flex: 1 }}>
                    {c.label}
                  </T>
                </Row>
              ))}
              {(o.subscribedApps.data?.length ?? 0) === 0 ? (
                <Button
                  title="Subscribe app to webhooks"
                  variant="outline"
                  size="sm"
                  style={{ marginTop: space.md }}
                  onPress={() => subscribe.mutate()}
                  loading={subscribe.isPending}
                />
              ) : null}
            </Card>
          </Section>

          {waba ? (
            <Section title="WhatsApp Business Account">
              <Card>
                <KV label="Name" value={waba.name ?? '—'} />
                <KV label="Account ID" value={waba.id} />
                <KV
                  label="Account review"
                  value={titleCase(waba.account_review_status ?? '—')}
                  tone={statusTone(waba.account_review_status)}
                />
                <KV
                  label="Business verification"
                  value={titleCase(waba.business_verification_status ?? '—')}
                  tone={statusTone(waba.business_verification_status)}
                />
                <KV
                  label="Can send messages"
                  value={titleCase(waba.health_status?.can_send_message ?? '—')}
                  tone={statusTone(waba.health_status?.can_send_message)}
                />
                <KV label="Currency" value={waba.currency ?? '—'} />
                <KV label="Country" value={waba.country ?? '—'} />
                <KV label="Ownership" value={titleCase(waba.ownership_type ?? '—')} />
                <KV label="Template namespace" value={waba.message_template_namespace ?? '—'} />
              </Card>
            </Section>
          ) : o.waba.error ? (
            <Card style={{ marginTop: space.lg }}>
              <T variant="small" color={colors.warning}>
                {o.waba.error}
              </T>
            </Card>
          ) : null}

          {o.phoneNumbers.data?.length ? (
            <Section title="All phone numbers on this account">
              {o.phoneNumbers.data.map((p) => (
                <ListRow
                  key={p.id}
                  icon="Phone"
                  title={p.display_phone_number ?? p.id}
                  subtitle={p.verified_name}
                  right={
                    p.quality_rating ? (
                      <Pill label={p.quality_rating} tone={statusTone(p.quality_rating)} small />
                    ) : undefined
                  }
                  chevron={false}
                />
              ))}
            </Section>
          ) : null}

          <MetaAnalytics analytics={o.analytics} />

          <Section title="Webhook status">
            <WebhookSetup webhook={o.webhook} verifyTokenSet={Boolean(o.config.webhookVerifyToken)} />
          </Section>

          {o.commerce.data ? (
            <Section title="App subscription & commerce">
              <Card>
                <KV
                  label="Subscribed apps"
                  value={
                    (o.subscribedApps.data ?? [])
                      .map((a) => a.whatsapp_business_api_data?.name)
                      .filter(Boolean)
                      .join(', ') || '—'
                  }
                />
                <KV label="Cart enabled" value={o.commerce.data.is_cart_enabled ? 'Yes' : 'No'} />
                <KV label="Catalog visible" value={o.commerce.data.is_catalog_visible ? 'Yes' : 'No'} />
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

// ============================================================== INBOX ====

interface Conversation {
  waId: string;
  contactName?: string;
  lastText?: string;
  lastDirection?: 'inbound' | 'outbound';
  lastAt: string;
  unread: number;
}
interface WaMessage {
  _id: string;
  direction: 'inbound' | 'outbound';
  type?: string;
  text?: string;
  templateName?: string;
  status?: string;
  errorMessage?: string;
  timestamp: string;
  media?: {
    url?: string;
    downloadUrl?: string;
    mimeType?: string;
    caption?: string;
    filename?: string;
    error?: string;
  };
}

export function WaInboxScreen() {
  const nav = useNav();
  const [text, setText] = useState('');
  const term = useDebounced(text);
  const q = useApi<{ conversations: Conversation[] }>(
    '/api/admin/whatsapp/conversations',
    { search: term || undefined },
    { refetchInterval: 15_000 } // same live refresh as the web inbox
  );
  return (
    <Screen
      header={
        <Header
          title="Inbox"
          right={
            <IconButton icon="Send" onPress={() => nav.navigate('WaSend')} accessibilityLabel="New message" />
          }
        />
      }
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      <SearchBar
        value={text}
        onChangeText={setText}
        placeholder="Name or number"
        style={{ marginBottom: space.md }}
      />
      {q.isLoading ? <Loading /> : null}
      {q.data?.conversations.length === 0 ? <Empty icon="MessageCircle" title="No conversations" /> : null}
      {q.data?.conversations.map((c) => (
        <ListRow
          key={c.waId}
          icon="MessageCircle"
          title={c.contactName || `+${c.waId}`}
          subtitle={`${c.lastDirection === 'outbound' ? 'You: ' : ''}${c.lastText ?? ''}`}
          meta={relativeTime(c.lastAt)}
          right={c.unread ? <Pill label={String(c.unread)} small /> : undefined}
          onPress={() => nav.navigate('Conversation', { waId: c.waId, name: c.contactName })}
        />
      ))}
    </Screen>
  );
}

function MediaBubble({ message, mine }: { message: WaMessage; mine: boolean }) {
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState(message.media);
  const load = async () => {
    setLoading(true);
    try {
      const r = await api.post<{ url: string; downloadUrl?: string; mimeType?: string }>(
        `/api/admin/whatsapp/media/${message._id}`
      );
      setMedia((m) => ({ ...m, ...r }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  if (!media) return null;
  if (!media.url) {
    return (
      <Button
        title={media.error ? 'Retry loading media' : `Load ${message.type ?? 'media'}`}
        size="sm"
        variant="surface"
        onPress={load}
        loading={loading}
      />
    );
  }
  if ((media.mimeType ?? '').startsWith('image') || message.type === 'image' || message.type === 'sticker') {
    return (
      <Tap onPress={() => openUrl(media.url!)} hapticOnPress={false}>
        <Image source={{ uri: media.url }} style={{ width: 200, height: 200, borderRadius: radius.md }} />
      </Tap>
    );
  }
  return (
    <Tap onPress={() => openUrl(media.downloadUrl ?? media.url!)} hapticOnPress={false}>
      <Row>
        <Icon name="FileText" size={18} color={mine ? colors.onGold : colors.gold} />
        <T variant="smallStrong" color={mine ? colors.onGold : colors.text}>
          {media.filename ?? titleCase(message.type ?? 'File')}
        </T>
      </Row>
    </Tap>
  );
}

export function ConversationScreen() {
  const nav = useNav();
  const params = useParams<{ waId: string; name: string }>();
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidate();
  const q = useApi<{ messages: WaMessage[]; windowOpen: boolean; windowOpenUntil: string | null }>(
    params.waId ? `/api/admin/whatsapp/conversations/${params.waId}` : null,
    undefined,
    { refetchInterval: 10_000 }
  );
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const refetch = q.refetch;

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post(`/api/admin/whatsapp/conversations/${params.waId}`, { text: text.trim() });
      setText('');
      await refetch();
      invalidate('/api/admin/whatsapp/conversations');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title={params.name || `+${params.waId}`}
        subtitle={
          q.data?.windowOpen && q.data.windowOpenUntil
            ? `Reply window open until ${fmtDateTime(q.data.windowOpenUntil)}`
            : `+${params.waId}`
        }
        right={
          <>
            <IconButton icon="Phone" onPress={() => call(`+${params.waId}`)} accessibilityLabel="Call" />
            <IconButton
              icon="FileText"
              onPress={() => nav.navigate('WaSend', { phone: params.waId, name: params.name })}
              accessibilityLabel="Send template"
            />
          </>
        }
      />
      <FlatList
        ref={listRef}
        data={q.data?.messages ?? []}
        keyExtractor={(m) => m._id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item: m }) => {
          const mine = m.direction === 'outbound';
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              {m.media ? <MediaBubble message={m} mine={mine} /> : null}
              {m.text || m.media?.caption || !m.media ? (
                <T variant="body" color={mine ? colors.onGold : colors.text}>
                  {m.text ||
                    m.media?.caption ||
                    (m.templateName ? `[Template: ${m.templateName}]` : `[${m.type ?? 'message'}]`)}
                </T>
              ) : null}
              {m.errorMessage ? (
                <T variant="small" color={mine ? colors.onGold : colors.danger}>
                  {m.errorMessage}
                </T>
              ) : null}
              <T
                variant="small"
                style={{ fontSize: 10, marginTop: 2, alignSelf: 'flex-end' }}
                color={mine ? alpha(colors.onGold, 0.75) : colors.textFaint}
              >
                {fmtDateTime(m.timestamp)}
                {mine && m.status ? ` · ${m.status}` : ''}
              </T>
            </View>
          );
        }}
        ListEmptyComponent={q.isLoading ? <Loading variant="list" /> : <Empty title="No messages" />}
      />
      {q.data && !q.data.windowOpen ? (
        <View style={{ paddingHorizontal: space.xl, marginBottom: space.sm }}>
          <T variant="small" align="center">
            The 24-hour reply window is closed — WhatsApp only allows approved templates until the customer
            writes again.
          </T>
          <Button
            title="Send a template"
            size="sm"
            variant="outline"
            style={{ alignSelf: 'center', marginTop: space.sm }}
            onPress={() => nav.navigate('WaSend', { phone: params.waId, name: params.name })}
          />
        </View>
      ) : null}
      <View style={[styles.composer, { paddingBottom: insets.bottom + space.sm }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={colors.textFaint}
          style={styles.composerInput}
          multiline
          editable={q.data?.windowOpen !== false && !sending}
          keyboardAppearance={currentScheme()}
        />
        <IconButton icon="Send" onPress={send} color={colors.gold} accessibilityLabel="Send" />
      </View>
    </KeyboardAvoidingView>
  );
}

// ======================================================= SEND TEMPLATE ====

function useMetaTemplates() {
  return useApi<{
    templates: MetaTemplate[];
    mappings: Record<string, { triggerEvent: string; isActive: boolean }[]>;
  }>('/api/admin/whatsapp/meta-templates');
}

export function WaSendScreen() {
  const nav = useNav();
  const params = useParams<{ phone: string; name: string; templateId: string }>();
  const invalidate = useInvalidate();
  const q = useMetaTemplates();
  const approved = (q.data?.templates ?? []).filter((t) => t.status === 'APPROVED');
  const [templateId, setTemplateId] = useState(params.templateId ?? '');
  const template = approved.find((t) => t.id === templateId);
  const [phone, setPhone] = useState(params.phone ?? '');
  const [name, setName] = useState(params.name ?? '');
  const [header, setHeader] = useState<string[]>([]);
  const [body, setBody] = useState<string[]>([]);
  const [urlParams, setUrlParams] = useState<Record<number, string>>({});
  const [mediaLink, setMediaLink] = useState('');
  const [filename, setFilename] = useState('');
  const [busy, setBusy] = useState(false);

  const headerComp = template ? comp(template, 'HEADER') : undefined;
  const bodyComp = template ? comp(template, 'BODY') : undefined;
  const mediaType =
    headerComp?.format === 'DOCUMENT'
      ? 'document'
      : headerComp?.format === 'IMAGE'
      ? 'image'
      : headerComp?.format === 'VIDEO'
      ? 'video'
      : null;
  const urlButtons = (template ? comp(template, 'BUTTONS')?.buttons ?? [] : [])
    .map((button, index) => ({ button, index }))
    .filter(({ button }) => button.type === 'URL' && /\{\{\s*1\s*\}\}/.test(button.url ?? ''));

  useEffect(() => {
    if (!template) return;
    const hc = headerComp?.format === 'TEXT' ? countParams(headerComp.text) : 0;
    setHeader(Array.from({ length: hc }, (_, i) => headerComp?.example?.header_text?.[i] ?? ''));
    setBody(
      Array.from(
        { length: countParams(bodyComp?.text) },
        (_, i) => bodyComp?.example?.body_text?.[0]?.[i] ?? ''
      )
    );
    setUrlParams({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const preview = template
    ? [
        headerComp?.format === 'TEXT' && headerComp.text ? fill(headerComp.text, header) : null,
        fill(bodyComp?.text ?? '', body),
        comp(template, 'FOOTER')?.text ?? null,
      ]
        .filter(Boolean)
        .join('\n\n')
    : '';

  const send = async () => {
    if (!template) return toast.error('Choose a template');
    if (phone.replace(/\D/g, '').length < 10) return toast.error('Enter the number with country code');
    if (body.some((v) => !v.trim()) || header.some((v) => !v.trim()))
      return toast.error('Fill in every variable');
    setBusy(true);
    try {
      const digits = phone.replace(/\D/g, '');
      await api.post('/api/admin/whatsapp/send', {
        to: digits.length === 10 ? `91${digits}` : digits,
        recipientName: name || undefined,
        templateName: template.name,
        language: template.language,
        headerText: header.length ? header : undefined,
        headerMedia: mediaType
          ? { type: mediaType, link: mediaLink, filename: filename || undefined }
          : undefined,
        bodyParams: body.length ? body : undefined,
        urlButtonParams: urlButtons.map(({ index }) => ({ index, text: urlParams[index] ?? '' })),
        previewText: preview,
      });
      toast.success(`Sent “${template.name}”`);
      invalidate('/api/admin/whatsapp');
      nav.goBack();
    } catch (e) {
      showMetaError('Send failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Header title="Send template" />}
      footer={
        <Button title="Send on WhatsApp" icon="Send" onPress={send} loading={busy} disabled={!template} />
      }
    >
      {q.isLoading ? <Loading /> : null}
      <SelectField
        label="Approved template"
        searchable
        value={templateId}
        onChange={setTemplateId}
        options={approved.map((t) => ({
          value: t.id,
          label: t.name,
          subtitle: `${t.language} · ${titleCase(t.category)}`,
        }))}
        placeholder={approved.length ? 'Choose' : 'No approved templates yet'}
      />
      <Row gap={space.md}>
        <Input
          label="To"
          hint="with country code"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={{ flex: 1 }}
        />
        <Input label="Name" hint="optional" value={name} onChangeText={setName} style={{ flex: 1 }} />
      </Row>
      {template ? (
        <>
          {header.map((v, i) => (
            <Input
              key={`h${i}`}
              label={`Header {{${i + 1}}}`}
              value={v}
              onChangeText={(t) => setHeader((s) => s.map((x, j) => (j === i ? t : x)))}
            />
          ))}
          {mediaType ? (
            <>
              <Input
                label={`Header ${mediaType} link`}
                hint="public https URL"
                value={mediaLink}
                onChangeText={setMediaLink}
                autoCapitalize="none"
                keyboardType="url"
              />
              {mediaType === 'document' ? (
                <Input label="File name" value={filename} onChangeText={setFilename} />
              ) : null}
            </>
          ) : null}
          {body.map((v, i) => (
            <Input
              key={`b${i}`}
              label={`Body {{${i + 1}}}`}
              value={v}
              onChangeText={(t) => setBody((s) => s.map((x, j) => (j === i ? t : x)))}
            />
          ))}
          {urlButtons.map(({ button, index }) => (
            <Input
              key={`u${index}`}
              label={`Button “${button.text}” link value`}
              hint={button.url}
              value={urlParams[index] ?? ''}
              onChangeText={(t) => setUrlParams((s) => ({ ...s, [index]: t }))}
              autoCapitalize="none"
            />
          ))}
          <Section title="Preview" style={{ marginTop: space.sm }}>
            <View style={[styles.bubble, styles.mine, { maxWidth: '100%' }]}>
              <T variant="body" color={colors.onGold}>
                {preview}
              </T>
              {(comp(template, 'BUTTONS')?.buttons ?? []).map((b, i) => (
                <T
                  key={i}
                  variant="smallStrong"
                  color={alpha(colors.onGold, 0.75)}
                  align="center"
                  style={{ marginTop: space.sm }}
                >
                  ↗ {b.text}
                </T>
              ))}
            </View>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

// ===================================================== META TEMPLATES ====

export function WaMetaTemplatesScreen() {
  const nav = useNav();
  const invalidate = useInvalidate();
  const q = useMetaTemplates();
  const [filter, setFilter] = useState('ALL');
  const [raw, setRaw] = useState<MetaTemplate | null>(null);
  const sync = useAction(
    () =>
      api.post<{ created?: number; updated?: number; warnings?: string[] } & Record<string, unknown>>(
        '/api/admin/whatsapp/meta-templates/sync'
      ),
    {
      onSuccess: (r) => {
        const counts =
          r && typeof r === 'object'
            ? Object.entries(r)
                .filter(([k]) => k !== 'warnings')
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : v}`)
                .join(' · ')
            : undefined;
        toast.success('Synced from Meta', counts);
        // Web shows "Check these after syncing" — surface the same warnings.
        if (r?.warnings?.length) {
          confirm({
            title: 'Check these after syncing',
            message: r.warnings.map((w) => `• ${w}`).join('\n'),
            confirmText: 'OK',
            cancelText: 'Close',
          });
        }
        invalidate('/api/admin/whatsapp');
      },
    }
  );
  const remove = async (t: MetaTemplate) => {
    if (
      !(await confirm({
        title: `Delete “${t.name}” from WhatsApp?`,
        message: 'Meta removes it for every language. This cannot be undone.',
        confirmText: 'Delete',
        destructive: true,
      }))
    )
      return;
    try {
      await api.delete(
        `/api/admin/whatsapp/meta-templates?name=${encodeURIComponent(t.name)}&id=${encodeURIComponent(t.id)}`
      );
      invalidate('/api/admin/whatsapp/meta-templates');
      toast.success('Template deleted');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const list = (q.data?.templates ?? []).filter((t) => filter === 'ALL' || t.status === filter);
  return (
    <Screen
      header={
        <Header
          title="Meta templates"
          right={
            <>
              <IconButton
                icon="RotateCcw"
                onPress={() => sync.mutate()}
                accessibilityLabel="Sync from Meta"
              />
              <IconButton
                icon="Plus"
                onPress={() => nav.navigate('WaCreateTemplate')}
                accessibilityLabel="New template"
              />
            </>
          }
        />
      }
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      <Chips
        options={['ALL', 'APPROVED', 'PENDING', 'REJECTED', 'PAUSED'].map((v) => ({
          value: v,
          label: titleCase(v.toLowerCase()),
        }))}
        value={filter}
        onChange={setFilter}
        style={{ marginHorizontal: -space.lg, marginBottom: space.md }}
      />
      {q.isLoading ? <Loading variant="list" /> : null}
      {q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : null}
      {list.length === 0 && !q.isLoading ? <Empty icon="FileText" title="No templates" /> : null}
      {list.map((t) => {
        const mappings = q.data?.mappings[t.name] ?? [];
        return (
          <Card key={t.id} style={{ marginBottom: space.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {t.name}
              </T>
              <Pill label={titleCase(t.status.toLowerCase())} tone={statusTone(t.status)} small />
            </Row>
            <T variant="small">
              {t.language} · {titleCase(t.category.toLowerCase())}
              {t.quality_score?.score ? ` · quality ${t.quality_score.score}` : ''}
            </T>
            {t.rejected_reason && t.rejected_reason !== 'NONE' ? (
              <T variant="small" color={colors.danger}>
                Rejected: {titleCase(t.rejected_reason.toLowerCase())}
              </T>
            ) : null}
            <T variant="body" style={{ marginTop: space.sm }} numberOfLines={5}>
              {comp(t, 'BODY')?.text}
            </T>
            {mappings.length ? (
              <Row style={{ flexWrap: 'wrap', marginTop: space.sm }}>
                {mappings.map((m, i) => (
                  <Pill
                    key={i}
                    label={`${triggerLabel(m.triggerEvent)}${m.isActive ? '' : ' (off)'}`}
                    tone={m.isActive ? 'gold' : 'muted'}
                    small
                  />
                ))}
              </Row>
            ) : null}
            <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
              {t.status === 'APPROVED' ? (
                <Button
                  title="Send"
                  icon="Send"
                  size="sm"
                  variant="surface"
                  onPress={() => nav.navigate('WaSend', { templateId: t.id })}
                />
              ) : null}
              <Button title="Raw JSON" size="sm" variant="ghost" onPress={() => setRaw(t)} />
              <Button title="Delete" size="sm" variant="danger" onPress={() => remove(t)} />
            </Row>
          </Card>
        );
      })}
      <Sheet visible={Boolean(raw)} onClose={() => setRaw(null)} title={raw?.name ?? 'Template'}>
        <T variant="small" selectable style={{ fontFamily: 'Courier', fontSize: 11 }}>
          {raw ? JSON.stringify(raw, null, 2) : ''}
        </T>
        <Button
          title="Copy JSON"
          icon="Copy"
          variant="outline"
          style={{ marginTop: space.md }}
          onPress={() => {
            Clipboard.setString(JSON.stringify(raw, null, 2));
            toast.success('Copied');
          }}
        />
      </Sheet>
    </Screen>
  );
}

const WA_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'hi', label: 'Hindi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'mr', label: 'Marathi' },
  { code: 'pa', label: 'Punjabi' },
];

interface ButtonDraft {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url: string;
  example: string;
  phone_number: string;
}

export function WaCreateTemplateScreen() {
  const nav = useNav();
  const invalidate = useInvalidate();
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [category, setCategory] = useState<'UTILITY' | 'MARKETING'>('UTILITY');
  const [headerText, setHeaderText] = useState('');
  const [headerExample, setHeaderExample] = useState('');
  const [body, setBody] = useState('');
  const [examples, setExamples] = useState<string[]>([]);
  const [footer, setFooter] = useState('');
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const n = countParams(body);

  useEffect(() => {
    setExamples((e) => Array.from({ length: n }, (_, i) => e[i] ?? ''));
  }, [n]);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/api/admin/whatsapp/meta-templates', {
        name: name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, '_'),
        language,
        category,
        headerText: headerText || undefined,
        headerExample: headerExample || undefined,
        body,
        bodyExamples: examples,
        footer: footer || undefined,
        buttons: buttons.map((b) =>
          b.type === 'QUICK_REPLY'
            ? { type: b.type, text: b.text }
            : b.type === 'URL'
            ? { type: b.type, text: b.text, url: b.url, example: b.example || undefined }
            : { type: b.type, text: b.text, phone_number: b.phone_number }
        ),
      });
      invalidate('/api/admin/whatsapp/meta-templates');
      toast.success('Submitted to Meta for review', 'Approval usually takes minutes to a day.');
      nav.goBack();
    } catch (e) {
      toast.error('Meta rejected the template', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Header title="New Meta template" />}
      footer={<Button title="Submit for review" onPress={submit} loading={busy} />}
    >
      <Input
        label="Name"
        hint="lowercase_with_underscores"
        value={name}
        onChangeText={setName}
        autoCapitalize="none"
        required
      />
      <Row gap={space.md}>
        <SelectField
          label="Language"
          value={language}
          onChange={setLanguage}
          options={WA_LANGUAGES.map((l) => ({ value: l.code, label: l.label, subtitle: l.code }))}
          style={{ flex: 1 }}
        />
        <View style={{ flex: 1 }}>
          <T variant="caption" style={{ marginBottom: 6, color: colors.textMuted }}>
            Category
          </T>
          <Segmented
            options={[
              { value: 'UTILITY', label: 'Utility' },
              { value: 'MARKETING', label: 'Marketing' },
            ]}
            value={category}
            onChange={setCategory}
          />
        </View>
      </Row>
      <Input label="Header" hint="optional · max one {{1}}" value={headerText} onChangeText={setHeaderText} />
      {countParams(headerText) === 1 ? (
        <Input label="Header example for {{1}}" value={headerExample} onChangeText={setHeaderExample} />
      ) : null}
      <Input
        label="Body"
        hint="use {{1}}, {{2}}… for variables"
        value={body}
        onChangeText={setBody}
        multiline
        required
      />
      {examples.map((v, i) => (
        <Input
          key={i}
          label={`Example for {{${i + 1}}}`}
          value={v}
          onChangeText={(t) => setExamples((s) => s.map((x, j) => (j === i ? t : x)))}
        />
      ))}
      <Input label="Footer" hint="optional" value={footer} onChangeText={setFooter} />
      <Section title="Buttons">
        {buttons.map((b, i) => (
          <Card key={i} style={{ marginBottom: space.md }}>
            <Segmented
              options={[
                { value: 'QUICK_REPLY', label: 'Reply' },
                { value: 'URL', label: 'Link' },
                { value: 'PHONE_NUMBER', label: 'Call' },
              ]}
              value={b.type}
              onChange={(v) => setButtons((s) => s.map((x, j) => (j === i ? { ...x, type: v } : x)))}
            />
            <Input
              label="Button text"
              value={b.text}
              onChangeText={(t) => setButtons((s) => s.map((x, j) => (j === i ? { ...x, text: t } : x)))}
            />
            {b.type === 'URL' ? (
              <>
                <Input
                  label="URL"
                  hint="may end with {{1}}"
                  value={b.url}
                  autoCapitalize="none"
                  onChangeText={(t) => setButtons((s) => s.map((x, j) => (j === i ? { ...x, url: t } : x)))}
                />
                {/\{\{\s*1\s*\}\}/.test(b.url) ? (
                  <Input
                    label="Example full URL"
                    value={b.example}
                    autoCapitalize="none"
                    onChangeText={(t) =>
                      setButtons((s) => s.map((x, j) => (j === i ? { ...x, example: t } : x)))
                    }
                  />
                ) : null}
              </>
            ) : null}
            {b.type === 'PHONE_NUMBER' ? (
              <Input
                label="Phone (with +country)"
                value={b.phone_number}
                keyboardType="phone-pad"
                onChangeText={(t) =>
                  setButtons((s) => s.map((x, j) => (j === i ? { ...x, phone_number: t } : x)))
                }
              />
            ) : null}
            <Button
              title="Remove button"
              variant="ghost"
              size="sm"
              onPress={() => setButtons((s) => s.filter((_, j) => j !== i))}
            />
          </Card>
        ))}
        {buttons.length < 10 ? (
          <Button
            title="Add button"
            icon="Plus"
            variant="outline"
            onPress={() =>
              setButtons((s) => [
                ...s,
                { type: 'QUICK_REPLY', text: '', url: '', example: '', phone_number: '' },
              ])
            }
          />
        ) : null}
      </Section>
      <Section title="Preview">
        <View style={[styles.bubble, styles.mine, { maxWidth: '100%' }]}>
          {headerText ? (
            <T variant="bodyStrong" color={colors.onGold}>
              {fill(headerText, [headerExample])}
            </T>
          ) : null}
          <T variant="body" color={colors.onGold}>
            {fill(body || 'Your message…', examples)}
          </T>
          {footer ? (
            <T variant="small" color={alpha(colors.onGold, 0.75)}>
              {footer}
            </T>
          ) : null}
        </View>
      </Section>
    </Screen>
  );
}

// ==================================================== TRIGGER MAPPINGS ===

export function WaMappingsScreen() {
  const invalidate = useInvalidate();
  const q = useApi<{ templates: LocalTemplate[] }>('/api/admin/whatsapp/templates');
  const meta = useMetaTemplates();
  const [editing, setEditing] = useState<Partial<LocalTemplate> | null>(null);
  const [testing, setTesting] = useState<LocalTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    const body = {
      name: editing.name ?? '',
      triggerEvent: editing.triggerEvent ?? 'custom',
      metaTemplateName: editing.metaTemplateName ?? '',
      ...(editing.brevoTemplateId ? { brevoTemplateId: editing.brevoTemplateId } : {}),
      metaLanguageCode: editing.metaLanguageCode ?? '',
      metaTemplateId: editing.metaTemplateId ?? '',
      metaStatus: editing.metaStatus ?? '',
      metaHeaderType: editing.metaHeaderType ?? 'none',
      previewBody: editing.previewBody ?? '',
      isActive: editing.isActive ?? true,
    };
    try {
      if (editing._id) await api.patch(`/api/admin/whatsapp/templates/${editing._id}`, body);
      else await api.post('/api/admin/whatsapp/templates', body);
      invalidate('/api/admin/whatsapp');
      toast.success('Automation saved');
      setEditing(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !editing?._id ||
      !(await confirm({ title: 'Delete this automation?', confirmText: 'Delete', destructive: true }))
    )
      return;
    try {
      await api.delete(`/api/admin/whatsapp/templates/${editing._id}`);
      invalidate('/api/admin/whatsapp');
      setEditing(null);
      toast.success('Deleted');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, LocalTemplate[]> = {};
    for (const t of q.data?.templates ?? []) (g[t.triggerEvent] ??= []).push(t);
    return g;
  }, [q.data]);

  return (
    <Screen
      header={
        <Header
          title="Automations"
          subtitle="Which template is sent for each event"
          right={
            <IconButton
              icon="Plus"
              onPress={() =>
                setEditing({ triggerEvent: 'booking_confirmed', metaHeaderType: 'none', isActive: true })
              }
            />
          }
        />
      }
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      {q.isLoading ? <Loading variant="list" /> : null}
      {TRIGGER_EVENTS.map((ev) => (
        <Section key={ev.value} title={ev.label} style={{ marginTop: space.lg }}>
          {(grouped[ev.value] ?? []).length === 0 ? (
            <T variant="small">No template — this event sends nothing.</T>
          ) : null}
          {(grouped[ev.value] ?? []).map((t) => (
            <ListRow
              key={t._id}
              icon="Sparkles"
              title={t.name}
              subtitle={`${t.metaTemplateName ?? '—'} · ${t.metaLanguageCode ?? ''}${
                t.metaHeaderType === 'document' ? ' · PDF header' : ''
              }`}
              right={<Pill label={t.isActive ? 'On' : 'Off'} tone={t.isActive ? 'success' : 'muted'} small />}
              onPress={() => setEditing(t)}
            />
          ))}
        </Section>
      ))}

      <Sheet
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?._id ? 'Edit automation' : 'New automation'}
        footer={
          <View style={{ gap: space.sm }}>
            <Button title="Save" onPress={save} loading={busy} />
            {editing?._id ? (
              <Button
                title="Send test message"
                variant="outline"
                onPress={() => {
                  setTesting(editing as LocalTemplate);
                  setEditing(null);
                }}
              />
            ) : null}
            {editing?._id ? <Button title="Delete" variant="danger" onPress={remove} /> : null}
          </View>
        }
      >
        <Input
          label="Name"
          value={editing?.name ?? ''}
          onChangeText={(v) => setEditing((s) => ({ ...s, name: v }))}
        />
        <SelectField
          label="Event"
          value={editing?.triggerEvent ?? 'custom'}
          onChange={(v) => setEditing((s) => ({ ...s, triggerEvent: v }))}
          options={TRIGGER_EVENTS.map((t) => ({ value: t.value, label: t.label }))}
        />
        <SelectField
          label="Meta template"
          searchable
          value={editing?.metaTemplateId ?? ''}
          onChange={(v) => {
            const t = meta.data?.templates.find((x) => x.id === v);
            if (!t) return;
            setEditing((s) => ({
              ...s,
              metaTemplateId: t.id,
              metaTemplateName: t.name,
              metaLanguageCode: t.language,
              metaStatus: t.status,
              metaHeaderType: comp(t, 'HEADER')?.format === 'DOCUMENT' ? 'document' : 'none',
              previewBody: s?.previewBody || comp(t, 'BODY')?.text || '',
            }));
          }}
          options={(meta.data?.templates ?? []).map((t) => ({
            value: t.id,
            label: t.name,
            subtitle: `${t.language} · ${t.status}`,
          }))}
          placeholder={editing?.metaTemplateName || 'Choose'}
        />
        <Row gap={space.md}>
          <Input
            label="Template name"
            value={editing?.metaTemplateName ?? ''}
            onChangeText={(v) => setEditing((s) => ({ ...s, metaTemplateName: v }))}
            autoCapitalize="none"
            style={{ flex: 1 }}
          />
          <Input
            label="Language"
            value={editing?.metaLanguageCode ?? ''}
            onChangeText={(v) => setEditing((s) => ({ ...s, metaLanguageCode: v }))}
            autoCapitalize="none"
            style={{ flex: 1 }}
          />
        </Row>
        <Segmented
          options={[
            { value: 'none', label: 'No header' },
            { value: 'document', label: 'PDF header (bill)' },
          ]}
          value={editing?.metaHeaderType ?? 'none'}
          onChange={(v) => setEditing((s) => ({ ...s, metaHeaderType: v }))}
        />
        <T variant="small" style={{ marginTop: space.xs, marginBottom: space.md }}>
          Use “PDF header” only if the template is approved in Meta with a DOCUMENT header (bill, invoice or
          booking-confirmation PDF) — every send then needs a document link, or Meta rejects the whole
          message. Only one active template per trigger event is used.
        </T>
        <Input
          label="Preview text"
          hint="what staff see"
          value={editing?.previewBody ?? ''}
          onChangeText={(v) => setEditing((s) => ({ ...s, previewBody: v }))}
          multiline
        />
        <T variant="small" style={{ marginBottom: space.md }}>
          Variables for this event:{' '}
          {(TRIGGER_EVENTS.find((t) => t.value === (editing?.triggerEvent ?? 'custom'))?.vars ?? []).join(
            ', '
          )}
        </T>
        <ToggleRow
          label="Active"
          value={editing?.isActive ?? true}
          onChange={(v) => setEditing((s) => ({ ...s, isActive: v }))}
        />
      </Sheet>
      {testing ? <TestSheet template={testing} onClose={() => setTesting(null)} /> : null}
    </Screen>
  );
}

function TestSheet({ template, onClose }: { template: LocalTemplate; onClose: () => void }) {
  const vars = TRIGGER_EVENTS.find((t) => t.value === template.triggerEvent)?.vars ?? [];
  const [phone, setPhone] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [doc, setDoc] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ messageId?: string }>('/api/admin/whatsapp/test', {
        phone,
        templateId: template._id,
        variables: values,
        documentUrl: doc,
      });
      toast.success('Test sent', r.messageId);
      onClose();
    } catch (e) {
      showMetaError('Test message failed', e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Send test message"
      subtitle={template.name}
      footer={<Button title="Send test" onPress={send} loading={busy} />}
    >
      <Input
        label="Phone"
        hint="with country code"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      {vars.map((v) => (
        <Input
          key={v}
          label={titleCase(v.replace(/([A-Z])/g, ' $1'))}
          value={values[v] ?? ''}
          onChangeText={(t) => setValues((s) => ({ ...s, [v]: t }))}
        />
      ))}
      {template.metaHeaderType === 'document' ? (
        <Input
          label="PDF link"
          hint="public URL"
          value={doc}
          onChangeText={setDoc}
          autoCapitalize="none"
          keyboardType="url"
        />
      ) : null}
    </Sheet>
  );
}

// ============================================================ SETTINGS ====

interface WaSettings {
  enabled: boolean;
  provider: 'brevo' | 'meta';
  senderLabel: string;
  autoSendOnBookingConfirmed: boolean;
  autoSendOnBookingReturned: boolean;
  autoSendOnBookingCancelled: boolean;
  autoSendOnInvoiceSent: boolean;
  autoSendOnPaymentReceived: boolean;
  autoSendOnCustomisationBillSent: boolean;
  autoSendOnSaleBillSent: boolean;
}

const AUTO_KEYS: { key: keyof WaSettings; label: string }[] = [
  { key: 'autoSendOnBookingConfirmed', label: 'Booking confirmed' },
  { key: 'autoSendOnBookingReturned', label: 'Booking returned' },
  { key: 'autoSendOnBookingCancelled', label: 'Booking cancelled' },
  { key: 'autoSendOnInvoiceSent', label: 'Invoice sent' },
  { key: 'autoSendOnPaymentReceived', label: 'Payment received' },
  { key: 'autoSendOnCustomisationBillSent', label: 'Customisation bill' },
  { key: 'autoSendOnSaleBillSent', label: 'Sale bill' },
];

export function WaSettingsScreen() {
  const q = useApi<{ settings: WaSettings; isConfigured: boolean }>('/api/admin/whatsapp/settings');
  const [s, setS] = useState<WaSettings | null>(null);
  useEffect(() => {
    if (q.data) setS(q.data.settings);
  }, [q.data]);
  const save = useAction(() => api.patch('/api/admin/whatsapp/settings', s), {
    success: 'WhatsApp settings saved',
  });
  if (!s)
    return (
      <Screen header={<Header title="WhatsApp settings" />}>
        <Loading />
      </Screen>
    );
  return (
    <Screen
      header={<Header title="WhatsApp settings" />}
      footer={<Button title="Save" onPress={() => save.mutate()} loading={save.isPending} />}
    >
      {!q.data?.isConfigured ? (
        <Card style={{ marginBottom: space.lg }}>
          <T variant="small" color={colors.warning}>
            The selected provider’s API keys aren’t set on the server yet — messages won’t send until they
            are.
          </T>
        </Card>
      ) : null}
      <Card>
        <ToggleRow
          label="WhatsApp messages enabled"
          value={s.enabled}
          onChange={(v) => setS({ ...s, enabled: v })}
        />
      </Card>
      <Section title="Provider">
        <Segmented
          options={[
            { value: 'meta', label: 'Meta Cloud API' },
            { value: 'brevo', label: 'Brevo' },
          ]}
          value={s.provider}
          onChange={(v) => setS({ ...s, provider: v })}
        />
        <Input
          label="Sender label"
          value={s.senderLabel}
          onChangeText={(v) => setS({ ...s, senderLabel: v })}
        />
      </Section>
      <Section title="Send automatically when…">
        <Card>
          {AUTO_KEYS.map((a) => (
            <ToggleRow
              key={a.key}
              label={a.label}
              value={Boolean(s[a.key])}
              onChange={(v) => setS({ ...s, [a.key]: v })}
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

// ===================================================== BUSINESS PROFILE ===

export function WaProfileScreen() {
  const invalidate = useInvalidate();
  const q = useApi<Overview>('/api/admin/whatsapp/overview');
  const [p, setP] = useState({
    about: '',
    description: '',
    address: '',
    email: '',
    website1: '',
    website2: '',
    vertical: 'APPAREL',
  });
  useEffect(() => {
    const d = q.data?.profile.data;
    if (d)
      setP({
        about: d.about ?? '',
        description: d.description ?? '',
        address: d.address ?? '',
        email: d.email ?? '',
        website1: d.websites?.[0] ?? '',
        website2: d.websites?.[1] ?? '',
        vertical: d.vertical ?? 'APPAREL',
      });
  }, [q.data]);
  const save = useAction(
    () =>
      api.patch('/api/admin/whatsapp/profile', {
        about: p.about,
        description: p.description,
        address: p.address,
        email: p.email,
        websites: [p.website1, p.website2].filter(Boolean),
        vertical: p.vertical,
      }),
    { success: 'Profile updated on WhatsApp', onSuccess: () => invalidate('/api/admin/whatsapp/overview') }
  );
  return (
    <Screen
      header={<Header title="Business profile" subtitle="What customers see on WhatsApp" />}
      footer={<Button title="Save to WhatsApp" onPress={() => save.mutate()} loading={save.isPending} />}
    >
      {q.isLoading ? <Loading variant="list" /> : null}
      {q.data?.profile.data?.profile_picture_url ? (
        <View style={{ alignItems: 'center', marginBottom: space.lg }}>
          <Image
            source={{ uri: q.data.profile.data.profile_picture_url }}
            style={{ width: 96, height: 96, borderRadius: 48 }}
          />
        </View>
      ) : null}
      <Input
        label="About"
        hint="max 139"
        value={p.about}
        onChangeText={(v) => setP({ ...p, about: v })}
        required
      />
      <Input
        label="Description"
        value={p.description}
        onChangeText={(v) => setP({ ...p, description: v })}
        multiline
      />
      <Input label="Address" value={p.address} onChangeText={(v) => setP({ ...p, address: v })} multiline />
      <Input
        label="Email"
        value={p.email}
        onChangeText={(v) => setP({ ...p, email: v })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label="Website 1"
        value={p.website1}
        onChangeText={(v) => setP({ ...p, website1: v })}
        autoCapitalize="none"
        keyboardType="url"
      />
      <Input
        label="Website 2"
        value={p.website2}
        onChangeText={(v) => setP({ ...p, website2: v })}
        autoCapitalize="none"
        keyboardType="url"
      />
      <SelectField
        label="Business category"
        value={p.vertical}
        onChange={(v) => setP({ ...p, vertical: v })}
        options={BUSINESS_VERTICALS.map((v) => ({ value: v, label: titleCase(v.toLowerCase()) }))}
      />
    </Screen>
  );
}

// ============================================================ QR CODES ===

interface QrCode {
  code: string;
  prefilled_message: string;
  deep_link_url: string;
  qr_image_url?: string;
}

export function WaQrScreen() {
  const invalidate = useInvalidate();
  const q = useApi<{ qrCodes: QrCode[] }>('/api/admin/whatsapp/qr-codes');
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const create = useAction(() => api.post('/api/admin/whatsapp/qr-codes', { prefilledMessage: message }), {
    success: 'QR code created',
    onSuccess: () => {
      setOpen(false);
      setMessage('');
      invalidate('/api/admin/whatsapp/qr-codes');
    },
  });
  const remove = async (c: QrCode) => {
    if (
      !(await confirm({
        title: 'Delete this QR code?',
        message: 'Printed copies will stop working.',
        confirmText: 'Delete',
        destructive: true,
      }))
    )
      return;
    try {
      await api.delete(`/api/admin/whatsapp/qr-codes?code=${encodeURIComponent(c.code)}`);
      invalidate('/api/admin/whatsapp/qr-codes');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Screen
      header={
        <Header title="QR codes & links" right={<IconButton icon="Plus" onPress={() => setOpen(true)} />} />
      }
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      <T variant="small" style={{ marginBottom: space.lg }}>
        Customers scan these (or tap the link) to open a WhatsApp chat with your shop, with the message
        already typed.
      </T>
      {q.isLoading ? <Loading variant="list" /> : null}
      {q.isError ? <ErrorState message={errorMessage(q.error)} /> : null}
      {q.data?.qrCodes.length === 0 ? <Empty icon="Share2" title="No QR codes yet" /> : null}
      {q.data?.qrCodes.map((c) => (
        <Card key={c.code} style={{ marginBottom: space.md }}>
          <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
            {c.qr_image_url ? (
              <Image
                source={{ uri: c.qr_image_url }}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 8,
                  backgroundColor: '#FFFFFF' /* QR codes need a white quiet zone to scan */,
                }}
              />
            ) : null}
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong">“{c.prefilled_message}”</T>
              <T variant="small" numberOfLines={1}>
                {c.deep_link_url}
              </T>
            </View>
          </Row>
          <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
            <Button
              title="Share link"
              icon="Share2"
              size="sm"
              variant="surface"
              onPress={() => shareLink('Chat with Color Times on WhatsApp', c.deep_link_url)}
            />
            <Button
              title="Copy link"
              icon="Copy"
              size="sm"
              variant="surface"
              onPress={() => {
                Clipboard.setString(c.deep_link_url);
                toast.success('Link copied');
              }}
            />
            {c.qr_image_url ? (
              <Button title="Open QR" size="sm" variant="surface" onPress={() => openUrl(c.qr_image_url!)} />
            ) : null}
            <Button title="Delete" size="sm" variant="danger" onPress={() => remove(c)} />
          </Row>
        </Card>
      ))}
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="New QR code"
        footer={<Button title="Create" onPress={() => create.mutate()} loading={create.isPending} />}
      >
        <Input
          label="Pre-filled message"
          hint="max 140"
          value={message}
          onChangeText={setMessage}
          multiline
        />
      </Sheet>
    </Screen>
  );
}

// ================================================================ LOGS ====

interface LogRow {
  _id: string;
  recipientName: string;
  recipientPhone?: string;
  templateName: string;
  triggerEvent: string;
  message: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
}

export function WaLogsScreen() {
  return (
    <ListScreen<LogRow>
      title="Delivery logs"
      path="/api/admin/whatsapp/logs"
      listKey="logs"
      search="Name, phone or template"
      chips={['all', 'sent', 'delivered', 'read', 'failed'].map((v) => ({ value: v, label: titleCase(v) }))}
      renderItem={(l) => (
        <Card style={{ marginBottom: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
              {l.recipientName} {l.recipientPhone ? `· ${l.recipientPhone}` : ''}
            </T>
            <Pill label={titleCase(l.status)} tone={statusTone(l.status)} small />
          </Row>
          <T variant="small">
            {l.templateName} · {triggerLabel(l.triggerEvent)} · {fmtDateTime(l.createdAt)}
          </T>
          <T variant="small" numberOfLines={3} style={{ marginTop: 4 }} color={colors.text}>
            {l.message}
          </T>
          {l.errorMessage ? (
            <T variant="small" color={colors.danger}>
              {l.errorMessage}
            </T>
          ) : null}
        </Card>
      )}
      empty={{ icon: 'ListFilter', title: 'No messages logged' }}
    />
  );
}

const styles = themed(() =>
  StyleSheet.create({
    bubble: {
      maxWidth: '82%',
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.lg,
      gap: 4,
    },
    mine: { alignSelf: 'flex-end', backgroundColor: colors.gold, borderBottomRightRadius: 4 },
    theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceHigh, borderBottomLeftRadius: 4 },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.bgElevated,
    },
    composerInput: {
      flex: 1,
      maxHeight: 120,
      minHeight: 42,
      color: colors.text,
      fontFamily: fonts.body,
      fontSize: 15,
      paddingHorizontal: space.md,
      paddingVertical: 10,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
  })
);

/** Web's "Full response from Meta": show the provider error behind a failed send, copyable. */
async function showMetaError(title: string, e: unknown) {
  const meta = e instanceof ApiError ? e.metaError : undefined;
  if (!meta) {
    toast.error(title, errorMessage(e));
    return;
  }
  const details = JSON.stringify(meta, null, 2);
  const copy = await confirm({
    title,
    message: `${errorMessage(e)}\n\nFull response from Meta:\n${details.slice(0, 1200)}`,
    confirmText: 'Copy details',
    cancelText: 'Close',
  });
  if (copy) {
    Clipboard.setString(details);
    toast.success('Copied');
  }
}

// ---------- Overview: Meta analytics chart + webhook setup (web overview parity) ----------

function MetaAnalytics({ analytics }: { analytics: Overview['analytics'] }) {
  const points = analytics.data ?? [];
  const totals = points.reduce((a, p) => ({ sent: a.sent + p.sent, delivered: a.delivered + p.delivered }), {
    sent: 0,
    delivered: 0,
  });
  const max = Math.max(1, ...points.map((p) => Math.max(p.sent, p.delivered)));
  const step = Math.max(1, Math.ceil(points.length / 6));
  return (
    <Section title="Meta analytics · all messages">
      <Card>
        {analytics.error ? (
          <T variant="small">Analytics unavailable: {analytics.error}</T>
        ) : points.length === 0 ? (
          <T variant="small">No messages in this period.</T>
        ) : (
          <>
            <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
              <Row gap={space.md}>
                <Row gap={6}>
                  <View style={[waStyles.legend, { backgroundColor: colors.gold }]} />
                  <T variant="small">Sent</T>
                </Row>
                <Row gap={6}>
                  <View style={[waStyles.legend, { backgroundColor: WA_GREEN }]} />
                  <T variant="small">Delivered</T>
                </Row>
              </Row>
              <T variant="smallStrong">
                {totals.sent} sent · {totals.delivered} delivered
              </T>
            </Row>
            <View style={waStyles.chart}>
              {points.map((p, i) => (
                <View
                  key={p.start}
                  style={waStyles.group}
                  accessibilityLabel={`${p.sent} sent, ${p.delivered} delivered`}
                >
                  <View style={waStyles.bars}>
                    <View
                      style={[
                        waStyles.bar,
                        { height: `${(p.sent / max) * 100}%`, backgroundColor: colors.gold },
                      ]}
                    />
                    <View
                      style={[
                        waStyles.bar,
                        { height: `${(p.delivered / max) * 100}%`, backgroundColor: WA_GREEN },
                      ]}
                    />
                  </View>
                  <T variant="caption" numberOfLines={1} style={{ fontSize: 9, marginTop: 4 }}>
                    {i % step === 0
                      ? new Date(p.start * 1000).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : ' '}
                  </T>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>
    </Section>
  );
}

function WebhookSetup({
  webhook,
  verifyTokenSet,
}: {
  webhook: Overview['webhook'];
  verifyTokenSet: boolean;
}) {
  const callbackUrl = api.url('/api/webhooks/meta-whatsapp');
  const latest = webhook.recent[0];
  let tone: 'success' | 'warning' | 'danger';
  let headline: string;
  let detail: string;
  if (latest && !latest.ok) {
    tone = 'danger';
    headline =
      latest.kind === 'verify' ? "Meta's verification failed" : 'Meta is calling, but the call was rejected';
    detail = latest.summary ?? '';
  } else if (webhook.lastEventAt) {
    tone = webhook.lastInboundAt ? 'success' : 'warning';
    headline = `Connected — last call from Meta ${relativeTime(webhook.lastEventAt)}`;
    detail = webhook.lastInboundAt
      ? `Last customer message received ${relativeTime(webhook.lastInboundAt)}.`
      : 'Delivery updates are arriving, but no customer message yet. If a customer has written to you, subscribe the "messages" field in your Meta app\'s webhook settings.';
  } else if (webhook.lastVerifiedAt) {
    tone = 'warning';
    headline = `Callback URL verified ${relativeTime(webhook.lastVerifiedAt)}, but no messages yet`;
    detail =
      'Meta accepted the URL. Now subscribe the "messages" field, subscribe this app to your WhatsApp account (above), and make sure the Meta app is Live, not in Development.';
  } else {
    tone = 'danger';
    headline = "Meta hasn't called this webhook yet";
    detail = verifyTokenSet
      ? 'Paste the callback URL below into your Meta app (WhatsApp → Configuration → Webhook → Edit) with your verify token, then Verify and save.'
      : "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN isn't set on the server yet — add it, redeploy, then paste the callback URL below into your Meta app. Type the secret's value into Meta, not the variable name.";
  }
  const toneColor = { success: colors.success, warning: colors.warning, danger: colors.danger }[tone];
  return (
    <Card>
      <Row gap={space.sm} style={{ alignItems: 'flex-start', marginBottom: space.md }}>
        <Icon name={tone === 'success' ? 'BadgeCheck' : 'CircleAlert'} size={18} color={toneColor} />
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong" color={toneColor}>
            {headline}
          </T>
          {detail ? <T variant="small">{detail}</T> : null}
        </View>
      </Row>
      <T variant="caption">Callback URL</T>
      <Row style={{ marginBottom: space.sm }}>
        <T variant="small" selectable style={{ flex: 1, fontFamily: 'Courier' }}>
          {callbackUrl}
        </T>
        <IconButton
          icon="Copy"
          size={34}
          accessibilityLabel="Copy callback URL"
          onPress={() => {
            Clipboard.setString(callbackUrl);
            toast.success('Callback URL copied');
          }}
        />
      </Row>
      <KV
        label="Verify token on server"
        value={verifyTokenSet ? 'Set' : 'Missing'}
        tone={verifyTokenSet ? 'success' : 'danger'}
      />
      <KV label="Fields to subscribe" value="messages, message_template_status_update" />
      <KV
        label="Last verified"
        value={webhook.lastVerifiedAt ? fmtDateTime(webhook.lastVerifiedAt) : 'Never'}
      />
      <KV label="Last event" value={webhook.lastEventAt ? fmtDateTime(webhook.lastEventAt) : 'Never'} />
      <KV
        label="Last customer message"
        value={webhook.lastInboundAt ? fmtDateTime(webhook.lastInboundAt) : 'Never'}
      />
      <Divider />
      <T variant="caption" style={{ marginBottom: 4 }}>
        Recent calls from Meta (last 7 days)
      </T>
      {webhook.recent.length === 0 ? <T variant="small">None recorded yet.</T> : null}
      {webhook.recent.slice(0, 8).map((e, i) => (
        <Row key={i} style={{ paddingVertical: 4 }}>
          <Icon name={e.ok ? 'Check' : 'X'} size={14} color={e.ok ? colors.success : colors.danger} />
          <T variant="small" style={{ flex: 1 }} numberOfLines={2}>
            {e.summary ?? e.kind}
          </T>
          <T variant="small" color={colors.textFaint}>
            {relativeTime(e.createdAt)}
          </T>
        </Row>
      ))}
    </Card>
  );
}

// WhatsApp's brand green for the "delivered" series (a recognised meaning, readable on both themes).
const WA_GREEN = '#25D366';
const waStyles = StyleSheet.create({
  legend: { width: 10, height: 10, borderRadius: 2 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 150 },
  group: { flex: 1, alignItems: 'center' },
  bars: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 1,
  },
  bar: { width: '38%', maxWidth: 10, minHeight: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
});
