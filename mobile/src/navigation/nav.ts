import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * Route names are plain strings shared by the admin and customer stacks.
 * Params are loosely typed (each screen reads what it needs) to keep the
 * ~50 screens manageable without a giant param-list type.
 */
export type AnyParams = Record<string, Record<string, unknown> | undefined>;

export function useNav() {
  return useNavigation<NativeStackNavigationProp<AnyParams>>();
}

export function useParams<T extends Record<string, unknown>>(): Partial<T> {
  return (useRoute().params ?? {}) as Partial<T>;
}

/** Maps a web admin link (from notifications / push data) to an app route. */
export function routeForLink(
  link?: string | null
): { name: string; params?: Record<string, unknown> } | null {
  if (!link) return null;
  const m = link.match(/^\/admin\/([a-z-]+)(?:\/([a-f0-9]{24}))?/);
  if (!m) return null;
  const [, section, id] = m;
  const detail: Record<string, string> = {
    bookings: 'BookingDetail',
    invoices: 'InvoiceDetail',
    sales: 'SaleDetail',
    customisation: 'CustomisationDetail',
    customers: 'CustomerDetail',
    products: 'ProductDetail',
    services: 'ServiceDetail',
  };
  const list: Record<string, string> = {
    bookings: 'Bookings',
    invoices: 'Invoices',
    sales: 'Sales',
    customisation: 'Customisation',
    customers: 'Enquiries',
    products: 'Products',
    services: 'Services',
    reviews: 'Reviews',
    whatsapp: 'WhatsApp',
  };
  if (id && detail[section]) return { name: detail[section], params: { id } };
  if (list[section]) return { name: list[section] };
  return null;
}
