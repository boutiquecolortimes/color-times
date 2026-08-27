import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { Staff } from "@/models/Staff";
import { StaffClient } from "@/components/admin/staff-client";

export const metadata: Metadata = { title: "Staff" };

const PAGE_SIZE = 10;

export default async function AdminStaffPage() {
  await connectToDatabase();

  const [staff, total] = await Promise.all([
    Staff.find({ deletedAt: null }).sort({ name: 1 }).limit(PAGE_SIZE).lean(),
    Staff.countDocuments({ deletedAt: null }),
  ]);

  const initialStaff = staff.map((member) => ({
    _id: String(member._id),
    name: member.name,
    phone: member.phone ?? "",
    designation: member.designation ?? "",
    monthlySalary: member.monthlySalary,
    joiningDate: member.joiningDate.toISOString().slice(0, 10),
    isActive: member.isActive,
    notes: member.notes ?? "",
  }));

  return (
    <StaffClient
      initialStaff={initialStaff}
      initialPagination={{
        page: 1,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      }}
    />
  );
}
