import * as React from "react"
import { Input } from "@/components/ui/input"

/** Digits-only mobile number input, capped at 10 characters. */
const PhoneInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ onChange, ...props }, ref) => {
    return (
      <Input
        type="tel"
        inputMode="numeric"
        maxLength={10}
        placeholder="9876543210"
        onChange={(event) => {
          event.target.value = event.target.value.replace(/\D/g, "").slice(0, 10)
          onChange?.(event)
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
PhoneInput.displayName = "PhoneInput"

export { PhoneInput }
