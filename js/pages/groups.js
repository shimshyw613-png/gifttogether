// Starting, joining and switching between groups, and the admins' group settings.
import { sb, state, KINDS, setting, isAdmin, loadFamily, switchGroup, refreshGroup, firstName, profileName, signOutHere, prefs } from '../data.js';
import { html, $, $$, icon, header, busy, toast, money, toCents } from '../ui.js';
import { go } from '../nav.js';

function codeFrom(text) {
  const m = String(text).match(/join\/([a-f0-9]+)/i) || String(text).trim().match(/^([a-f0-9]{12})$/i);
  return m ? m[1].toLowerCase() : null;
}

// Used for the first screen after signing in, and for "add another group".
export async function startOrJoin(app, { first = false } = {}) {
  const pending = state.groups.filter((g) => g.member.status === 'pending');
  app.innerHTML = html`<main class="page ${first ? 'narrow' : ''}">
    ${first ? html`<div class="hero-brand">
      <div class="logo">${icon('gift', 34)}</div>
      <h1 class="display">Welcome!</h1>
      <p class="lead">Signed in as ${state.user.email}</p>
    </div>` : header('Add a group', { back: '#/groups' })}

    ${pending.length ? html`<section class="card stack notice">
      <h2>Waiting for approval</h2>
      ${pending.map((g) => html`<p>${icon('lock', 16)} <b>${g.family.name}</b>: an admin will let you in soon.</p>`)}
    </section>` : ''}

    <form id="join-form" class="card stack">
      <h2>Have an invite link?</h2>
      <p class="muted">Paste the link someone sent you.</p>
      <label class="field" for="join-link">Invite link
        <input id="join-link" name="link" required placeholder="https://…/#/join/…">
      </label>
      <button class="btn big" type="submit">Join</button>
    </form>

    <form id="start-form" class="card stack">
      <h2>Start a group</h2>
      <fieldset class="field"><legend>What kind of group?</legend>
        <div class="chip-list">
          ${Object.entries(KINDS).map(([k, v], i) => html`<label class="chip-radio"><input type="radio" name="kind" value="${k}" ${i === 0 ? 'checked' : ''}><span>${v.label}</span></label>`)}
        </div>
      </fieldset>
      <p class="muted small" id="kind-note"></p>
      <label class="field" for="start-name">Group name
        <input id="start-name" name="group" required maxlength="80" placeholder="${KINDS.family.example}">
      </label>
      <label class="field" for="start-me">Your name, as the group will see it
        <input id="start-me" name="name" required maxlength="80" autocomplete="name" placeholder="Sarah" value="${firstName()}">
      </label>
      <button class="btn big" type="submit">Start the group</button>
    </form>
    ${first ? html`<button class="btn ghost" id="signout">${icon('logout', 18)} Sign out</button>` : ''}
  </main>`.s;

  const f = $('#start-form', app);
  const describe = () => {
    const k = KINDS[f.querySelector('input[name=kind]:checked').value];
    const s = k.settings;
    f.group.placeholder = k.example;
    const kindKey = f.querySelector('input[name=kind]:checked').value;
    if (!f.name.dataset.touched) f.name.value = ['family', 'friends'].includes(kindKey) ? firstName() : (profileName() || firstName());
    $('#kind-note', app).textContent = [
      s.approve_members ? 'You approve everyone who joins' : 'Anyone with the invite link can join',
      s.who_can_create === 'admins' ? 'only admins start collections' : 'anyone can start a collection',
      s.share_contacts_default ? 'contact details shared' : 'contact details private unless people share them',
    ].join(' · ') + '. You can change all of this later in Group settings.';
  };
  f.name.addEventListener('input', () => { f.name.dataset.touched = '1'; });
  $$('input[name=kind]', f).forEach((r) => r.addEventListener('change', describe));
  describe();

  $('#join-form', app).addEventListener('submit', (e) => {
    e.preventDefault();
    const code = codeFrom(e.target.link.value);
    if (!code) { toast('That doesn’t look like an invite link', 'error'); return; }
    go('join/' + code);
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const k = f.querySelector('input[name=kind]:checked').value;
    busy(f.querySelector('button'), async () => {
      const { data: id, error } = await sb.rpc('create_family', {
        p_name: f.group.value, p_display_name: f.name.value, p_kind: k, p_settings: { ...KINDS[k].settings, tradition: prefs().tradition || null },
      });
      if (error) throw error;
      const bday = state.user?.user_metadata?.birthday;
      if (bday) await sb.from('members').update({ birthday: bday }).eq('family_id', id).eq('user_id', state.user.id);
      await loadFamily(id);
      toast('Your group is ready. Next: invite people!');
      go('family');
    });
  });
  $('#signout', app)?.addEventListener('click', () => signOutHere());
}

export async function welcome(app) {
  return startOrJoin(app, { first: true });
}

export async function add(app) {
  return startOrJoin(app, { first: false });
}

