"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchableSelectOption {
  value: string
  label: string
  sublabel?: string
  disabled?: boolean
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  /**
   * Server-side search mode: called (debounced) with what the user types,
   * and `options` is expected to already be the server's matches — no local
   * filtering. Lets a dropdown cover any number of records while only ever
   * holding one page of them.
   */
  onSearch?: (query: string) => void
  loading?: boolean
  /** Label for the selected value when it isn't in the current `options`. */
  selectedLabel?: string
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results.",
  disabled,
  className,
  onSearch,
  loading,
  selectedLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const selected = options.find((option) => option.value === value)
  const triggerLabel = selected?.label ?? (value ? selectedLabel : undefined)

  // Debounced so fast typing sends one request, not one per keystroke.
  React.useEffect(() => {
    if (!onSearch || !open) return
    const timer = setTimeout(() => onSearch(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query, open, onSearch])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || onSearch) return options
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || option.sublabel?.toLowerCase().includes(q)
    )
  }, [options, query, onSearch])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setQuery("")
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
          />
        }
      >
        <span className={cn("truncate text-left", !triggerLabel && "text-muted-foreground")}>
          {triggerLabel ?? placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner className="isolate z-50 outline-none" align="start" sideOffset={6}>
          <PopoverPrimitive.Popup className="w-80 max-w-[90vw] origin-(--transform-origin) rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex items-center gap-2 border-b border-border px-2 pb-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="mt-1 max-h-64 overflow-y-auto">
              {loading && (
                <p className="px-2 py-3 text-center text-sm text-muted-foreground">Searching...</p>
              )}
              {!loading && filtered.length === 0 && (
                <p className="px-2 py-3 text-center text-sm text-muted-foreground">{emptyText}</p>
              )}
              {filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => {
                    if (option.disabled) return
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary",
                    option.value === value && "bg-secondary",
                    option.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
                  )}
                >
                  <span className="truncate">
                    {option.label}
                    {option.sublabel && (
                      <span
                        className={cn(
                          "ml-1.5 text-xs",
                          option.disabled ? "text-destructive" : "text-muted-foreground"
                        )}
                      >
                        {option.sublabel}
                      </span>
                    )}
                  </span>
                  {option.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                </button>
              ))}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { SearchableSelect }
export type { SearchableSelectOption }
