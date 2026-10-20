import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { api, errorMessage } from '../../../api/client';
import { useAction, useApi, useInvalidate } from '../../../api/hooks';
import type { Category, Product } from '../../../api/types';
import {
  ListScreen,
  ImageViewer,
  MonthCalendar,
  type DayMark,
  Button,
  Card,
  Chips,
  DateField,
  Divider,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Img,
  Input,
  KV,
  ListRow,
  Loading,
  MoneyInput,
  Pill,
  Row,
  Screen,
  Section,
  SelectField,
  Sheet,
  T,
  Tap,
  ToggleRow,
  confirm,
  toast,
} from '../../../components/ui';

import { alpha, colors, radius, space, themed } from '../../../theme';
import { useNav, useParams } from '../../../navigation/nav';
import { fmtDate, fmtRange, inr, isoDay, num } from '../../../lib/format';
import { PRODUCT_STATUS, SERVICE_STATUS } from '../../../lib/labels';
import { useRole } from '../../../auth/AuthContext';
import { canSettings, isManager } from '../../../lib/roles';
import { pickAndUpload } from '../../../lib/upload';
import { BULK, EXPORTS, SORTS, TRASH } from '../listConfig';
import { ImportSheet } from '../../../components/admin/ImportSheet';
import { ImageLinkSheet } from '../../../components/admin/ImageLinkSheet';
import { AuditHistory } from '../../../components/admin/AuditHistory';
import { ActivityIndicator } from 'react-native';

const { width } = Dimensions.get('window');
const CARD_W = (width - space.lg * 2 - space.md) / 2;

const STATE_CHIPS = [
  { value: '', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'picked_up', label: 'Picked up' },
  { value: 'under_dry_cleaning', label: 'Dry cleaning' },
  { value: 'under_repair', label: 'Repair' },
  { value: 'sold', label: 'Sold' },
  { value: 'inactive', label: 'Hidden' },
];

