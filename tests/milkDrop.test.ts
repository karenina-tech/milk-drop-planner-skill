import { describe, test, expect } from 'vitest';
import { checkBagSafety, withUrgency, generateFifoSchedule } from '../src/domain/milkEngine.js';
import { checkBagSafetyTool } from '../src/tools/checkBagSafety.js';
import { validateStashSafetyTool } from '../src/tools/validateStashSafety.js';
import { calculateFifoScheduleTool } from '../src/tools/calculateFifoSchedule.js';

// ── Time fixtures ─────────────────────────────────────────────────────────────
// Domain functions accept `now` explicitly so all expiry assertions are
// deterministic regardless of when the suite runs.
//
// Reference point: 2026-06-23 at noon UTC.
// NOW_2AM is used only for the ambient-safe case where we need to be inside
// the 4-hour window (midnight + 4 h = 04:00 UTC; 02:00 is safely before that).

const NOW_NOON = new Date('2026-06-23T12:00:00Z');
const NOW_2AM  = new Date('2026-06-23T02:00:00Z');

// ── checkBagSafety — ambient (4-hour window) ──────────────────────────────────

describe('checkBagSafety — ambient (4-hour window)', () => {
	test('a bag pumped today is safe when checked inside the 4-hour window', () => {
		// new Date('2026-06-23') === 2026-06-23T00:00:00Z → expires at T04:00Z
		// NOW_2AM (T02:00Z) is still within the window
		const result = checkBagSafety('2026-06-23', 'ambient', NOW_2AM);

		expect(result.isExpired).toBe(false);
		expect(result.status).toBe('safe');
		expect(result.daysRemaining).toBe(0);
	});

	test('a bag pumped yesterday is expired — ambient limit is 4 hours', () => {
		// '2026-06-22' expires at 2026-06-22T04:00Z; NOW_NOON is well past that
		const result = checkBagSafety('2026-06-22', 'ambient', NOW_NOON);

		expect(result.isExpired).toBe(true);
		expect(result.status).toBe('expired');
		expect(result.daysRemaining).toBeNull();
	});
});

// ── checkBagSafety — fridge (4-day / 96-hour window) ─────────────────────────

describe('checkBagSafety — fridge (4-day window)', () => {
	test('a bag pumped 2 days ago is safe with 1 day remaining', () => {
		// '2026-06-21' + 96 h → expires 2026-06-25T00:00Z
		// NOW_NOON = 2026-06-23T12:00Z → 36 h left → daysRemaining: 1
		const result = checkBagSafety('2026-06-21', 'fridge', NOW_NOON);

		expect(result.isExpired).toBe(false);
		expect(result.daysRemaining).toBe(1);
	});

	test('a bag pumped 5 days ago is expired — fridge limit is 4 days', () => {
		// '2026-06-18' + 96 h → expires 2026-06-22T00:00Z; before NOW_NOON
		const result = checkBagSafety('2026-06-18', 'fridge', NOW_NOON);

		expect(result.isExpired).toBe(true);
		expect(result.daysRemaining).toBeNull();
	});
});

// ── checkBagSafety — freezer (6-month window) ────────────────────────────────

describe('checkBagSafety — freezer (6-month window)', () => {
	test('a bag pumped 3 months ago is safe', () => {
		// '2026-04-01' + 4320 h (~180 days) → expires ~2026-09-28
		const result = checkBagSafety('2026-04-01', 'freezer', NOW_NOON);

		expect(result.isExpired).toBe(false);
		expect(result.daysRemaining).toBeGreaterThan(0);
	});

	test('a bag pumped 7 months ago is expired — freezer limit is 6 months', () => {
		// '2025-11-01' + 180 days → expires ~2026-04-30; before NOW_NOON
		const result = checkBagSafety('2025-11-01', 'freezer', NOW_NOON);

		expect(result.isExpired).toBe(true);
	});
});

// ── checkBagSafety — ultra-freezer (12-month window) ─────────────────────────

describe('checkBagSafety — ultra-freezer (12-month window)', () => {
	test('a bag pumped 8 months ago is safe', () => {
		// '2025-10-01' + 8640 h (~360 days) → expires ~2026-09-26
		const result = checkBagSafety('2025-10-01', 'ultra-freezer', NOW_NOON);

		expect(result.isExpired).toBe(false);
		expect(result.daysRemaining).toBeGreaterThan(0);
	});

	test('a bag pumped 13 months ago is expired — ultra-freezer limit is 12 months', () => {
		// '2025-05-01' + 360 days → expires ~2026-04-26; before NOW_NOON
		const result = checkBagSafety('2025-05-01', 'ultra-freezer', NOW_NOON);

		expect(result.isExpired).toBe(true);
	});
});

