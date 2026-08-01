import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/forms/login-form";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Color Times Boutique account.",
  alternates: { canonical: "/login" },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const isAdminLogin = next?.startsWith("/admin") ?? false;

  return (
    <div
      className="admin-theme relative grid min-h-svh place-items-center overflow-hidden px-6 py-8"
      style={{
        background:
          "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 55%), linear-gradient(175deg, var(--sidebar) 0%, #28081a 60%, #190510 100%)",
      }}
    >
      <div className="flex w-full max-w-[378px] flex-col items-center">
        <span className="mb-2.5 grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-white/95 p-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.28)]">
          <Image
            src="/logo-icon.png"
            alt={siteConfig.name}
            width={30}
            height={30}
            priority
            className="h-full w-full object-contain"
          />
        </span>
        <p className="font-heading text-[17px] font-semibold tracking-wide text-white">
          {siteConfig.name}
        </p>
        <p className="mb-5 mt-1 text-[9.5px] font-semibold uppercase tracking-[0.24em] text-[#C9A6B4]">
          {isAdminLogin ? "Admin Panel" : "Customer Account"}
        </p>

        <div className="relative w-full rounded-[18px] bg-[#FAF6EF] p-7 pb-8 shadow-[0_30px_70px_rgba(10,2,7,0.35)]">
          <div className="absolute inset-x-[14%] top-0 h-0.5 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent" />

          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {isAdminLogin ? "Admin Access" : "Welcome Back"}
          </p>
          <h1 className="text-center font-heading text-2xl font-semibold italic text-foreground">
            {isAdminLogin ? "Welcome back" : "Sign in"}
          </h1>
          <p className="mb-6 mt-1.5 text-center text-[12.5px] leading-relaxed text-muted-foreground">
            {isAdminLogin
              ? "Sign in with your team credentials to manage bookings, inventory, and orders."
              : "Sign in to track your rentals, wishlist, and orders."}
          </p>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          {isAdminLogin ? (
            <p className="mt-4 text-center text-xs text-[#C9A6B4]">
              Need access? Contact your store manager
            </p>
          ) : (
            <p className="mt-4 text-center text-xs text-[#C9A6B4]">
              New to Color Times?{" "}
              <Link href="/register" className="font-semibold text-[#D9B876] hover:underline">
                Create an account
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
