"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]
// Old bookings/records can go back further than a fresh calendar makes
// convenient to reach one month-click at a time — a direct year/month
// jump matters more than the exact bound, so this is generous on purpose.
const YEARS_BACK = 20
const YEARS_FORWARD = 2

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

function DatePicker({ value, onChange, placeholder = "Select date", className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseIsoDate(value)
  const [cursor, setCursor] = React.useState(() => {
    const base = selected ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const base = selected ?? new Date()
      setCursor(new Date(base.getFullYear(), base.getMonth(), 1))
    }
    setOpen(nextOpen)
  }

  // Bounded around today, but stretched to always include whatever year is
  // currently in view — e.g. an existing booking dated further back than
  // the default window shouldn't leave the year select without a match.
  const yearOptions = React.useMemo(() => {
    const thisYear = new Date().getFullYear()
    const min = Math.min(thisYear - YEARS_BACK, cursor.getFullYear())
    const max = Math.max(thisYear + YEARS_FORWARD, cursor.getFullYear())
    const years: number[] = []
    for (let year = max; year >= min; year -= 1) years.push(year)
    return years
  }, [cursor])

  const monthStart = cursor
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
  const gridStart = new Date(monthStart)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())
  const gridEnd = new Date(monthEnd)
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()))

  const days: Date[] = []
  for (const d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }

  const todayKey = toIsoDate(new Date())
  const selectedKey = selected ? toIsoDate(selected) : null

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              className
            )}
          />
        }
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className={cn(!value && "text-muted-foreground")}>
          {value ? formatDate(value) : placeholder}
        </span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner className="isolate z-50 outline-none" align="start" sideOffset={6}>
          <PopoverPrimitive.Popup className="w-80 origin-(--transform-origin) rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex items-center justify-between gap-1 pb-2">
              <button
                type="button"
                onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Year first, then month — jumping straight to a year (e.g.
                  older records from 2023) beats clicking "previous month"
                  dozens of times. */}
              <div className="flex flex-1 items-center justify-center gap-1.5">
                <Select
                  value={String(cursor.getFullYear())}
                  onValueChange={(next) => {
                    if (!next) return
                    setCursor((prev) => new Date(Number(next), prev.getMonth(), 1))
                  }}
                >
                  <SelectTrigger size="sm" className="w-[74px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="center">
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(cursor.getMonth())}
                  onValueChange={(next) => {
                    if (!next) return
                    setCursor((prev) => new Date(prev.getFullYear(), Number(next), 1))
                  }}
                >
                  <SelectTrigger size="sm" className="w-[76px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="center">
                    {MONTH_LABELS.map((label, index) => (
                      <SelectItem key={label} value={String(index)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <button
                type="button"
                onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="grid h-7 place-items-center text-[11px] font-semibold uppercase text-muted-foreground"
                >
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const key = toIsoDate(day)
                const isCurrentMonth = day.getMonth() === cursor.getMonth()
                const isToday = key === todayKey
                const isSelected = key === selectedKey
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onChange(key)
                      setOpen(false)
                    }}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-full text-sm transition-colors hover:bg-secondary",
                      !isCurrentMonth && "text-muted-foreground/40",
                      isCurrentMonth && !isSelected && "text-foreground",
                      isToday && !isSelected && "font-semibold text-accent",
                      isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary"
                    )}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { DatePicker }
