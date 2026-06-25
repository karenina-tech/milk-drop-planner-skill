import * as fs from 'fs';
import * as path from 'path';
import type { BagWithUrgency, UrgencyLevel, FifoSchedule } from './milkEngine.js';
import type { MilkBag } from '../schemas/stashSchema.js';
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
  expired:  'Expired — Please discard',
  expiring: 'Expiring within 24 hours — Use today',
  soon:     'Use within 3 days',
  safe:     'Safe',
};

const STASH_SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const SECTION_ICONS: Record<UrgencyLevel, string> = {
  expired:  `<svg ${STASH_SVG_ATTRS}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  expiring: `<svg ${STASH_SVG_ATTRS}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  soon:     `<svg ${STASH_SVG_ATTRS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  safe:     `<svg ${STASH_SVG_ATTRS}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
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
          <td colspan="6"><div class="section-header-inner">${SECTION_ICONS[urgency]}${SECTION_LABELS[urgency]}</div></td>
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

const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const LOCATION_ICONS: Record<string, string> = {
  ambient:         `<svg class="bag-icon bag-icon-ambient" ${SVG_ATTRS}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
  fridge:          `<svg class="bag-icon bag-icon-fridge" ${SVG_ATTRS}><path d="M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z"/><path d="M5 10h14"/><path d="M15 7v6"/></svg>`,
  freezer:         `<svg class="bag-icon bag-icon-freezer" ${SVG_ATTRS}><line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg>`,
  'ultra-freezer': `<svg class="bag-icon bag-icon-ultra-freezer" ${SVG_ATTRS}><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" x2="8" y1="16" y2="16"/><line x1="8" x2="8" y1="20" y2="20"/><line x1="12" x2="12" y1="18" y2="18"/><line x1="12" x2="12" y1="22" y2="22"/><line x1="16" x2="16" y1="16" y2="16"/><line x1="16" x2="16" y1="20" y2="20"/></svg>`,
};

const CHECK_ICON = `<svg class="bag-icon bag-icon-check" ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;

export function compileScheduleReport(
  dailyTargetOz: number,
  stash: MilkBag[],
  schedule: FifoSchedule,
  generatedAt: string,
): string {
  const bagMap = new Map(stash.map((b) => [b.id, b]));

  const daysCovered   = schedule.days.filter((d) => d.shortfallOz === 0).length;
  const daysShortfall = schedule.days.filter((d) => d.shortfallOz > 0).length;
  const totalOz       = schedule.days.reduce((sum, d) => sum + d.totalOz, 0);

  const tableRowsHtml = schedule.days.map((day) => {
    const rowClass = day.totalOz === 0 ? 'row-empty' : day.shortfallOz > 0 ? 'row-shortfall' : '';

    const bagsHtml = day.servings.length === 0
      ? '<span class="none-value">—</span>'
      : `<ul class="bag-list">${day.servings.map((s) => {
          const bag = bagMap.get(s.bagId);
          const loc = bag?.location ?? 'fridge';
          const action = (loc === 'freezer' || loc === 'ultra-freezer') ? 'Defrost' : 'Use';
          const pumpDate = bag ? formatPumpDate(bag.pumpDate) : s.bagId;
          const locIcon = LOCATION_ICONS[loc] ?? LOCATION_ICONS.fridge;
          return `<li>${CHECK_ICON}${locIcon}${action} bag pumped ${pumpDate} · ${s.ouncesUsed} oz</li>`;
        }).join('')}</ul>`;

    const shortfallHtml = day.shortfallOz > 0
      ? `<span class="shortfall-value">−${day.shortfallOz} oz</span>`
      : '<span class="none-value">—</span>';

    return `
        <tr class="${rowClass}">
          <td class="col-day">${day.day}</td>
          <td class="col-date">${formatScheduleDate(day.date)}</td>
          <td class="col-bags">${bagsHtml}</td>
          <td class="col-oz">${day.totalOz} / ${dailyTargetOz} oz</td>
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
