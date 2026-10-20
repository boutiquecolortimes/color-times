import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { alpha, colors, currentScheme, fonts, radius, space, themed } from '../../theme';
import { T } from './Text';
import { Icon } from './Icon';
import { Tap } from './Pressable';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { fmtDate, isoDay } from '../../lib/format';
import { haptic } from '../../lib/haptics';

function Label({ label, required, hint }: { label?: string; required?: boolean; hint?: string }) {
  if (!label) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}
    >
      <T variant="caption" style={{ color: colors.textMuted }}>
        {label}
        {required ? (
          <T variant="caption" gold>
            {' '}
            *
          </T>
        ) : null}
      </T>
      {hint ? (
        <T variant="small" color={colors.textFaint}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
  prefix?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: string;
  onSubmitEditing?: () => void;
  returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  hint,
  error,
  multiline,
  keyboardType,
  secure,
  prefix,
  autoCapitalize,
  autoComplete,
  editable = true,
  style,
  icon,
  onSubmitEditing,
  returnKeyType,
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  return (
    <View style={[{ marginBottom: space.lg }, style]}>
      <Label label={label} required={required} hint={hint} />
      <View
        style={[
          styles.field,
          multiline && {
            minHeight: 96,
            alignItems: 'flex-start',
            paddingVertical: space.md,
          },
          focused && { borderColor: colors.gold },
          error ? { borderColor: colors.danger } : null,
          !editable && { opacity: 0.6 },
        ]}
      >
        {icon ? <Icon name={icon} size={18} color={colors.textFaint} /> : null}
        {prefix ? (
          <T variant="body" muted>
            {prefix}
          </T>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          style={[styles.input, multiline && { textAlignVertical: 'top' }]}
          multiline={multiline}
          keyboardType={keyboardType}
          secureTextEntry={secure && !reveal}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          editable={editable}
          selectionColor={colors.gold}
          cursorColor={colors.gold}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          keyboardAppearance={currentScheme()}
        />
        {secure ? (
          <Tap
            onPress={() => setReveal((r) => !r)}
            hapticOnPress={false}
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
          >
            <Icon name={reveal ? 'EyeOff' : 'Eye'} size={18} color={colors.textFaint} />
          </Tap>
        ) : null}
      </View>
      {error ? (
        <T variant="small" color={colors.danger} style={{ marginTop: 4 }}>
          {error}
        </T>
      ) : null}
    </View>
  );
}

/** Numeric money input that keeps a string in state; parse with num() on submit. */
export function MoneyInput(props: Omit<InputProps, 'keyboardType' | 'prefix'>) {
  return <Input {...props} keyboardType="decimal-pad" prefix="₹" />;
}

export function DateField({
  label,
  value,
  onChange,
  required,
  minimumDate,
  style,
}: {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  required?: boolean;
  minimumDate?: Date;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  const [draft, setDraft] = useState(date);

  return (
    <View style={[{ marginBottom: space.lg }, style]}>
      <Label label={label} required={required} />
      <Tap
        onPress={() => {
          setDraft(date);
          setOpen(true);
        }}
        style={styles.field}
        scaleTo={0.99}
      >
        <Icon name="Calendar" size={18} color={colors.gold} />
        <T variant="body" style={{ flex: 1 }} color={value ? colors.text : colors.textFaint}>
          {value ? fmtDate(value) : 'Select date'}
        </T>
      </Tap>
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={date}
          mode="date"
          minimumDate={minimumDate}
          onChange={(event, selected) => {
            setOpen(false);
            if (event.type === 'set' && selected) onChange(isoDay(selected));
          }}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Sheet
          visible={open}
          onClose={() => setOpen(false)}
          title={label ?? 'Select date'}
          footer={
            <Button
              title="Done"
              onPress={() => {
                onChange(isoDay(draft));
                setOpen(false);
              }}
            />
          }
        >
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            themeVariant={currentScheme()}
            accentColor={colors.gold}
            minimumDate={minimumDate}
            onChange={(_, selected) => selected && setDraft(selected)}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

export interface Option {
  value: string;
  label: string;
  subtitle?: string;
  /** Greyed out and not selectable (e.g. dress already booked for these dates). */
  disabled?: boolean;
  /** Short warning line under the option. */
  note?: string;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  required,
  searchable,
  onSearch,
  loading,
  style,
}: {
  label?: string;
  value: string;
  options: Option[];
  onChange: (value: string, option: Option) => void;
  placeholder?: string;
  required?: boolean;
  searchable?: boolean;
  /** Remote search: called as the user types (options should update from outside). */
  onSearch?: (query: string) => void;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    if (onSearch || !query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.subtitle?.toLowerCase().includes(q));
  }, [options, query, onSearch]);

  return (
    <View style={[{ marginBottom: space.lg }, style]}>
      <Label label={label} required={required} />
      <Tap onPress={() => setOpen(true)} style={styles.field} scaleTo={0.99}>
        <T
          variant="body"
          style={{ flex: 1 }}
          numberOfLines={1}
          color={selected ? colors.text : colors.textFaint}
        >
          {selected?.label ?? placeholder}
        </T>
        <Icon name="ChevronDown" size={18} color={colors.textFaint} />
      </Tap>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? placeholder} scroll={false}>
        {searchable || onSearch ? (
          <SearchBar
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              onSearch?.(text);
            }}
            placeholder="Search…"
            autoFocus
            style={{ marginBottom: space.md }}
          />
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 460 }}
          contentContainerStyle={{ paddingBottom: space.xl }}
        >
          {loading ? (
            <T variant="small" style={{ padding: space.md }}>
              Searching…
            </T>
          ) : null}
          {!loading && filtered.length === 0 ? (
            <T variant="small" style={{ padding: space.md }}>
              No matches
            </T>
          ) : null}
          {filtered.map((option) => {
            const active = option.value === value;
            return (
              <Tap
                key={option.value}
                disabled={option.disabled}
                onPress={() => {
                  haptic('select');
                  onChange(option.value, option);
                  setOpen(false);
                }}
                hapticOnPress={false}
                scaleTo={0.99}
                style={[
                  styles.option,
                  option.disabled && { opacity: 0.45 },
                  active && {
                    borderColor: colors.goldDeep,
                    backgroundColor: alpha(colors.gold, 0.08),
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong">{option.label}</T>
                  {option.subtitle ? <T variant="small">{option.subtitle}</T> : null}
                  {option.note ? (
                    <T variant="small" color={colors.warning}>
                      {option.note}
                    </T>
                  ) : null}
                </View>
                {active ? <Icon name="Check" size={18} color={colors.gold} /> : null}
              </Tap>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <T variant="bodyStrong">{label}</T>
        {description ? <T variant="small">{description}</T> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          haptic('select');
          onChange(v);
        }}
        trackColor={{ false: colors.borderStrong, true: colors.goldDeep }}
        thumbColor={value ? colors.goldBright : colors.textMuted}
        ios_backgroundColor={colors.borderStrong}
      />
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  autoFocus,
  style,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.search, style]}>
      <Icon name="Search" size={18} color={colors.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={[styles.input, { paddingVertical: 0 }]}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        selectionColor={colors.gold}
        keyboardAppearance={currentScheme()}
      />
      {value ? (
        <Tap onPress={() => onChangeText('')} hapticOnPress={false} accessibilityLabel="Clear search">
          <Icon name="X" size={16} color={colors.textFaint} />
        </Tap>
      ) : null}
    </View>
  );
}

/** Horizontal filter chips, optionally with counts. */
export function Chips<V extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: V; label: string; count?: number }[];
  value: V;
  onChange: (value: V) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Tap
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptic('select');
              onChange(option.value);
            }}
            hapticOnPress={false}
            style={[styles.chip, active && styles.chipActive]}
          >
            <T
              style={{
                fontFamily: fonts.bodySemi,
                fontSize: 13,
                color: active ? colors.onGold : colors.textMuted,
              }}
            >
              {option.label}
              {typeof option.count === 'number' ? `  ${option.count}` : ''}
            </T>
          </Tap>
        );
      })}
    </ScrollView>
  );
}

/** Two-to-four segment switch. */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Tap
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => {
              haptic('select');
              onChange(option.value);
            }}
            hapticOnPress={false}
            style={[
              styles.segment,
              active && {
                backgroundColor: colors.surfaceHigh,
                borderColor: colors.goldDeep,
              },
            ]}
          >
            <T
              style={{
                fontFamily: fonts.bodySemi,
                fontSize: 13,
                color: active ? colors.gold : colors.textMuted,
              }}
              align="center"
            >
              {option.label}
            </T>
          </Tap>
        );
      })}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      minHeight: 50,
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontFamily: fonts.body,
      fontSize: 15,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: space.sm,
      backgroundColor: colors.surface,
    },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: space.md,
    },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      height: 46,
      paddingHorizontal: space.md,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chip: {
      paddingHorizontal: 14,
      height: 34,
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    segmented: {
      flexDirection: 'row',
      gap: 6,
      padding: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      marginBottom: space.lg,
    },
    segment: {
      flex: 1,
      height: 36,
      borderRadius: radius.pill,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
  })
);