/** Catalogue as a 2-up image grid — the boutique's most visual screen. */
export function ProductsScreen() {
  const nav = useNav();
  const role = useRole();
  const invalidate = useInvalidate();
  const cats = useApi<{ categories: Category[] }>('/api/admin/categories', { all: 'true' });
  const [category, setCategory] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [importing, setImporting] = useState(false);
  const [rentFor, setRentFor] = useState<Product | null>(null);
  const [rentDraft, setRentDraft] = useState('');
  const [savingRent, setSavingRent] = useState(false);

  // Web catalogue: click the rent to edit it in place.
  const saveRent = async () => {
    if (!rentFor) return;
    const value = num(rentDraft);
    if (value === undefined || value < 0) return toast.error('Enter a valid rent');
    if (value === rentFor.rentalPricePerDay) return setRentFor(null);
    setSavingRent(true);
    try {
      await api.patch(`/api/admin/products/${rentFor._id}`, { rentalPricePerDay: value });
      invalidate('/api/admin/products');
      toast.success(`Rent updated to ${inr(value)}`);
      setRentFor(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingRent(false);
    }
  };

  const toggleFavorite = async (product: Product) => {
    try {
      await api.patch(`/api/admin/products/${product._id}`, { isFavorited: !product.isFavorited });
      invalidate('/api/admin/products');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <ListScreen<Product>
        key={`${category}-${view}`}
        title={view === 'archived' ? 'Archived products' : 'Products'}
        large
        path="/api/admin/products"
        listKey="products"
        numColumns={2}
        pageSize={24}
        query={{ category: category || undefined, status: view }}
        search="Name, code, colour…"
        chipParam="productState"
        chips={STATE_CHIPS}
        bulk={BULK.products}
        trash={TRASH.products}
        filters={{ sorts: SORTS.products }}
        exporter={EXPORTS.products}
        headerRight={
          <IconButton
            icon="FolderTree"
            onPress={() => nav.navigate('Categories')}
            accessibilityLabel="Categories"
          />
        }
        menu={[
          {
            label: view === 'archived' ? 'Show active pieces' : 'Show archived pieces',
            icon: 'Archive',
            onPress: () => setView(view === 'archived' ? 'active' : 'archived'),
          },
          { label: 'Import products', icon: 'Download', onPress: () => setImporting(true) },
          ...(canSettings(role)
            ? [{ label: 'Inventory settings', icon: 'Settings', onPress: () => nav.navigate('Settings') }]
            : []),
        ]}
        top={() => (
          <Chips
            options={[
              { value: '', label: 'All categories' },
              ...(cats.data?.categories ?? []).map((c) => ({ value: c._id, label: c.name })),
            ]}
            value={category}
            onChange={setCategory}
            style={{ marginHorizontal: -space.lg, marginBottom: space.md }}
          />
        )}
        onCreate={() => nav.navigate('ProductForm')}
        createLabel="Piece"
        renderItem={(item) => (
          <ProductTile
            product={item}
            onPress={() => nav.navigate('ProductDetail', { id: item._id })}
            onFavorite={isManager(role) ? () => toggleFavorite(item) : undefined}
            onEditRent={
              isManager(role)
                ? () => {
                    setRentDraft(String(item.rentalPricePerDay));
                    setRentFor(item);
                  }
                : undefined
            }
          />
        )}
        empty={{ icon: 'Shirt', title: 'No pieces found' }}
      />
      <ImportSheet
        visible={importing}
        onClose={() => setImporting(false)}
        title="Import products"
        endpoint="/api/admin/products/import"
        invalidatePath="/api/admin/products"
        sample={[
          'Sample Silk Gown',
          '',
          'party-wear',
          'Designer Name',
          'A beautiful sample description of the product.',
          'Emerald',
          'Silk',
          '',
          'S:3,M:5,L:2',
          '2500',
          '30000',
          '5000',
          'true',
          'false',
          'true',
          'silk,emerald',
        ]}
        columns={[
          'name',
          'code',
          'category',
          'designer',
          'description',
          'color',
          'fabric',
          'image',
          'sizes',
          'rentalPricePerDay',
          'retailValue',
          'securityDeposit',
          'isActive',
          'isFeatured',
          'isNewArrival',
          'tags',
        ]}
      />
      <Sheet
        visible={Boolean(rentFor)}
        onClose={() => setRentFor(null)}
        title={rentFor ? `Rent · ${rentFor.name}` : 'Rent'}
        footer={<Button title="Save rent" onPress={saveRent} loading={savingRent} />}
      >
        <MoneyInput label="Rent per booking" value={rentDraft} onChangeText={setRentDraft} />
      </Sheet>
    </>
  );
}

function ProductTile({
  product,
  onPress,
  onFavorite,
  onEditRent,
}: {
  product: Product;
  onPress: () => void;
  onFavorite?: () => void;
  onEditRent?: () => void;
}) {
  const st = PRODUCT_STATUS[product.status];
  return (
    <Tap onPress={onPress} style={{ width: CARD_W }} scaleTo={0.97}>
      <View>
        <Img src={product.images[0]} style={{ width: CARD_W, height: CARD_W * 1.3 }} rounded={radius.lg} />
        <View style={{ position: 'absolute', top: space.sm, left: space.sm }}>
          <Pill label={st?.label ?? product.status} tone={st?.tone} small />
        </View>
        {!product.isActive ? (
          <View style={styles.hidden}>
            <Icon name="EyeOff" size={14} color={colors.text} />
          </View>
        ) : null}
        {onFavorite || product.isFavorited ? (
          <Tap
            onPress={onFavorite}
            disabled={!onFavorite}
            style={styles.fav}
            accessibilityLabel={product.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Icon
              name="Star"
              size={15}
              color={colors.gold}
              fill={product.isFavorited ? colors.gold : 'none'}
            />
          </Tap>
        ) : null}
      </View>
      <T variant="smallStrong" numberOfLines={1} style={{ marginTop: space.sm }}>
        {product.name}
      </T>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="small" numberOfLines={1}>
          {product.sku}
        </T>
        <Tap
          onPress={onEditRent}
          disabled={!onEditRent}
          hitSlop={8}
          accessibilityLabel={onEditRent ? 'Edit rent' : undefined}
        >
          <T variant="smallStrong" gold style={onEditRent ? { textDecorationLine: 'underline' } : undefined}>
            {inr(product.rentalPricePerDay)}
          </T>
        </Tap>
      </Row>
    </Tap>
  );
}

interface History {
  activeRanges?: { bookingNumber: string; rentalStartDate: string; rentalEndDate: string }[];
  bookings: {
    _id: string;
    bookingNumber: string;
    status: string;
    rentalStartDate: string;
    rentalEndDate: string;
    totalAmount: number;
  }[];
  serviceOrders: {
    _id: string;
    serviceType: string;
    status: string;
    sentDate: string;
    totalAmount: number;
  }[];
  summary: {
    timesRented: number;
    totalEarned: number;
    acquisitionCost: number;
    totalServiceExpense: number;
    netAmount: number;
  };
}

export function ProductDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNav();
  const role = useRole();
  const manager = isManager(role);
  const invalidate = useInvalidate();
  const q = useApi<{ product: Product }>(id ? `/api/admin/products/${id}` : null);
  const history = useApi<History>(id ? `/api/admin/products/${id}/history` : null);
  const [page, setPage] = useState(0);
  const [checkOpen, setCheckOpen] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [calMonth, setCalMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const setCover = useAction((images: string[]) => api.patch(`/api/admin/products/${id}`, { images }), {
    success: 'Cover photo updated',
    onSuccess: () => invalidate('/api/admin/products'),
  });

  const refresh = () => invalidate('/api/admin/products');
  const duplicate = useAction(() => api.post<{ product: Product }>(`/api/admin/products/${id}/duplicate`), {
    success: 'Duplicated',
    onSuccess: (d) => {
      refresh();
      nav.replace('ProductForm', { id: d.product._id });
    },
  });
  const archive = useAction(() => api.post(`/api/admin/products/${id}/archive`), {
    success: 'Archive updated',
    onSuccess: refresh,
  });
  const remove = useAction(() => api.delete(`/api/admin/products/${id}`), {
    success: 'Moved to Trash',
    onSuccess: () => {
      refresh();
      nav.goBack();
    },
  });

  if (q.isLoading)
    return (
      <Screen header={<Header title="Piece" />}>
        <Loading />
      </Screen>
    );
  const p = q.data?.product;
  if (!p)
    return (
      <Screen header={<Header title="Piece" />}>
        <ErrorState message={errorMessage(q.error)} />
      </Screen>
    );
  const st = PRODUCT_STATUS[p.status];
  const images = p.images.length ? p.images : [''];
  const stock = p.variants.reduce((s, v) => s + v.quantityInStock, 0);

  return (
    <Screen
      padded={false}
      header={
        <Header
          title={p.sku}
          right={
            manager ? (
              <IconButton
                icon="Pencil"
                onPress={() => nav.navigate('ProductForm', { id: p._id })}
                accessibilityLabel="Edit"
              />
            ) : undefined
          }
        />
      }
      refreshing={q.isRefetching}
      onRefresh={() => {
        q.refetch();
        history.refetch();
      }}
      footer={<Button title="Check availability" icon="Calendar" onPress={() => setCheckOpen(true)} />}
    >
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(src, i) => `${src}-${i}`}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => (
          <Tap
            style={{ width, paddingHorizontal: space.lg }}
            scaleTo={0.99}
            hapticOnPress={false}
            onPress={() => item && setViewer(index)}
          >
            <Img
              src={item}
              style={{
                width: width - space.lg * 2,
                height: (width - space.lg * 2) * 1.25,
              }}
              rounded={radius.xl}
            />
          </Tap>
        )}
      />
      {images.length > 1 ? (
        <Row style={{ justifyContent: 'center', marginTop: space.sm }} gap={6}>
          {images.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === page ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === page ? colors.gold : colors.borderStrong,
              }}
            />
          ))}
        </Row>
      ) : null}

      <View style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>
        <Row gap={space.sm}>
          <Pill label={st?.label ?? p.status} tone={st?.tone} />
          {!p.isActive ? <Pill label="Hidden from site" tone="muted" /> : null}
          {p.isFeatured ? <Pill label="Featured" tone="gold" /> : null}
          {p.isNewArrival ? <Pill label="New" tone="rose" /> : null}
          {p.archivedAt ? <Pill label="Archived" tone="muted" /> : null}
        </Row>
        <T variant="h1" style={{ marginTop: space.md }}>
          {p.name}
        </T>
        <T variant="small">{[p.category?.name, p.designer, p.color, p.fabric].filter(Boolean).join(' · ')}</T>

        <Row gap={space.sm} style={{ marginTop: space.lg }}>
          <Card style={{ flex: 1 }}>
            <T variant="caption">Rent</T>
            <T variant="number">{inr(p.rentalPricePerDay)}</T>
          </Card>
          <Card style={{ flex: 1 }}>
            <T variant="caption">Deposit</T>
            <T variant="number">{inr(p.securityDeposit)}</T>
          </Card>
        </Row>

        <Section title="Details">
          <Card>
            <KV label="Code" value={p.sku} />
            <KV label="Retail value" value={inr(p.retailValue)} />
            {p.dressType ? <KV label="Type" value={p.dressType} /> : null}
            {p.work ? <KV label="Work" value={p.work} /> : null}
            <KV
              label="Sizes / stock"
              value={p.variants.map((v) => `${v.size} ×${v.quantityInStock}`).join(', ') || `${stock}`}
            />
            {p.dealerName && manager ? <KV label="Dealer" value={p.dealerName} /> : null}
            <KV label="Added" value={fmtDate(p.createdAt)} />
            {p.description ? (
              <>
                <Divider />
                <T variant="small">{p.description}</T>
              </>
            ) : null}
          </Card>
        </Section>

        <Section title="Availability">
          <Card>
            <MonthCalendar
              month={calMonth}
              onMonthChange={setCalMonth}
              marks={(() => {
                const m: Record<string, DayMark> = {};
                for (const r of history.data?.activeRanges ?? []) {
                  const cur = new Date(r.rentalStartDate);
                  const end = new Date(r.rentalEndDate);
                  while (cur <= end) {
                    m[isoDay(cur)] = { fill: alpha(colors.danger, 0.3) };
                    cur.setDate(cur.getDate() + 1);
                  }
                }
                return m;
              })()}
            />
            <T variant="small" style={{ marginTop: space.sm }}>
              Shaded days are reserved by confirmed or picked-up bookings.
            </T>
          </Card>
        </Section>

        {history.data ? (
          <Section title="Performance">
            <Card>
              <KV label="Times rented" value={String(history.data.summary.timesRented)} />
              <KV label="Earned" value={inr(history.data.summary.totalEarned)} tone="success" />
              {manager ? (
                <>
                  <KV label="Acquisition cost" value={inr(history.data.summary.acquisitionCost)} />
                  <KV label="Service costs" value={inr(history.data.summary.totalServiceExpense)} />
                  <Divider />
                  <KV
                    label="Net"
                    value={inr(history.data.summary.netAmount)}
                    strong
                    tone={history.data.summary.netAmount >= 0 ? 'success' : 'danger'}
                  />
                </>
              ) : null}
            </Card>
          </Section>
        ) : null}

        {history.data?.bookings.length ? (
          <Section title="Booking history">
            {history.data.bookings.slice(0, 10).map((b) => (
              <ListRow
                key={b._id}
                icon="CalendarCheck"
                title={b.bookingNumber}
                subtitle={fmtRange(b.rentalStartDate, b.rentalEndDate)}
                right={<T variant="smallStrong">{inr(b.totalAmount)}</T>}
                onPress={() => nav.navigate('BookingDetail', { id: b._id })}
              />
            ))}
          </Section>
        ) : null}

        {history.data?.serviceOrders.length ? (
          <Section title="Service history">
            {history.data.serviceOrders.slice(0, 10).map((s) => (
              <ListRow
                key={s._id}
                icon={s.serviceType === 'tailor' ? 'Scissors' : 'Droplets'}
                title={s.serviceType === 'tailor' ? 'Tailor' : 'Dry clean'}
                subtitle={`${fmtDate(s.sentDate)} · ${
                  SERVICE_STATUS[s.status as keyof typeof SERVICE_STATUS]?.label ?? s.status
                }`}
                right={<T variant="smallStrong">{inr(s.totalAmount)}</T>}
                onPress={() => nav.navigate('ServiceDetail', { id: s._id })}
              />
            ))}
          </Section>
        ) : null}

        <AuditHistory entityType="Product" entityId={p._id} />

        <Section title="Actions">
          <ListRow
            icon="Droplets"
            title="Send for service"
            subtitle="Dry clean or tailor"
            onPress={() =>
              nav.navigate('ServiceForm', {
                productId: p._id,
                productName: p.name,
              })
            }
          />
          <ListRow icon="Copy" title="Duplicate" onPress={() => duplicate.mutate()} />
          {manager ? (
            <ListRow
              icon="Archive"
              title={p.archivedAt ? 'Unarchive' : 'Archive'}
              onPress={() => archive.mutate()}
            />
          ) : null}
          {manager ? (
            <ListRow
              icon="Trash"
              danger
              title="Move to Trash"
              onPress={async () => {
                if (
                  await confirm({
                    title: `Remove ${p.name}?`,
                    confirmText: 'Move to Trash',
                    destructive: true,
                  })
                )
                  remove.mutate();
              }}
            />
          ) : null}
        </Section>
      </View>
      <AvailabilitySheet productId={p._id} visible={checkOpen} onClose={() => setCheckOpen(false)} />
      <ImageViewer
        images={p.images}
        index={viewer}
        onClose={() => setViewer(null)}
        actions={
          manager
            ? (src, i) =>
                i > 0 ? (
                  <Button
                    title="Make cover photo"
                    icon="Star"
                    variant="surface"
                    size="sm"
                    onPress={() => {
                      setCover.mutate([src, ...p.images.filter((x) => x !== src)]);
                      setViewer(null);
                    }}
                  />
                ) : (
                  <Pill label="Cover photo" />
                )
            : undefined
        }
      />
    </Screen>
  );
}

