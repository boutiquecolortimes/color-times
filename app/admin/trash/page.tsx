import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { TrashClient } from "@/components/admin/trash-client";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage() {
  const currentUser = await requireRole(ADMIN_ROLES);
  if (!currentUser) {
    redirect("/admin");
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Trash</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Restore or permanently delete items across Products, Categories, Bookings, Customers, and
          Invoices. Permanently deleting frees up codes, slugs, and names so they can be reused.
        </p>
      </div>

      <TrashClient />
    </div>
  );
}
