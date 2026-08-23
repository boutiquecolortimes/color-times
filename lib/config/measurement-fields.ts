import type { MeasurementValues } from "@/models/shared/measurements";

export const MEASUREMENT_FIELD_DEFS: { key: keyof MeasurementValues; label: string }[] = [
  { key: "upperChest", label: "UC" },
  { key: "lowerChest", label: "LC" },
  { key: "sleeveLength", label: "Sleeves" },
  { key: "armhole", label: "Armhole" },
  { key: "shoulder", label: "Shoulder" },
  { key: "armLength", label: "Arm Length" },
  { key: "blouseLength", label: "Blouse Length" },
  { key: "neckFront", label: "Neck Front" },
  { key: "neckBack", label: "Neck Back" },
  { key: "waist", label: "Waist" },
  { key: "hip", label: "Hips" },
  { key: "length", label: "Length" },
  { key: "thigh", label: "Thighs" },
  { key: "bust", label: "Bust" },
];
