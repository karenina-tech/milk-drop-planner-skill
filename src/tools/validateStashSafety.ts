import { validateStashSafetyInputSchema } from '../schemas/stashSchema.js';
import { withUrgency } from '../domain/milkEngine.js';
import { TOOL_MESSAGES } from '../data/toolMessages.js';

export function validateStashSafetyTool(input: unknown) {
  const validation = validateStashSafetyInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: 'VALIDATION_FAILED', details: validation.error };
  }

  const { stash } = validation.data;
  const bags = withUrgency(stash, new Date());

  const expired = bags.filter((b) => b.urgency === 'expired').length;
  const expiring = bags.filter((b) => b.urgency === 'expiring').length;
  const soon = bags.filter((b) => b.urgency === 'soon').length;
  const safe = bags.filter((b) => b.urgency === 'safe').length;

  const allExpiredNote = expired === bags.length ? TOOL_MESSAGES.STASH_ALL_EXPIRED_NOTE : undefined;

  return {
    success: true,
    bags,
    summary: { total: bags.length, expired, expiring, soon, safe },
    allExpiredNote,
    disclaimer: TOOL_MESSAGES.DISCLAIMER,
  };
}
