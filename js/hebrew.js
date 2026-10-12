// The Jewish calendar: Hebrew dates, Yomim Tovim, fasts, Rosh Chodesh,
// and Shabbos candle-lighting and havdalah times.
// Hebrew date math follows the standard arithmetic calendar (Reingold &
// Dershowitz, "Calendrical Calculations"). Sun times use the NOAA solar formulas.

// ------------------------------------------------------------ day numbers
// Days are counted as "fixed" day numbers: 1 = Monday, January 1 of year 1.
const UNIX_EPOCH_FIXED = 719163; // 1970-01-01

export function fixedFromGregorian(y, m, d) {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000) + UNIX_EPOCH_FIXED;
}

export function gregorianFromFixed(fixed) {
  const dt = new Date((fixed - UNIX_EPOCH_FIXED) * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function todayFixed() {
  const t = new Date();
  return fixedFromGregorian(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

export function dayOfWeek(fixed) {
  return ((fixed % 7) + 7) % 7; // 0 = Sunday ... 6 = Shabbos
}

// ------------------------------------------------------------ Hebrew calendar
// Months: 1 Nisan, 2 Iyar, 3 Sivan, 4 Tammuz, 5 Av, 6 Elul, 7 Tishrei,
// 8 Cheshvan, 9 Kislev, 10 Teves, 11 Shevat, 12 Adar (Adar I in a leap year), 13 Adar II.
const HEBREW_EPOCH = -1373427;
export const NISAN = 1, IYAR = 2, SIVAN = 3, TAMMUZ = 4, AV = 5, ELUL = 6, TISHREI = 7,
  CHESHVAN = 8, KISLEV = 9, TEVES = 10, SHEVAT = 11, ADAR = 12, ADAR2 = 13;

export function isLeapYear(y) {
  return ((7 * y + 1) % 19 + 19) % 19 < 7;
}

function lastMonthOfYear(y) {
  return isLeapYear(y) ? 13 : 12;
}

const elapsedCache = new Map();
function calendarElapsedDays(y) {
  if (elapsedCache.has(y)) return elapsedCache.get(y);
  const monthsElapsed = Math.floor((235 * y - 234) / 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  const days = 29 * monthsElapsed + Math.floor(partsElapsed / 25920);
  const out = ((3 * (days + 1)) % 7 + 7) % 7 < 3 ? days + 1 : days;
  elapsedCache.set(y, out);
  return out;
}

function yearLengthCorrection(y) {
  const ny0 = calendarElapsedDays(y - 1);
  const ny1 = calendarElapsedDays(y);
  const ny2 = calendarElapsedDays(y + 1);
  if (ny2 - ny1 === 356) return 2;
  if (ny1 - ny0 === 382) return 1;
  return 0;
}

export function hebrewNewYear(y) {
  return HEBREW_EPOCH + calendarElapsedDays(y) + yearLengthCorrection(y);
}

function daysInYear(y) {
  return hebrewNewYear(y + 1) - hebrewNewYear(y);
}

export function daysInMonth(m, y) {
  const len = daysInYear(y);
  const longCheshvan = len === 355 || len === 385;
  const shortKislev = len === 353 || len === 383;
  if ([2, 4, 6, 10, 13].includes(m)) return 29;
  if (m === 12 && !isLeapYear(y)) return 29;
  if (m === 8 && !longCheshvan) return 29;
  if (m === 9 && shortKislev) return 29;
  return 30;
}

export function fixedFromHebrew(y, m, d) {
  let total = hebrewNewYear(y) + d - 1;
  if (m < TISHREI) {
    for (let mm = TISHREI; mm <= lastMonthOfYear(y); mm++) total += daysInMonth(mm, y);
    for (let mm = NISAN; mm < m; mm++) total += daysInMonth(mm, y);
  } else {
    for (let mm = TISHREI; mm < m; mm++) total += daysInMonth(mm, y);
  }
  return total;
}

export function hebrewFromFixed(fixed) {
  const approx = Math.floor((fixed - HEBREW_EPOCH) / (35975351 / 98496)) + 1;
  let y = approx - 1;
  while (hebrewNewYear(y + 1) <= fixed) y++;
  const start = fixed < fixedFromHebrew(y, NISAN, 1) ? TISHREI : NISAN;
  let m = start;
  while (fixed > fixedFromHebrew(y, m, daysInMonth(m, y))) m = m === lastMonthOfYear(y) ? NISAN : m + 1;
  return { y, m, d: fixed - fixedFromHebrew(y, m, 1) + 1 };
}

// ------------------------------------------------------------ names
// Ashkenazi and Sephardi families spell (and say) things differently.
const MONTHS = {
  ashkenazi: ['', 'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 'Tishrei', 'Cheshvan', 'Kislev', 'Teves', 'Shevat', 'Adar', 'Adar II'],
  sephardi: ['', 'Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar II'],
};

export function monthName(m, y, style = 'ashkenazi') {
  const names = MONTHS[style] || MONTHS.ashkenazi;
  if (m === ADAR && y && isLeapYear(y)) return 'Adar I';
  return names[m];
}

// Months to offer when someone picks a Hebrew date (for a yahrzeit, say).
export function monthChoices(style = 'ashkenazi') {
  const order = [TISHREI, CHESHVAN, KISLEV, TEVES, SHEVAT, ADAR, ADAR2, NISAN, IYAR, SIVAN, TAMMUZ, AV, ELUL];
  return order.map((m) => ({ value: m, label: m === ADAR ? 'Adar (Adar I in a leap year)' : (MONTHS[style] || MONTHS.ashkenazi)[m] }));
}

export function formatHebrew(h, style = 'ashkenazi', withYear = true) {
  return `${h.d} ${monthName(h.m, h.y, style)}${withYear ? ' ' + h.y : ''}`;
}

const WORDS = {
  ashkenazi: {
    shabbos: 'Shabbos', rh: 'Rosh Hashanah', yk: 'Yom Kippur', sukkos: 'Sukkos', chm: 'Chol Hamoed',
    hr: 'Hoshana Rabbah', sa: 'Shemini Atzeres', st: 'Simchas Torah', chanukah: 'Chanukah',
    tubshvat: 'Tu B’Shvat', purim: 'Purim', shushan: 'Shushan Purim', purimKatan: 'Purim Katan',
    pesach: 'Pesach', lag: 'Lag BaOmer', shavuos: 'Shavuos', gedalia: 'Tzom Gedalyah',
    teves10: 'Asarah B’Teves', esther: 'Ta’anis Esther', tammuz17: 'Shivah Asar B’Tammuz',
    tishaBav: 'Tishah B’Av', rc: 'Rosh Chodesh',
  },
  sephardi: {
    shabbos: 'Shabbat', rh: 'Rosh Hashanah', yk: 'Yom Kippur', sukkos: 'Sukkot', chm: 'Chol Hamoed',
    hr: 'Hoshana Rabbah', sa: 'Shemini Atzeret', st: 'Simchat Torah', chanukah: 'Chanukah',
    tubshvat: 'Tu Bishvat', purim: 'Purim', shushan: 'Shushan Purim', purimKatan: 'Purim Katan',
    pesach: 'Pesach', lag: 'Lag BaOmer', shavuos: 'Shavuot', gedalia: 'Tzom Gedalyah',
    teves10: 'Asara BeTevet', esther: 'Ta’anit Esther', tammuz17: 'Shiva Asar BeTammuz',
    tishaBav: 'Tisha BeAv', rc: 'Rosh Chodesh',
  },
};

export function word(key, style = 'ashkenazi') {
  return (WORDS[style] || WORDS.ashkenazi)[key];
}

// ------------------------------------------------------------ holidays
// kind: 'yomtov' (work forbidden), 'cholhamoed', 'fast', 'minor', 'roshchodesh'
export function holidaysOfYear(y, { israel = false, style = 'ashkenazi' } = {}) {
  const w = (k) => word(k, style);
  const list = [];
  const add = (m, d, name, kind) => list.push({ fixed: fixedFromHebrew(y, m, d), name, kind });
  const addFixed = (fixed, name, kind) => list.push({ fixed, name, kind });
  // A fast that would fall on Shabbos moves to Sunday (Ta'anis Esther moves to Thursday).
  const fast = (m, d, name) => {
    let f = fixedFromHebrew(y, m, d);
    if (dayOfWeek(f) === 6) f += 1;
    addFixed(f, name, 'fast');
  };

  add(TISHREI, 1, `${w('rh')} I`, 'yomtov');
  add(TISHREI, 2, `${w('rh')} II`, 'yomtov');
  fast(TISHREI, 3, w('gedalia'));
  add(TISHREI, 10, w('yk'), 'yomtov');
  add(TISHREI, 15, `${w('sukkos')} I`, 'yomtov');
  if (israel) add(TISHREI, 16, `${w('sukkos')} (${w('chm')})`, 'cholhamoed');
  else add(TISHREI, 16, `${w('sukkos')} II`, 'yomtov');
  for (let d = 17; d <= 20; d++) add(TISHREI, d, `${w('sukkos')} (${w('chm')})`, 'cholhamoed');
  add(TISHREI, 21, w('hr'), 'cholhamoed');
  if (israel) add(TISHREI, 22, `${w('sa')} / ${w('st')}`, 'yomtov');
  else { add(TISHREI, 22, w('sa'), 'yomtov'); add(TISHREI, 23, w('st'), 'yomtov'); }

  const chanukah = fixedFromHebrew(y, KISLEV, 25);
  for (let i = 0; i < 8; i++) addFixed(chanukah + i, `${w('chanukah')}: ${i + 1} candle${i ? 's' : ''}`, 'minor');
  fast(TEVES, 10, w('teves10'));
  add(SHEVAT, 15, w('tubshvat'), 'minor');

  const purimMonth = isLeapYear(y) ? ADAR2 : ADAR;
  if (isLeapYear(y)) add(ADAR, 14, w('purimKatan'), 'minor');
  let esther = fixedFromHebrew(y, purimMonth, 13);
  if (dayOfWeek(esther) === 6) esther -= 2;
  addFixed(esther, w('esther'), 'fast');
  add(purimMonth, 14, w('purim'), 'minor');
  add(purimMonth, 15, w('shushan'), 'minor');

  add(NISAN, 15, `${w('pesach')} I`, 'yomtov');
  if (israel) add(NISAN, 16, `${w('pesach')} (${w('chm')})`, 'cholhamoed');
  else add(NISAN, 16, `${w('pesach')} II`, 'yomtov');
  for (let d = 17; d <= 20; d++) add(NISAN, d, `${w('pesach')} (${w('chm')})`, 'cholhamoed');
  add(NISAN, 21, `${w('pesach')} VII`, 'yomtov');
  if (!israel) add(NISAN, 22, `${w('pesach')} VIII`, 'yomtov');
  add(IYAR, 18, w('lag'), 'minor');
  add(SIVAN, 6, `${w('shavuos')} I`, 'yomtov');
  if (!israel) add(SIVAN, 7, `${w('shavuos')} II`, 'yomtov');
  fast(TAMMUZ, 17, w('tammuz17'));
  fast(AV, 9, w('tishaBav'));

  // Rosh Chodesh: the 30th of a full month, and the 1st (not Tishrei, which is Rosh Hashanah).
  for (let m = 1; m <= lastMonthOfYear(y); m++) {
    if (m === TISHREI) continue;
    const name = `${w('rc')} ${monthName(m, y, style)}`;
    // Within one Hebrew year the months run Tishrei..Adar, then Nisan..Elul,
    // so the month before Nisan is the year's last Adar.
    const prev = m === NISAN ? lastMonthOfYear(y) : m - 1;
    if (daysInMonth(prev, y) === 30) addFixed(fixedFromHebrew(y, m, 1) - 1, name, 'roshchodesh');
    add(m, 1, name, 'roshchodesh');
  }
  return list;
}

// Holidays between two fixed days (inclusive), soonest first.
export function holidaysBetween(from, to, opts = {}) {
  const ys = new Set([hebrewFromFixed(from).y, hebrewFromFixed(to).y]);
  const all = [];
  for (const y of ys) all.push(...holidaysOfYear(y, opts));
  const seen = new Set();
  return all
    .filter((h) => h.fixed >= from && h.fixed <= to)
    .filter((h) => { const k = h.fixed + h.name; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.fixed - b.fixed);
}

// The next fixed day (from `from` on) when a Hebrew date comes around,
// for yahrzeits and Hebrew birthdays. A date in Adar of a plain year is kept in
// Adar II of a leap year, and the 30th of a short month moves to the 1st
// of the next month (common custom; families can note their own).
export function nextHebrewAnniversary(m, d, from) {
  const startYear = hebrewFromFixed(from).y;
  for (let y = startYear; y <= startYear + 2; y++) {
    let mm = m;
    if (m === ADAR2 && !isLeapYear(y)) mm = ADAR;
    if (m === ADAR && isLeapYear(y)) mm = ADAR2;
    let fixed;
    if (d === 30 && daysInMonth(mm, y) === 29) fixed = fixedFromHebrew(y, mm, 29) + 1;
    else fixed = fixedFromHebrew(y, mm, d);
    if (fixed >= from) return fixed;
  }
  return null;
}

// ------------------------------------------------------------ sun times
// Sunset for a day, as minutes after midnight UTC (NOAA approximation, about a minute accurate).
export function sunsetUtcMinutes(y, m, d, lat, lon) {
  const n = fixedFromGregorian(y, m, d) - fixedFromGregorian(y, 1, 1) + 1;
  const yearDays = isGregorianLeap(y) ? 366 : 365;
  const g = (2 * Math.PI / yearDays) * (n - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const rad = Math.PI / 180;
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosHa < -1 || cosHa > 1) return null; // no sunset (far north)
  const ha = Math.acos(cosHa) / rad;
  return 720 - 4 * (lon - ha) - eqTime;
}

function isGregorianLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function instant(y, m, d, utcMinutes) {
  return new Date(Date.UTC(y, m - 1, d) + Math.round(utcMinutes * 60) * 1000);
}

export function formatTime(date, timeZone) {
  return date.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
}

// Candle lighting (minutes before sunset) and havdalah (minutes after sunset) for a Friday.
export function shabbosTimes(fridayFixed, city, { candleMinutes, havdalahMinutes = 50 } = {}) {
  const fri = gregorianFromFixed(fridayFixed);
  const sat = gregorianFromFixed(fridayFixed + 1);
  const candles = candleMinutes ?? city.candles ?? 18;
  const sunsetFri = sunsetUtcMinutes(fri.y, fri.m, fri.d, city.lat, city.lon);
  const sunsetSat = sunsetUtcMinutes(sat.y, sat.m, sat.d, city.lat, city.lon);
  return {
    candleLighting: instant(fri.y, fri.m, fri.d, sunsetFri - candles),
    havdalah: instant(sat.y, sat.m, sat.d, sunsetSat + havdalahMinutes),
  };
}

export function nextFriday(from) {
  const dow = dayOfWeek(from);
  return from + ((5 - dow + 7) % 7);
}

// Cities people can choose for candle-lighting times.
export const CITIES = [
  { id: 'brooklyn', name: 'Brooklyn, NY', lat: 40.6501, lon: -73.9496, tz: 'America/New_York' },
  { id: 'manhattan', name: 'Manhattan, NY', lat: 40.7831, lon: -73.9712, tz: 'America/New_York' },
  { id: 'queens', name: 'Queens, NY', lat: 40.7282, lon: -73.7949, tz: 'America/New_York' },
  { id: 'fivetowns', name: 'Five Towns, NY', lat: 40.6312, lon: -73.7246, tz: 'America/New_York' },
  { id: 'monsey', name: 'Monsey, NY', lat: 41.1112, lon: -74.0685, tz: 'America/New_York' },
  { id: 'monroe', name: 'Monroe / Kiryas Joel, NY', lat: 41.3401, lon: -74.1677, tz: 'America/New_York' },
  { id: 'lakewood', name: 'Lakewood, NJ', lat: 40.0821, lon: -74.2097, tz: 'America/New_York' },
  { id: 'teaneck', name: 'Teaneck, NJ', lat: 40.8976, lon: -74.016, tz: 'America/New_York' },
  { id: 'passaic', name: 'Passaic, NJ', lat: 40.8568, lon: -74.1285, tz: 'America/New_York' },
  { id: 'baltimore', name: 'Baltimore, MD', lat: 39.2904, lon: -76.6122, tz: 'America/New_York' },
  { id: 'philadelphia', name: 'Philadelphia, PA', lat: 39.9526, lon: -75.1652, tz: 'America/New_York' },
  { id: 'boston', name: 'Boston, MA', lat: 42.3601, lon: -71.0589, tz: 'America/New_York' },
  { id: 'miami', name: 'Miami, FL', lat: 25.7617, lon: -80.1918, tz: 'America/New_York' },
  { id: 'chicago', name: 'Chicago, IL', lat: 41.8781, lon: -87.6298, tz: 'America/Chicago' },
  { id: 'cleveland', name: 'Cleveland, OH', lat: 41.4993, lon: -81.6944, tz: 'America/New_York' },
  { id: 'detroit', name: 'Detroit, MI', lat: 42.3314, lon: -83.0458, tz: 'America/Detroit' },
  { id: 'dallas', name: 'Dallas, TX', lat: 32.7767, lon: -96.797, tz: 'America/Chicago' },
  { id: 'denver', name: 'Denver, CO', lat: 39.7392, lon: -104.9903, tz: 'America/Denver' },
  { id: 'la', name: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles' },
  { id: 'toronto', name: 'Toronto, ON', lat: 43.6532, lon: -79.3832, tz: 'America/Toronto' },
  { id: 'montreal', name: 'Montreal, QC', lat: 45.5019, lon: -73.5674, tz: 'America/Toronto' },
  { id: 'london', name: 'London, UK', lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
  { id: 'manchester', name: 'Manchester, UK', lat: 53.4808, lon: -2.2426, tz: 'Europe/London' },
  { id: 'antwerp', name: 'Antwerp, Belgium', lat: 51.2194, lon: 4.4025, tz: 'Europe/Brussels' },
  { id: 'paris', name: 'Paris, France', lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris' },
  { id: 'jerusalem', name: 'Jerusalem', lat: 31.7683, lon: 35.2137, tz: 'Asia/Jerusalem', candles: 40, israel: true },
  { id: 'bneibrak', name: 'Bnei Brak', lat: 32.0807, lon: 34.8338, tz: 'Asia/Jerusalem', candles: 20, israel: true },
  { id: 'telaviv', name: 'Tel Aviv', lat: 32.0853, lon: 34.7818, tz: 'Asia/Jerusalem', candles: 20, israel: true },
  { id: 'beitshemesh', name: 'Beit Shemesh', lat: 31.7497, lon: 34.9881, tz: 'Asia/Jerusalem', candles: 30, israel: true },
];

export function cityById(id) {
  return CITIES.find((c) => c.id === id) || null;
}
