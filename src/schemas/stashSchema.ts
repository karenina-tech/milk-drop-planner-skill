import { z } from 'zod';

export const STORAGE_LOCATIONS = ['ambient', 'fridge', 'freezer', 'ultra-freezer'] as const;
export type StorageLocation = (typeof STORAGE_LOCATIONS)[number];

const isoDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .refine(
    (date) => date <= new Date().toISOString().split('T')[0],
    'Pump date cannot be in the future',
  );

export const milkBagSchema = z.object({
  id: z.string().min(1),
  pumpDate: isoDate,
  volumeInOz: z.number().positive().max(20),
  location: z.enum(STORAGE_LOCATIONS),
});

export type MilkBag = z.infer<typeof milkBagSchema>;

export const checkBagSafetyInputSchema = z.object({
  pumpDate: isoDate,
  volumeInOz: z.number().positive().max(20),
  location: z.enum(STORAGE_LOCATIONS),
});

export type CheckBagSafetyInput = z.infer<typeof checkBagSafetyInputSchema>;

export const validateStashSafetyInputSchema = z.object({
  stash: z.array(milkBagSchema).min(1),
});

export type ValidateStashSafetyInput = z.infer<typeof validateStashSafetyInputSchema>;

export const calculateFifoScheduleInputSchema = z.object({
  stash: z.array(milkBagSchema).min(1),
  dailyTargetOz: z.number().positive(),
});

export type CalculateFifoScheduleInput = z.infer<typeof calculateFifoScheduleInputSchema>;
