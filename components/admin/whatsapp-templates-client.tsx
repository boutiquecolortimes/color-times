"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Grid3x3, List, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  WhatsAppTemplateFormDialog,
  type WhatsAppTemplateRow,
} from "@/components/admin/whatsapp-template-form-dialog";
import { TRIGGER_EVENT_LABELS } from "@/lib/notifications/trigger-events";
import { WhatsAppChatBubble } from "@/components/admin/whatsapp-chat-preview";

const PAGE_SIZE = 5;

async function fetchTemplates(): Promise<WhatsAppTemplateRow[]> {
  const res = await fetch("/api/admin/whatsapp/templates");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data.templates;
}

export function WhatsAppTemplatesClient({
  initialTemplates,
}: {
  initialTemplates: WhatsAppTemplateRow[];
}) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplateRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [layout, setLayout] = useState<"table" | "card">("table");
  const [page, setPage] = useState(1);

  const { data: templates = initialTemplates } = useQuery({
    queryKey: ["admin", "whatsapp", "templates"],
    queryFn: fetchTemplates,
    initialData: initialTemplates,
  });

  // Template lists are small and fetched in one shot — paginate on the
  // client instead of round-tripping to the server for each page.
  const totalPages = Math.max(1, Math.ceil(templates.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedTemplates = templates.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/whatsapp/templates/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "templates"] });
      setDeleteId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cardGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {pagedTemplates.map((template) => (
        <div
          key={template._id}
          className="overflow-hidden rounded-lg border border-border bg-card"
        >
          <WhatsAppChatBubble text={template.previewBody} delivered={template.isActive} />
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{template.name}</p>
              <Badge
                className={
                  template.isActive
                    ? "rounded-full border-none bg-emerald-100 font-medium text-emerald-800"
                    : "rounded-full border-none bg-secondary font-medium text-foreground"
                }
              >
                {template.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {TRIGGER_EVENT_LABELS[template.triggerEvent]}
            </p>
            <p className="text-xs text-muted-foreground">
              {template.brevoTemplateId && `Brevo Template ID ${template.brevoTemplateId}`}
              {template.brevoTemplateId && template.metaTemplateName && " · "}
              {template.metaTemplateName && `Meta: ${template.metaTemplateName}`}
            </p>
            <div className="mt-3 flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditingTemplate(template);
                setFormOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => setDeleteId(template._id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
      {templates.length === 0 && (
        <p className="col-span-full py-10 text-center text-muted-foreground">
          No templates yet. Create one to start sending WhatsApp updates.
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
        <Button
          size="sm"
          onClick={() => {
            setEditingTemplate(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      <div className="lg:hidden">{cardGrid}</div>

      {layout === "card" ? (
        <div className="hidden lg:block">{cardGrid}</div>
      ) : (
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
        <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
          <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Provider ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedTemplates.map((template) => (
              <tr key={template._id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{template.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {TRIGGER_EVENT_LABELS[template.triggerEvent]}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {template.brevoTemplateId
                    ? `Brevo #${template.brevoTemplateId}`
                    : template.metaTemplateName
                      ? `Meta: ${template.metaTemplateName}`
                      : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={
                      template.isActive
                        ? "rounded-full border-none bg-emerald-100 font-medium text-emerald-800"
                        : "rounded-full border-none bg-secondary font-medium text-foreground"
                    }
                  >
                    {template.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingTemplate(template);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteId(template._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No templates yet. Create one to start sending WhatsApp updates.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      <AdminPagination
        page={safePage}
        totalPages={totalPages}
        total={templates.length}
        itemLabel="templates"
        onPageChange={setPage}
      />

      <WhatsAppTemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingTemplate={editingTemplate}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete template?"
        description="This will permanently remove the template. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}
