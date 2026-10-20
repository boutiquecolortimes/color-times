import React, { useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '../../api/client';
import { useInvalidate } from '../../api/hooks';
import { Button, Input, Segmented, Sheet, T, toast } from '../ui';
import { space } from '../../theme';

const RELATIONS = ['S/O', 'D/O', 'W/O'] as const;
type Relation = (typeof RELATIONS)[number];

export interface QuickCustomer {
  _id: string;
  name: string;
  phone: string;
  address: string;
}

/**
 * Walk-in customer in one step — same as the web's "New customer" dialog on
 * the booking, sale and customisation forms: no email needed (a unique
 * placeholder is generated), relation (S/O · D/O · W/O) + name, address.
 */
export function QuickCustomerSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (customer: QuickCustomer) => void;
}) {
  const invalidate = useInvalidate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState<Relation>('S/O');
  const [relationName, setRelationName] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setPhone('');
    setRelation('S/O');
    setRelationName('');
    setAddress('');
  };

  const save = async () => {
    if (!name.trim()) return toast.error('Name is required');
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 10) return toast.error('Enter a 10-digit mobile number');
    setBusy(true);
    try {
      const { customer } = await api.post<{ customer: { _id: string; name: string } }>(
        '/api/admin/customers',
        {
          name: name.trim(),
          // Walk-ins rarely give an email — a unique placeholder keeps account creation unblocked.
          email: `${digits}.${Date.now()}@walkin.vchuki.local`,
          phone: phone.trim(),
          fatherName: relationName.trim() ? `${relation} ${relationName.trim()}` : '',
          addressLine1: address.trim(),
          addressCity: '',
          addressState: '',
          addressPostalCode: '',
        }
      );
      toast.success('Customer created');
      invalidate('/api/admin/customers');
      onCreated({ _id: customer._id, name: customer.name, phone: phone.trim(), address: address.trim() });
      reset();
      onClose();
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
      title="New customer"
      footer={<Button title="Create customer" onPress={save} loading={busy} />}
    >
      <Input label="Name" value={name} onChangeText={setName} required autoCapitalize="words" />
      <Input
        label="Mobile"
        value={phone}
        onChangeText={setPhone}
        required
        keyboardType="phone-pad"
        prefix="+91"
      />
      <T variant="caption" style={{ marginBottom: space.xs }}>
        Relation
      </T>
      <View style={{ marginBottom: space.md }}>
        <Segmented
          options={RELATIONS.map((r) => ({ value: r, label: r }))}
          value={relation}
          onChange={setRelation}
        />
      </View>
      <Input
        label={`${relation === 'W/O' ? 'Husband' : 'Father'}'s name`}
        value={relationName}
        onChangeText={setRelationName}
        autoCapitalize="words"
      />
      <Input label="Address" value={address} onChangeText={setAddress} />
      <T variant="caption">No email needed — you can add one later from the customer's profile.</T>
    </Sheet>
  );
}
