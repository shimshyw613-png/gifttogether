// The family home screen.
import { sb, state, loadMembers, isAdmin, feature, canCreateCelebration, kind, accounts, isJewish, hebrewStyle } from '../data.js';
import { word } from '../hebrew.js';
import { hebrewToday, nextShabbos } from './calendar.js';
import { html, icon, avatar, money, shortDate, whenLabel, parseDay, todayParts, monthDay } from '../ui.js';
import { upcomingDates } from './dates.js';

export async function show(app) {
  await loadMembers();
  const showCelebrations = feature('celebrations');
  const { data: list, error } = !showCelebrations ? { data: [], error: null } : await sb
    .from('celebrations')
    .select('*')
    .eq('family_id', state.family.id)
    .eq('cancelled', false)
    .order('event_date', { ascending: true, nullsFirst: false });
  if (error) throw error;

  const active = list.filter((c) => c.gift_status !== 'delivered' || !c.revealed);
  const summaries = await Promise.all(active.map((c) =>
    sb.rpc('celebration_summary', { cid: c.id }).then((r) => r.data)));
  const myRows = await sb.from('contributions').select('celebration_id, status').eq('member_id', state.me.id);
  const mine = new Map((myRows.data || []).map((r) => [r.celebration_id, r.status]));

  const t = todayParts();
  const birthdaysToday = !feature('wishes') ? [] : state.members.filter((m) => {
    const p = parseDay(m.birthday);
    return p && p.m === t.m && p.d === t.d;
  });
  const soon = feature('dates') ? (await upcomingDates()).filter((d) => d.days <= 45).slice(0, 5) : [];
  const hour = new Date().getHours();
  const jewish = isJewish();
  const hToday = jewish ? hebrewToday() : null;
  const shabbos = jewish ? nextShabbos() : null;
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  app.innerHTML = html`<main class="page home">
    <header class="home-head">
      <div>
        <p class="muted">${greeting}, ${state.me.display_name}${accounts().length > 1 ? html` · <a href="#/accounts">Switch account</a>` : ''}</p>
        <a class="group-switch" href="#/groups" aria-label="Switch group">
          <h1 class="display">${state.family.name}</h1>
          <span class="small muted">${kind().label}${state.groups.length > 1 ? ' · Switch group' : ' · Add a group'}</span>
        </a>
        ${hToday ? html`<p class="small muted">${hToday.text}</p>` : ''}
      </div>
      <a href="#/me" class="me-link" aria-label="My info">${avatar(state.me.display_name, state.me.id, 46)}</a>
    </header>

    <div class="avatar-row" aria-label="Family members">
      ${state.members.slice(0, 12).map((m) => avatar(m.display_name, m.id, 34))}
      ${state.members.length > 12 ? html`<span class="muted small">+${state.members.length - 12}</span>` : ''}
    </div>

    ${shabbos?.city ? html`<a class="card notice-link" href="#/calendar">
      ${icon('calendar', 20)} <span class="grow"><b>${word('shabbos', hebrewStyle())} candle lighting ${shabbos.candles}</b><span class="muted small block-text">Friday · ${shabbos.city.name} · Havdalah ${shabbos.havdalah}</span></span>
    </a>` : ''}

    ${isAdmin() && state.pendingMembers.length ? html`<a class="card notice-link" href="#/family">
      ${icon('people', 20)} <span class="grow"><b>${state.pendingMembers.length} waiting for approval</b><span class="muted small block-text">Tap to let them in</span></span>
    </a>` : ''}

    ${birthdaysToday.map((m) => html`<a class="birthday-banner" href="#/birthday/${m.id}">
      <span class="confetti" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="small caps">Today</span>
      <span class="banner-title">Happy birthday, ${m.display_name}!</span>
      <span class="small">Tap to leave a wish</span>
    </a>`)}

    ${showCelebrations ? html`<h2 class="section-title">Coming up</h2>` : ''}
    ${!showCelebrations || active.length ? '' : html`<div class="card empty">
      <p>No celebrations yet. When someone has a simcha, start one here and the whole ${kind().noun} can chip in.</p>
    </div>`}
    ${active.map((c, i) => {
      const s = summaries[i] || { promised_cents: 0, paid_cents: 0, count_in: 0 };
      const pct = c.goal_cents ? Math.min(100, Math.round((s.promised_cents / c.goal_cents) * 100)) : 0;
      const organizer = c.organizer_member_id === state.me.id;
      const status = mine.get(c.id);
      return html`<a class="card celebration-card ${c.is_surprise && !c.revealed ? 'surprise' : ''}" href="#/c/${c.id}">
        <div class="row between top">
          <div>
            <div class="card-title">${c.title}</div>
            <div class="muted small">${[c.collect_by ? 'Collect by ' + shortDate(c.collect_by) : '', organizer ? 'You’re organizing' : ''].filter(Boolean).join(' · ')}</div>
          </div>
          ${c.is_surprise && !c.revealed ? html`<span class="badge gold">${icon('lock', 13)} Surprise</span>`
            : status && status !== 'declined' ? html`<span class="badge green">${icon('check', 13)} You’re in</span>` : ''}
        </div>
        ${c.goal_cents ? html`<div class="progress"><span style="width:${pct}%"></span></div>` : ''}
        <div class="row between small">
          <span class="strong">${money(s.promised_cents)}${c.goal_cents ? ' of ' + money(c.goal_cents) : ' promised'}</span>
          <span class="muted">${s.count_in} chipped in</span>
        </div>
      </a>`;
    })}

    ${canCreateCelebration() ? html`<a class="btn big block" href="#/new">${icon('plus', 20)} New celebration</a>`
      : showCelebrations ? html`<p class="muted small center">In this ${kind().noun}, admins start the collections.</p>` : ''}

    ${soon.length ? html`<h2 class="section-title">${state.family.kind === 'family' ? 'Family dates' : 'Dates'}</h2>
      <div class="card list">
        ${soon.map((d) => html`<a class="list-row" href="${d.kind === 'birthday' && d.member_id ? '#/birthday/' + d.member_id : '#/dates'}">
          <span class="date-chip">${monthDay(d.month, d.day)}</span>
          <span class="grow"><span class="strong">${d.title}</span><span class="muted small block-text">${d.subtitle}</span></span>
          <span class="muted small">${whenLabel(d.days)}</span>
        </a>`)}
      </div>` : ''}

    <nav class="tiles" aria-label="Sections">
      ${jewish ? html`<a class="tile" href="#/calendar" style="--t:#F6E3E3">${icon('calendar')}<span>Calendar</span></a>` : ''}
      ${feature('dates') ? html`<a class="tile" href="#/dates" style="--t:#FCEFD3">${icon('calendar')}<span>Dates</span></a>` : ''}
      ${feature('contacts') ? html`<a class="tile" href="#/contacts" style="--t:#E2F3EA">${icon('people')}<span>Contacts</span></a>` : ''}
      <a class="tile" href="#/family" style="--t:#EDE5F6">${icon(isAdmin() ? 'key' : 'people')}<span>${kind().people}</span></a>
      <a class="tile" href="#/me" style="--t:#DCEBFA">${icon('user')}<span>My info</span></a>
    </nav>
  </main>`.s;
}
