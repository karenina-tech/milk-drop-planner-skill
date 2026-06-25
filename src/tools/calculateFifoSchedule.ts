import { calculateFifoScheduleInputSchema } from '../schemas/stashSchema.js';
import { generateFifoSchedule } from '../domain/milkEngine.js';
import { TOOL_MESSAGES } from '../data/toolMessages.js';

export function calculateFifoScheduleTool(input: unknown) {
  const validation = calculateFifoScheduleInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: 'VALIDATION_FAILED', details: validation.error };
  }

  const { stash, dailyTargetOz } = validation.data;
  const schedule = generateFifoSchedule(stash, dailyTargetOz, new Date());

  return {
    success: true,
    dailyTargetOz,
    stash,
    schedule,
    disclaimer: TOOL_MESSAGES.DISCLAIMER,
  };
}
