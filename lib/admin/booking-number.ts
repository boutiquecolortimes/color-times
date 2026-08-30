import "server-only";
import { Booking } from "@/models/Booking";

export async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CTB-${year}-`;
  const latest = await Booking.findOne({ bookingNumber: { $regex: `^${prefix}` } })
    .sort({ bookingNumber: -1 })
    .select("bookingNumber")
    .lean();
  const lastSeq = latest ? Number(latest.bookingNumber.split("-").pop()) : 1000;
  const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 1000) + 1;
  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
}

// The manual bill-number suggestion that used to live here
// (suggestNextBillNumber) now covers Booking, Sale, and Customisation Order
// together as one shared sequence — see lib/admin/bill-number.ts.
