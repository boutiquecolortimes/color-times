import React, { useState } from 'react';
import { Button, Img, Input, Sheet, T, toast } from '../ui';
import { space } from '../../theme';

/** Web's "…or paste an image path/URL": add a photo that's already hosted somewhere. */
export function ImageLinkSheet({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (url: string) => void;
}) {
  const [url, setUrl] = useState('');
  const valid = /^(https?:\/\/|\/)\S+$/i.test(url.trim());
  const add = () => {
    if (!valid) return toast.error('Paste a full image link (https://…) or a site path (/images/…)');
    onAdd(url.trim());
    setUrl('');
    onClose();
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Add photo from link"
      footer={<Button title="Add photo" onPress={add} disabled={!url.trim()} />}
    >
      <Input
        label="Image link"
        value={url}
        onChangeText={setUrl}
        placeholder="https://… or /images/…"
        autoCapitalize="none"
        keyboardType="url"
      />
      {valid ? (
        <Img src={url.trim()} style={{ width: '100%', height: 220, marginBottom: space.md }} />
      ) : (
        <T variant="small">The photo is used as-is — it isn't copied to your storage.</T>
      )}
    </Sheet>
  );
}
