"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AuditLogList } from "@/components/admin/audit-log-list";
import { formatDate } from "@/lib/utils";
import type { SaleSource } from "@/models/Sale";

interface SaleProduct {
  _id: string;
  name: string;
  images: string[];
  sku: string;
}

interface SaleDetail {
  _id: string;
  billNumber: string;
  saleDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  product: SaleProduct | null;
  details?: string;
  totalAmount: number;
  source: SaleSource;
  createdAt: string;
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function hasRealImage(images: string[]): boolean {
  const first = images[0];
  return Boolean(first) && !first.startsWith("/images/placeholder/");
}

async function fetchSale(id: string): Promise<SaleDetail> {
  const res = await fetch(`/api/admin/sales/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data.sale;
}

export function SaleDetailClient({ initialSale }: { initialSale: SaleDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: sale = initialSale } = useQuery({
    queryKey: ["admin", "sale", initialSale._id],
    queryFn: () => fetchSale(initialSale._id),
    initialData: initialSale,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/sales/${sale._id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => toast.success("Bill sent via WhatsApp"),
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/sales/${sale._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Sale deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "sales"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      router.push("/admin/sales");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pdfUrl = `/api/sales/${sale._id}/pdf`;

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/sales"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Sale
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl">{sale.billNumber}</h1>
            {sale.source === "booking" && (
              <Badge variant="secondary" className="rounded-full">
                Rental Settlement
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Sale date {formatDate(sale.saleDate)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ButtonLink variant="outline" size="sm" href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4" /> PDF
          </ButtonLink>
          <Button
            variant="outline"
            size="sm"
            disabled={sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send via WhatsApp
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Customer</h2>
              <p className="mt-2 text-sm">{sale.customerName}</p>
              <p className="text-sm text-muted-foreground">{sale.customerPhone}</p>
              <p className="mt-1 text-sm text-muted-foreground">{sale.customerAddress}</p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Dress</h2>
              {sale.product ? (
                <Link
                  href={`/admin/products/${sale.product._id}`}
                  className="mt-2 flex items-center gap-3 hover:opacity-80"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-secondary">
                    {hasRealImage(sale.product.images) ? (
                      <Image
                        src={sale.product.images[0]}
                        alt={sale.product.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <Image
                        src="/logo.png"
                        alt={sale.product.name}
                        fill
                        sizes="56px"
                        className="object-contain p-2 opacity-60"
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{sale.product.name}</p>
                    <p className="text-xs text-muted-foreground">{sale.product.sku}</p>
                  </div>
                </Link>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Dress no longer available</p>
              )}
            </div>
          </div>

          {sale.details && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Details</h2>
              <p className="mt-2 text-sm text-muted-foreground">{sale.details}</p>
            </div>
          )}

          <div className="rounded-lg border border-border bg-secondary/40 p-6">
            <div className="flex items-center justify-between">
              <span className="font-heading text-lg">Total Amount</span>
              <span className="text-xl font-medium text-accent">
                {formatCurrency(sale.totalAmount)}
              </span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <AuditLogList entityType="Sale" entityId={sale._id} />
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete sale?"
        description="This will move the sale to trash."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