// ── checkBagSafety — response shape ──────────────────────────────────────────

describe('checkBagSafety — response shape', () => {
	test('every location returns a non-empty handling instructions list', () => {
		const locations = ['ambient', 'fridge', 'freezer', 'ultra-freezer'] as const;
		for (const loc of locations) {
			const pumpDate = loc === 'ambient' ? '2026-06-23' : '2026-06-21';
			const now       = loc === 'ambient' ? NOW_2AM    : NOW_NOON;
			const result = checkBagSafety(pumpDate, loc, now);
			expect(result.handlingInstructions.length).toBeGreaterThan(0);
		}
	});

	test('ambient and freezer return different handling instructions', () => {
		const ambient = checkBagSafety('2026-06-23', 'ambient', NOW_2AM);
		const freezer = checkBagSafety('2026-04-01', 'freezer', NOW_NOON);

		expect(ambient.handlingInstructions).not.toEqual(freezer.handlingInstructions);
	});

	test('an expired bag returns a truthy expiresAt and null daysRemaining', () => {
		const result = checkBagSafety('2026-06-18', 'fridge', NOW_NOON);

		expect(result.expiresAt).toBeTruthy();
		expect(result.daysRemaining).toBeNull();
	});
});

// ── checkBagSafetyTool — input validation ────────────────────────────────────

describe('checkBagSafetyTool — input validation', () => {
	test('missing pumpDate returns a validation failure', () => {
		const result = checkBagSafetyTool({ volumeInOz: 4, location: 'fridge' }) as any;

		expect(result.success).toBe(false);
		expect(result.error).toBe('VALIDATION_FAILED');
	});

	test('an unrecognised location value returns a validation failure', () => {
		const result = checkBagSafetyTool({ pumpDate: '2026-06-21', volumeInOz: 4, location: 'countertop' }) as any;

		expect(result.success).toBe(false);
		expect(result.error).toBe('VALIDATION_FAILED');
	});

	test('a volume above 20 oz returns a validation failure', () => {
		const result = checkBagSafetyTool({ pumpDate: '2026-06-21', volumeInOz: 25, location: 'fridge' }) as any;

		expect(result.success).toBe(false);
		expect(result.error).toBe('VALIDATION_FAILED');
	});

	test('a zero volume returns a validation failure — volume must be positive', () => {
		const result = checkBagSafetyTool({ pumpDate: '2026-06-21', volumeInOz: 0, location: 'fridge' }) as any;

		expect(result.success).toBe(false);
		expect(result.error).toBe('VALIDATION_FAILED');
	});

	test('a pumpDate not in YYYY-MM-DD format returns a validation failure', () => {
		const result = checkBagSafetyTool({ pumpDate: '06/21/2026', volumeInOz: 4, location: 'fridge' }) as any;

		expect(result.success).toBe(false);
		expect(result.error).toBe('VALIDATION_FAILED');
	});
});

// ── withUrgency — urgency classification ─────────────────────────────────────
//
// Reference: NOW_NOON = 2026-06-23T12:00Z, fridge 96-hour window.
//
//   expired  — pumpDate 2026-06-18 → expires 2026-06-22T00:00Z (past)
//   expiring — pumpDate 2026-06-20 → expires 2026-06-24T00:00Z (12 h left)
//   soon     — pumpDate 2026-06-21 → expires 2026-06-25T00:00Z (36 h left)
//   safe     — pumpDate 2026-06-23 → expires 2026-06-27T00:00Z (84 h left)

describe('withUrgency — urgency classification', () => {
	const makeFridgeBag = (id: string, pumpDate: string) => ({
		id,
		pumpDate,
		volumeInOz: 4,
		location: 'fridge' as const,
	});

	test('a bag past its storage window is classified as expired', () => {
		const [bag] = withUrgency([makeFridgeBag('b1', '2026-06-18')], NOW_NOON);

		expect(bag.urgency).toBe('expired');
		expect(bag.daysRemaining).toBeNull();
	});

	test('a bag expiring within 24 hours is classified as expiring', () => {
		const [bag] = withUrgency([makeFridgeBag('b1', '2026-06-20')], NOW_NOON);

		expect(bag.urgency).toBe('expiring');
	});

	test('a bag expiring within 72 hours (but not 24) is classified as soon', () => {
		const [bag] = withUrgency([makeFridgeBag('b1', '2026-06-21')], NOW_NOON);

		expect(bag.urgency).toBe('soon');
	});

	test('a bag with more than 72 hours remaining is classified as safe', () => {
		const [bag] = withUrgency([makeFridgeBag('b1', '2026-06-23')], NOW_NOON);

		expect(bag.urgency).toBe('safe');
	});
});