// All my groups, to switch between them.
export async function groups(app) {
  await loadFamily(state.family?.id);
  app.innerHTML = html`<main class="page">
    ${header('My groups')}
    <section class="stack">
      ${state.groups.map((g) => {
        const k = KINDS[g.family.kind] || KINDS.family;
        const current = g.family.id === state.family?.id;
        const waiting = g.member.status === 'pending';
        return html`<button class="card group-row ${current ? 'current' : ''}" data-group="${g.family.id}" ${waiting ? 'disabled' : ''}>
          <span class="grow"><span class="strong block-text">${g.family.name}</span>
            <span class="muted small">${k.label}${g.member.role !== 'member' ? ' · ' + (g.member.role === 'owner' ? 'Owner' : 'Admin') : ''}</span></span>
          ${current ? html`<span class="badge green">${icon('check', 13)} Open</span>` : waiting ? html`<span class="badge gold">Waiting for approval</span>` : html`<span class="muted small">Open</span>`}
        </button>`;
      })}
    </section>
    <a class="btn big block" href="#/add">${icon('plus', 20)} Start or join another group</a>
  </main>`.s;
  $$('[data-group]', app).forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    await switchGroup(b.dataset.group);
    toast(`Now in ${state.family.name}`);
    go('');
  })));
}

// Admins tailor the group to fit how it works.
export async function settings(app) {
  if (!isAdmin()) { go(''); return; }
  await refreshGroup();
  const f0 = state.family;
  const feats = setting('features') || {};
  const on = (k) => feats[k] !== false;
  app.innerHTML = html`<main class="page">
    ${header('Group settings', { back: '#/family', sub: f0.name })}
    <form id="settings-form" class="stack">
      <section class="card stack">
        <label class="field" for="g-name">Group name <input id="g-name" name="name" required maxlength="80" value="${f0.name}"></label>
        <label class="field" for="g-kind">Kind of group
          <select id="g-kind" name="kind">${Object.entries(KINDS).map(([k, v]) => html`<option value="${k}" ${k === f0.kind ? 'selected' : ''}>${v.label}</option>`)}</select>
        </label>
      </section>

      <section class="card stack">
        <h2>Who can join</h2>
        <label class="switch-row" for="g-approve">
          <span class="grow"><span class="strong">Approve new people</span>
            <span class="muted small block-text">People with the invite link wait until an admin lets them in. Good for classes and communities.</span></span>
          <input type="checkbox" id="g-approve" name="approve" class="switch" ${setting('approve_members') ? 'checked' : ''}>
        </label>
        <label class="switch-row" for="g-share">
          <span class="grow"><span class="strong">Share contact details by default</span>
            <span class="muted small block-text">When off, new people’s phone and address stay private until they choose to share.</span></span>
          <input type="checkbox" id="g-share" name="share" class="switch" ${setting('share_contacts_default') ? 'checked' : ''}>
        </label>
      </section>

      <section class="card stack">
        <h2>Collections</h2>
        <fieldset class="field"><legend>Who can start a collection?</legend>
          <div class="chip-list">
            <label class="chip-radio"><input type="radio" name="who" value="anyone" ${setting('who_can_create') !== 'admins' ? 'checked' : ''}><span>Anyone</span></label>
            <label class="chip-radio"><input type="radio" name="who" value="admins" ${setting('who_can_create') === 'admins' ? 'checked' : ''}><span>Admins only</span></label>
          </div>
        </fieldset>
        <label class="field" for="g-suggested">Usual amount each <span class="muted small">(filled in for new collections)</span>
          <input id="g-suggested" name="suggested" inputmode="decimal" placeholder="$18" value="${setting('suggested_cents') ? money(setting('suggested_cents')) : ''}">
        </label>
      </section>

      <section class="card stack">
        <h2>Sections</h2>
        <p class="muted small">Turn off what this group doesn’t need. Nothing is deleted.</p>
        ${[['celebrations', 'Celebrations and collections'], ['dates', 'Dates (birthdays, anniversaries, yahrzeits)'],
           ['wishes', 'Birthday wishes'], ['contacts', 'Contacts list']].map(([k, label]) => html`<label class="check" for="feat-${k}">
          <input type="checkbox" id="feat-${k}" name="feat" value="${k}" ${on(k) ? 'checked' : ''}><span>${label}</span></label>`)}
      </section>

      <button class="btn big" type="submit">Save settings</button>
    </form>
  </main>`.s;

  $('#settings-form', app).addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const features = {};
    $$('input[name=feat]', f).forEach((cb) => { features[cb.value] = cb.checked; });
    const next = {
      ...(f0.settings || {}),
      approve_members: f.approve.checked,
      share_contacts_default: f.share.checked,
      who_can_create: f.querySelector('input[name=who]:checked').value,
      suggested_cents: toCents(f.suggested.value) || null,
      features,
    };
    busy(f.querySelector('button[type=submit]'), async () => {
      const { error } = await sb.from('families').update({ name: f.name.value.trim(), kind: f.kind.value, settings: next }).eq('id', f0.id);
      if (error) throw error;
      await refreshGroup();
      toast('Settings saved');
      go('family');
    });
  });
}

