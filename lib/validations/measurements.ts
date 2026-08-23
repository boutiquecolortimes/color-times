import { z } from "zod";

export const measurementsZodSchema = z.object({
  bust: z.number().min(0).optional(),
  waist: z.number().min(0).optional(),
  hip: z.number().min(0).optional(),
  shoulder: z.number().min(0).optional(),
  sleeveLength: z.number().min(0).optional(),
  blouseLength: z.number().min(0).optional(),
  armhole: z.number().min(0).optional(),
  neckFront: z.number().min(0).optional(),
  neckBack: z.number().min(0).optional(),
  upperChest: z.number().min(0).optional(),
  lowerChest: z.number().min(0).optional(),
  armLength: z.number().min(0).optional(),
  length: z.number().min(0).optional(),
  thigh: z.number().min(0).optional(),
  other: z.string().trim().optional(),
});

export type MeasurementsInput = z.infer<typeof measurementsZodSchema>;
