// Creating a celebration, chipping in, and the organizer's tools.
import { sb, state, nameOf, loadMembers, loadContacts, celebrationLink, setting, canCreateCelebration } from '../data.js';
import { html, $, $$, icon, header, avatar, money, toCents, longDate, shortDate, busy, toast, copyText } from '../ui.js';
import { go } from '../nav.js';

const OCCASIONS = [
  ['birthday', 'Birthday'], ['baby', 'New baby'], ['wedding', 'Wedding'], ['engagement', 'Engagement'],
  ['bar_mitzvah', 'Bar / Bat Mitzvah'], ['graduation', 'Graduation'], ['anniversary', 'Anniversary'], ['other', 'Other'],
];
const OCCASION_TITLE = {
  birthday: (n) => `${n}’s birthday`, baby: (n) => `${n}’s new baby`, wedding: (n) => `${n}’s wedding`,
  engagement: (n) => `${n}’s engagement`, bar_mitzvah: (n) => `${n}’s simcha`, graduation: (n) => `${n}’s graduation`,
  anniversary: (n) => `${n}’s anniversary`, other: (n) => `For ${n}`,
};
const STATUS = {
  pledged: { label: 'Promised', cls: '' },
  sent: { label: 'Says it’s sent', cls: 'gold' },
  paid: { label: 'Received', cls: 'green' },
  declined: { label: 'Can’t this time', cls: 'grey' },
};
const GIFT_STEPS = [['collecting', 'Collecting'], ['gift_chosen', 'Gift chosen'], ['ordered', 'Ordered'], ['delivered', 'Delivered']];

// ---------------------------------------------------------------- New celebration
export async function create(app) {
  if (!canCreateCelebration()) { go(''); return; }
  await loadMembers();
  const usual = setting('suggested_cents');
  const others = state.members.filter((m) => m.id !== state.me.id);
  app.innerHTML = html`<main class="page">
    ${header('New celebration', { back: '#/' })}
    <form id="new-form" class="stack">
      <section class="card stack">
        <label class="field">Who’s it for?
          <select name="recipient" required>
            <option value="">Choose…</option>
            ${others.map((m) => html`<option value="${m.id}">${m.display_name}${m.household ? ' · ' + m.household : ''}</option>`)}
          </select>
        </label>
        <fieldset class="field">
          <legend>What’s the occasion?</legend>
          <div class="chip-list">
            ${OCCASIONS.map(([v, label], i) => html`<label class="chip-radio"><input type="radio" name="occasion" value="${v}" ${i === 0 ? 'checked' : ''}><span>${label}</span></label>`)}
          </div>
        </fieldset>
        <label class="field">Name of the celebration
          <input name="title" required maxlength="120" placeholder="Avi’s 50th birthday">
        </label>
        <div class="grid2">
          <label class="field">Date of the simcha <input type="date" name="event_date"></label>
          <label class="field">Collect by <input type="date" name="collect_by"></label>
        </div>
      </section>

      <section class="card stack">
        <div class="grid2">
          <label class="field">Suggested each <input name="suggested" inputmode="decimal" placeholder="$100" value="${usual ? money(usual) : ''}"></label>
          <label class="field">Goal (optional) <input name="goal" inputmode="decimal" placeholder="$900"></label>
        </div>
        <p class="muted small">Everyone can still give more or less. Amounts stay private.</p>
        <label class="field">How should people pay you?
          <input name="payment" maxlength="300" placeholder="Zelle to (555) 201-3398, or cash">
        </label>
      </section>

      <section class="card stack surprise-box">
        <label class="switch-row">
          <span class="grow"><span class="strong">${icon('lock', 18)} Keep it a surprise</span>
            <span class="muted small block-text">They won’t see this celebration anywhere in the app until you reveal it.</span></span>
          <input type="checkbox" name="surprise" class="switch" checked>
        </label>
        <div id="hide-more" class="stack">
          <p class="small strong">Also keep it hidden from:</p>
          <div class="chip-list">
            ${others.map((m) => html`<label class="chip-check" data-person="${m.id}"><input type="checkbox" name="hide" value="${m.id}"><span>${m.display_name}</span></label>`)}
          </div>
        </div>
      </section>

      <button class="btn big" type="submit">Create celebration</button>
    </form>
  </main>`.s;

  const f = $('#new-form', app);
  let titleTouched = false;
  f.title.addEventListener('input', () => { titleTouched = true; });
  const refresh = () => {
    const rid = f.recipient.value;
    const r = state.memberById.get(rid);
    if (r && !titleTouched) f.title.value = OCCASION_TITLE[f.occasion.value](r.display_name);
    $$('[data-person]', f).forEach((el) => { el.hidden = el.dataset.person === rid; });
    $('#hide-more', f).hidden = !f.surprise.checked;
  };
  f.recipient.addEventListener('change', () => {
    // Pre-select the recipient's household (for example their spouse).
    const r = state.memberById.get(f.recipient.value);
    $$('input[name=hide]', f).forEach((cb) => {
      const m = state.memberById.get(cb.value);
      cb.checked = !!(r && r.household && m.household === r.household && m.id !== r.id);
    });
    refresh();
  });
  $$('input[name=occasion]', f).forEach((r) => r.addEventListener('change', refresh));
  f.surprise.addEventListener('change', refresh);
  refresh();

  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const surprise = f.surprise.checked;
    const hidden = surprise ? $$('input[name=hide]:checked', f).map((cb) => cb.value).filter((id) => id !== f.recipient.value) : [];
    busy(f.querySelector('button[type=submit]'), async () => {
      const { data, error } = await sb.from('celebrations').insert({
        family_id: state.family.id,
        organizer_member_id: state.me.id,
        recipient_member_id: f.recipient.value,
        title: f.title.value.trim(),
        occasion: f.occasion.value,
        event_date: f.event_date.value || null,
        collect_by: f.collect_by.value || null,
        suggested_cents: toCents(f.suggested.value),
        goal_cents: toCents(f.goal.value),
        payment_instructions: f.payment.value.trim() || null,
        is_surprise: surprise,
        hidden_member_ids: hidden,
      }).select('id').single();
      if (error) throw error;
      toast('Celebration created. Now let the family know!');
      go('c/' + data.id);
    });
  });
}

