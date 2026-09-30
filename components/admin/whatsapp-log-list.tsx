"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDateTime } from "@/lib/utils";

interface NotificationLogRow {
  _id: string;
  recipientPhone?: string;
  recipientName: string;
  templateName: string;
  triggerEvent: string;
  message: string;
  status: "sent" | "delivered" | "read" | "failed";
  errorMessage?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

const STATUS_BADGE: Record<NotificationLogRow["status"], { label: string; className: string }> = {
  sent: { label: "Sent", className: "bg-secondary text-foreground" },
  delivered: { label: "Delivered", className: "bg-sky-100 text-sky-800" },
  read: { label: "Read", className: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
};

function StatusBadge({ log }: { log: NotificationLogRow }) {
  const badge = STATUS_BADGE[log.status] ?? STATUS_BADGE.sent;
  const at = log.status === "read" ? log.readAt : log.status === "delivered" ? log.deliveredAt : undefined;
  return (
    <Badge
      className={cn("rounded-full border-none font-medium", badge.className)}
      title={at ? formatDateTime(at) : undefined}
    >
      {badge.label}
    </Badge>
  );
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

async function fetchLogs(params: {
  page: number;
  status: string;
  search: string;
}): Promise<{ logs: NotificationLogRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({ page: String(params.page) });
  if (params.status !== "all") searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);

  const res = await fetch(`/api/admin/whatsapp/logs?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

export function WhatsAppLogList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["admin", "whatsapp", "logs", { page, status, search }],
    queryFn: () => fetchLogs({ page, status, search }),
  });

  const logs = data?.logs ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search recipient or template..."
            className="w-64 pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue>
              {(value: string) =>
                value === "all"
                  ? "All Statuses"
                  : (STATUS_BADGE[value as NotificationLogRow["status"]]?.label ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="sent">Sent (not yet delivered)</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 lg:hidden">
        {logs.map((log) => (
          <div key={log._id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{log.recipientName}</p>
                <p className="text-xs text-muted-foreground">{log.recipientPhone ?? "—"}</p>
              </div>
              <StatusBadge log={log} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{log.templateName}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{log.message}</p>
            {log.status === "failed" && log.errorMessage && (
              <p className="mt-1 text-xs text-destructive">{log.errorMessage}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">No WhatsApp messages sent yet.</p>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
        <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-b border-border last:border-0 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{log.recipientName}</p>
                  <p className="text-xs text-muted-foreground">{log.recipientPhone ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{log.templateName}</td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="line-clamp-2 text-muted-foreground">{log.message}</p>
                  {log.status === "failed" && log.errorMessage && (
                    <p className="mt-1 text-xs text-destructive">{log.errorMessage}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge log={log} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No WhatsApp messages sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <AdminPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          itemLabel="messages"
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
