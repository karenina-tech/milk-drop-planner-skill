import type { MilkBag, StorageLocation } from '../schemas/stashSchema.js';

const HOUR_MS = 60 * 60 * 1000;

// CDC & AAP storage guidelines (conservative end of each range)
const CDC_AAP_MAX_HOURS: Record<StorageLocation, number> = {
  ambient: 4,              // 4 hours (room temp ≤77°F / 25°C)
  fridge: 4 * 24,          // 96 hours (4 days, ≤40°F / 4°C)
  freezer: 6 * 30 * 24,    // ~4320 hours (6 months, 0°F / -18°C)
  'ultra-freezer': 12 * 30 * 24, // ~8640 hours (12 months, ≤-4°F / -20°C)
};

// Ported verbatim from the milk-drop-planner web app
const HANDLING_INSTRUCTIONS: Record<StorageLocation, string[]> = {
  ambient: [
    'Use within 4 hours of pumping — do not leave at room temperature longer.',
    'Keep away from direct sunlight and heat sources; room must be ≤77°F (25°C).',
    'Warm by placing the sealed bag in a bowl of warm water if needed.',
    'Never microwave breast milk — it creates hot spots and destroys nutrients.',
    'Swirl gently to mix separated fat; do not shake vigorously.',
    'Discard any milk left in the bottle after a feeding.',
  ],
  fridge: [
    'Use directly — no thawing needed.',
    'Warm by placing the sealed bag in a bowl of warm water for a few minutes.',
    'Never microwave breast milk — it creates hot spots and destroys nutrients.',
    'Swirl gently to mix separated fat; do not shake vigorously.',
    'Discard any milk left in the bottle after a feeding.',
  ],
  freezer: [
    'Thaw overnight in the refrigerator, or place the sealed bag in warm water.',
    'Once fully thawed, use within 24 hours — do not refreeze.',
    'Warm the thawed milk by placing the bag in a bowl of warm water.',
    'Never microwave frozen breast milk — it creates hot spots and destroys nutrients.',
    'Swirl gently to remix separated fat after thawing; do not shake.',
  ],
  'ultra-freezer': [
    'Thaw overnight in the refrigerator — avoid counter-thawing to preserve quality.',
    'Once fully thawed, use within 24 hours — do not refreeze.',
    'Warm the thawed milk by placing the bag in a bowl of warm water.',
    'Never microwave frozen breast milk — it creates hot spots and destroys nutrients.',
    'Swirl gently to remix separated fat after thawing; do not shake.',
    'Label bags clearly with pump date and use oldest bags first (FIFO).',
  ],
};

export type UrgencyLevel = 'expired' | 'expiring' | 'soon' | 'safe';

export interface BagSafetyResult {
  expiresAt: string;
  isExpired: boolean;
  status: 'safe' | 'expired';
  daysRemaining: number | null;
  handlingInstructions: string[];
}

export interface BagWithUrgency extends MilkBag {
  expiresAt: string;
  urgency: UrgencyLevel;
  daysRemaining: number | null;
}

export interface DayPlan {
  day: number;
  date: string;
  servings: Array<{ bagId: string; ouncesUsed: number }>;
  totalOz: number;
  shortfallOz: number;
}

export interface FifoSchedule {
  days: DayPlan[];
  unallocatedBagIds: string[];
}

function expiresAt(pumpDate: string, location: StorageLocation): Date {
  return new Date(new Date(pumpDate).getTime() + CDC_AAP_MAX_HOURS[location] * HOUR_MS);
}

export function checkBagSafety(pumpDate: string, location: StorageLocation, now: Date): BagSafetyResult {
  const expiry = expiresAt(pumpDate, location);
  const isExpired = now.getTime() >= expiry.getTime();
  const hoursLeft = (expiry.getTime() - now.getTime()) / HOUR_MS;

  return {
    expiresAt: expiry.toISOString(),
    isExpired,
    status: isExpired ? 'expired' : 'safe',
    daysRemaining: isExpired ? null : Math.floor(hoursLeft / 24),
    handlingInstructions: HANDLING_INSTRUCTIONS[location],
  };
}

export function withUrgency(bags: MilkBag[], now: Date): BagWithUrgency[] {
  return bags.map((bag) => {
    const expiry = expiresAt(bag.pumpDate, bag.location);
    const hoursLeft = (expiry.getTime() - now.getTime()) / HOUR_MS;
    const isExpired = now.getTime() >= expiry.getTime();
    const urgency: UrgencyLevel = isExpired
      ? 'expired'
      : hoursLeft < 24
        ? 'expiring'
        : hoursLeft < 72
          ? 'soon'
          : 'safe';

    return {
      ...bag,
      expiresAt: expiry.toISOString(),
      urgency,
      daysRemaining: isExpired ? null : Math.floor(hoursLeft / 24),
    };
  });
}

export function generateFifoSchedule(stash: MilkBag[], dailyTargetOz: number, now: Date): FifoSchedule {
  const sorted = [...stash]
    .filter((bag) => now.getTime() < expiresAt(bag.pumpDate, bag.location).getTime())
    .sort((a, b) => new Date(a.pumpDate).getTime() - new Date(b.pumpDate).getTime());

  const remaining = new Map(sorted.map((bag) => [bag.id, bag.volumeInOz]));
  const days: DayPlan[] = [];

  for (let d = 0; d < 7; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const servings: Array<{ bagId: string; ouncesUsed: number }> = [];
    let needed = dailyTargetOz;

    for (const bag of sorted) {
      if (needed <= 0) break;
      const avail = remaining.get(bag.id) ?? 0;
      if (avail <= 0) continue;
      const used = Math.min(avail, needed);
      servings.push({ bagId: bag.id, ouncesUsed: used });
      remaining.set(bag.id, avail - used);
      needed -= used;
    }

    days.push({
      day: d + 1,
      date: date.toISOString().split('T')[0],
      servings,
      totalOz: dailyTargetOz - needed,
      shortfallOz: Math.max(0, needed),
    });
  }

  const unallocatedBagIds = sorted
    .filter((bag) => (remaining.get(bag.id) ?? 0) > 0)
    .map((b) => b.id);

  return { days, unallocatedBagIds };
}
