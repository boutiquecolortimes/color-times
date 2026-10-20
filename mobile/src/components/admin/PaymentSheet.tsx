import React, { useEffect, useState } from 'react';
import { Button, Input, MoneyInput, SelectField, Sheet, T, ToggleRow } from '../ui';
import { PAYMENT_METHODS } from '../../lib/labels';
import { inr, num } from '../../lib/format';
import { space } from '../../theme';

export interface PaymentInput {
  amount: number;
  method: string;
  reference?: string;
  note?: string;
  markDelivered?: boolean;
}

/** Record a payment against an invoice / sale / customisation order. */
export function PaymentSheet({
  visible,
  onClose,
  due,
  onSubmit,
  loading,
  title = 'Record payment',
  allowMarkDelivered,
}: {
  visible: boolean;
  onClose: () => void;
  due: number;
  onSubmit: (input: PaymentInput) => void;
  loading?: boolean;
  title?: string;
  allowMarkDelivered?: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [markDelivered, setMarkDelivered] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount(due > 0 ? String(Math.round(due)) : '');
      setReference('');
      setNote('');
      setMarkDelivered(false);
    }
  }, [visible, due]);

  const value = num(amount) ?? 0;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={`Outstanding ${inr(due)}`}
      footer={
        <Button
          title={value > 0 ? `Record ${inr(value)}` : markDelivered ? 'Mark delivered' : 'Record payment'}
          loading={loading}
          disabled={value <= 0 && !markDelivered}
          onPress={() =>
            onSubmit({
              amount: value,
              method,
              reference: reference || undefined,
              note: note || undefined,
              ...(allowMarkDelivered ? { markDelivered } : {}),
            })
          }
        />
      }
    >
      <MoneyInput label="Amount received" value={amount} onChangeText={setAmount} required />
      <SelectField
        label="Method"
        value={method}
        onChange={setMethod}
        options={PAYMENT_METHODS.map((m) => ({ ...m }))}
      />
      <Input label="Reference" hint="UPI ref / txn id" value={reference} onChangeText={setReference} />
      <Input label="Note" value={note} onChangeText={setNote} />
      {allowMarkDelivered ? (
        <ToggleRow
          label="Mark as delivered"
          description="Close the order with this payment."
          value={markDelivered}
          onChange={setMarkDelivered}
        />
      ) : null}
      {value > due && due > 0 ? (
        <T variant="small" style={{ marginTop: space.sm }}>
          That’s more than what’s due — double-check the amount.
        </T>
      ) : null}
    </Sheet>
  );
}
