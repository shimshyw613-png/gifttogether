// Family dates (birthdays and yearly occasions) and the birthday wishes page.
import { sb, state, nameOf, loadMembers, isJewish, hebrewStyle } from '../data.js';
import * as H from '../hebrew.js';
import { html, $, $$, icon, header, avatar, parseDay, daysUntil, nextOccurrenceYear, whenLabel, monthDay, todayParts, busy, toast, MONTH_NAMES } from '../ui.js';
import { go } from '../nav.js';

const KINDS = [
  ['anniversary', 'Anniversary'], ['engagement', 'Engagement'], ['graduation', 'Graduation'],
  ['yahrzeit', 'Yahrzeit'], ['other', 'Other'],
];
const KIND_LABEL = Object.fromEntries([['birthday', 'Birthday'], ...KINDS]);

// Birthdays from everyone's profile plus the dates people added, soonest first.
export async function upcomingDates() {
  const { data, error } = await sb.from('family_dates').select('*').eq('family_id', state.family.id);
  if (error) throw error;
  const items = [];
  for (const m of state.members) {
    const p = parseDay(m.birthday);
    if (!p) continue;
    const age = p.y > 1800 ? nextOccurrenceYear(p.m, p.d) - p.y : null;
    items.push({
      kind: 'birthday', member_id: m.id, month: p.m, day: p.d, days: daysUntil(p.m, p.d),
      title: `${m.display_name}’s birthday`,
      subtitle: age && age > 0 && age < 120 ? `Turning ${age}` : 'Birthday',
    });
  }
  const today = H.todayFixed();
  const style = hebrewStyle();
  for (const d of data) {
    if (d.hebrew_month && d.hebrew_day) {
      // A Hebrew date: find when it falls next, and show it on that English day.
      const fixed = H.nextHebrewAnniversary(d.hebrew_month, d.hebrew_day, today);
      if (fixed == null) continue;
      const g = H.gregorianFromFixed(fixed);
      const hy = H.hebrewFromFixed(fixed).y;
      const years = d.hebrew_year ? hy - d.hebrew_year : null;
      const hebrew = `${d.hebrew_day} ${H.monthName(d.hebrew_month, hy, style)}`;
      items.push({
        ...d, month: g.m, day: g.d, days: fixed - today, hebrew,
        subtitle: [KIND_LABEL[d.kind] || 'Date', hebrew, years && years > 0 ? `${years} years` : '', d.notes || ''].filter(Boolean).join(' · '),
      });
      continue;
    }
    const years = d.year ? nextOccurrenceYear(d.month, d.day) - d.year : null;
    items.push({
      ...d, days: daysUntil(d.month, d.day),
      subtitle: [KIND_LABEL[d.kind] || 'Date', years && d.kind !== 'yahrzeit' && years > 0 ? `${years} years` : '', d.notes || ''].filter(Boolean).join(' · '),
    });
  }
  return items.sort((a, b) => a.days - b.days);
}

