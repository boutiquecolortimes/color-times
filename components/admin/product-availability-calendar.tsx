"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DateRange {
  bookingNumber: string;
  rentalStartDate: string;
  rentalEndDate: string;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function rangeBounds(range: DateRange): { start: Date; end: Date } {
  const start = new Date(range.rentalStartDate);
  const end = new Date(range.rentalEndDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

// The return day is a handover day — the dress can go out again that same
// day — so it only counts as booked for a single-day rental. That case
// must match the one day exactly: the old `day >= start && (… || start === end)`
// was true for every day after a same-day booking, so a single 14 Dec
// rental showed the dress as booked for the rest of time.
function isBookedOn(day: Date, range: DateRange): boolean {
  const { start, end } = rangeBounds(range);
  if (start.getTime() === end.getTime()) {
    return day.getTime() === start.getTime();
  }
  return day >= start && day < end;
}

function isReturnDay(day: Date, range: DateRange): boolean {
  return day.getTime() === rangeBounds(range).end.getTime();
}

export function ProductAvailabilityCalendar({ activeRanges }: { activeRanges: DateRange[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_LABELS.map((label, index) => (
          <div key={index} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) return <div key={index} />;
          const booking = activeRanges.find((range) => isBookedOn(day, range));
          const returning = booking ? undefined : activeRanges.find((range) => isReturnDay(day, range));
          const isToday = day.getTime() === today.getTime();
          return (
            <div
              key={index}
              title={
                booking
                  ? `Booked — ${booking.bookingNumber}`
                  : returning
                    ? `Return day — ${returning.bookingNumber} (can be booked from this day)`
                    : "Available"
              }
              className={`flex aspect-square items-center justify-center rounded-md text-xs ${
                booking
                  ? "bg-red-100 font-medium text-red-800"
                  : returning
                    ? "bg-amber-100 font-medium text-amber-800"
                    : "bg-emerald-50 text-emerald-800"
              } ${isToday ? "ring-2 ring-accent" : ""}`}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>

      {/* Tooltips don't exist on touch screens, so list the bookings that
          are holding dates — makes a wrong end date obvious at a glance. */}
      {activeRanges.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {activeRanges.map((range) => {
            const { start, end } = rangeBounds(range);
            const fmt = (d: Date) =>
              d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            return (
              <li key={range.bookingNumber} className="flex justify-between gap-2">
                <span className="font-medium">{range.bookingNumber}</span>
                <span className="text-muted-foreground">
                  {fmt(start)} → {fmt(end)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-100" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-100" /> Return day
        </span>
      </div>
    </div>
  );
}
