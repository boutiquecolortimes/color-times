"use client";

import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  updateAccountSchema,
  changePasswordSchema,
  type UpdateAccountInput,
  type ChangePasswordInput,
} from "@/lib/validations/account";
import type { UserRole } from "@/models/User";

const ROLE_LABELS: Record<string, string> = {
  staff: "Staff",
  admin: "Admin",
  developer: "Developer",
  super_admin: "Super Admin",
};

interface Profile {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

export function AccountSettingsClient({ initialProfile }: { initialProfile: Profile }) {
  const profileForm = useForm<UpdateAccountInput>({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: { name: initialProfile.name, phone: initialProfile.phone },
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const profileMutation = useMutation({
    mutationFn: async (values: UpdateAccountInput) => {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => toast.success("Profile updated"),
    onError: (error: Error) => toast.error(error.message),
  });

  const passwordMutation = useMutation({
    mutationFn: async (values: ChangePasswordInput) => {
      const res = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Password changed");
      passwordForm.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your own profile and password.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-heading text-lg">Profile</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{initialProfile.email}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs uppercase tracking-wide">
            {ROLE_LABELS[initialProfile.role] ?? initialProfile.role}
          </span>
        </div>
        <Form {...profileForm}>
          <form
            onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}
            className="mt-5 space-y-4"
          >
            <FormField
              control={profileForm.control}
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
              control={profileForm.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <PhoneInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={profileMutation.isPending}>
              {profileMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-heading text-lg">Change Password</h2>
        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))}
            className="mt-5 space-y-4"
          >
            <FormField
              control={passwordForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Change Password
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
