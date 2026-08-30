"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, Loader2, Pencil, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  customerUpdateSchema,
  type CustomerUpdateInput,
} from "@/lib/validations/customer";
import { useCanEdit } from "@/components/admin/current-user-context";
import { formatDate, isWalkinEmail } from "@/lib/utils";

interface CustomerDetail {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  fatherName?: string;
  isActive: boolean;
  createdAt: string;
  addresses: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
  }[];
}

export function CustomerDetailClient({ initialCustomer }: { initialCustomer: CustomerDetail }) {
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();
  const [editing, setEditing] = useState(false);
  const [customer, setCustomer] = useState(initialCustomer);
  const primaryAddress = customer.addresses[0];

  const form = useForm<CustomerUpdateInput>({
    resolver: zodResolver(customerUpdateSchema),
    defaultValues: {
      name: customer.name,
      phone: customer.phone ?? "",
      fatherName: customer.fatherName ?? "",
      addressLine1: primaryAddress?.line1 ?? "",
      addressCity: primaryAddress?.city ?? "",
      addressState: primaryAddress?.state ?? "",
      addressPostalCode: primaryAddress?.postalCode ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: CustomerUpdateInput) => {
      const res = await fetch(`/api/admin/customers/${customer._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.customer as CustomerDetail;
    },
    onSuccess: (updated) => {
      toast.success("Customer updated");
      setCustomer(updated);
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      setEditing(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async () => {
      const action = customer.isActive ? "archive" : "restore";
      const res = await fetch(`/api/admin/customers/${customer._id}/${action}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.customer as { isActive: boolean };
    },
    onSuccess: (updated) => {
      toast.success(updated.isActive ? "Customer restored" : "Customer archived");
      setCustomer((prev) => ({ ...prev, isActive: updated.isActive }));
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl">Edit Customer</h1>
          <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="mt-4 space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 90000 00000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fatherName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Father&apos;s Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium">Address</p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Address Line</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="addressCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="addressState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="addressPostalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {/*
        Unlike the equivalent header on the invoice/sale/booking detail
        pages, this row had no responsive stacking at all — a long
        customer name plus the Archive/Edit buttons on one
        `justify-between` line with nothing to wrap or stack them. Long
        names ran the buttons off the edge of a narrow screen. Stacking
        below sm matches how the other detail pages already handle this.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl">{customer.name}</h1>
          {!customer.isActive && <Badge variant="secondary">Inactive</Badge>}
        </div>
        <div className="flex gap-2">
          {/* Archiving is Admin-and-up only, but Restoring (same toggle,
              when the customer is already inactive) stays open to Staff. */}
          {(canEdit || !customer.isActive) && (
            <Button
              variant="outline"
              size="sm"
              disabled={toggleActiveMutation.isPending}
              onClick={() => toggleActiveMutation.mutate()}
            >
              {toggleActiveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : customer.isActive ? (
                <Archive className="h-4 w-4" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {customer.isActive ? "Archive" : "Restore"}
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Email</p>
          <p className="mt-1">{isWalkinEmail(customer.email) ? "—" : customer.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Mobile</p>
          <p className="mt-1">{customer.phone ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Joined</p>
          <p className="mt-1">{formatDate(customer.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Father&apos;s Name</p>
          <p className="mt-1">{customer.fatherName ?? "—"}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs uppercase text-muted-foreground">Address</p>
          <p className="mt-1">
            {primaryAddress
              ? [primaryAddress.line1, primaryAddress.city, primaryAddress.state, primaryAddress.postalCode]
                  .filter(Boolean)
                  .join(", ")
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