function AvailabilitySheet({
  productId,
  visible,
  onClose,
}: {
  productId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(isoDay());
  const [to, setTo] = useState(isoDay());
  const [result, setResult] = useState<{
    available: boolean;
    conflicts: {
      bookingNumber: string;
      rentalStartDate: string;
      rentalEndDate: string;
    }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    try {
      setResult(
        await api.get(`/api/admin/products/${productId}/availability`, {
          from,
          to,
        })
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Availability"
      footer={<Button title="Check" onPress={check} loading={busy} />}
    >
      <Row gap={space.md}>
        <DateField
          label="From"
          value={from}
          onChange={(v) => {
            setFrom(v);
            setResult(null);
            if (to < v) setTo(v);
          }}
          style={{ flex: 1 }}
        />
        <DateField
          label="To"
          value={to}
          onChange={(v) => {
            setTo(v);
            setResult(null);
          }}
          style={{ flex: 1 }}
        />
      </Row>
      {result ? (
        <Card>
          {result.available ? (
            <Row>
              <Icon name="BadgeCheck" color={colors.success} />
              <T variant="bodyStrong" color={colors.success}>
                Free for these dates
              </T>
            </Row>
          ) : (
            <>
              <T variant="bodyStrong" color={colors.danger}>
                Already booked
              </T>
              {result.conflicts.map((c) => (
                <T key={c.bookingNumber} variant="small">
                  {c.bookingNumber} · {fmtRange(c.rentalStartDate, c.rentalEndDate)}
                </T>
              ))}
            </>
          )}
        </Card>
      ) : null}
    </Sheet>
  );
}

const slugify = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function ProductFormScreen() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const nav = useNav();
  const role = useRole();
  const invalidate = useInvalidate();
  const q = useApi<{ product: Product }>(id ? `/api/admin/products/${id}` : null);
  const cats = useApi<{ categories: Category[] }>('/api/admin/categories', {
    all: 'true',
  });
  const invSettings = useApi<{
    settings: { defaultSecurityDepositMultiplier?: number; defaultRetailValueMultiplier?: number };
  }>('/api/admin/settings/inventory');
  const [f, setF] = useState({
    name: '',
    sku: '',
    category: '',
    designer: '',
    dealerName: '',
    description: '',
    color: '',
    fabric: '',
    dressType: '',
    work: '',
    rentalPricePerDay: '',
    securityDeposit: '',
    retailValue: '',
    purchasePrice: '',
    stitchingCost: '',
    transportCost: '',
    otherCost: '',
    status: 'available',
    tags: '',
  });
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<{ size: string; qty: string }[]>([{ size: 'Free', qty: '1' }]);
  const [flags, setFlags] = useState({
    isFeatured: false,
    isNewArrival: true,
    isActive: true,
  });
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    const p = q.data?.product;
    if (!p) return;
    setF({
      name: p.name,
      sku: p.sku,
      category: p.category?._id ?? '',
      designer: p.designer ?? '',
      dealerName: p.dealerName ?? '',
      description: p.description ?? '',
      color: p.color ?? '',
      fabric: p.fabric ?? '',
      dressType: p.dressType ?? '',
      work: p.work ?? '',
      rentalPricePerDay: String(p.rentalPricePerDay ?? ''),
      securityDeposit: String(p.securityDeposit ?? ''),
      retailValue: String(p.retailValue ?? ''),
      purchasePrice: p.purchasePrice ? String(p.purchasePrice) : '',
      stitchingCost: p.stitchingCost ? String(p.stitchingCost) : '',
      transportCost: p.transportCost ? String(p.transportCost) : '',
      otherCost: p.otherCost ? String(p.otherCost) : '',
      status: p.status,
      tags: p.tags.join(', '),
    });
    setImages(p.images);
    setVariants(
      p.variants.length
        ? p.variants.map((v) => ({
            size: v.size,
            qty: String(v.quantityInStock),
          }))
        : [{ size: 'Free', qty: '1' }]
    );
    setFlags({
      isFeatured: p.isFeatured,
      isNewArrival: p.isNewArrival,
      isActive: p.isActive,
    });
  }, [q.data]);

  const [linkOpen, setLinkOpen] = useState(false);
  const addPhotos = async (source: 'library' | 'camera') => {
    setUploading(true);
    try {
      const urls = await pickAndUpload(source);
      setImages((list) => [...list, ...urls]);
    } catch (e) {
      toast.error('Upload failed', errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!f.name.trim() || !f.sku.trim() || !f.category)
      return toast.error('Name, code and category are required');
    setBusy(true);
    const body = {
      name: f.name.trim(),
      slug: editing && q.data?.product.slug ? q.data.product.slug : slugify(`${f.name}-${f.sku}`),
      sku: f.sku.trim().toUpperCase(),
      category: f.category,
      designer: f.designer,
      dealerName: f.dealerName,
      description: f.description,
      color: f.color,
      fabric: f.fabric,
      dressType: f.dressType,
      work: f.work,
      images,
      variants: variants
        .filter((v) => v.size.trim())
        .map((v) => ({
          size: v.size.trim(),
          quantityInStock: Math.max(0, Math.round(num(v.qty) ?? 0)),
        })),
      status: f.status,
      rentalPricePerDay: num(f.rentalPricePerDay) ?? 0,
      securityDeposit: num(f.securityDeposit),
      retailValue: num(f.retailValue),
      purchasePrice: num(f.purchasePrice),
      stitchingCost: num(f.stitchingCost),
      transportCost: num(f.transportCost),
      otherCost: num(f.otherCost),
      ...flags,
      tags: f.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      const r = editing
        ? await api.patch<{ product: Product }>(`/api/admin/products/${id}`, body)
        : await api.post<{ product: Product }>('/api/admin/products', body);
      invalidate('/api/admin/products');
      toast.success(editing ? 'Saved' : 'Piece added');
      if (editing) nav.goBack();
      else nav.replace('ProductDetail', { id: r.product._id });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (editing && q.isLoading)
    return (
      <Screen header={<Header title="Edit piece" />}>
        <Loading />
      </Screen>
    );

  return (
    <Screen
      header={<Header title={editing ? 'Edit piece' : 'New piece'} />}
      footer={
        <Button title={editing ? 'Save changes' : 'Add to catalogue'} onPress={submit} loading={busy} />
      }
    >
      <T variant="caption" style={{ marginBottom: space.sm }}>
        Photos
      </T>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm }}
        style={{ marginBottom: space.lg }}
      >
        {images.map((src, i) => (
          <View key={`${src}-${i}`}>
            <Img src={src} style={{ width: 92, height: 116 }} />
            <View style={{ position: 'absolute', top: 4, right: 4 }}>
              <IconButton
                icon="X"
                size={26}
                onPress={() => setImages((l) => l.filter((_, j) => j !== i))}
                accessibilityLabel="Remove photo"
              />
            </View>
            {i === 0 ? (
              <View style={{ position: 'absolute', bottom: 4, left: 4 }}>
                <Pill label="Cover" small />
              </View>
            ) : null}
          </View>
        ))}
        <Tap style={styles.addPhoto} onPress={() => addPhotos('library')} disabled={uploading}>
          {uploading ? <ActivityIndicator color={colors.gold} /> : <Icon name="Image" color={colors.gold} />}
          <T variant="small">Gallery</T>
        </Tap>
        <Tap style={styles.addPhoto} onPress={() => addPhotos('camera')} disabled={uploading}>
          <Icon name="Camera" color={colors.gold} />
          <T variant="small">Camera</T>
        </Tap>
        <Tap style={styles.addPhoto} onPress={() => setLinkOpen(true)} disabled={uploading}>
          <Icon name="Link" color={colors.gold} />
          <T variant="small">Link</T>
        </Tap>
      </ScrollView>
      <ImageLinkSheet
        visible={linkOpen}
        onClose={() => setLinkOpen(false)}
        onAdd={(u) => setImages((list) => [...list, u])}
      />

      <Input label="Name" value={f.name} onChangeText={set('name')} required autoCapitalize="words" />
      <Row gap={space.md}>
        <Input
          label="Code / SKU"
          value={f.sku}
          onChangeText={set('sku')}
          required
          autoCapitalize="characters"
          style={{ flex: 1 }}
        />
        <SelectField
          label="Category"
          required
          value={f.category}
          onChange={set('category')}
          options={(cats.data?.categories ?? []).map((c) => ({
            value: c._id,
            label: c.name,
          }))}
          style={{ flex: 1 }}
        />
      </Row>
      <Row gap={space.md}>
        <MoneyInput
          label="Rent"
          value={f.rentalPricePerDay}
          onChangeText={(v) => {
            const rent = num(v) ?? 0;
            const st = invSettings.data?.settings;
            setF((x) => ({
              ...x,
              rentalPricePerDay: v,
              ...(!editing && st?.defaultSecurityDepositMultiplier && rent
                ? { securityDeposit: String(Math.round(rent * st.defaultSecurityDepositMultiplier)) }
                : {}),
              ...(!editing && st?.defaultRetailValueMultiplier && rent
                ? { retailValue: String(Math.round(rent * st.defaultRetailValueMultiplier)) }
                : {}),
            }));
          }}
          required
          style={{ flex: 1 }}
        />
        <MoneyInput
          label="Deposit"
          value={f.securityDeposit}
          onChangeText={set('securityDeposit')}
          style={{ flex: 1 }}
        />
      </Row>
      <MoneyInput label="Retail value" value={f.retailValue} onChangeText={set('retailValue')} />
      <SelectField
        label="Status"
        value={f.status}
        onChange={set('status')}
        options={Object.entries(PRODUCT_STATUS).map(([value, v]) => ({
          value,
          label: v.label,
        }))}
      />

      <Section title="Description">
        <Row gap={space.md}>
          <Input label="Colour" value={f.color} onChangeText={set('color')} style={{ flex: 1 }} />
          <Input label="Fabric" value={f.fabric} onChangeText={set('fabric')} style={{ flex: 1 }} />
        </Row>
        <Row gap={space.md}>
          <Input label="Dress type" value={f.dressType} onChangeText={set('dressType')} style={{ flex: 1 }} />
          <Input label="Work" value={f.work} onChangeText={set('work')} style={{ flex: 1 }} />
        </Row>
        <Input label="Designer" value={f.designer} onChangeText={set('designer')} />
        <Input label="Description" value={f.description} onChangeText={set('description')} multiline />
        <Input label="Tags" hint="comma separated" value={f.tags} onChangeText={set('tags')} />
      </Section>

      <Section title="Sizes & stock">
        {variants.map((v, i) => (
          <Row key={i} gap={space.md}>
            <Input
              label="Size"
              value={v.size}
              onChangeText={(s) => setVariants((l) => l.map((x, j) => (j === i ? { ...x, size: s } : x)))}
              style={{ flex: 2 }}
            />
            <Input
              label="Qty"
              value={v.qty}
              keyboardType="number-pad"
              onChangeText={(s) => setVariants((l) => l.map((x, j) => (j === i ? { ...x, qty: s } : x)))}
              style={{ flex: 1 }}
            />
            {variants.length > 1 ? (
              <IconButton
                icon="X"
                size={32}
                onPress={() => setVariants((l) => l.filter((_, j) => j !== i))}
              />
            ) : null}
          </Row>
        ))}
        <Button
          title="Add size"
          icon="Plus"
          variant="ghost"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => setVariants((l) => [...l, { size: '', qty: '1' }])}
        />
      </Section>

      {isManager(role) ? (
        <Section title="Costs (private)">
          <Input label="Dealer" value={f.dealerName} onChangeText={set('dealerName')} />
          <Row gap={space.md}>
            <MoneyInput
              label="Purchase"
              value={f.purchasePrice}
              onChangeText={set('purchasePrice')}
              style={{ flex: 1 }}
            />
            <MoneyInput
              label="Stitching"
              value={f.stitchingCost}
              onChangeText={set('stitchingCost')}
              style={{ flex: 1 }}
            />
          </Row>
          <Row gap={space.md}>
            <MoneyInput
              label="Transport"
              value={f.transportCost}
              onChangeText={set('transportCost')}
              style={{ flex: 1 }}
            />
            <MoneyInput
              label="Other"
              value={f.otherCost}
              onChangeText={set('otherCost')}
              style={{ flex: 1 }}
            />
          </Row>
        </Section>
      ) : null}

      <Section title="Visibility">
        <ToggleRow
          label="Show on website & app"
          value={flags.isActive}
          onChange={(v) => setFlags((s) => ({ ...s, isActive: v }))}
        />
        <ToggleRow
          label="Featured"
          value={flags.isFeatured}
          onChange={(v) => setFlags((s) => ({ ...s, isFeatured: v }))}
        />
        <ToggleRow
          label="New arrival"
          description="Privé members see new arrivals 7 days early"
          value={flags.isNewArrival}
          onChange={(v) => setFlags((s) => ({ ...s, isNewArrival: v }))}
        />
      </Section>
    </Screen>
  );
}