export async function list(app) {
  await loadMembers();
  const items = await upcomingDates();
  const missing = state.members.filter((m) => !m.birthday);

  app.innerHTML = html`<main class="page">
    ${header('Family dates', { sub: 'Every year, they come up on everyone’s home screen' })}
    <div class="card list">
      ${items.length ? items.map((d) => html`<div class="list-row">
        <span class="date-chip">${monthDay(d.month, d.day)}</span>
        <a class="grow plain-link" href="${d.kind === 'birthday' ? '#/birthday/' + d.member_id : '#/dates'}">
          <span class="strong">${d.title}</span><span class="muted small block-text">${d.subtitle}</span></a>
        <span class="muted small">${whenLabel(d.days)}</span>
        ${d.id && (d.created_by_member === state.me.id || state.me.role !== 'member')
          ? html`<button class="icon-btn small" data-del="${d.id}" aria-label="Delete ${d.title}">${icon('trash', 16)}</button>` : ''}
      </div>`) : html`<p class="muted">No dates yet. Add birthdays in My info, or add an anniversary below.</p>`}
    </div>
    ${missing.length ? html`<p class="muted small">Missing a birthday: ${missing.map((m) => m.display_name).join(', ')}. ${state.me.role !== 'member' ? 'Admins can add them in Family.' : 'Ask them to add it in My info.'}</p>` : ''}

    <form id="date-form" class="card stack">
      <h2>Add a yearly date</h2>
      <label class="field">What is it?
        <input name="title" required maxlength="120" placeholder="Yossi & Miri’s anniversary">
      </label>
      <fieldset class="field"><legend>Type</legend>
        <div class="chip-list">
          ${KINDS.map(([v, label], i) => html`<label class="chip-radio"><input type="radio" name="kind" value="${v}" ${i === 0 ? 'checked' : ''}><span>${label}</span></label>`)}
        </div>
      </fieldset>
      ${isJewish() ? html`<fieldset class="field"><legend>Which calendar?</legend>
        <div class="chip-list">
          <label class="chip-radio"><input type="radio" name="cal" value="en" checked><span>English date</span></label>
          <label class="chip-radio"><input type="radio" name="cal" value="he"><span>Hebrew date</span></label>
        </div>
        <span class="muted small">Yahrzeits and Hebrew birthdays move every year. Pick Hebrew date and the app finds the right day for you.</span>
      </fieldset>
      <div class="grid3" id="he-date" hidden>
        <label class="field">Hebrew month
          <select name="hmonth">${H.monthChoices(hebrewStyle()).map((o) => html`<option value="${o.value}">${o.label}</option>`)}</select>
        </label>
        <label class="field">Day <input name="hday" type="number" min="1" max="30"></label>
        <label class="field">Year <input name="hyear" type="number" min="3000" max="6500" placeholder="optional, e.g. 5770"></label>
      </div>` : ''}
      <div class="grid3" id="en-date">
        <label class="field">Month
          <select name="month" required>${MONTH_NAMES.map((n, i) => html`<option value="${i + 1}">${n}</option>`)}</select>
        </label>
        <label class="field">Day <input name="day" type="number" min="1" max="31" required></label>
        <label class="field">Year <input name="year" type="number" min="1800" max="2200" placeholder="optional"></label>
      </div>
      <label class="field">Note (optional) <input name="notes" maxlength="500" placeholder="Place, anything to remember"></label>
      <button class="btn" type="submit">${icon('plus', 18)} Add date</button>
    </form>
  </main>`.s;

  $('#date-form', app).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      const hebrew = f.querySelector('input[name=cal]:checked')?.value === 'he';
      const { error } = await sb.from('family_dates').insert({
        family_id: state.family.id,
        created_by_member: state.me.id,
        title: f.title.value.trim(),
        kind: f.querySelector('input[name=kind]:checked').value,
        month: hebrew ? null : Number(f.month.value),
        day: hebrew ? null : Number(f.day.value),
        year: !hebrew && f.year.value ? Number(f.year.value) : null,
        hebrew_month: hebrew ? Number(f.hmonth.value) : null,
        hebrew_day: hebrew ? Number(f.hday.value) : null,
        hebrew_year: hebrew && f.hyear.value ? Number(f.hyear.value) : null,
        notes: f.notes.value.trim() || null,
      });
      if (error) throw error;
      toast('Date added for the whole family');
      go('dates');
    });
  });
  // Switch between English and Hebrew date boxes.
  const form = $('#date-form', app);
  const syncCal = () => {
    const he = form.querySelector('input[name=cal]:checked')?.value === 'he';
    const heBox = $('#he-date', form);
    if (!heBox) return;
    heBox.hidden = !he;
    $('#en-date', form).hidden = he;
    form.month.required = !he; form.day.required = !he; form.hday.required = he;
  };
  $$('input[name=cal]', form).forEach((r) => r.addEventListener('change', syncCal));
  syncCal();
  $$('[data-del]', app).forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Delete this date for everyone?')) return;
    busy(b, async () => {
      const { error } = await sb.from('family_dates').delete().eq('id', b.dataset.del);
      if (error) throw error;
      go('dates');
    });
  }));
}

