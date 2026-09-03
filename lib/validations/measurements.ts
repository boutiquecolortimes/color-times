import { z } from "zod";

// These come in as free text, not a strict number — tailoring notes often
// need more than one value in a single field (multiple sizes on a bulk
// order, e.g. "4 50 59" or "4,5,6"), which an <input type="number"> simply
// refuses to accept at all (it blocks spaces and commas outright). Kept as
// trimmed strings all the way through validation, storage, and display.
export const measurementsZodSchema = z.object({
  bust: z.string().trim().optional(),
  waist: z.string().trim().optional(),
  hip: z.string().trim().optional(),
  shoulder: z.string().trim().optional(),
  sleeveLength: z.string().trim().optional(),
  blouseLength: z.string().trim().optional(),
  armhole: z.string().trim().optional(),
  neckFront: z.string().trim().optional(),
  neckBack: z.string().trim().optional(),
  upperChest: z.string().trim().optional(),
  lowerChest: z.string().trim().optional(),
  armLength: z.string().trim().optional(),
  length: z.string().trim().optional(),
  thigh: z.string().trim().optional(),
  other: z.string().trim().optional(),
});

export type MeasurementsInput = z.infer<typeof measurementsZodSchema>;