// ---------------------------------------------------------------- One celebration
export async function show(app, id) {
  await loadMembers();
  const { data: c, error } = await sb.from('celebrations').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!c) {
    app.innerHTML = html`<main class="page">${header('Celebration')}
      <div class="card"><p>This celebration isn’t available. It may have been removed.</p></div></main>`.s;
    return;
  }
  const organizer = c.organizer_member_id === state.me.id;
  const isRecipient = c.recipient_member_id === state.me.id;
  const [{ data: summary }, { data: card }, { data: myRow }] = await Promise.all([
    sb.rpc('celebration_summary', { cid: id }),
    sb.rpc('celebration_card', { cid: id }),
    sb.from('contributions').select('*').eq('celebration_id', id).eq('member_id', state.me.id).maybeSingle(),
  ]);
  const s = summary || { promised_cents: 0, paid_cents: 0, count_in: 0, people: [] };

  let allRows = [];
  let contacts = new Map();
  if (organizer) {
    const r = await sb.from('contributions').select('*').eq('celebration_id', id);
    allRows = r.data || [];
    contacts = await loadContacts();
  }
  const link = celebrationLink(id);
  const pct = c.goal_cents ? Math.min(100, Math.round((s.promised_cents / c.goal_cents) * 100)) : 0;
  const hiddenNames = (c.hidden_member_ids || []).map(nameOf);
  const suggested = c.suggested_cents || 0;
  const chips = [...new Set([suggested, suggested ? suggested / 2 : 2500, suggested ? suggested * 1.5 : 5000, suggested ? suggested * 2 : 10000]
    .map((v) => Math.round(v / 100) * 100).filter((v) => v > 0))].sort((a, b) => a - b);
  const canChipIn = !isRecipient && !(c.hidden_member_ids || []).includes(state.me.id) && !c.cancelled;

  app.innerHTML = html`<main class="page">
    ${header(c.title, { sub: [c.event_date ? longDate(c.event_date) : '', c.collect_by ? 'Collect by ' + shortDate(c.collect_by) : ''].filter(Boolean).join(' · ') })}

    ${c.cancelled ? html`<div class="card notice">This celebration was cancelled.</div>` : ''}
    ${c.is_surprise && !c.revealed ? html`<div class="badge-line gold">${icon('lock', 15)} Surprise · hidden from ${hiddenNames.join(', ')}</div>` : ''}

    ${isRecipient ? html`<section class="card stack reveal">
      <p class="caps small">From your family, with love</p>
      <h2 class="display-sm">${c.title}</h2>
      ${c.gift_description ? html`<p class="strong">${c.gift_description}</p>` : ''}
      ${(card || []).map((m) => html`<blockquote class="note"><p>${m.message}</p><cite>${nameOf(m.member_id)}</cite></blockquote>`)}
    </section>` : ''}

    <section class="card stack">
      <div class="row baseline"><span class="big-number">${money(s.promised_cents)}</span>
        <span class="muted">${c.goal_cents ? 'of ' + money(c.goal_cents) + ' goal' : 'promised so far'}</span></div>
      ${c.goal_cents ? html`<div class="progress"><span style="width:${pct}%"></span></div>` : ''}
      <p class="muted small">${money(s.paid_cents)} received by ${nameOf(c.organizer_member_id)} · ${s.count_in} chipped in · amounts stay private</p>
      ${s.people.length ? html`<div class="chip-list">
        ${s.people.map((p) => html`<span class="chip person-chip ${STATUS[p.status]?.cls || ''}">${avatar(nameOf(p.member_id), p.member_id, 22)} ${nameOf(p.member_id)}</span>`)}
      </div>` : ''}
    </section>

    ${canChipIn ? html`<section class="card stack" id="mine">
      <h2>${myRow ? 'Your part' : 'Chip in'}</h2>
      ${myRow ? html`<p><span class="badge ${STATUS[myRow.status].cls}">${STATUS[myRow.status].label}</span>
        ${myRow.status !== 'declined' ? html` <span class="strong">${money(myRow.amount_cents)}</span>` : ''}</p>` : ''}
      ${myRow?.status === 'paid' ? html`<p class="muted small">Thank you! ${nameOf(c.organizer_member_id)} received it.</p>` : html`
        <form id="chip-form" class="stack">
          <div class="amount-chips">
            ${chips.map((v) => html`<label class="chip-radio"><input type="radio" name="amount" value="${v}" ${(myRow ? myRow.amount_cents === v : v === suggested) ? 'checked' : ''}><span>${money(v)}</span></label>`)}
            <label class="chip-radio"><input type="radio" name="amount" value="other" ${myRow && !chips.includes(myRow.amount_cents) && myRow.amount_cents ? 'checked' : ''}><span>Other</span></label>
          </div>
          <input name="other" inputmode="decimal" placeholder="Other amount" hidden value="${myRow && !chips.includes(myRow.amount_cents) && myRow.amount_cents ? myRow.amount_cents / 100 : ''}">
          ${suggested ? html`<p class="muted small">${nameOf(c.organizer_member_id)} suggested ${money(suggested)}. Only you and the organizer see what you give.</p>` : ''}
          <label class="field">A line for the card (optional)
            <textarea name="message" rows="2" maxlength="1000" placeholder="Mazel tov!">${myRow?.message || ''}</textarea>
          </label>
          ${c.payment_instructions ? html`<div class="pay-box"><span class="small caps">How to pay</span><span class="strong">${c.payment_instructions}</span></div>` : ''}
          <div class="stack tight">
            <button class="btn big" name="act" value="pledged">${myRow ? 'Update' : 'I’m in'}</button>
            <button class="btn ghost" name="act" value="sent">I sent the money</button>
            <button class="btn link" name="act" value="declined">Can’t this time (only the organizer sees this)</button>
          </div>
        </form>`}
    </section>` : ''}

    ${organizer ? organizerPanel(c, allRows, contacts, link) : ''}

    ${!isRecipient ? html`<section class="card stack">
      <h2>Tell the family</h2>
      <p class="muted small">Send this link to everyone who should chip in.</p>
      <div class="row wrap">
        <button class="btn ghost" id="share-c">${icon('share', 18)} Share</button>
        <button class="btn ghost" id="copy-c">${icon('copy', 18)} Copy link</button>
      </div>
    </section>` : ''}
  </main>`.s;

  wireChipIn(app, c, myRow);
  if (organizer) wireOrganizer(app, c, allRows, link);
  const shareText = `Chip in for ${c.title} on GiftTogether${c.is_surprise && !c.revealed ? ' (it’s a surprise, shh!)' : ''}: ${link}`;
  $('#copy-c', app)?.addEventListener('click', () => copyText(link, 'Link copied'));
  $('#share-c', app)?.addEventListener('click', async () => {
    if (navigator.share) { try { await navigator.share({ text: shareText }); } catch { /* cancelled */ } }
    else copyText(shareText, 'Message copied. Paste it in your family chat.');
  });
}

