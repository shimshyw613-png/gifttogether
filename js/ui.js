// Small helpers for building screens safely.
// Everything people type is escaped before it reaches the page.

export class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export function esc(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function piece(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(piece).join('');
  return esc(v);
}

// html`<p>${userText}</p>` escapes userText; nested html`` stays as markup.
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += piece(vals[i]);
  });
  return new Raw(out);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function money(cents) {
  const dollars = (cents || 0) / 100;
  return '$' + dollars.toLocaleString('en-US', {
    minimumFractionDigits: dollars % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function toCents(text) {
  const n = parseFloat(String(text).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

// Dates are stored as "YYYY-MM-DD"; read them without time-zone shifts.
export function parseDay(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function shortDate(s) {
  const p = parseDay(s);
  if (!p) return '';
  return `${MONTHS[p.m - 1]} ${p.d}`;
}

export function longDate(s) {
  const p = parseDay(s);
  if (!p) return '';
  const dt = new Date(p.y, p.m - 1, p.d);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function monthDay(m, d) {
  return `${MONTHS[m - 1]} ${d}`;
}

export function todayParts() {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
}

// Days from today until the next time month/day comes around (0 = today).
export function daysUntil(m, d) {
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  let next = new Date(t.getFullYear(), m - 1, d);
  if (next < today) next = new Date(t.getFullYear() + 1, m - 1, d);
  return Math.round((next - today) / 86400000);
}

// The year in which month/day next comes around (this year if it's today or later).
export function nextOccurrenceYear(m, d) {
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return new Date(t.getFullYear(), m - 1, d) < today ? t.getFullYear() + 1 : t.getFullYear();
}

export function whenLabel(days) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 14) return 'Next week';
  return `In ${Math.round(days / 7)} weeks`;
}

export function initials(name) {
  return (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const TONES = ['#FCEFD3', '#EDE5F6', '#E2F3EA', '#FDE3DC', '#DCEBFA'];
export function tone(key) {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export function avatar(name, key, size = 40) {
  return html`<span class="avatar" style="width:${size}px;height:${size}px;background:${tone(key || name)};font-size:${Math.round(size * 0.38)}px" aria-hidden="true">${initials(name)}</span>`;
}

let toastTimer;
export function toast(message, kind = 'ok') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.className = 'toast ' + kind;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// Turns a database error into something a person can read.
export function friendly(err) {
  const msg = (err && (err.message || err.error_description)) || String(err || 'Something went wrong');
  if (/row-level security|permission denied/i.test(msg)) return 'You don’t have permission to do that.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg;
}

export async function busy(button, fn) {
  if (button) { button.disabled = true; button.dataset.label = button.textContent; button.textContent = 'One moment…'; }
  try {
    return await fn();
  } catch (e) {
    toast(friendly(e), 'error');
    return undefined;
  } finally {
    if (button) { button.disabled = false; button.textContent = button.dataset.label; }
  }
}

// Inline stroke icons.
const PATHS = {
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  check: 'M5 12l5 5 9-10',
  calendar: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M8 3v4M16 3v4',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  gift: 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8c-2-4-6-4-6-1s6 1 6 1zM12 8c2-4 6-4 6-1s-6 1-6 1z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  key: 'M15 7a4 4 0 1 1-4 4M11 11l-8 8M6 16l2 2M9 13l2 2',
  cake: 'M4 21h16M5 21v-7h14v7M12 14V9M12 6V4M8 14v-2M16 14v-2',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  print: 'M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z',
  message: 'M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.5A8 8 0 1 1 21 12z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  share: 'M4 12v8h16v-8M12 3v12M8 7l4-4 4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
};
export function icon(name, size = 20) {
  return html`<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[name] || ''}"/></svg>`;
}

export function header(title, { back = '#/', sub = '' } = {}) {
  return html`<header class="bar">
    <a class="icon-btn" href="${back}" aria-label="Back">${icon('back', 22)}</a>
    <div class="bar-text"><h1>${title}</h1>${sub ? html`<p class="muted small">${sub}</p>` : ''}</div>
  </header>`;
}

export function csv(rows) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
}

export function downloadFile(filename, text, type = 'text/csv') {
  const blob = new Blob(['﻿' + text], { type: type + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function copyText(text, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    window.prompt('Copy this:', text);
  }
}
