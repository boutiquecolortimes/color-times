"use client";

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { AuditAction, AuditFieldChange } from "@/models/AuditLog";

interface AuditLogEntry {
  _id: string;
  action: AuditAction;
  actorName: string;
  actorEmail: string;
  changes: AuditFieldChange[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const ACTION_LABELS: Record<AuditAction, string> = {
  create: "Created",
  update: "Updated",
  archive: "Archived",
  restore: "Restored",
  delete: "Moved to Trash",
  status_change: "Status Changed",
  bulk_update: "Bulk Updated",
  bulk_delete: "Bulk Deleted",
  import: "Imported",
};

async function fetchAuditLog(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
  const res = await fetch(
    `/api/admin/audit-log?entityType=${entityType}&entityId=${entityId}`
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data.entries;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AuditLogList({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["admin", "audit-log", entityType, entityId],
    queryFn: () => fetchAuditLog(entityType, entityId),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading history...</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
        <History className="h-6 w-6" />
        <p className="text-sm">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div key={entry._id} className="border-l-2 border-accent/40 pl-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {entry.metadata?.undoReturn ? "Return Undone" : ACTION_LABELS[entry.action]}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(entry.createdAt)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {entry.actorName} ({entry.actorEmail})
          </p>
          {typeof entry.metadata?.reason === "string" && entry.metadata.reason && (
            <p className="mt-1 text-xs">
              <span className="font-medium">Reason:</span> {entry.metadata.reason}
            </p>
          )}
          {entry.changes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {entry.changes.map((change) => (
                <li key={change.field}>
                  <span className="font-medium">{change.field}:</span>{" "}
                  <span className="text-muted-foreground line-through">
                    {formatValue(change.from)}
                  </span>{" "}
                  &rarr; <span>{formatValue(change.to)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
