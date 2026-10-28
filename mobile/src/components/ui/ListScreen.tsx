import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../navigation/tabSpace';
import LinearGradient from 'react-native-linear-gradient';
import { useInvalidate, useList } from '../../api/hooks';
import { colors, gradients, radius, shadow, space, themed } from '../../theme';
import { Empty, ErrorState, Header, Row } from './Layout';
import { Chips, DateField, SearchBar, Segmented, SelectField } from './Form';
import { Tap } from './Pressable';
import { Icon } from './Icon';
import { T } from './Text';
import { Button, IconButton } from './Button';
import { Sheet } from './Sheet';
import { confirm } from './Dialog';
import { toast } from './Toast';
import { GridSkeleton, ListSkeleton } from './Skeleton';
import { api, errorMessage } from '../../api/client';
import { useRole } from '../../auth/AuthContext';
import type { UserRole } from '../../api/types';
import { exportTable, type Cell, type ExportFormat } from '../../lib/files';
import { haptic } from '../../lib/haptics';

export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export interface BulkAction {
  action: 'archive' | 'restore' | 'delete' | 'permanent-delete' | 'activate' | 'deactivate';
  label: string;
  icon: string;
  danger?: boolean;
  roles?: UserRole[];
}

export interface ExportColumn<T> {
  label: string;
  value: (item: T) => Cell;
  /** Sum this column into a totals row. */
  total?: boolean;
}

export interface ListScreenProps<T> {
  title: string;
  subtitle?: string;
  path: string;
  listKey: string;
  query?: Record<string, unknown>;
  renderItem: (item: T) => React.ReactElement;
  keyOf?: (item: T) => string;
  search?: boolean | string;
  chips?: { value: string; label: string }[];
  chipParam?: string;
  counts?: (meta: Record<string, unknown> | null) => Record<string, number> | undefined;
  defaultChip?: string;
  onCreate?: () => void;
  createLabel?: string;
  headerRight?: React.ReactNode;
  top?: (meta: Record<string, unknown> | null) => React.ReactNode;
  empty?: { icon?: string; title: string; body?: string };
  back?: boolean;
  large?: boolean;
  pageSize?: number;
  /** Multi-select bulk actions via `${path}/bulk` ({ ids, action }). */
  bulk?: BulkAction[];
  /** Trash view: which query param flips the list to deleted records. */
  trash?: {
    param: 'view' | 'status';
    roles?: UserRole[];
    permanentRoles?: UserRole[];
    /** List deleted records only (the web has no restore for these). */
    readOnly?: boolean;
  };
  /** Filter sheet: date range (from/to) and sort options (sortBy/sortDir). */
  filters?: { dateRange?: { label?: string }; sorts?: { value: string; label: string }[] };
  /** Export the whole filtered list (not just loaded pages). */
  exporter?: { title: string; filename: string; columns: ExportColumn<T>[] };
  /** Extra items for the ⋯ menu (import, settings…). */
  menu?: { label: string; icon: string; onPress: () => void }[];
  /** Grid layout (e.g. 2 for the catalogue). */
  numColumns?: number;
}

const MANAGERS: UserRole[] = ['admin', 'developer', 'super_admin'];