export function CategoriesScreen() {
  const invalidate = useInvalidate();
  const role = useRole();
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing?.name?.trim()) return toast.error('Name is required');
    setBusy(true);
    const body = {
      name: editing.name.trim(),
      slug: editing.slug || slugify(editing.name),
      description: editing.description ?? '',
      heroImage: editing.heroImage ?? '',
      displayOrder: Number(editing.displayOrder ?? 0),
      isFeatured: Boolean(editing.isFeatured),
    };
    try {
      if (editing._id) await api.patch(`/api/admin/categories/${editing._id}`, body);
      else await api.post('/api/admin/categories', body);
      invalidate('/api/admin/categories');
      toast.success('Category saved');
      setEditing(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Category) => {
    if (
      !(await confirm({
        title: `Delete ${c.name}?`,
        message: 'Moves to Trash.',
        confirmText: 'Delete',
        destructive: true,
      }))
    )
      return;
    try {
      await api.delete(`/api/admin/categories/${c._id}`);
      invalidate('/api/admin/categories');
      toast.success('Category removed');
      setEditing(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ListScreen<Category>
        title="Categories"
        path="/api/admin/categories"
        listKey="categories"
        search={false}
        pageSize={50}
        bulk={isManager(role) ? BULK.categories : []}
        trash={TRASH.categories}
        exporter={EXPORTS.categories}
        filters={{
          sorts: [
            { value: 'name', label: 'Name' },
            { value: 'createdAt', label: 'Date added' },
            { value: 'updatedAt', label: 'Last updated' },
          ],
        }}
        onCreate={() => setEditing({ name: '', isFeatured: false })}
        createLabel="Category"
        empty={{ icon: 'FolderTree', title: 'No categories yet' }}
        renderItem={(c) => (
          <ListRow
            leading={<Img src={c.heroImage} style={{ width: 46, height: 46 }} rounded={23} />}
            title={c.name}
            subtitle={c.description || c.slug}
            right={c.isFeatured ? <Pill label="Featured" small /> : undefined}
            onPress={isManager(role) ? () => setEditing(c) : undefined}
          />
        )}
      />
      <Sheet
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?._id ? 'Edit category' : 'New category'}
        footer={
          <View style={{ gap: space.sm }}>
            <Button title="Save" onPress={save} loading={busy} />
            {editing?._id && isManager(role) ? (
              <Button title="Delete" variant="danger" onPress={() => remove(editing as Category)} />
            ) : null}
          </View>
        }
      >
        <Input
          label="Name"
          value={editing?.name ?? ''}
          onChangeText={(v) => setEditing((s) => ({ ...s, name: v }))}
          required
        />
        <Input
          label="Description"
          value={editing?.description ?? ''}
          onChangeText={(v) => setEditing((s) => ({ ...s, description: v }))}
          multiline
        />
        <Input
          label="Display order"
          value={String(editing?.displayOrder ?? 0)}
          keyboardType="number-pad"
          onChangeText={(v) => setEditing((s) => ({ ...s, displayOrder: Number(v) || 0 }))}
        />
        <ToggleRow
          label="Featured on home"
          value={Boolean(editing?.isFeatured)}
          onChange={(v) => setEditing((s) => ({ ...s, isFeatured: v }))}
        />
        <Button
          title={editing?.heroImage ? 'Replace cover photo' : 'Add cover photo'}
          icon="Image"
          variant="outline"
          onPress={async () => {
            try {
              const [url] = await pickAndUpload('library');
              if (url) setEditing((s) => ({ ...s, heroImage: url }));
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        />
        <Input
          label="…or paste an image link"
          value={editing?.heroImage ?? ''}
          onChangeText={(v) => setEditing((s) => ({ ...s, heroImage: v.trim() }))}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="https://…"
          style={{ marginTop: space.md }}
        />
        {editing?.heroImage ? <Img src={editing.heroImage} style={{ width: '100%', height: 160 }} /> : null}
      </Sheet>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    fav: {
      position: 'absolute',
      bottom: space.sm,
      right: space.sm,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hidden: {
      position: 'absolute',
      top: space.sm,
      right: space.sm,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addPhoto: {
      width: 92,
      height: 116,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.goldDeep,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
  })
);
