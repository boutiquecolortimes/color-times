import { z } from "zod";

// Validates the text fields of a public review submission (see
// app/api/reviews/[token]/route.ts). The 1-4 photo requirement is enforced
// separately in the route itself, since the files arrive as multipart
// FormData entries rather than something zod can see here.
export const bookingReviewSubmitSchema = z.object({
  customerName: z.string().trim().min(1, "Please enter your name").max(200),
  rating: z.coerce.number().int().min(1, "Please select a star rating").max(5),
  comment: z.string().trim().max(1000, "Keep your review under 1000 characters").optional(),
});

export type BookingReviewSubmitInput = z.infer<typeof bookingReviewSubmitSchema>;
