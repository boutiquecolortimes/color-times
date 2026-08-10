import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { connectToDatabase } from "@/lib/db/connect";
import { Settings } from "@/models/Settings";
import { PaymentMethodsSettingsForm } from "@/components/admin/payment-methods-settings-form";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/validations/payment-methods";

export const metadata: Metadata = { title: "Booking Settings" };

export default async function BookingSettingsPage() {
  const currentUser = await requireRole(SETTINGS_ROLES);
  if (!currentUser) {
    redirect("/admin");
  }

  await connectToDatabase();
  const settings = await Settings.findOne({ module: "payment-methods" }).lean();

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Bookings
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Booking Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure options used when creating and managing bookings.
        </p>
      </div>

      <PaymentMethodsSettingsForm
        initialSettings={
          (settings?.data as typeof DEFAULT_PAYMENT_METHODS) ?? DEFAULT_PAYMENT_METHODS
        }
      />
    </div>
  );
}
