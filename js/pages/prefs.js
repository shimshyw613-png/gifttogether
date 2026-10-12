// The setup questions: community and culture, and for Jewish users their
// tradition and city (for candle-lighting times). Used at sign-up and in My info.
import { html, $, $$ } from '../ui.js';
import { CITIES } from '../hebrew.js';

export const TRADITIONS = [
  ['jewish', 'Jewish'], ['christian', 'Christian'], ['muslim', 'Muslim'], ['hindu', 'Hindu'],
  ['buddhist', 'Buddhist'], ['chinese', 'Chinese traditions'], ['other', 'Other'], ['none', 'Prefer not to say'],
];
const MINHAGIM = [['ashkenazi', 'Ashkenazi'], ['sephardi', 'Sephardi'], ['chassidish', 'Chassidish'], ['unsure', 'Not sure / mixed']];
const HAVDALAH = [[42, '42 minutes'], [50, '50 minutes'], [72, '72 minutes (Rabbeinu Tam)']];
const LANGUAGES = [['en', 'English'], ['he', 'Hebrew (coming soon)'], ['es', 'Spanish (coming soon)'], ['ru', 'Russian (coming soon)'], ['zh', 'Chinese (coming soon)'], ['yi', 'Yiddish (coming soon)']];

export function prefsFields(m = {}) {
  const tradition = m.tradition || '';
  return html`<fieldset class="field">
      <legend>Which community are you part of?</legend>
      <div class="chip-list">
        ${TRADITIONS.map(([v, label]) => html`<label class="chip-radio"><input type="radio" name="tradition" value="${v}" ${tradition === v ? 'checked' : ''}><span>${label}</span></label>`)}
      </div>
      <span class="muted small">We use this to show the right holidays and features. You can change it any time.</span>
    </fieldset>
    <div class="stack" id="jewish-fields" ${tradition === 'jewish' ? '' : 'hidden'}>
      <fieldset class="field">
        <legend>Your tradition</legend>
        <div class="chip-list">
          ${MINHAGIM.map(([v, label]) => html`<label class="chip-radio"><input type="radio" name="minhag" value="${v}" ${(m.minhag || 'ashkenazi') === v ? 'checked' : ''}><span>${label}</span></label>`)}
        </div>
      </fieldset>
      <label class="field" for="pref-city">Your city, for Shabbos and Yom Tov times
        <select id="pref-city" name="city">
          <option value="">Choose your city…</option>
          ${CITIES.map((c) => html`<option value="${c.id}" ${m.city === c.id ? 'selected' : ''}>${c.name}</option>`)}
        </select>
      </label>
      <label class="field" for="pref-havdalah">Havdalah time after sunset
        <select id="pref-havdalah" name="havdalah">
          ${HAVDALAH.map(([v, label]) => html`<option value="${v}" ${Number(m.havdalah || 50) === v ? 'selected' : ''}>${label}</option>`)}
        </select>
      </label>
    </div>
    <p class="muted small" id="other-note" ${tradition && tradition !== 'jewish' && tradition !== 'none' ? '' : 'hidden'}>
      Calendars and features for your community are on the way. For now you get everything else in the app.
    </p>
    <label class="field" for="pref-lang">Language
      <select id="pref-lang" name="language">
        ${LANGUAGES.map(([v, label]) => html`<option value="${v}" ${(m.language || 'en') === v ? 'selected' : ''} ${v === 'en' ? '' : 'disabled'}>${label}</option>`)}
      </select>
    </label>`;
}

// Shows the Jewish questions only for Jewish users.
export function wirePrefs(root) {
  const sync = () => {
    const t = root.querySelector('input[name=tradition]:checked')?.value || '';
    $('#jewish-fields', root).hidden = t !== 'jewish';
    $('#other-note', root).hidden = !t || t === 'jewish' || t === 'none';
  };
  $$('input[name=tradition]', root).forEach((r) => r.addEventListener('change', sync));
  sync();
}

export function readPrefs(form) {
  const tradition = form.querySelector('input[name=tradition]:checked')?.value || null;
  const jewish = tradition === 'jewish';
  return {
    tradition,
    minhag: jewish ? form.querySelector('input[name=minhag]:checked')?.value || 'ashkenazi' : null,
    city: jewish ? form.city.value || null : null,
    havdalah: jewish ? Number(form.havdalah.value) || 50 : null,
    language: form.language.value || 'en',
  };
}
