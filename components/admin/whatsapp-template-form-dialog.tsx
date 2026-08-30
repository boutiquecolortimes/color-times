"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  whatsAppTemplateSchema,
  type WhatsAppTemplateInput,
} from "@/lib/validations/whatsapp-template";
import {
  TRIGGER_EVENTS,
  TRIGGER_EVENT_LABELS,
  TRIGGER_EVENT_VARIABLES,
  type WhatsAppTriggerEvent,
} from "@/lib/notifications/trigger-events";
import { WhatsAppChatBubble } from "@/components/admin/whatsapp-chat-preview";

export interface WhatsAppTemplateRow {
  _id: string;
  name: string;
  triggerEvent: WhatsAppTriggerEvent;
  brevoTemplateId?: number;
  metaTemplateName?: string;
  metaLanguageCode?: string;
  previewBody: string;
  isActive: boolean;
}

const EMPTY_VALUES: WhatsAppTemplateInput = {
  name: "",
  triggerEvent: "booking_confirmed",
  brevoTemplateId: undefined,
  metaTemplateName: "",
  metaLanguageCode: "en_US",
  previewBody: "",
  isActive: false,
};

export function WhatsAppTemplateFormDialog({
  open,
  onOpenChange,
  editingTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTemplate: WhatsAppTemplateRow | null;
}) {
  const queryClient = useQueryClient();

  const form = useForm<WhatsAppTemplateInput>({
    resolver: zodResolver(whatsAppTemplateSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editingTemplate
          ? {
              name: editingTemplate.name,
              triggerEvent: editingTemplate.triggerEvent,
              brevoTemplateId: editingTemplate.brevoTemplateId,
              metaTemplateName: editingTemplate.metaTemplateName ?? "",
              metaLanguageCode: editingTemplate.metaLanguageCode || "en_US",
              previewBody: editingTemplate.previewBody,
              isActive: editingTemplate.isActive,
            }
          : EMPTY_VALUES
      );
    }
  }, [open, editingTemplate, form]);

  const triggerEvent = form.watch("triggerEvent");
  const previewBody = form.watch("previewBody");
  const availableVariables = TRIGGER_EVENT_VARIABLES[triggerEvent as WhatsAppTriggerEvent] ?? [];

  const mutation = useMutation({
    mutationFn: async (values: WhatsAppTemplateInput) => {
      const url = editingTemplate
        ? `/api/admin/whatsapp/templates/${editingTemplate._id}`
        : "/api/admin/whatsapp/templates";
      const res = await fetch(url, {
        method: editingTemplate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.template;
    },
    onSuccess: () => {
      toast.success(editingTemplate ? "Template updated" : "Template created");
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "templates"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="grid gap-6 md:grid-cols-[1fr_260px]"
          >
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Booking confirmation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="triggerEvent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trigger Event</FormLabel>
                  <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: WhatsAppTriggerEvent) => TRIGGER_EVENT_LABELS[value]}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TRIGGER_EVENTS.map((event) => (
                        <SelectItem key={event} value={event}>
                          {TRIGGER_EVENT_LABELS[event]}
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
              name="brevoTemplateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brevo Template ID</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      value={field.value ? field.value : ""}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === "" ? undefined : Number(event.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Fill this in if sending via Brevo. The numeric ID of the approved WhatsApp
                    template from your Brevo dashboard.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px]">
              <FormField
                control={form.control}
                name="metaTemplateName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meta Template Name</FormLabel>
                    <FormControl>
                      <Input placeholder="booking_confirmed" {...field} />
                    </FormControl>
                    <FormDescription>
                      Fill this in if sending via Meta Cloud API — the exact template name
                      approved in Meta Business Manager.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="metaLanguageCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Language</FormLabel>
                    <FormControl>
                      <Input placeholder="en_US" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="previewBody"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preview Text</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Hi {{customerName}}, your booking {{bookingNumber}} is confirmed..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    For your reference and the activity log only — this should match what the
                    approved Brevo template actually says. Available variables:{" "}
                    {availableVariables.map((v) => `{{${v}}}`).join(", ")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <FormLabel className="font-normal">Active</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Only one active template per trigger event is used.
                    </p>
                  </div>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </div>
              )}
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Live Preview
            </p>
            <WhatsAppChatBubble text={previewBody} />
            {availableVariables.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {availableVariables.map((variable) => (
                  <span
                    key={variable}
                    className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {`{{${variable}}}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="md:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
