import { Linking, Share } from 'react-native';
import { api } from '../api/client';
import { toast } from '../components/ui/Toast';

/** The web app's bill PDFs are public-by-id links, so the phone can open or share them directly. */
export function pdfUrl(kind: 'invoices' | 'sales' | 'customisation-orders', id: string): string {
  return api.url(`/api/${kind}/${id}/pdf`);
}

/** Downloads a bill PDF and opens it in the system viewer, where Print lives. */
export async function printPdf(url: string, name: string): Promise<void> {
  try {
    const { printRemotePdf } = require('./files') as typeof import('./files');
    await printRemotePdf(url, name);
  } catch {
    toast.error('Could not open the PDF for printing');
  }
}

export async function openUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    toast.error('Could not open link');
  }
}

export async function shareLink(message: string, url?: string): Promise<void> {
  try {
    await Share.share(url ? { message: `${message}\n${url}`, url } : { message });
  } catch {
    // dismissed
  }
}

export function call(phone?: string | null) {
  if (phone) openUrl(`tel:${phone.replace(/[^\d+]/g, '')}`);
}

export function whatsapp(phone?: string | null, text = '') {
  if (!phone) return;
  const digits = phone.replace(/\D/g, '');
  const intl = digits.length === 10 ? `91${digits}` : digits;
  openUrl(`https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`);
}
