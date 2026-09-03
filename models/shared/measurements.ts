import { Schema } from "mongoose";

// Stored as strings, not numbers — tailoring measurements sometimes need
// more than one value in a single field (multiple sizes on a bulk order,
// e.g. "4 50 59" or "4,5,6"), which a numeric field can't hold at all.
export interface MeasurementValues {
  bust?: string;
  waist?: string;
  hip?: string;
  shoulder?: string;
  sleeveLength?: string;
  blouseLength?: string;
  armhole?: string;
  neckFront?: string;
  neckBack?: string;
  upperChest?: string;
  lowerChest?: string;
  armLength?: string;
  length?: string;
  thigh?: string;
  other?: string;
}

export const measurementsSchema = new Schema<MeasurementValues>(
  {
    bust: { type: String, trim: true },
    waist: { type: String, trim: true },
    hip: { type: String, trim: true },
    shoulder: { type: String, trim: true },
    sleeveLength: { type: String, trim: true },
    blouseLength: { type: String, trim: true },
    armhole: { type: String, trim: true },
    neckFront: { type: String, trim: true },
    neckBack: { type: String, trim: true },
    upperChest: { type: String, trim: true },
    lowerChest: { type: String, trim: true },
    armLength: { type: String, trim: true },
    length: { type: String, trim: true },
    thigh: { type: String, trim: true },
    other: { type: String, trim: true },
  },
  { _id: false }
);
