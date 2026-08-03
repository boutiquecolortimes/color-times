"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, FileDown, FileSpreadsheet, Grid3x3, List, Loader2, Printer, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard, type StatTint } from "@/components/admin/stat-card";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { BookingStatusBadge } from "@/components/admin/booking-status-badge";
import { InvoiceStatusBadge } from "@/components/admin/invoice-status-badge";
import { ServiceOrderStatusBadge } from "@/components/admin/service-order-status-badge";
import { CustomisationStatusBadge } from "@/components/admin/customisation-status-badge";
import { downloadPdf, downloadExcel } from "@/lib/admin/export";
import { DATE_RANGE_PRESETS, DATE_RANGE_LABELS, type DateRangePreset } from "@/lib/admin/date-ranges";
import { formatDate } from "@/lib/utils";
import type { BookingStatus } from "@/models/Booking";
import type { InvoiceStatus } from "@/models/Invoice";
import type { ServiceOrderStatus } from "@/models/ServiceOrder";
import type { CustomisationOrderStatus } from "@/models/CustomisationOrder";

const PAGE_SIZE = 5;

type ReportType =
  | "products"
  | "bookings"
  | "invoices"
  | "customers"
  | "services"
  | "customisation"
  | "sale"
  | "pending-returns";
type Row = Record<string, string | number | boolean>;

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "products", label: "Products" },
  { value: "bookings", label: "Bookings" },
  { value: "invoices", label: "Invoices" },
  { value: "customers", label: "Customers" },
  { value: "services", label: "Dry Clean & Tailor" },
  { value: "customisation", label: "Customisation" },
  { value: "sale", label: "Sale" },
  { value: "pending-returns", label: "Pending Returns" },
];

const STATUS_OPTIONS: Record<ReportType, { value: string; label: string }[]> = {
  products: [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
    { value: "trash", label: "Trash" },
  ],
  bookings: [
    { value: "all", label: "All" },
    { value: "inquiry", label: "Inquiry" },
    { value: "pending_payment", label: "Pending Payment" },
    { value: "confirmed", label: "Confirmed" },
    { value: "in_use", label: "In Use" },
    { value: "returned", label: "Returned" },
    { value: "cancelled", label: "Cancelled" },
  ],
  invoices: [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "partially_paid", label: "Partially Paid" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
    { value: "cancelled", label: "Cancelled" },
  ],
  customers: [],
  services: [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In Progress" },
    { value: "quality_check", label: "Quality Check" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ],
  customisation: [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In Progress" },
    { value: "ready", label: "Ready" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
  ],
  sale: [],
  "pending-returns": [],
};

const SERVICE_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "dry_clean", label: "Dry Clean" },
  { value: "tailor", label: "Tailor / Alteration" },
];

interface ColumnConfig {
  key: string;
  label: string;
  format?: (row: Row) => string;
  render?: (row: Row) => React.ReactNode;
  /** Included as a summed grand-total in the exported file's totals row. */
  isTotal?: boolean;
}

function DueBadge({ isOverdue, daysOverdue }: { isOverdue: boolean; daysOverdue: number }) {
  if (isOverdue) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        Overdue {daysOverdue}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
      On track
    </span>
  );
}

