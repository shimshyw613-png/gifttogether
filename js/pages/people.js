// My info, the family list (with invites and admin tools) and family contacts.
import { sb, state, isAdmin, loadMembers, loadContacts, inviteLink, loadFamily, kind, setting, accounts as listAccounts, activeKey, switchAccount, addAccount, signOutHere, profileName } from '../data.js';
import { html, $, $$, icon, header, avatar, busy, toast, csv, downloadFile, copyText, shortDate } from '../ui.js';
import { go } from '../nav.js';
import { prefsFields, wirePrefs, readPrefs } from './prefs.js';

// ---------------------------------------------------------------- My info
export async function me(app) {
  const contacts = await loadContacts();
  const mine = contacts.get(state.me.id) || {};
  const m = state.me;
  app.innerHTML = html`<main class="page">
    ${header('My info', { sub: 'Keep this up to date so gifts reach you' })}
    <form id="me-form" class="stack">
      <section class="card stack">
        <label class="field">First name
          <input name="display_name" required maxlength="80" value="${m.display_name}" autocomplete="given-name">
        </label>
        <label class="field">Household <span class="muted small">(how cards and lists show your home)</span>
          <input name="household" maxlength="120" value="${m.household || ''}" placeholder="Avi & Dina Levi">
        </label>
        <label class="field">Birthday
          <input type="date" name="birthday" value="${m.birthday || ''}">
        </label>
      </section>
      <section class="card stack">
        <label class="field">Phone
          <input type="tel" name="phone" maxlength="40" value="${mine.phone || ''}" autocomplete="tel">
        </label>
        <label class="field">Email
          <input type="email" name="email" maxlength="200" value="${mine.email || state.user.email || ''}" autocomplete="email">
        </label>
        <label class="field">Home address for gifts and invitations
          <textarea name="address" rows="3" maxlength="300" autocomplete="street-address">${mine.address || ''}</textarea>
        </label>
        <label class="check">
          <input type="checkbox" name="share" ${mine.share_with_family === false ? '' : 'checked'}>
          <span>Show my phone, email and address to others in ${state.family.name}</span>
        </label>
        <p class="muted small">If you turn this off, only admins can see them, so gifts can still reach you.</p>
      </section>
      <button class="btn big" type="submit">Save</button>
    </form>
    <form id="prefs-form" class="card stack">
      <h2>Community and calendar</h2>
      ${prefsFields(state.user?.user_metadata || {})}
      <button class="btn ghost" type="submit">Save</button>
    </form>
    <a class="btn ghost" href="#/accounts">${icon('people', 18)} Accounts on this phone</a>
    <button class="btn link" id="signout">${icon('logout', 18)} Sign out of ${state.user.email}</button>
  </main>`.s;

  const pf = $('#prefs-form', app);
  wirePrefs(pf);
  pf.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(pf.querySelector('button[type=submit]'), async () => {
      const { data, error } = await sb.auth.updateUser({ data: readPrefs(pf) });
      if (error) throw error;
      state.user = data.user;
      toast('Saved');
    });
  });
  $('#me-form', app).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button[type=submit]'), async () => {
      const { error: e1 } = await sb.from('members').update({
        display_name: f.display_name.value.trim(),
        household: f.household.value.trim() || null,
        birthday: f.birthday.value || null,
      }).eq('id', state.me.id);
      if (e1) throw e1;
      const { error: e2 } = await sb.from('member_contacts').upsert({
        member_id: state.me.id,
        family_id: state.family.id,
        phone: f.phone.value.trim() || null,
        email: f.email.value.trim() || null,
        address: f.address.value.trim() || null,
        share_with_family: f.share.checked,
      });
      if (e2) throw e2;
      await loadMembers();
      toast('Saved. Thank you!');
      go('');
    });
  });
  $('#signout', app).addEventListener('click', () => signOutHere());
}

