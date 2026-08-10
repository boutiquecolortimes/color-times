import { z } from "zod";

// Free-form, admin-editable list — deliberately not a fixed enum, so new
// payment options can be added from the settings screen without a code
// change or migration.
export const paymentMethodsSettingsSchema = z.object({
  options: z
    .array(z.string().trim().min(1).max(40))
    .min(1, "Add at least one payment method")
    .max(20, "That's a lot of payment methods — keep it under 20"),
});

export type PaymentMethodsSettingsInput = z.infer<typeof paymentMethodsSettingsSchema>;

export const DEFAULT_PAYMENT_METHODS: PaymentMethodsSettingsInput = {
  options: ["Online", "Cash", "Manual"],
};
