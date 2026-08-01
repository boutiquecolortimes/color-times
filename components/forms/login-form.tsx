"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "idle") {
      toast.info("You were signed out after 30 minutes of inactivity.");
    } else if (reason === "session-ended") {
      toast.info("You were signed out — your account may have signed in elsewhere, or your session ended.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(values: LoginInput) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Unable to sign in. Please try again.");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["session"] });
      toast.success(`Welcome back, ${json.data.name}!`);
      const fallback = json.data.role === "customer" ? "/account" : "/admin";
      router.push(searchParams.get("next") ?? fallback);
    } catch {
      toast.error("Network error. Please check your connection and try again.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Email address</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-2.5 transition-colors focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@colortimes.com"
                    className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Password</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-2.5 transition-colors focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <PasswordInput
                    placeholder="Enter your password"
                    className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="mt-2 w-full rounded-[10px] bg-gradient-to-br from-primary to-[#28081a] py-2.5 font-semibold tracking-wide shadow-[0_6px_18px_rgba(61,18,41,0.28)] transition-transform hover:-translate-y-px active:scale-[0.98]"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>
    </Form>
  );
}
