import * as fs from 'fs';
import * as path from 'path';
import type { BagWithUrgency, UrgencyLevel, FifoSchedule } from './milkEngine.js';
import { TOOL_MESSAGES } from '../data/toolMessages.js';

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'stash-report.html');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatPumpDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function formatExpiryDate(isoTimestamp: string): string {
  const dt = new Date(isoTimestamp);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

function locationLabel(location: string): string {
  switch (location) {
    case 'ambient':      return 'Counter';
    case 'fridge':       return 'Fridge';
    case 'freezer':      return 'Freezer';
    case 'ultra-freezer': return 'Deep Freezer';
    default:             return location;
  }
}

const URGENCY_ORDER: UrgencyLevel[] = ['expired', 'expiring', 'soon', 'safe'];

const SECTION_LABELS: Record<UrgencyLevel, string> = {
  expired:  '🚨 Expired — Please discard',
  expiring: '⚠️ Expiring within 24 hours — Use today',
  soon:     '⏳ Use within 3 days',
  safe:     '✅ Safe',
};

const BADGE_LABELS: Record<UrgencyLevel, string> = {
  expired:  'Expired',
  expiring: 'Expiring',
  soon:     'Use soon',
  safe:     'Safe',
};

export function compileStashReport(bags: BagWithUrgency[], generatedAt: string): string {
  const counts = {
    total:    bags.length,
    expired:  bags.filter((b) => b.urgency === 'expired').length,
    expiring: bags.filter((b) => b.urgency === 'expiring').length,
    soon:     bags.filter((b) => b.urgency === 'soon').length,
    safe:     bags.filter((b) => b.urgency === 'safe').length,
  };

  const tableRowsHtml = URGENCY_ORDER
    .filter((urgency) => bags.some((b) => b.urgency === urgency))
    .flatMap((urgency) => {
      const groupBags = bags.filter((b) => b.urgency === urgency);

      const sectionRow = `
        <tr class="section-header section-${urgency}">
          <td colspan="6">${SECTION_LABELS[urgency]}</td>
        </tr>`;

      const bagRows = groupBags.map((bag) => `
        <tr>
          <td class="col-id">${bag.id}</td>
          <td class="col-date">${formatPumpDate(bag.pumpDate)}</td>
          <td class="col-loc">${locationLabel(bag.location)}</td>
          <td class="col-vol">${bag.volumeInOz} oz</td>
          <td class="col-exp">${formatExpiryDate(bag.expiresAt)}</td>
          <td class="col-status"><span class="badge badge-${urgency}">${BADGE_LABELS[urgency]}</span></td>
        </tr>`);

      return [sectionRow, ...bagRows];
    })
    .join('');

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  return template
    .replace('{{GENERATED_AT}}', generatedAt)
    .replace('{{TOTAL}}',    String(counts.total))
    .replace('{{EXPIRED}}',  String(counts.expired))
    .replace('{{EXPIRING}}', String(counts.expiring))
    .replace('{{SOON}}',     String(counts.soon))
    .replace('{{SAFE}}',     String(counts.safe))
    .replace('{{TABLE_ROWS}}', tableRowsHtml)
    .replace('{{DISCLAIMER}}', TOOL_MESSAGES.DISCLAIMER);
}

const SCHEDULE_TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'schedule-report.html');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatScheduleDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dow = DAY_NAMES[new Date(y, m - 1, d).getDay()];
  return `${dow}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function compileScheduleReport(
  dailyTargetOz: number,
  schedule: FifoSchedule,
  generatedAt: string,
): string {
  const daysCovered  = schedule.days.filter((d) => d.shortfallOz === 0).length;
  const daysShortfall = schedule.days.filter((d) => d.shortfallOz > 0).length;
  const totalOz = schedule.days.reduce((sum, d) => sum + d.totalOz, 0);

  const tableRowsHtml = schedule.days.map((day) => {
    const rowClass = day.totalOz === 0 ? 'row-empty' : day.shortfallOz > 0 ? 'row-shortfall' : '';

    const bagsHtml = day.servings.length === 0
      ? '<span class="none-value">—</span>'
      : `<ul class="bag-list">${day.servings.map((s) =>
          `<li>${s.bagId}<span>(${s.ouncesUsed} oz)</span></li>`
        ).join('')}</ul>`;

    const shortfallHtml = day.shortfallOz > 0
      ? `<span class="shortfall-value">${day.shortfallOz} oz</span>`
      : '<span class="none-value">—</span>';

    return `
        <tr class="${rowClass}">
          <td class="col-day">${day.day}</td>
          <td class="col-date">${formatScheduleDate(day.date)}</td>
          <td class="col-bags">${bagsHtml}</td>
          <td class="col-oz">${day.totalOz} oz</td>
          <td class="col-shortfall">${shortfallHtml}</td>
        </tr>`;
  }).join('');

  const unallocatedNote = schedule.unallocatedBagIds.length > 0
    ? `<div class="unallocated-box">
        <strong>📦 Bags not needed this week</strong>
        The following bags were not required to meet the 7-day target and remain in your stash: ${schedule.unallocatedBagIds.join(', ')}.
      </div>`
    : '';

  const template = fs.readFileSync(SCHEDULE_TEMPLATE_PATH, 'utf-8');

  return template
    .replace('{{GENERATED_AT}}',  generatedAt)
    .replace('{{DAILY_TARGET}}',  String(dailyTargetOz))
    .replace('{{DAYS_COVERED}}',  String(daysCovered))
    .replace('{{DAYS_SHORTFALL}}', String(daysShortfall))
    .replace('{{TOTAL_OZ}}',      String(Math.round(totalOz * 10) / 10))
    .replace('{{TABLE_ROWS}}',    tableRowsHtml)
    .replace('{{UNALLOCATED_NOTE}}', unallocatedNote)
    .replace('{{DISCLAIMER}}',    TOOL_MESSAGES.DISCLAIMER);
}
