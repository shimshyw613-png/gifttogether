// The Jewish calendar screen: today's Hebrew date, this Shabbos, and what's coming up.
import { prefs, hebrewStyle } from '../data.js';
import { html, header } from '../ui.js';
import * as H from '../hebrew.js';

const KIND_LABEL = { yomtov: 'Yom Tov', cholhamoed: 'Chol Hamoed', fast: 'Fast day', minor: '', roshchodesh: '' };
const KIND_CLASS = { yomtov: 'gold', cholhamoed: '', fast: 'grey', minor: '', roshchodesh: 'green' };

export function shortGregorian(fixed) {
  const g = H.gregorianFromFixed(fixed);
  return new Date(Date.UTC(g.y, g.m - 1, g.d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}

// Today's Hebrew date, moving to tomorrow's after sunset in the person's city.
export function hebrewToday() {
  const style = hebrewStyle();
  const city = H.cityById(prefs().city);
  let fixed = H.todayFixed();
  let afterSunset = false;
  if (city) {
    const g = H.gregorianFromFixed(fixed);
    const sunset = new Date(Date.UTC(g.y, g.m - 1, g.d) + H.sunsetUtcMinutes(g.y, g.m, g.d, city.lat, city.lon) * 60000);
    if (Date.now() > sunset.getTime()) { fixed += 1; afterSunset = true; }
  }
  return { text: H.formatHebrew(H.hebrewFromFixed(fixed), style), afterSunset, fixed };
}

export function nextShabbos() {
  const city = H.cityById(prefs().city);
  const fri = H.nextFriday(H.todayFixed());
  if (!city) return { friday: fri, city: null };
  const times = H.shabbosTimes(fri, city, { havdalahMinutes: Number(prefs().havdalah) || 50 });
  return {
    friday: fri,
    city,
    candles: H.formatTime(times.candleLighting, city.tz),
    havdalah: H.formatTime(times.havdalah, city.tz),
  };
}

export async function show(app) {
  const style = hebrewStyle();
  const p = prefs();
  const city = H.cityById(p.city);
  const israel = !!city?.israel;
  const today = hebrewToday();
  const shabbos = nextShabbos();
  const from = H.todayFixed();
  const upcoming = H.holidaysBetween(from, from + 75, { israel, style });

  app.innerHTML = html`<main class="page">
    ${header(style === 'sephardi' ? 'Jewish calendar' : 'Jewish calendar', { sub: city ? `Times for ${city.name}` : 'Choose your city in My info for Shabbos times' })}

    <section class="card stack accent">
      <p class="caps small muted">Today${today.afterSunset ? ' (after sunset)' : ''}</p>
      <h2 class="display-sm">${today.text}</h2>
      <p class="muted">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
    </section>

    <section class="card stack">
      <h2>${H.word('shabbos', style)} · ${shortGregorian(shabbos.friday)}</h2>
      ${shabbos.city ? html`<div class="grid2">
        <div class="stat"><span class="small muted">Candle lighting</span><span class="big-time">${shabbos.candles}</span></div>
        <div class="stat"><span class="small muted">Havdalah</span><span class="big-time">${shabbos.havdalah}</span></div>
      </div>
      <p class="muted small">Calculated for ${shabbos.city.name} (${shabbos.city.candles || 18} minutes before sunset; havdalah ${Number(p.havdalah) || 50} minutes after). Your shul’s calendar is the final word.</p>`
      : html`<p>Add your city in <a href="#/me">My info</a> to see candle lighting and havdalah.</p>`}
    </section>

    <h2 class="section-title">Coming up</h2>
    <div class="card list">
      ${upcoming.map((h) => html`<div class="list-row">
        <span class="date-chip">${shortGregorian(h.fixed).replace(/^\w+, /, '')}</span>
        <span class="grow"><span class="strong">${h.name}</span>
          <span class="muted small block-text">${shortGregorian(h.fixed).split(',')[0]} · ${H.formatHebrew(H.hebrewFromFixed(h.fixed), style, false)}</span></span>
        ${KIND_LABEL[h.kind] ? html`<span class="badge ${KIND_CLASS[h.kind]}">${KIND_LABEL[h.kind]}</span>` : ''}
      </div>`)}
    </div>
    <p class="muted small">Yom Tov and fast days begin the evening before. ${israel ? 'Showing the Israel calendar.' : 'Showing the calendar for outside Israel.'}</p>
  </main>`.s;
}
