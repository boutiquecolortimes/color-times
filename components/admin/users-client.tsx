"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Copy, Grid3x3, KeyRound, List, Loader2, Pencil, Plus, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { createStaffSchema, type CreateStaffInput } from "@/lib/validations/staff";
import { formatDate } from "@/lib/utils";
import type { UserRole } from "@/models/User";

const PAGE_SIZE = 5;

interface StaffUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  staff: "Staff",
  admin: "Admin",
  developer: "Developer",
  super_admin: "Super Admin",
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
  { value: "developer", label: "Developer" },
  { value: "super_admin", label: "Super Admin" },
];

async function fetchUsers(): Promise<StaffUser[]> {
  const res = await fetch("/api/admin/users");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data.users;
}

function TemporaryPasswordDialog({
  password,
  onClose,
}: {
  password: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={password !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Temporary Password</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Share this password with the team member. It won&apos;t be shown again.
        </p>
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2">
          <code className="font-mono text-sm">{password}</code>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (password) {
                void navigator.clipboard.writeText(password);
                toast.success("Copied to clipboard");
              }
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersClient({
  initialUsers,
  currentUserId,
  currentUserRole,
}: {
  initialUsers: StaffUser[];
  currentUserId: string;
  currentUserRole: UserRole;
}) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [deactivating, setDeactivating] = useState<StaffUser | null>(null);
  const [deleting, setDeleting] = useState<StaffUser | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [layout, setLayout] = useState<"table" | "card">("table");
  const [page, setPage] = useState(1);

  const { data: users = initialUsers } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchUsers,
    initialData: initialUsers,
  });

  // Team rosters are small and fetched in one shot — paginate on the
  // client instead of round-tripping to the server for each page.
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = users.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const canAssignPrivilegedRoles = currentUserRole === "super_admin";
  const roleOptions = canAssignPrivilegedRoles
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((option) => option.value === "staff" || option.value === "admin");

  const form = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: { name: "", email: "", phone: "", role: "staff" },
  });

  function openCreateDialog() {
    form.reset({ name: "", email: "", phone: "", role: "staff" });
    setCreateOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: async (values: CreateStaffInput) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as { user: StaffUser; temporaryPassword: string };
    },
    onSuccess: (data) => {
      toast.success("Team member created");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setCreateOpen(false);
      setTemporaryPassword(data.temporaryPassword);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const editForm = useForm<{ name: string; phone: string; role: UserRole }>({
    defaultValues: { name: "", phone: "", role: "staff" },
  });

  function openEditDialog(user: StaffUser) {
    setEditing(user);
    editForm.reset({ name: user.name, phone: user.phone, role: user.role });
  }

  const updateMutation = useMutation({
    mutationFn: async (values: { name: string; phone: string; role: UserRole }) => {
      if (!editing) return null;
      const res = await fetch(`/api/admin/users/${editing._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.user;
    },
    onSuccess: () => {
      toast.success("Team member updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.user;
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.isActive ? "Account reactivated" : "Account deactivated");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setDeactivating(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Team member removed");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setDeleting(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as { temporaryPassword: string };
    },
    onSuccess: (data) => {
      setTemporaryPassword(data.temporaryPassword);
      setResettingId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setResettingId(null);
    },
  });

  const cardGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {pagedUsers.map((user) => {
          const isSelf = user._id === currentUserId;
          return (
            <div key={user._id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">
                  {user.name}
                  {isSelf && <span className="ml-2 text-xs text-muted-foreground">(You)</span>}
                </p>
                <Badge variant={user.isActive ? "default" : "secondary"} className="rounded-full">
                  {user.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-sm text-muted-foreground">{user.phone || "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ROLE_LABELS[user.role] ?? user.role} &middot; Joined {formatDate(user.createdAt)}
              </p>
              <div className="mt-3 flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(user)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={resetPasswordMutation.isPending && resettingId === user._id}
                  onClick={() => {
                    setResettingId(user._id);
                    resetPasswordMutation.mutate(user._id);
                  }}
                  title="Reset password"
                >
                  {resetPasswordMutation.isPending && resettingId === user._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" />
                  )}
                </Button>
                {!isSelf && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeactivating(user)}
                    title={user.isActive ? "Deactivate" : "Reactivate"}
                  >
                    <ShieldOff className="h-3.5 w-3.5" />
                  </Button>
                )}
                {!isSelf && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => setDeleting(user)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      {users.length === 0 && (
        <p className="col-span-full py-10 text-center text-muted-foreground">No team members yet.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage staff, admin, and developer accounts.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" /> New Team Member
          </Button>
        </div>
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
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.map((user) => {
              const isSelf = user._id === currentUserId;
              return (
                <tr key={user._id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {user.name}
                    {isSelf && <span className="ml-2 text-xs text-muted-foreground">(You)</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.phone || "—"}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[user.role] ?? user.role}</td>
                  <td className="px-4 py-3">
                    <Badge variant={user.isActive ? "default" : "secondary"} className="rounded-full">
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(user)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={resetPasswordMutation.isPending && resettingId === user._id}
                        onClick={() => {
                          setResettingId(user._id);
                          resetPasswordMutation.mutate(user._id);
                        }}
                        title="Reset password"
                      >
                        {resetPasswordMutation.isPending && resettingId === user._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <KeyRound className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {!isSelf && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeactivating(user)}
                          title={user.isActive ? "Deactivate" : "Reactivate"}
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!isSelf && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          onClick={() => setDeleting(user)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No team members yet.
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
        total={users.length}
        itemLabel="team members"
        onPageChange={setPage}
      />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Team Member</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
              className="space-y-4"
            >
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
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
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "staff")}>
                        <SelectTrigger>
                          <SelectValue>
                            {(value: string) => ROLE_LABELS[value] ?? value}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground">
                A temporary password will be generated automatically — you&apos;ll be shown it once to share with them.
              </p>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit((values) => updateMutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
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
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={(value) => field.onChange(value ?? "staff")}
                        disabled={editing?._id === currentUserId}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {(value: string) => ROLE_LABELS[value] ?? value}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={deactivating?.isActive ? "Deactivate account?" : "Reactivate account?"}
        description={
          deactivating?.isActive
            ? `${deactivating?.name} will no longer be able to sign in until reactivated.`
            : `${deactivating?.name} will be able to sign in again.`
        }
        confirmLabel={deactivating?.isActive ? "Deactivate" : "Reactivate"}
        variant={deactivating?.isActive ? "destructive" : "default"}
        isLoading={toggleActiveMutation.isPending}
        onConfirm={() => {
          if (deactivating) {
            toggleActiveMutation.mutate({ id: deactivating._id, isActive: !deactivating.isActive });
          }
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remove team member?"
        description={`This permanently deletes ${deleting?.name}'s account. This cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting._id);
        }}
      />

      <TemporaryPasswordDialog password={temporaryPassword} onClose={() => setTemporaryPassword(null)} />
    </div>
  );
}
