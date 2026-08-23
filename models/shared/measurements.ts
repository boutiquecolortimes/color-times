import { Schema } from "mongoose";

export interface MeasurementValues {
  bust?: number;
  waist?: number;
  hip?: number;
  shoulder?: number;
  sleeveLength?: number;
  blouseLength?: number;
  armhole?: number;
  neckFront?: number;
  neckBack?: number;
  upperChest?: number;
  lowerChest?: number;
  armLength?: number;
  length?: number;
  thigh?: number;
  other?: string;
}

export const measurementsSchema = new Schema<MeasurementValues>(
  {
    bust: { type: Number, min: 0 },
    waist: { type: Number, min: 0 },
    hip: { type: Number, min: 0 },
    shoulder: { type: Number, min: 0 },
    sleeveLength: { type: Number, min: 0 },
    blouseLength: { type: Number, min: 0 },
    armhole: { type: Number, min: 0 },
    neckFront: { type: Number, min: 0 },
    neckBack: { type: Number, min: 0 },
    upperChest: { type: Number, min: 0 },
    lowerChest: { type: Number, min: 0 },
    armLength: { type: Number, min: 0 },
    length: { type: Number, min: 0 },
    thigh: { type: Number, min: 0 },
    other: { type: String, trim: true },
  },
  { _id: false }
);