function wireChipIn(app, c, myRow) {
  const f = $('#chip-form', app);
  if (!f) return;
  const other = f.other;
  const sync = () => { other.hidden = f.querySelector('input[name=amount]:checked')?.value !== 'other'; };
  $$('input[name=amount]', f).forEach((r) => r.addEventListener('change', sync));
  sync();
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const act = e.submitter?.value || 'pledged';
    const choice = f.querySelector('input[name=amount]:checked')?.value;
    const amount = act === 'declined' ? 0 : choice === 'other' ? toCents(other.value) : Number(choice);
    if (act !== 'declined' && !amount) { toast('Choose an amount first', 'error'); return; }
    busy(e.submitter, async () => {
      const row = {
        celebration_id: c.id,
        family_id: c.family_id,
        member_id: state.me.id,
        amount_cents: amount,
        status: act,
        message: f.message.value.trim() || null,
      };
      const { error } = myRow
        ? await sb.from('contributions').update(row).eq('id', myRow.id)
        : await sb.from('contributions').insert(row);
      if (error) throw error;
      toast(act === 'declined' ? 'Got it. Only the organizer will know.' : act === 'sent' ? 'Thanks! The organizer will confirm it.' : 'You’re in. Thank you!');
      go('c/' + c.id);
    });
  });
}

