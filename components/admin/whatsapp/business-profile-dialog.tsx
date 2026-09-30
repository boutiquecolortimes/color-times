"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { whatsappApi } from "@/lib/whatsapp/client-fetch";
import { BUSINESS_VERTICALS, type MetaBusinessProfile } from "@/lib/whatsapp/meta-types";

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function BusinessProfileDialog({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: MetaBusinessProfile;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    about: profile.about ?? "",
    description: profile.description ?? "",
    address: profile.address ?? "",
    email: profile.email ?? "",
    website1: profile.websites?.[0] ?? "",
    website2: profile.websites?.[1] ?? "",
    vertical: profile.vertical ?? "APPAREL",
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const save = useMutation({
    mutationFn: () =>
      whatsappApi("/api/admin/whatsapp/profile", {
        method: "PATCH",
        body: {
          about: form.about,
          description: form.description,
          address: form.address,
          email: form.email,
          websites: [form.website1, form.website2].map((w) => w.trim()).filter(Boolean),
          vertical: form.vertical,
        },
      }),
    onSuccess: () => {
      toast.success("Business profile updated on WhatsApp");
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "overview"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message, { duration: 10000 }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit WhatsApp business profile</DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className="text-sm font-medium">About</label>
            <Input className="mt-2" maxLength={139} value={form.about} onChange={set("about")} />
            <p className="mt-1 text-xs text-muted-foreground">{form.about.length}/139 — shown under your name</p>
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea className="mt-2" rows={3} maxLength={512} value={form.description} onChange={set("description")} />
          </div>
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select value={form.vertical} onValueChange={(v) => setForm((p) => ({ ...p, vertical: v ?? "APPAREL" }))}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue>{(v: string) => label(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_VERTICALS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {label(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Address</label>
            <Textarea className="mt-2" rows={2} maxLength={256} value={form.address} onChange={set("address")} />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input className="mt-2" type="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Websites (up to 2)</label>
            <Input placeholder="https://" value={form.website1} onChange={set("website1")} />
            <Input placeholder="https://" value={form.website2} onChange={set("website2")} />
          </div>
          <p className="text-xs text-muted-foreground">
            The profile photo can only be changed in WhatsApp Manager.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save to WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
