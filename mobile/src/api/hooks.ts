import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { api } from './client';
import type { Pagination } from './types';
import { toast } from '../components/ui/Toast';
import { haptic } from '../lib/haptics';

export function useApi<T>(
  path: string | null,
  query?: Record<string, unknown>,
  opts?: {
    enabled?: boolean;
    /** Live refresh while on screen (ms), like the web's polling. */ refetchInterval?: number;
  }
) {
  return useQuery<T>({
    queryKey: [path, query ?? {}],
    queryFn: () => api.get<T>(path as string, query),
    enabled: Boolean(path) && opts?.enabled !== false,
    refetchInterval: opts?.refetchInterval,
  });
}

/**
 * Infinite list over the web API's page/pageSize convention. `listKey` is the
 * array key in the response (e.g. "bookings", "invoices"). Extra top-level
 * fields (summary, statusCounts, typeCounts…) come back as `meta`.
 */
export function useList<T>(path: string, listKey: string, query?: Record<string, unknown>, pageSize = 20) {
  const result = useInfiniteQuery({
    queryKey: [path, 'list', query ?? {}],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<Record<string, unknown> & { pagination?: Pagination }>(path, {
        ...query,
        page: pageParam,
        pageSize,
      }),
    getNextPageParam: (last) =>
      last.pagination && last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
  });
  const pages = result.data?.pages ?? [];
  const items = pages.flatMap((page) => (page[listKey] as T[] | undefined) ?? []);
  const meta = pages[0] ?? null;
  return { ...result, items, meta, total: meta?.pagination?.total ?? items.length };
}

/** Mutation that toasts, buzzes and invalidates related lists. */
export function useAction<TInput = void, TOutput = unknown>(
  fn: (input: TInput) => Promise<TOutput>,
  opts: { success?: string; invalidate?: QueryKey[]; onSuccess?: (data: TOutput) => void } = {}
) {
  const client = useQueryClient();
  return useMutation<TOutput, Error, TInput>({
    mutationFn: fn,
    onSuccess: (data) => {
      if (opts.success) toast.success(opts.success);
      else haptic('success');
      (opts.invalidate ?? []).forEach((key) => client.invalidateQueries({ queryKey: key }));
      opts.onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

/** Invalidate every query whose key starts with one of these API paths. */
export function useInvalidate() {
  const client = useQueryClient();
  return (...paths: string[]) =>
    client.invalidateQueries({
      predicate: (query) => {
        const first = query.queryKey[0];
        return typeof first === 'string' && paths.some((p) => first.startsWith(p));
      },
    });
}
