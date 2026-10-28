import React, { useState } from 'react';
import { View } from 'react-native';
import { useApi } from '../../api/hooks';
import type { Customer, Product } from '../../api/types';
import { SelectField, useDebounced, type Option, Input, T } from '../ui';
import { inr } from '../../lib/format';
import { MEASUREMENT_FIELDS } from '../../lib/labels';
import { space } from '../../theme';

/** Server-searched customer picker (keeps the selected one visible even when off the result page). */
export function CustomerPicker({
  value,
  onChange,
  label = 'Customer',
  initial,
  optional,
}: {
  value: string;
  onChange: (id: string, customer: Option) => void;
  label?: string;
  initial?: Option | null;
  /** Not required: shows "Optional" instead of the required mark. */
  optional?: boolean;
}) {
  const [q, setQ] = useState('');
  const term = useDebounced(q);
  const { data, isFetching } = useApi<{ customers: Customer[] }>('/api/admin/customers', {
    search: term,
    pageSize: 30,
  });
  const [picked, setPicked] = useState<Option | null>(initial ?? null);
  const options: Option[] = (data?.customers ?? []).map((c) => ({
    value: c._id,
    label: c.name,
    subtitle: [c.phone, c.email].filter(Boolean).join(' · '),
  }));
  if (picked && !options.some((o) => o.value === picked.value)) options.unshift(picked);
  return (
    <SelectField
      label={label}
      required={!optional}
      hint={optional ? 'Optional' : undefined}
      value={value}
      options={options}
      onSearch={setQ}
      loading={isFetching}
      placeholder="Search name, phone or email"
      onChange={(id, option) => {
        setPicked(option);
        onChange(id, option);
      }}
    />
  );
}

/** Server-searched product picker; `bookable` hides sold/archived pieces like the web booking form. */
export function ProductPicker({
  value,
  onChange,
  label = 'Dress',
  bookable,
  initial,
  bookedIds,
}: {
  value: string;
  onChange: (id: string, product: Product | null, option: Option) => void;
  label?: string;
  bookable?: boolean;
  initial?: Option | null;
  /** Dresses already booked for the chosen dates — shown but not selectable (web booking form). */
  bookedIds?: Set<string>;
}) {
  const [q, setQ] = useState('');
  const term = useDebounced(q);
  const { data, isFetching } = useApi<{ products: Product[] }>('/api/admin/products', {
    search: term,
    pageSize: 30,
    ...(bookable ? { bookable: 'true' } : {}),
  });
  const [picked, setPicked] = useState<Option | null>(initial ?? null);
  const products = data?.products ?? [];
  const options: Option[] = products.map((p) => {
    const booked = Boolean(bookedIds?.has(p._id)) && p._id !== value;
    return {
      value: p._id,
      label: `${p.name}`,
      subtitle: `${p.sku} · ${inr(p.rentalPricePerDay)} · ${p.color || '—'}`,
      disabled: booked,
      note: booked ? 'Already booked for these dates' : undefined,
    };
  });
  if (picked && !options.some((o) => o.value === picked.value)) options.unshift(picked);
  return (
    <SelectField
      label={label}
      required
      value={value}
      options={options}
      onSearch={setQ}
      loading={isFetching}
      placeholder="Search name or code"
      onChange={(id, option) => {
        setPicked(option);
        onChange(id, products.find((p) => p._id === id) ?? null, option);
      }}
    />
  );
}

/** Two-column measurement inputs (strings, as the API stores them). */
export function MeasurementsEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -space.xs,
      }}
    >
      {MEASUREMENT_FIELDS.map((field) => (
        <View
          key={field.key}
          style={{
            width: field.key === 'other' ? '100%' : '50%',
            paddingHorizontal: space.xs,
          }}
        >
          <Input
            label={field.label}
            value={value[field.key] ?? ''}
            onChangeText={(text) => onChange({ ...value, [field.key]: text })}
            keyboardType={field.key === 'other' ? 'default' : 'decimal-pad'}
            style={{ marginBottom: space.md }}
          />
        </View>
      ))}
    </View>
  );
}

export function MeasurementsView({ value }: { value?: Record<string, string | undefined> | null }) {
  const entries = MEASUREMENT_FIELDS.filter((f) => value?.[f.key]);
  if (!entries.length) return <T variant="small">No measurements recorded.</T>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {entries.map((f) => (
        <View key={f.key} style={{ minWidth: '30%' }}>
          <T variant="caption">{f.label}</T>
          <T variant="bodyStrong">{value?.[f.key]}</T>
        </View>
      ))}
    </View>
  );
}

/** Strip empty measurement strings before sending. */
export function cleanMeasurements(value: Record<string, string>): Record<string, string> | undefined {
  const cleaned = Object.fromEntries(Object.entries(value).filter(([, v]) => v && v.trim()));
  return Object.keys(cleaned).length ? cleaned : undefined;
}