function organizerPanel(c, rows, contacts, link) {
  const byMember = new Map(rows.map((r) => [r.member_id, r]));
  const hidden = new Set([...(c.hidden_member_ids || []), c.recipient_member_id]);
  const people = state.members.filter((m) => !hidden.has(m.id));
  const step = GIFT_STEPS.findIndex(([v]) => v === c.gift_status);
  return html`<section class="card stack organizer">
    <h2>${icon('key', 18)} Organizer tools</h2>
    <p class="muted small">Only you see amounts and who can’t join.</p>
    <ul class="plain people-status">
      ${people.map((m) => {
        const r = byMember.get(m.id);
        const st = r ? STATUS[r.status] : null;
        const contact = contacts.get(m.id) || {};
        const reminder = `Hi ${m.display_name}! Reminder about ${c.title}${c.collect_by ? `, collecting by ${shortDate(c.collect_by)}` : ''}. Chip in here: ${link}${c.payment_instructions ? ` (pay: ${c.payment_instructions})` : ''}. Thank you!`;
        return html`<li class="status-row">
          ${avatar(m.display_name, m.id, 34)}
          <span class="grow"><span class="strong">${m.display_name}${m.id === state.me.id ? ' (you)' : ''}</span>
            <span class="small block-text">${st ? html`<span class="badge ${st.cls}">${st.label}</span>${r.status !== 'declined' ? ' ' + money(r.amount_cents) : ''}` : html`<span class="muted">Not yet</span>`}</span></span>
          ${r && r.status === 'paid'
            ? html`<button class="btn tiny ghost" data-unpaid="${r.id}">Undo</button>`
            : r && r.status === 'declined' ? ''
            : html`<button class="btn tiny" data-paid="${m.id}" data-amount="${r ? r.amount_cents : c.suggested_cents || 0}">Received</button>`}
          ${!r || r.status === 'pledged' ? (contact.phone
            ? html`<a class="btn tiny ghost" href="sms:${contact.phone}?&body=${encodeURIComponent(reminder)}" aria-label="Text ${m.display_name} a reminder">${icon('message', 16)}</a>`
            : contact.email
              ? html`<a class="btn tiny ghost" href="mailto:${contact.email}?subject=${encodeURIComponent('Reminder: ' + c.title)}&body=${encodeURIComponent(reminder)}" aria-label="Email ${m.display_name} a reminder">${icon('mail', 16)}</a>`
              : html`<button class="btn tiny ghost" data-copy="${reminder}" aria-label="Copy a reminder for ${m.display_name}">${icon('copy', 16)}</button>`) : ''}
        </li>`;
      })}
    </ul>

    <form id="gift-form" class="stack">
      <h3>The gift</h3>
      <div class="steps">
        ${GIFT_STEPS.map(([v, label], i) => html`<label class="step ${i <= step ? 'done' : ''}"><input type="radio" name="gift_status" value="${v}" ${v === c.gift_status ? 'checked' : ''}><span>${label}</span></label>`)}
      </div>
      <label class="field">What are you getting?
        <input name="gift_description" maxlength="300" value="${c.gift_description || ''}" placeholder="Apple gift card, $500">
      </label>
      <button class="btn ghost" type="submit">Save gift</button>
    </form>

    ${c.is_surprise && !c.revealed ? html`<button class="btn big" id="reveal">Reveal to ${nameOf(c.recipient_member_id)}</button>
      <p class="muted small center">They’ll see the celebration and everyone’s card messages, never the amounts.</p>` : ''}
    ${!c.cancelled ? html`<button class="btn link danger" id="cancel">Cancel this celebration</button>` : ''}
  </section>`;
}

