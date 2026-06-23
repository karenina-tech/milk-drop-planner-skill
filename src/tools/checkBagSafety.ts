import { checkBagSafetyInputSchema } from '../schemas/stashSchema.js';
import { checkBagSafety } from '../domain/milkEngine.js';
import { TOOL_MESSAGES } from '../data/toolMessages.js';

export function checkBagSafetyTool(input: unknown) {
  const validation = checkBagSafetyInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: 'VALIDATION_FAILED', details: validation.error };
  }

  const { pumpDate, location } = validation.data;
  const result = checkBagSafety(pumpDate, location, new Date());

  return {
    success: true,
    ...result,
    expiredNote: result.isExpired ? TOOL_MESSAGES.EXPIRED_BAG_NOTE : undefined,
    disclaimer: TOOL_MESSAGES.DISCLAIMER,
  };
}