// ── validateStashSafetyTool — stash overview ─────────────────────────────────

describe('validateStashSafetyTool — stash overview', () => {
	test('a stash where every bag has expired returns the all-expired note', () => {
		// Dates far enough in the past to be expired regardless of when this runs
		const result = validateStashSafetyTool({
			stash: [
				{ id: 'bag-1', pumpDate: '2024-01-01', volumeInOz: 4, location: 'fridge' },
				{ id: 'bag-2', pumpDate: '2024-02-01', volumeInOz: 3, location: 'fridge' },
			],
		}) as any;

		expect(result.success).toBe(true);
		expect(result.allExpiredNote).toBeDefined();
		expect(result.summary.expired).toBe(2);
	});

	test('an empty stash array returns a validation failure', () => {
		const result = validateStashSafetyTool({ stash: [] }) as any;

		expect(result.success).toBe(false);
		expect(result.error).toBe('VALIDATION_FAILED');
	});

	test('a valid stash always returns a disclaimer', () => {
		const result = validateStashSafetyTool({
			stash: [{ id: 'bag-1', pumpDate: '2024-01-01', volumeInOz: 4, location: 'fridge' }],
		}) as any;

		expect(result.disclaimer).toBeTruthy();
	});
});

// ── calculateFifoScheduleTool — input validation ─────────────────────────────

describe('calculateFifoScheduleTool — input validation', () => {
	test('missing dailyTargetOz returns a validation failure', () => {
		const result = calculateFifoScheduleTool({
			stash: [{ id: 'bag-1', pumpDate: '2026-06-23', volumeInOz: 4, location: 'fridge' }],
		}) as any;

		expect(result.success).toBe(false);
		expect(result.error).toBe('VALIDATION_FAILED');
	});
});

// ── generateFifoSchedule — FIFO ordering ─────────────────────────────────────

describe('generateFifoSchedule — FIFO ordering', () => {
	test('the oldest bag is consumed before the newer one', () => {
		// Deliberately pass them in newest-first order to confirm the sort
		const stash = [
			{ id: 'bag-new', pumpDate: '2026-06-23', volumeInOz: 3, location: 'fridge' as const },
			{ id: 'bag-old', pumpDate: '2026-06-21', volumeInOz: 3, location: 'fridge' as const },
		];

		const schedule = generateFifoSchedule(stash, 3, NOW_NOON);

		expect(schedule.days[0].servings[0].bagId).toBe('bag-old');
	});
});

// ── generateFifoSchedule — shortfall ─────────────────────────────────────────

describe('generateFifoSchedule — shortfall', () => {
	test('when the daily target exceeds the stash a shortfall is reported per day', () => {
		const stash = [{ id: 'bag-1', pumpDate: '2026-06-23', volumeInOz: 2, location: 'fridge' as const }];

		const schedule = generateFifoSchedule(stash, 5, NOW_NOON);

		// Day 1: bag-1 provides 2 oz of the 5 oz target → shortfall 3
		expect(schedule.days[0].shortfallOz).toBe(3);
		// Day 2+: bag is exhausted → full shortfall
		expect(schedule.days[1].shortfallOz).toBe(5);
	});
});

// ── generateFifoSchedule — expired bags excluded ─────────────────────────────

describe('generateFifoSchedule — expired bags excluded', () => {
	test('an expired bag is never allocated to any day in the schedule', () => {
		const stash = [
			{ id: 'bag-expired', pumpDate: '2026-06-18', volumeInOz: 5, location: 'fridge' as const },
			{ id: 'bag-fresh',   pumpDate: '2026-06-23', volumeInOz: 3, location: 'fridge' as const },
		];

		const schedule = generateFifoSchedule(stash, 3, NOW_NOON);
		const allBagIds = schedule.days.flatMap((d) => d.servings.map((s) => s.bagId));

		expect(allBagIds).not.toContain('bag-expired');
		expect(allBagIds).toContain('bag-fresh');
	});
});

// ── generateFifoSchedule — schedule length ───────────────────────────────────

describe('generateFifoSchedule — schedule length', () => {
	test('the plan always covers exactly 7 days', () => {
		const stash = [{ id: 'bag-1', pumpDate: '2026-06-23', volumeInOz: 5, location: 'fridge' as const }];

		const schedule = generateFifoSchedule(stash, 3, NOW_NOON);

		expect(schedule.days).toHaveLength(7);
	});
});
