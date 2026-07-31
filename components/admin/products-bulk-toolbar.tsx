"use client";

import { Archive, CheckCircle2, RotateCcw, Trash2, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductsBulkToolbarProps {
  count: number;
  status: string;
  onAction: (action: "archive" | "restore" | "delete" | "permanent-delete" | "activate" | "deactivate") => void;
  onClear: () => void;
}

export function ProductsBulkToolbar({ count, status, onAction, onClear }: ProductsBulkToolbarProps) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {status === "trash" ? (
          <>
            <Button size="sm" variant="outline" onClick={() => onAction("restore")}>
              <RotateCcw className="h-3.5 w-3.5" />
              Restore
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onAction("permanent-delete")}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete Permanently
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => onAction("activate")}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Activate
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction("deactivate")}>
              <XCircle className="h-3.5 w-3.5" />
              Deactivate
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction("archive")}>
              <Archive className="h-3.5 w-3.5" />
              Archive
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onAction("delete")}>
              <Trash2 className="h-3.5 w-3.5" />
              Move to Trash
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection" title="Clear selection">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
