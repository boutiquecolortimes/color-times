import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { api } from '../api/client';

const OPTIONS = {
  mediaType: 'photo' as const,
  maxWidth: 2000,
  maxHeight: 2400,
  quality: 0.8 as const,
  selectionLimit: 6,
};

async function uploadAsset(asset: Asset): Promise<string> {
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.fileName ?? `photo-${Date.now()}.jpg`,
    type: asset.type ?? 'image/jpeg',
  } as unknown as Blob);
  const { url } = await api.upload<{ url: string }>('/api/admin/upload', form);
  return url;
}

/** Pick (or shoot) photos and upload them to Vercel Blob through the web API. Returns hosted URLs. */
export async function pickAndUpload(source: 'library' | 'camera'): Promise<string[]> {
  const result =
    source === 'camera'
      ? await launchCamera({ ...OPTIONS, saveToPhotos: false })
      : await launchImageLibrary(OPTIONS);
  if (result.didCancel || !result.assets?.length) return [];
  if (result.errorMessage) throw new Error(result.errorMessage);
  const urls: string[] = [];
  for (const asset of result.assets) {
    if (asset.uri) urls.push(await uploadAsset(asset));
  }
  return urls;
}