// ---------------------------------------------------------------- Family
export async function family(app) {
  await loadMembers();
  const admin = isAdmin();
  const link = inviteLink();
  const people = state.members;

  app.innerHTML = html`<main class="page">
    ${header(state.family.name, { sub: `${kind().label} · ${people.length} people` })}

    ${admin && state.pendingMembers.length ? html`<section class="card stack notice">
      <h2>Waiting for approval</h2>
      ${state.pendingMembers.map((p) => html`<div class="person">
        ${avatar(p.display_name, p.id, 40)}
        <div class="grow strong">${p.display_name}</div>
        <button class="btn tiny" data-approve="${p.id}">Let in</button>
        <button class="btn tiny ghost" data-decline="${p.id}">Decline</button>
      </div>`)}
    </section>` : ''}

    <section class="card stack accent">
      <h2>Invite people</h2>
      <p>${setting('approve_members')
        ? 'Send this link. People sign in with their email, and you approve them.'
        : 'Send this link. People sign in with their email and they’re in.'}</p>
      <div class="link-box">${link}</div>
      <div class="row wrap">
        <button class="btn" id="share">${icon('share', 18)} Share link</button>
        <button class="btn ghost" id="copy">${icon('copy', 18)} Copy</button>
        ${admin ? html`<button class="btn ghost" id="new-code">New link</button>` : ''}
      </div>
    </section>
    ${admin ? html`<a class="btn ghost block" href="#/settings">${icon('key', 18)} Group settings</a>` : ''}

    <section class="stack">
      <h2 class="section-title">Everyone</h2>
      ${people.map((p) => html`<div class="person card">
        ${avatar(p.display_name, p.id, 44)}
        <div class="grow">
          <div class="strong">${p.display_name}${p.id === state.me.id ? ' (you)' : ''}</div>
          <div class="muted small">${[p.household, p.birthday ? 'Birthday ' + shortDate(p.birthday) : '', p.user_id ? '' : 'No account yet'].filter(Boolean).join(' · ')}</div>
        </div>
        ${p.role !== 'member' ? html`<span class="badge">${p.role === 'owner' ? 'Owner' : 'Admin'}</span>` : ''}
        ${admin && p.role !== 'owner' && p.id !== state.me.id ? html`<details class="menu">
          <summary aria-label="Options for ${p.display_name}">•••</summary>
          <div class="menu-body">
            ${p.user_id ? html`<button data-role="${p.id}" data-to="${p.role === 'admin' ? 'member' : 'admin'}">${p.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>` : ''}
            <button data-remove="${p.id}" class="danger">Remove from family</button>
          </div>
        </details>` : ''}
      </div>`)}
    </section>

    ${admin ? html`<form id="add-form" class="card stack">
      <h2>${state.family.kind === 'family' ? 'Add a relative' : 'Add someone'}</h2>
      <p class="muted small">${state.family.kind === 'family'
        ? 'For children, in-laws or grandparents. They can link their own account later from the invite link.'
        : 'For people without an account yet, like a rebbe or a guest of honor. They can link their own account later.'}</p>
      <label class="field">Name <input name="name" required maxlength="80"></label>
      <label class="field">Household <input name="household" maxlength="120" placeholder="Avi & Dina Levi"></label>
      <label class="field">Birthday <input type="date" name="birthday"></label>
      <button class="btn" type="submit">${icon('plus', 18)} Add</button>
    </form>` : ''}
    ${state.me.role !== 'owner' ? html`<button class="btn link danger" id="leave">Leave ${state.family.name}</button>` : ''}
  </main>`.s;

  const message = `Join ${state.family.name} on GiftTogether: ${link}`;
  $('#copy', app).addEventListener('click', () => copyText(link, 'Invite link copied'));
  $('#share', app).addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title: state.family.name, text: message }); } catch { /* cancelled */ }
    } else {
      location.href = 'sms:?&body=' + encodeURIComponent(message);
    }
  });
  $('#new-code', app)?.addEventListener('click', (e) => {
    if (!confirm('Make a new invite link? The old one will stop working.')) return;
    busy(e.target, async () => {
      const { data, error } = await sb.rpc('new_invite_code', { p_family: state.family.id });
      if (error) throw error;
      state.family.invite_code = data;
      toast('New invite link ready');
      go('family');
    });
  });
  $$('[data-role]', app).forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    const { error } = await sb.from('members').update({ role: b.dataset.to }).eq('id', b.dataset.role);
    if (error) throw error;
    go('family');
  })));
  $$('[data-remove]', app).forEach((b) => b.addEventListener('click', () => {
    const p = state.memberById.get(b.dataset.remove);
    if (!confirm(`Remove ${p.display_name} from the family? This can’t be undone.`)) return;
    busy(b, async () => {
      const { error } = await sb.from('members').delete().eq('id', p.id);
      if (error) throw error;
      go('family');
    });
  }));
  $$('[data-approve]', app).forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    const { error } = await sb.from('members').update({ status: 'active' }).eq('id', b.dataset.approve);
    if (error) throw error;
    toast('Approved');
    go('family');
  })));
  $$('[data-decline]', app).forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    const { error } = await sb.from('members').delete().eq('id', b.dataset.decline);
    if (error) throw error;
    go('family');
  })));
  $('#leave', app)?.addEventListener('click', (e) => {
    if (!confirm(`Leave ${state.family.name}? You can join again with an invite link.`)) return;
    busy(e.target, async () => {
      const { error } = await sb.rpc('leave_family', { p_family: state.family.id });
      if (error) throw error;
      await loadFamily();
      go(state.family ? '' : 'welcome');
    });
  });
  $('#add-form', app)?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      const { error } = await sb.from('members').insert({
        family_id: state.family.id,
        display_name: f.name.value.trim(),
        household: f.household.value.trim() || null,
        birthday: f.birthday.value || null,
      });
      if (error) throw error;
      toast(`${f.name.value.trim()} added`);
      go('family');
    });
  });
}

