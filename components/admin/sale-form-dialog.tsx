"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { saleSchema, type SaleInput } from "@/lib/validations/sale";

export interface SaleRow {
  _id: string;
  billNumber: string;
  saleDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  product: { _id: string; name: string; sku: string } | null;
  details?: string;
  totalAmount: number;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

const EMPTY_VALUES: SaleInput = {
  saleDate: new Date().toISOString().slice(0, 10),
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  product: "",
  details: "",
  totalAmount: 0,
};

export function SaleFormDialog({
  open,
  onOpenChange,
  products,
  editingSale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  editingSale: SaleRow | null;
}) {
  const queryClient = useQueryClient();

  const form = useForm<SaleInput>({
    resolver: zodResolver(saleSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      if (editingSale) {
        form.reset({
          saleDate: toDateInputValue(editingSale.saleDate),
          customerName: editingSale.customerName,
          customerPhone: editingSale.customerPhone,
          customerAddress: editingSale.customerAddress,
          product: editingSale.product?._id ?? "",
          details: editingSale.details ?? "",
          totalAmount: editingSale.totalAmount,
        });
      } else {
        form.reset(EMPTY_VALUES);
      }
    }
  }, [open, editingSale, form]);

  const productValue = form.watch("product");
  const selectedProduct = products.find((p) => p._id === productValue);

  const mutation = useMutation({
    mutationFn: async (values: SaleInput) => {
      const url = editingSale ? `/api/admin/sales/${editingSale._id}` : "/api/admin/sales";
      const res = await fetch(url, {
        method: editingSale ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.sale;
    },
    onSuccess: () => {
      toast.success(editingSale ? "Sale updated" : "Sale created");
      queryClient.invalidateQueries({ queryKey: ["admin", "sales"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingSale ? "Edit Sale" : "New Sale"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile No.</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="customerAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product"
              render={() => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select
                    value={productValue}
                    onValueChange={(value) => form.setValue("product", value ?? "")}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a product">
                          {() =>
                            selectedProduct
                              ? `${selectedProduct.name} (${selectedProduct.sku})`
                              : "Select a product"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product._id} value={product._id}>
                          {product.name} ({product.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="saleDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} className="w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        value={field.value ? field.value : ""}
                        onChange={(event) =>
                          field.onChange(event.target.value === "" ? 0 : Number(event.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingSale ? "Save Changes" : "Create Sale"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