function RemindButton({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/bookings/${bookingId}/remind`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Return reminder sent");
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={(event) => {
        event.stopPropagation();
        mutation.mutate();
      }}
    >
      {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
      Remind
    </Button>
  );
}

const CURRENCY = (value: unknown) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const DATE = (value: unknown) => formatDate(String(value));

const TABLE_CONFIGS: Record<ReportType, ColumnConfig[]> = {
  products: [
    { key: "name", label: "Product" },
    { key: "sku", label: "Code" },
    { key: "category", label: "Category" },
    { key: "rentalPricePerDay", label: "Rent", format: (r) => CURRENCY(r.rentalPricePerDay) },
    { key: "retailValue", label: "Retail Value", format: (r) => CURRENCY(r.retailValue) },
    { key: "totalStock", label: "Stock", isTotal: true },
    { key: "isActive", label: "Status", format: (r) => (r.isActive ? "Active" : "Inactive") },
    { key: "createdAt", label: "Added", format: (r) => DATE(r.createdAt) },
  ],
  bookings: [
    { key: "bookingNumber", label: "Booking #" },
    { key: "customer", label: "Customer" },
    { key: "product", label: "Product" },
    {
      key: "status",
      label: "Status",
      format: (r) => STATUS_OPTIONS.bookings.find((o) => o.value === r.status)?.label ?? String(r.status),
      render: (r) => <BookingStatusBadge status={r.status as BookingStatus} />,
    },
    { key: "totalAmount", label: "Total", format: (r) => CURRENCY(r.totalAmount), isTotal: true },
    { key: "rentalStartDate", label: "Start", format: (r) => DATE(r.rentalStartDate) },
    { key: "rentalEndDate", label: "End", format: (r) => DATE(r.rentalEndDate) },
    { key: "createdAt", label: "Created", format: (r) => DATE(r.createdAt) },
  ],
  invoices: [
    { key: "invoiceNumber", label: "Invoice #" },
    { key: "customer", label: "Customer" },
    {
      key: "status",
      label: "Status",
      format: (r) => STATUS_OPTIONS.invoices.find((o) => o.value === r.status)?.label ?? String(r.status),
      render: (r) => <InvoiceStatusBadge status={r.status as InvoiceStatus} />,
    },
    { key: "total", label: "Total", format: (r) => CURRENCY(r.total), isTotal: true },
    { key: "amountPaid", label: "Paid", format: (r) => CURRENCY(r.amountPaid), isTotal: true },
    { key: "amountDue", label: "Due", format: (r) => CURRENCY(r.amountDue), isTotal: true },
    { key: "dueDate", label: "Due Date", format: (r) => DATE(r.dueDate) },
    { key: "createdAt", label: "Created", format: (r) => DATE(r.createdAt) },
  ],
  customers: [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Mobile" },
    { key: "fatherName", label: "Father's Name" },
    { key: "createdAt", label: "Joined", format: (r) => DATE(r.createdAt) },
  ],
  services: [
    { key: "product", label: "Product" },
    {
      key: "serviceType",
      label: "Type",
      format: (r) => (r.serviceType === "dry_clean" ? "Dry Clean" : "Tailor / Alteration"),
    },
    { key: "description", label: "Description" },
    { key: "stitchingType", label: "Stitching Type" },
    { key: "dryCleanCharge", label: "Dry Clean", format: (r) => CURRENCY(r.dryCleanCharge), isTotal: true },
    { key: "ironCharge", label: "Iron", format: (r) => CURRENCY(r.ironCharge), isTotal: true },
    {
      key: "stitchingCharge",
      label: "Stitching",
      format: (r) => CURRENCY(r.stitchingCharge),
      isTotal: true,
    },
    { key: "otherCharge", label: "Other", format: (r) => CURRENCY(r.otherCharge), isTotal: true },
    { key: "totalAmount", label: "Total", format: (r) => CURRENCY(r.totalAmount), isTotal: true },
    {
      key: "status",
      label: "Status",
      format: (r) => STATUS_OPTIONS.services.find((o) => o.value === r.status)?.label ?? String(r.status),
      render: (r) => <ServiceOrderStatusBadge status={r.status as ServiceOrderStatus} />,
    },
    { key: "assignedTo", label: "Assigned To" },
    { key: "expectedReturnDate", label: "Expected Return", format: (r) => DATE(r.expectedReturnDate) },
  ],
  customisation: [
    { key: "billNumber", label: "Bill #" },
    { key: "customerName", label: "Customer" },
    { key: "customerPhone", label: "Mobile" },
    { key: "stitchingType", label: "Stitching Type" },
    { key: "totalAmount", label: "Total", format: (r) => CURRENCY(r.totalAmount), isTotal: true },
    { key: "advancePayment", label: "Advance", format: (r) => CURRENCY(r.advancePayment), isTotal: true },
    { key: "dueAmount", label: "Due", format: (r) => CURRENCY(r.dueAmount), isTotal: true },
    {
      key: "status",
      label: "Status",
      format: (r) =>
        STATUS_OPTIONS.customisation.find((o) => o.value === r.status)?.label ?? String(r.status),
      render: (r) => <CustomisationStatusBadge status={r.status as CustomisationOrderStatus} />,
    },
    { key: "orderDate", label: "Order Date", format: (r) => DATE(r.orderDate) },
  ],
  sale: [
    { key: "billNumber", label: "Bill #" },
    { key: "customerName", label: "Customer" },
    { key: "customerPhone", label: "Mobile" },
    { key: "product", label: "Product" },
    { key: "totalAmount", label: "Total", format: (r) => CURRENCY(r.totalAmount), isTotal: true },
    { key: "saleDate", label: "Sale Date", format: (r) => DATE(r.saleDate) },
  ],
  "pending-returns": [
    { key: "bookingNumber", label: "Booking #" },
    { key: "customer", label: "Customer" },
    { key: "customerPhone", label: "Mobile", format: (r) => String(r.customerPhone ?? "—") },
    { key: "product", label: "Product" },
    { key: "rentalEndDate", label: "Return Due", format: (r) => DATE(r.rentalEndDate) },
    {
      key: "isOverdue",
      label: "Status",
      format: (r) => (r.isOverdue ? `Overdue ${r.daysOverdue}d` : "On track"),
      render: (r) => <DueBadge isOverdue={Boolean(r.isOverdue)} daysOverdue={Number(r.daysOverdue ?? 0)} />,
    },
    {
      key: "securityDeposit",
      label: "Deposit Held",
      format: (r) => CURRENCY(r.securityDeposit),
      isTotal: true,
    },
    {
      key: "_id",
      label: "Action",
      format: () => "",
      render: (r) => <RemindButton bookingId={String(r._id)} />,
    },
  ],
};

interface SummaryCardConfig {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

const SUMMARY_TINTS: StatTint[] = ["gold", "teal", "wine", "rose"];

const SUMMARY_CONFIGS: Record<ReportType, SummaryCardConfig[]> = {
  products: [
    { key: "totalProducts", label: "Total Products" },
    { key: "activeCount", label: "Active Products" },
    { key: "totalStockUnits", label: "Total Stock Units" },
    { key: "totalStockValue", label: "Total Stock Value", format: CURRENCY },
  ],
  bookings: [
    { key: "totalBookings", label: "Total Bookings" },
    { key: "totalRevenue", label: "Total Revenue", format: CURRENCY },
    { key: "avgBookingValue", label: "Avg. Booking Value", format: CURRENCY },
    { key: "activeCount", label: "Currently In Use" },
  ],
  invoices: [
    { key: "totalInvoices", label: "Total Invoices" },
    { key: "totalInvoiced", label: "Total Invoiced", format: CURRENCY },
    { key: "totalCollected", label: "Total Collected", format: CURRENCY },
    { key: "totalOutstanding", label: "Outstanding", format: CURRENCY },
  ],
  customers: [
    { key: "newCustomers", label: "New Customers (in range)" },
    { key: "totalCustomersOverall", label: "Total Customers (all-time)" },
  ],
  services: [
    { key: "totalOrders", label: "Total Orders" },
    { key: "totalCost", label: "Total Cost", format: CURRENCY },
    { key: "completedCount", label: "Completed" },
    { key: "pendingCount", label: "Pending / In Progress" },
  ],
  customisation: [
    { key: "totalOrders", label: "Total Orders" },
    { key: "totalRevenue", label: "Total Revenue", format: CURRENCY },
    { key: "totalAdvanceCollected", label: "Advance Collected", format: CURRENCY },
    { key: "totalDue", label: "Total Due", format: CURRENCY },
  ],
  sale: [
    { key: "totalSales", label: "Total Sales" },
    { key: "totalRevenue", label: "Total Revenue", format: CURRENCY },
  ],
  "pending-returns": [
    { key: "totalPending", label: "Total Pending" },
    { key: "overdueCount", label: "Overdue" },
  ],
};

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ReportData {
  summary: Record<string, number>;
  items: Row[];
  pagination: Pagination;
  range: { from: string | null; to: string | null; label: string };
}

async function fetchReport(params: {
  type: ReportType;
  range: DateRangePreset;
  from: string;
  to: string;
  status: string;
  serviceType: string;
  page?: number;
  all?: boolean;
}): Promise<ReportData> {
  const searchParams = new URLSearchParams({ type: params.type, range: params.range });
  if (params.range === "custom") {
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
  }
  if (params.status !== "all") searchParams.set("status", params.status);
  if (params.serviceType !== "all") searchParams.set("serviceType", params.serviceType);
  if (params.all) {
    searchParams.set("all", "true");
  } else {
    searchParams.set("page", String(params.page ?? 1));
    searchParams.set("pageSize", String(PAGE_SIZE));
  }

  const res = await fetch(`/api/admin/reports?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

export function ReportsClient() {
  const [reportType, setReportType] = useState<ReportType>("bookings");
  const [range, setRange] = useState<DateRangePreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [status, setStatus] = useState("all");
  const [serviceType, setServiceType] = useState("all");
  const [page, setPage] = useState(1);
  const [layout, setLayout] = useState<"table" | "card">("table");
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reports", { reportType, range, customFrom, customTo, status, serviceType, page }],
    queryFn: () =>
      fetchReport({
        type: reportType,
        range,
        from: customFrom,
        to: customTo,
        status,
        serviceType,
        page,
      }),
  });

  const columns = TABLE_CONFIGS[reportType];
  const summaryConfig = SUMMARY_CONFIGS[reportType];
  const statusOptions = STATUS_OPTIONS[reportType];
  const pagination = data?.pagination;

  async function exportRows(): Promise<{
    headers: string[];
    rows: (string | number)[][];
    totals?: (string | number)[];
  }> {
    const full = await fetchReport({
      type: reportType,
      range,
      from: customFrom,
      to: customTo,
      status,
      serviceType,
      all: true,
    });
    const headers = columns.map((c) => c.label);
    const rows = full.items.map((row) =>
      columns.map((c) => (c.format ? c.format(row) : (row[c.key] as string | number)))
    );

    const hasTotals = columns.some((c) => c.isTotal);
    const totals = hasTotals
      ? columns.map((c, index) => {
          if (index === 0) return "TOTAL";
          if (!c.isTotal) return "";
          const sum = full.items.reduce((acc, row) => acc + (Number(row[c.key]) || 0), 0);
          return c.format ? c.format({ [c.key]: sum } as Row) : sum;
        })
      : undefined;

    return { headers, rows, totals };
  }

  async function withExportGuard(action: () => Promise<void>): Promise<void> {
    setIsExporting(true);
    try {
      await action();
    } finally {
      setIsExporting(false);
    }
  }

  const cardGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {isLoading && <p className="col-span-full py-10 text-center text-muted-foreground">Loading...</p>}
      {!isLoading &&
        (data?.items ?? []).map((row, index) => {
          const [titleColumn, ...restColumns] = columns;
          return (
            <div key={index} className="rounded-lg border border-border bg-card p-4">
              <p className="font-medium">
                {titleColumn.render
                  ? titleColumn.render(row)
                  : titleColumn.format
                    ? titleColumn.format(row)
                    : String(row[titleColumn.key] ?? "—")}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {restColumns.map((column) => (
                  <div key={column.key}>
                    <p className="text-xs text-muted-foreground">{column.label}</p>
                    <p>
                      {column.render
                        ? column.render(row)
                        : column.format
                          ? column.format(row)
                          : String(row[column.key] ?? "—")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      {!isLoading && data?.items.length === 0 && (
        <p className="col-span-full py-10 text-center text-muted-foreground">No records found.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Filter, review, and export data across every module.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={reportType}
          onValueChange={(value) => {
            setReportType((value as ReportType) ?? "bookings");
            setStatus("all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue>
              {(value: ReportType) =>
                REPORT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {REPORT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {reportType !== "pending-returns" && (
          <Select
            value={range}
            onValueChange={(value) => {
              setRange((value as DateRangePreset) ?? "month");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue>
                {(value: DateRangePreset) => DATE_RANGE_LABELS[value] ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {DATE_RANGE_LABELS[preset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {reportType !== "pending-returns" && range === "custom" && (
          <>
            <DatePicker
              value={customFrom}
              onChange={(value) => {
                setCustomFrom(value);
                setPage(1);
              }}
              placeholder="From"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <DatePicker
              value={customTo}
              onChange={(value) => {
                setCustomTo(value);
                setPage(1);
              }}
              placeholder="To"
            />
          </>
        )}

        {statusOptions.length > 0 && (
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue>
                {(value: string) => statusOptions.find((o) => o.value === value)?.label ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {reportType === "services" && (
          <Select
            value={serviceType}
            onValueChange={(value) => {
              setServiceType(value ?? "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue>
                {(value: string) =>
                  SERVICE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="hidden items-center gap-1 rounded-md border border-border p-1 lg:flex">
          <Button
            variant={layout === "table" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setLayout("table")}
            aria-label="Table view"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={layout === "card" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setLayout("card")}
            aria-label="Card view"
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={() =>
              withExportGuard(async () => {
                const { headers, rows, totals } = await exportRows();
                await downloadExcel(
                  `${reportType}-report`,
                  `${REPORT_TYPE_OPTIONS.find((o) => o.value === reportType)?.label} Report`,
                  headers,
                  rows,
                  totals
                );
              })
            }
          >
            <Table2 className="h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={() =>
              withExportGuard(async () => {
                const { headers, rows, totals } = await exportRows();
                const rangeSuffix =
                  reportType !== "pending-returns" && data?.range.label ? ` — ${data.range.label}` : "";
                await downloadPdf(
                  `${reportType}-report`,
                  `${REPORT_TYPE_OPTIONS.find((o) => o.value === reportType)?.label} Report${rangeSuffix}`,
                  headers,
                  rows,
                  totals
                );
              })
            }
          >
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {data && (
        <p className="text-sm text-muted-foreground">
          {reportType !== "pending-returns" && (
            <>
              Showing <span className="font-medium text-foreground">{data.range.label}</span> &middot;{" "}
            </>
          )}
          {data.pagination.total} records
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryConfig.map((card, index) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={
              card.format
                ? card.format(data?.summary[card.key] ?? 0)
                : (data?.summary[card.key] ?? 0).toLocaleString("en-IN")
            }
            icon={FileSpreadsheet}
            tint={SUMMARY_TINTS[index % SUMMARY_TINTS.length]}
          />
        ))}
      </div>

      <div className="lg:hidden">{cardGrid}</div>

      {layout === "card" ? (
        <div className="hidden lg:block">{cardGrid}</div>
      ) : (
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
        <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading &&
              (data?.items ?? []).map((row, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      {column.render
                        ? column.render(row)
                        : column.format
                          ? column.format(row)
                          : String(row[column.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  No records found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {pagination && (
        <AdminPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          itemLabel="records"
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