export async function birthday(app, memberId) {
  await loadMembers();
  const person = state.memberById.get(memberId);
  if (!person) { go(''); return; }
  const t = todayParts();
  const p = parseDay(person.birthday);
  const isToday = p && p.m === t.m && p.d === t.d;
  const age = p && p.y > 1800 ? t.y - p.y : null;
  const { data: wishes, error } = await sb.from('wishes').select('*')
    .eq('for_member_id', memberId).order('created_at', { ascending: false });
  if (error) throw error;
  const thisYear = wishes.filter((w) => w.year === t.y);
  const earlier = wishes.filter((w) => w.year !== t.y);
  const mine = person.id === state.me.id;

  app.innerHTML = html`<main class="page birthday-page">
    <section class="birthday-hero">
      <a class="icon-btn light" href="#/" aria-label="Back">${icon('back', 22)}</a>
      <span class="confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
      <p class="caps small">${isToday ? 'Today' : p ? monthDay(p.m, p.d) : 'Birthday'}</p>
      <div class="row">${avatar(person.display_name, person.id, 64)}
        <h1 class="display">${isToday ? `Happy ${age && age > 0 && age < 120 ? ordinal(age) + ' ' : ''}birthday, ${person.display_name}!` : `${person.display_name}’s birthday`}</h1></div>
      ${isJewish() && p && p.y > 1800 ? html`<p class="small">Hebrew birthday: ${H.formatHebrew(H.hebrewFromFixed(H.fixedFromGregorian(p.y, p.m, p.d)), hebrewStyle(), false)}</p>` : ''}
      <p>${mine ? 'Here’s what your family wrote you. Every wish is saved forever.' : `Leave ${person.display_name} a wish. Every wish is saved forever.`}</p>
    </section>

    ${!mine ? html`<form id="wish-form" class="card stack">
      <label class="field">Your wish for ${person.display_name}
        <textarea name="text" rows="3" maxlength="1000" required placeholder="Happy birthday!"></textarea>
      </label>
      <button class="btn big" type="submit">Send wish</button>
    </form>` : ''}

    <h2 class="section-title">Wishes ${t.y} · ${thisYear.length}</h2>
    ${thisYear.length ? thisYear.map((w) => wishCard(w)) : html`<p class="muted">No wishes yet this year.</p>`}
    ${earlier.length ? html`<details class="card"><summary class="strong">Earlier years · ${earlier.length}</summary>
      <div class="stack">${earlier.map((w) => wishCard(w, true))}</div></details>` : ''}
  </main>`.s;

  $('#wish-form', app)?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      const { error: err } = await sb.from('wishes').insert({
        family_id: state.family.id,
        for_member_id: memberId,
        author_member_id: state.me.id,
        year: t.y,
        text: f.text.value.trim(),
      });
      if (err) throw err;
      toast('Wish sent!');
      go('birthday/' + memberId);
    });
  });
  $$('[data-del-wish]', app).forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    const { error: err } = await sb.from('wishes').delete().eq('id', b.dataset.delWish);
    if (err) throw err;
    go('birthday/' + memberId);
  })));
}

function wishCard(w, showYear = false) {
  const canDelete = w.author_member_id === state.me.id || state.me.role !== 'member';
  return html`<article class="wish" style="--t:${['#FCEFD3', '#EDE5F6', '#E2F3EA', '#DCEBFA'][w.text.length % 4]}">
    ${avatar(nameOf(w.author_member_id), w.author_member_id, 34)}
    <div class="grow"><div class="small strong">${nameOf(w.author_member_id)}${showYear ? ` · ${w.year}` : ''}</div><p>${w.text}</p></div>
    ${canDelete ? html`<button class="icon-btn small" data-del-wish="${w.id}" aria-label="Delete wish">${icon('trash', 15)}</button>` : ''}
  </article>`;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
