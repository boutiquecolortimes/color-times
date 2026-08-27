import { z } from "zod";

// Payroll staff — the people the business pays a monthly salary (tailors,
// helpers, etc). Deliberately separate from lib/validations/staff.ts, which
// governs admin/Team accounts with a "staff" login role — same word,
// unrelated concepts.
export const staffMemberSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  designation: z.string().trim().max(80).optional().or(z.literal("")),
  monthlySalary: z.number().min(0, "Monthly salary must be 0 or more"),
  joiningDate: z.string().trim().min(1, "Joining date is required"),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type StaffMemberInput = z.infer<typeof staffMemberSchema>;
