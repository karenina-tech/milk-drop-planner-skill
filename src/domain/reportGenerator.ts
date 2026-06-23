import * as fs from 'fs';
import * as path from 'path';
import type { BagWithUrgency, UrgencyLevel } from './milkEngine.js';
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
