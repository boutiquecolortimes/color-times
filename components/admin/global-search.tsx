"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { InvoiceStatusBadge } from "@/components/admin/invoice-status-badge";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import type { BookingStatus } from "@/models/Booking";
import type { InvoiceStatus } from "@/models/Invoice";

interface SearchResults {
  products: { _id: string; name: string; sku: string; image: string | null }[];
  customers: { _id: string; name: string; email: string; phone: string | null }[];
  bookings: { _id: string; bookingNumber: string; status: BookingStatus; customerName: string | null }[];
  invoices: { _id: string; invoiceNumber: string; status: InvoiceStatus; customerName: string | null }[];
}

const EMPTY_RESULTS: SearchResults = { products: [], customers: [], bookings: [], invoices: [] };
const RECENT_SEARCHES_KEY = "ct-admin-recent-searches";
const MAX_RECENT = 8;

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function persistRecentSearches(list: string[]): void {
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // Private browsing / storage disabled — recent search history is a
    // nice-to-have, fail silently rather than breaking search itself.
  }
}

async function fetchSearch(q: string): Promise<SearchResults> {
  const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

export function GlobalSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  // Lazy-initialized from localStorage on first render — reading it in a
  // useEffect + setState after mount would trip the same
  // react-hooks/set-state-in-effect rule this codebase avoids elsewhere
  // (see sidebar/theme cookie handling), and it's harmless here since the
  // dropdown that renders `recent` starts closed either way.
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const { data = EMPTY_RESULTS, isFetching } = useQuery({
    queryKey: ["admin", "search", debounced],
    queryFn: () => fetchSearch(debounced),
    enabled: debounced.length >= 2,
  });

  const hasQuery = debounced.length >= 2;
  const hasResults =
    data.products.length + data.customers.length + data.bookings.length + data.invoices.length > 0;

  function rememberSearch(term: string) {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
        0,
        MAX_RECENT
      );
      persistRecentSearches(next);
      return next;
    });
  }

  function clearRecent() {
    setRecent([]);
    persistRecentSearches([]);
  }

  function go(href: string) {
    rememberSearch(query);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(href);
  }

  function runRecent(term: string) {
    setQuery(term);
    setDebounced(term);
    inputRef.current?.focus();
  }

  return (
    <div
      ref={containerRef}
      className="relative w-9 shrink-0 transition-[width] duration-200 ease-out focus-within:w-64 sm:w-52 sm:focus-within:w-80"
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search..."
        aria-label="Search"
        className="h-9 rounded-full border-border bg-secondary/60 pl-9 pr-8 focus-visible:ring-2"
      />
      {isFetching && (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-lg sm:left-0 sm:right-auto sm:w-96">
          {!hasQuery && (
            <div className="mb-1">
              <div className="flex items-center justify-between px-3 py-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent searches
                </p>
                {recent.length > 0 && (
                  <button
                    type="button"
                    onClick={clearRecent}
                    className="text-[10px] text-muted-foreground hover:text-accent"
                  >
                    Clear
                  </button>
                )}
              </div>
              {recent.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Search bill no., dress code, dress name, customer, mobile...
                </p>
              ) : (
                recent.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => runRecent(term)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{term}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {hasQuery && !isFetching && !hasResults && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches found.</p>
          )}

          {hasQuery && data.bookings.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Bookings
              </p>
              {data.bookings.map((booking) => (
                <button
                  key={booking._id}
                  type="button"
                  onClick={() => go(`/admin/bookings/${booking._id}`)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span className="truncate">
                    {booking.bookingNumber}
                    {booking.customerName && (
                      <span className="text-muted-foreground"> — {booking.customerName}</span>
                    )}
                  </span>
                  <BookingStatusBadge status={booking.status} />
                </button>
              ))}
            </div>
          )}

          {hasQuery && data.invoices.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Invoices
              </p>
              {data.invoices.map((invoice) => (
                <button
                  key={invoice._id}
                  type="button"
                  onClick={() => go(`/admin/invoices/${invoice._id}`)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span className="truncate">
                    {invoice.invoiceNumber}
                    {invoice.customerName && (
                      <span className="text-muted-foreground"> — {invoice.customerName}</span>
                    )}
                  </span>
                  <InvoiceStatusBadge status={invoice.status} />
                </button>
              ))}
            </div>
          )}

          {hasQuery && data.products.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dresses
              </p>
              {data.products.map((product) => (
                <button
                  key={product._id}
                  type="button"
                  onClick={() => go(`/admin/products/${product._id}`)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span className="truncate">{product.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{product.sku}</span>
                </button>
              ))}
            </div>
          )}

          {hasQuery && data.customers.length > 0 && (
            <div className="mb-1">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Customers
              </p>
              {data.customers.map((customer) => (
                <button
                  key={customer._id}
                  type="button"
                  onClick={() => go(`/admin/customers/${customer._id}`)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span className="truncate">{customer.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {customer.phone ?? customer.email}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
