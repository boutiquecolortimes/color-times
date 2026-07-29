"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseSpreadsheetFile, downloadCsv } from "@/lib/admin/export";

interface ImportResult {
  row: number;
  name: string;
  status: "created" | "skipped";
  reason?: string;
}

const TEMPLATE_HEADERS = [
  "name",
  "code",
  "category",
  "designer",
  "description",
  "color",
  "fabric",
  "image",
  "sizes",
  "rentalPricePerDay",
  "retailValue",
  "securityDeposit",
  "isActive",
  "isFeatured",
  "isNewArrival",
  "tags",
];

export function ProductImportDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as { results: ImportResult[]; createdCount: number; skippedCount: number };
    },
    onSuccess: (data) => {
      setResults(data.results);
      toast.success(`Imported ${data.createdCount} product(s), skipped ${data.skippedCount}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setFileName(file.name);
    setResults(null);
    try {
      const parsed = await parseSpreadsheetFile<Record<string, string>>(file);
      setRows(parsed);
    } catch {
      toast.error("Could not parse this file");
    }
  }

  function handleDownloadTemplate() {
    downloadCsv(
      "product-import-template",
      TEMPLATE_HEADERS,
      [
        [
          "Sample Silk Gown",
          "",
          "party-wear",
          "Designer Name",
          "A beautiful sample description of the product.",
          "Emerald",
          "Silk",
          "/images/placeholder/dresses/dress-1.png",
          "S:3,M:5,L:2",
          "2500",
          "30000",
          "5000",
          "true",
          "false",
          "true",
          "silk,emerald",
        ],
      ]
    );
  }

  function handleClose() {
    setOpen(false);
    setRows([]);
    setFileName("");
    setResults(null);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        title="Bulk import products from a CSV or Excel file"
      >
        <Upload className="h-4 w-4" />
        Import
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleClose())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Products (CSV or Excel)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Choose File
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
                Download Template
              </Button>
              {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
            </div>

            {rows.length > 0 && !results && (
              <div className="max-h-64 overflow-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-secondary/60">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Name</th>
                      <th className="px-2 py-1.5 text-left">Category</th>
                      <th className="px-2 py-1.5 text-left">Sizes</th>
                      <th className="px-2 py-1.5 text-left">Price/Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={index} className="border-t border-border">
                        <td className="px-2 py-1.5">{row.name}</td>
                        <td className="px-2 py-1.5">{row.category}</td>
                        <td className="px-2 py-1.5">{row.sizes}</td>
                        <td className="px-2 py-1.5">{row.rentalPricePerDay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-border px-2 py-1.5 text-xs text-muted-foreground">
                  {rows.length} row(s) ready to import
                </p>
              </div>
            )}

            {results && (
              <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-border p-3">
                {results.map((result) => (
                  <div key={result.row} className="flex items-center gap-2 text-xs">
                    {result.status === "created" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    )}
                    <span className="font-medium">Row {result.row}:</span>
                    <span>{result.name}</span>
                    {result.reason && (
                      <span className="text-muted-foreground">— {result.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button
              disabled={rows.length === 0 || importMutation.isPending || results !== null}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Import {rows.length > 0 ? `${rows.length} Product(s)` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