// ---------------------------------------------------------------- Contacts
export async function contacts(app) {
  await loadMembers();
  const cmap = await loadContacts();
  const groups = new Map();
  for (const p of state.members) {
    const key = (p.household || p.display_name).trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const households = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, list]) => {
    const withAddress = list.map((p) => cmap.get(p.id)).find((c) => c && c.address);
    return { name, list, address: withAddress?.address || '' };
  });
  const hiddenCount = state.members.filter((p) => !cmap.has(p.id)).length;

  app.innerHTML = html`<main class="page">
    ${header(state.family.kind === 'family' ? 'Family contacts' : 'Contacts', { sub: `${households.length} households` })}
    <div class="row between no-print">
      <span class="muted small" id="sel-count">All households</span>
      <button class="btn ghost small" id="toggle-all">Select some</button>
    </div>
    <section class="stack" id="contact-list">
      ${households.map((h, i) => html`<article class="card household" data-i="${i}">
        <label class="check no-print select-box" hidden><input type="checkbox" data-pick="${i}"> <span>Include</span></label>
        <h2>${h.name}</h2>
        ${h.address ? html`<p class="address">${h.address}</p>` : html`<p class="muted small">No address shared</p>`}
        <ul class="plain">
          ${h.list.map((p) => {
            const c = cmap.get(p.id) || {};
            return html`<li class="contact-line">
              <span class="strong">${p.display_name}</span>
              ${c.phone ? html`<a href="tel:${c.phone}">${c.phone}</a>` : ''}
              ${c.email ? html`<a href="mailto:${c.email}">${c.email}</a>` : ''}
            </li>`;
          })}
        </ul>
      </article>`)}
    </section>
    ${hiddenCount ? html`<p class="muted small no-print">${hiddenCount} ${hiddenCount === 1 ? 'person keeps' : 'people keep'} their details private.</p>` : ''}
    <div class="row wrap sticky-actions no-print">
      <button class="btn" id="download">${icon('download', 18)} Download list</button>
      <button class="btn ghost" id="print">${icon('print', 18)} Print</button>
      <a class="btn ghost" href="#/me">${icon('user', 18)} My info</a>
    </div>
  </main>`.s;

  let selecting = false;
  const picks = () => $$('[data-pick]', app).filter((b) => b.checked).map((b) => Number(b.dataset.pick));
  const chosen = () => (selecting && picks().length ? picks().map((i) => households[i]) : households);
  const updateCount = () => {
    $('#sel-count', app).textContent = selecting ? `${picks().length} selected` : 'All households';
  };
  $('#toggle-all', app).addEventListener('click', (e) => {
    selecting = !selecting;
    $$('.select-box', app).forEach((l) => { l.hidden = !selecting; });
    e.target.textContent = selecting ? 'Use everyone' : 'Select some';
    updateCount();
  });
  $$('[data-pick]', app).forEach((b) => b.addEventListener('change', updateCount));

  $('#download', app).addEventListener('click', () => {
    const rows = [['Household', 'Name', 'Address', 'Phone', 'Email']];
    for (const h of chosen()) {
      for (const p of h.list) {
        const c = cmap.get(p.id) || {};
        rows.push([h.name, p.display_name, c.address || h.address, c.phone || '', c.email || '']);
      }
    }
    downloadFile(`${state.family.name} contacts.csv`, csv(rows));
  });
  $('#print', app).addEventListener('click', () => {
    const keep = new Set(chosen().map((h) => households.indexOf(h)));
    $$('.household', app).forEach((el) => el.classList.toggle('no-print', !keep.has(Number(el.dataset.i))));
    window.print();
    $$('.household', app).forEach((el) => el.classList.remove('no-print'));
  });
}

// ---------------------------------------------------------------- Accounts on this phone
export async function accounts(app) {
  const list = listAccounts();
  app.innerHTML = html`<main class="page">
    ${header('Accounts on this phone', { back: state.family ? '#/me' : '#/welcome', sub: 'Everyone listed here stays signed in' })}
    <section class="stack">
      ${list.map((a) => html`<div class="person card">
        ${avatar(a.name, a.userId, 44)}
        <div class="grow">
          <div class="strong">${a.name}</div>
          <div class="muted small">${a.email}</div>
        </div>
        ${a.key === activeKey ? html`<span class="badge green">In use</span>`
          : html`<button class="btn small" data-switch="${a.key}">Switch</button>`}
      </div>`)}
    </section>
    <button class="btn big block" id="add-account">${icon('plus', 20)} Add another account</button>
    <p class="muted small">For example, a parent and a child on one phone, or two people sharing a tablet. Each person signs in once with their own email.</p>
    <button class="btn link" id="signout-here">${icon('logout', 18)} Sign out of ${profileName() || state.user.email}</button>
  </main>`.s;
  $$('[data-switch]', app).forEach((b) => b.addEventListener('click', () => switchAccount(b.dataset.switch)));
  $('#add-account', app).addEventListener('click', () => addAccount());
  $('#signout-here', app).addEventListener('click', () => {
    if (confirm('Sign out of this account on this phone? Other accounts stay signed in.')) signOutHere();
  });
}
