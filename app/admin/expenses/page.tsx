import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { Expense } from "@/models/Expense";
import { ExpensesClient } from "@/components/admin/expenses-client";

export const metadata: Metadata = { title: "Expenses" };

const PAGE_SIZE = 10;

export default async function AdminExpensesPage() {
  await connectToDatabase();

  const [expenses, total] = await Promise.all([
    Expense.find({ deletedAt: null }).sort({ expenseDate: -1 }).limit(PAGE_SIZE).lean(),
    Expense.countDocuments({ deletedAt: null }),
  ]);

  const initialExpenses = expenses.map((expense) => ({
    _id: String(expense._id),
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
    expenseDate: expense.expenseDate.toISOString().slice(0, 10),
    paymentMethod: expense.paymentMethod ?? "",
    notes: expense.notes ?? "",
  }));

  return (
    <ExpensesClient
      initialExpenses={initialExpenses}
      initialPagination={{
        page: 1,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      }}
    />
  );
}