/** Search + chips + infinite list + bulk select + trash + filters + export — the backbone of every admin module. */
export function ListScreen<T extends { _id?: string }>({
  title,
  subtitle,
  path,
  listKey,
  query,
  renderItem,
  keyOf,
  search = true,
  chips,
  chipParam = 'status',
  counts,
  defaultChip,
  onCreate,
  createLabel = 'New',
  headerRight,
  top,
  empty,
  back = true,
  large = false,
  pageSize = 20,
  bulk,
  trash,
  filters,
  exporter,
  menu,
  numColumns,
}: ListScreenProps<T>) {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const role = useRole();
  const invalidate = useInvalidate();
  const [text, setText] = useState('');
  const term = useDebounced(text);
  const [chip, setChip] = useState(defaultChip ?? chips?.[0]?.value ?? '');
  const [inTrash, setInTrash] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [sort, setSort] = useState<{ sortBy: string; sortDir: 'asc' | 'desc' }>({
    sortBy: '',
    sortDir: 'desc',
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const chipsHidden = Boolean(inTrash && trash?.param === 'status' && chipParam === 'status');

  const fullQuery = useMemo(() => {
    const q: Record<string, unknown> = { ...query };
    if (search && term) q.search = term;
    if (chips && chip && !chipsHidden) q[chipParam] = chip;
    if (inTrash && trash) q[trash.param] = 'trash';
    if (range.from) q.from = range.from;
    if (range.to) q.to = range.to;
    if (sort.sortBy) {
      q.sortBy = sort.sortBy;
      q.sortDir = sort.sortDir;
    }
    return q;
  }, [query, search, term, chips, chip, chipParam, chipsHidden, inTrash, trash, range, sort]);

  const list = useList<T>(path, listKey, fullQuery, pageSize);
  const chipCounts = counts?.(list.meta);
  const idOf = (item: T, index: number) => (keyOf ? keyOf(item) : item._id ?? String(index));
  const allowed = (roles?: UserRole[]) => !roles || (role ? roles.includes(role) : false);

  const bulkActions: BulkAction[] = inTrash
    ? trash?.readOnly
      ? []
      : [
          { action: 'restore', label: 'Restore', icon: 'Undo2', roles: trash?.roles },
          {
            action: 'permanent-delete',
            label: 'Delete forever',
            icon: 'Trash',
            danger: true,
            roles: trash?.permanentRoles ?? MANAGERS,
          },
        ]
    : bulk ?? [];
  const visibleBulk = bulkActions.filter((a) => allowed(a.roles));
  const canSelect = visibleBulk.length > 0;

  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const runBulk = async (a: BulkAction) => {
    const ids = [...selected];
    if (!ids.length) return;
    if (
      (a.danger || a.action === 'delete') &&
      !(await confirm({
        title: `${a.label} ${ids.length} ${ids.length === 1 ? 'record' : 'records'}?`,
        message:
          a.action === 'permanent-delete'
            ? 'This cannot be undone.'
            : a.action === 'delete'
            ? 'They move to Trash and can be restored.'
            : undefined,
        confirmText: a.label,
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    try {
      const r = await api.post<{ affected?: number; deleted?: number; blocked?: unknown[] }>(`${path}/bulk`, {
        ids,
        action: a.action,
      });
      const n = r.affected ?? r.deleted ?? ids.length;
      const blocked = Array.isArray(r.blocked) ? r.blocked.length : 0;
      toast.success(
        `${a.label}: ${n} done`,
        blocked ? `${blocked} skipped (still linked to other records)` : undefined
      );
      invalidate(path, '/api/admin/trash', '/api/admin/dashboard');
      exitSelect();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const trashTap = async (item: T) => {
    const id = item._id;
    if (!id) return;
    const permanentOk = allowed(trash?.permanentRoles ?? MANAGERS);
    const restore = await confirm({
      title: 'In Trash',
      message: permanentOk ? 'Restore this record, or delete it forever?' : 'Restore this record?',
      confirmText: 'Restore',
      cancelText: permanentOk ? 'Delete forever…' : 'Cancel',
    });
    try {
      if (restore) {
        await api.post(`${path}/${id}/restore`);
        toast.success('Restored');
      } else if (
        permanentOk &&
        (await confirm({
          title: 'Delete forever?',
          message: 'This cannot be undone.',
          confirmText: 'Delete forever',
          destructive: true,
        }))
      ) {
        await api.delete(`${path}/${id}/permanent`);
        toast.success('Deleted permanently');
      } else return;
      invalidate(path, '/api/admin/trash');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // Web "Empty Trash": permanently delete every trashed record in this list.
  const emptyTrash = async () => {
    if (!trash) return;
    setMenuOpen(false);
    if (
      !(await confirm({
        title: `Empty ${title.toLowerCase()} trash?`,
        message:
          'Every trashed record here will be permanently deleted, even if other records still reference it. This cannot be undone.',
        confirmText: 'Empty Trash',
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    try {
      const all = await api.get<Record<string, unknown>>(path, { [trash.param]: 'trash', all: 'true' });
      const ids = ((all[listKey] as { _id?: string }[] | undefined) ?? []).map((x) => String(x._id));
      if (!ids.length) {
        toast.success('Trash is already empty');
        return;
      }
      const r = await api.post<{ deleted?: number; affected?: number }>(`${path}/bulk`, {
        ids,
        action: 'permanent-delete',
      });
      toast.success(`Emptied trash — deleted ${r.deleted ?? r.affected ?? ids.length}`);
      invalidate(path, '/api/admin/trash', '/api/admin/dashboard');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runExport = async (format: ExportFormat | 'print') => {
    if (!exporter) return;
    setMenuOpen(false);
    setBusy(true);
    try {
      const data = await api.get<Record<string, unknown>>(path, { ...fullQuery, all: 'true' });
      const items = (data[listKey] as T[] | undefined) ?? [];
      const rows = items.map((item) => exporter.columns.map((c) => c.value(item) ?? ''));
      const hasTotals = exporter.columns.some((c) => c.total);
      const totals = hasTotals
        ? exporter.columns.map((c, i) =>
            c.total ? rows.reduce((s, r) => s + (Number(r[i]) || 0), 0) : i === 0 ? 'TOTAL' : ''
          )
        : undefined;
      await exportTable({
        format,
        filename: exporter.filename,
        title: exporter.title,
        headers: exporter.columns.map((c) => c.label),
        rows,
        totals,
      });
    } catch (e) {
      toast.error('Export failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const filterActive = Boolean(range.from || range.to || sort.sortBy);
  // Select lives in the More menu, keeping the header to filter + more (plus any screen-specific icon).
  const showMenu = Boolean(exporter || menu?.length || trash || canSelect);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title={inTrash ? `${title} · Trash` : title}
        subtitle={subtitle}
        back={back}
        large={large && !selecting}
        right={
          selecting ? (
            <Button title="Done" size="sm" variant="surface" onPress={exitSelect} />
          ) : (
            <>
              {headerRight}
              {filters ? (
                <IconButton
                  icon="SlidersHorizontal"
                  color={filterActive ? colors.gold : colors.text}
                  onPress={() => setFilterOpen(true)}
                  accessibilityLabel="Filters"
                />
              ) : null}
              {showMenu ? (
                <IconButton
                  icon="Ellipsis"
                  onPress={() => setMenuOpen(true)}
                  accessibilityLabel="More actions"
                />
              ) : null}
            </>
          )
        }
      />
      {search ? (
        <SearchBar
          value={text}
          onChangeText={setText}
          placeholder={typeof search === 'string' ? search : `Search ${title.toLowerCase()}`}
          style={{ marginHorizontal: space.lg, marginBottom: space.md }}
        />
      ) : null}
      {chips && !chipsHidden ? (
        <Chips
          options={chips.map((c) => ({ ...c, count: chipCounts?.[c.value] }))}
          value={chip}
          onChange={setChip}
          style={{ marginBottom: space.md }}
        />
      ) : null}
      {inTrash ? (
        <Tap onPress={() => setInTrash(false)} style={styles.trashBanner} hapticOnPress={false}>
          <Icon name="Trash" size={16} color={colors.warning} />
          <T variant="small" color={colors.warning} style={{ flex: 1 }}>
            {trash?.readOnly ? 'Viewing deleted records' : 'Viewing Trash — tap a record to restore it'}
          </T>
          <T variant="smallStrong" gold>
            Exit
          </T>
        </Tap>
      ) : null}
      {list.isLoading ? (
        numColumns && numColumns > 1 ? (
          <GridSkeleton inset />
        ) : (
          <ListSkeleton inset />
        )
      ) : list.isError ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <FlatList
          key={numColumns ? `grid-${numColumns}` : 'list'}
          data={list.items}
          numColumns={numColumns}
          columnWrapperStyle={numColumns ? { gap: space.md } : undefined}
          keyExtractor={(item, index) => idOf(item, index)}
          renderItem={({ item, index }) => {
            const id = idOf(item, index);
            const isSel = selected.has(id);
            const content = renderItem(item);
            if (selecting) {
              return (
                <View>
                  <View pointerEvents="none" style={isSel ? styles.selectedRow : undefined}>
                    {content}
                  </View>
                  <Tap
                    style={StyleSheet.absoluteFill}
                    hapticOnPress={false}
                    scaleTo={1}
                    onPress={() => {
                      haptic('select');
                      setSelected((s) => {
                        const next = new Set(s);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      });
                    }}
                    accessibilityLabel={isSel ? 'Deselect' : 'Select'}
                  >
                    <View style={[styles.check, isSel && styles.checkOn]}>
                      {isSel ? (
                        <Icon name="Check" size={14} color={colors.onPrimary} strokeWidth={3} />
                      ) : null}
                    </View>
                  </Tap>
                </View>
              );
            }
            if (inTrash && !trash?.readOnly) {
              return (
                <View>
                  <View pointerEvents="none">{content}</View>
                  <Tap
                    style={StyleSheet.absoluteFill}
                    hapticOnPress={false}
                    scaleTo={1}
                    onPress={() => trashTap(item)}
                    accessibilityLabel="Restore options"
                  >
                    <View />
                  </Tap>
                </View>
              );
            }
            return content;
          }}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            // Clear the create button and, inside the tabs, the floating tab bar.
            paddingBottom: (tabSpace || insets.bottom) + 120,
            gap: numColumns ? space.md : undefined,
          }}
          ListHeaderComponent={top && !inTrash ? <>{top(list.meta)}</> : undefined}
          ListEmptyComponent={
            <Empty
              icon={inTrash ? 'Trash' : empty?.icon}
              title={inTrash ? 'Trash is empty' : empty?.title ?? 'Nothing here yet'}
              body={inTrash ? undefined : empty?.body}
              action={
                // A clear next step on an empty list (not while searching or in Trash).
                onCreate && !inTrash && !text.trim() ? (
                  <Button
                    title={createLabel ? `New ${createLabel.toLowerCase()}` : 'Create'}
                    icon="Plus"
                    size="sm"
                    onPress={onCreate}
                  />
                ) : undefined
              }
            />
          }
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <ActivityIndicator color={colors.gold} style={{ marginVertical: space.lg }} />
            ) : list.items.length > 0 ? (
              <T variant="small" align="center" color={colors.textFaint} style={{ marginVertical: space.lg }}>
                {list.total} {list.total === 1 ? 'record' : 'records'}
              </T>
            ) : undefined
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching && !list.isFetchingNextPage}
              onRefresh={() => {
                list.refetch();
              }}
              tintColor={colors.gold}
              colors={[colors.gold]}
              progressBackgroundColor={colors.surface}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {selecting ? (
        <View
          style={[
            styles.bulkBar,
            tabSpace
              ? {
                  bottom: tabSpace + space.sm,
                  marginHorizontal: space.lg,
                  borderRadius: radius.lg,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.borderStrong,
                  paddingBottom: space.md,
                }
              : { paddingBottom: insets.bottom + space.md },
            shadow,
          ]}
        >
          <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
            <T variant="smallStrong">{selected.size} selected</T>
            <Tap
              hapticOnPress={false}
              onPress={() =>
                setSelected(
                  selected.size === list.items.length
                    ? new Set()
                    : new Set(list.items.map((it, i) => idOf(it, i)))
                )
              }
            >
              <T variant="smallStrong" gold>
                {selected.size === list.items.length && list.items.length
                  ? 'Clear'
                  : `Select all ${list.items.length}`}
              </T>
            </Tap>
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            {visibleBulk.map((a) => (
              <Button
                key={a.action}
                title={a.label}
                icon={a.icon}
                size="sm"
                variant={a.danger ? 'danger' : 'surface'}
                disabled={!selected.size}
                loading={busy}
                onPress={() => runBulk(a)}
              />
            ))}
          </Row>
        </View>
      ) : onCreate && !inTrash ? (
        <Fab label={createLabel} onPress={onCreate} />
      ) : null}

      {busy && !selecting ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : null}

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={title}>
        {canSelect && !inTrash ? (
          <Button
            title="Select records"
            icon="Check"
            variant="outline"
            style={{ marginBottom: space.lg }}
            onPress={() => {
              setMenuOpen(false);
              setSelecting(true);
            }}
          />
        ) : null}
        {exporter ? (
          <>
            <T variant="caption" style={{ marginBottom: space.sm }}>
              Export current filter
            </T>
            <Row style={{ marginBottom: space.lg }}>
              <Button
                title="CSV"
                icon="FileText"
                variant="surface"
                size="sm"
                onPress={() => runExport('csv')}
              />
              <Button
                title="Excel"
                icon="FileText"
                variant="surface"
                size="sm"
                onPress={() => runExport('xlsx')}
              />
              <Button
                title="PDF"
                icon="FileText"
                variant="surface"
                size="sm"
                onPress={() => runExport('pdf')}
              />
              <Button
                title="Print"
                icon="Printer"
                variant="surface"
                size="sm"
                onPress={() => runExport('print')}
              />
            </Row>
          </>
        ) : null}
        {menu?.map((m) => (
          <Button
            key={m.label}
            title={m.label}
            icon={m.icon}
            variant="outline"
            style={{ marginBottom: space.sm }}
            onPress={() => {
              setMenuOpen(false);
              m.onPress();
            }}
          />
        ))}
        {trash && allowed(trash.roles) ? (
          <Button
            title={inTrash ? 'Back to active records' : 'View Trash'}
            icon={inTrash ? 'Undo2' : 'Trash'}
            variant="outline"
            onPress={() => {
              setMenuOpen(false);
              exitSelect();
              setInTrash(!inTrash);
            }}
          />
        ) : null}
        {inTrash && trash && !trash.readOnly && allowed(trash.permanentRoles ?? MANAGERS) ? (
          <Button
            title="Empty Trash"
            icon="Trash"
            variant="danger"
            style={{ marginTop: space.sm }}
            onPress={emptyTrash}
          />
        ) : null}
      </Sheet>

      {filters ? (
        <Sheet
          visible={filterOpen}
          onClose={() => setFilterOpen(false)}
          title="Filters"
          footer={
            <View style={{ gap: space.sm }}>
              <Button title="Apply" onPress={() => setFilterOpen(false)} />
              {filterActive ? (
                <Button
                  title="Clear filters"
                  variant="ghost"
                  onPress={() => {
                    setRange({ from: '', to: '' });
                    setSort({ sortBy: '', sortDir: 'desc' });
                    setFilterOpen(false);
                  }}
                />
              ) : null}
            </View>
          }
        >
          {filters.dateRange ? (
            <>
              <T variant="caption" style={{ marginBottom: space.sm }}>
                {filters.dateRange.label ?? 'Date range'}
              </T>
              <Row gap={space.md}>
                <DateField
                  label="From"
                  value={range.from}
                  onChange={(v) => setRange((r) => ({ ...r, from: v }))}
                  style={{ flex: 1 }}
                />
                <DateField
                  label="To"
                  value={range.to}
                  onChange={(v) => setRange((r) => ({ ...r, to: v }))}
                  style={{ flex: 1 }}
                />
              </Row>
            </>
          ) : null}
          {filters.sorts?.length ? (
            <>
              <SelectField
                label="Sort by"
                value={sort.sortBy}
                onChange={(v) => setSort((s) => ({ ...s, sortBy: v }))}
                options={[{ value: '', label: 'Default' }, ...filters.sorts]}
              />
              <Segmented
                options={[
                  { value: 'desc', label: 'Newest / highest' },
                  { value: 'asc', label: 'Oldest / lowest' },
                ]}
                value={sort.sortDir}
                onChange={(v) => setSort((s) => ({ ...s, sortDir: v }))}
              />
            </>
          ) : null}
        </Sheet>
      ) : null}
    </View>
  );
}

export function Fab({
  label,
  onPress,
  icon = 'Plus',
}: {
  label?: string;
  onPress: () => void;
  icon?: string;
}) {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  return (
    <Tap
      onPress={onPress}
      style={[styles.fab, { bottom: tabSpace ? tabSpace + space.md : insets.bottom + space.xl }, shadow]}
      accessibilityLabel={label ?? 'Create'}
    >
      <LinearGradient
        colors={[...gradients.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fabInner}
      >
        <Icon name={icon} size={20} color={colors.onPrimary} strokeWidth={2.2} />
        {label ? (
          <T style={{ color: colors.onPrimary, fontFamily: 'Manrope-Bold', fontSize: 14 }}>{label}</T>
        ) : null}
      </LinearGradient>
    </Tap>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    fab: { position: 'absolute', right: space.lg },
    fabInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      height: 54,
      paddingHorizontal: space.xl,
      borderRadius: radius.pill,
    },
    check: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.textMuted,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    selectedRow: { opacity: 0.75 },
    bulkBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: space.lg,
      paddingTop: space.md,
      backgroundColor: colors.bgElevated,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderStrong,
    },
    trashBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      marginHorizontal: space.lg,
      marginBottom: space.md,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.warningBg,
    },
    busy: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.scrim,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);