function wireOrganizer(app, c, rows, _link) {
  $$('[data-paid]', app).forEach((b) => b.addEventListener('click', () => {
    const memberId = b.dataset.paid;
    const existing = rows.find((r) => r.member_id === memberId);
    const answer = prompt(`How much did ${nameOf(memberId)} give?`, ((Number(b.dataset.amount) || 0) / 100).toString());
    if (answer === null) return;
    const cents = toCents(answer);
    if (!cents) { toast('Enter an amount', 'error'); return; }
    busy(b, async () => {
      const { error } = existing
        ? await sb.from('contributions').update({ status: 'paid', amount_cents: cents }).eq('id', existing.id)
        : await sb.from('contributions').insert({ celebration_id: c.id, family_id: c.family_id, member_id: memberId, amount_cents: cents, status: 'paid' });
      if (error) throw error;
      go('c/' + c.id);
    });
  }));
  $$('[data-unpaid]', app).forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    const { error } = await sb.from('contributions').update({ status: 'pledged' }).eq('id', b.dataset.unpaid);
    if (error) throw error;
    go('c/' + c.id);
  })));
  $$('[data-copy]', app).forEach((b) => b.addEventListener('click', () => copyText(b.dataset.copy, 'Reminder copied')));

  const gf = $('#gift-form', app);
  gf.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(gf.querySelector('button'), async () => {
      const { error } = await sb.from('celebrations').update({
        gift_status: gf.querySelector('input[name=gift_status]:checked')?.value || 'collecting',
        gift_description: gf.gift_description.value.trim() || null,
      }).eq('id', c.id);
      if (error) throw error;
      toast('Gift saved');
      go('c/' + c.id);
    });
  });
  $('#reveal', app)?.addEventListener('click', (e) => {
    if (!confirm(`Reveal the celebration to ${nameOf(c.recipient_member_id)} now?`)) return;
    busy(e.target, async () => {
      const { error } = await sb.from('celebrations').update({ revealed: true }).eq('id', c.id);
      if (error) throw error;
      toast('Revealed! Mazel tov!');
      go('c/' + c.id);
    });
  });
  $('#cancel', app)?.addEventListener('click', (e) => {
    if (!confirm('Cancel this celebration? Let everyone who already paid know you’ll return their money.')) return;
    busy(e.target, async () => {
      const { error } = await sb.from('celebrations').update({ cancelled: true }).eq('id', c.id);
      if (error) throw error;
      go('');
    });
  });
}
