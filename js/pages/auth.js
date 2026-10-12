// Signing in, and joining a group with an invite link.
import { sb, state, loadFamily, takeNext, rememberAccount, returnAccount, switchAccount, firstName, profileName } from '../data.js';
import { isNativeApp } from '../native.js';
import { html, $, $$, icon, busy, toast } from '../ui.js';
import { go } from '../nav.js';
import { prefsFields, wirePrefs, readPrefs } from './prefs.js';

export async function login(app) {
  app.innerHTML = html`<main class="page narrow">
    <div class="hero-brand">
      <div class="logo">${icon('gift', 34)}</div>
      <h1 class="display">GiftTogether</h1>
      <p class="lead">Celebrate better, together.</p>
    </div>
    <form id="email-form" class="card stack">
      <label class="field">Your email
        <input type="email" name="email" autocomplete="email" inputmode="email" required placeholder="you@example.com">
      </label>
      <button class="btn big" type="submit">Continue</button>
      <p class="muted small">New here or coming back, it’s the same: we email you a 6-digit code. No password to remember.</p>
    </form>
    ${returnAccount() ? html`<button class="btn ghost" type="button" id="back-account">Back to ${returnAccount().name}</button>` : ''}
    <button class="btn link" type="button" id="use-password">Sign in with a password instead</button>
    <form id="password-form" class="card stack" hidden>
      <label class="field" for="pw-email">Email <input id="pw-email" type="email" name="email" autocomplete="email" required></label>
      <label class="field" for="pw-pass">Password <input id="pw-pass" type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn big" type="submit">Sign in</button>
    </form>
    <form id="code-form" class="card stack" hidden>
      <h2>Check your email</h2>
      <p>${isNativeApp() ? html`We emailed a 6-digit code to <b id="sent-to"></b>. Type it below.` : html`We sent a sign-in link to <b id="sent-to"></b>. Open it on this device.`}</p>
      <label class="field">${isNativeApp() ? 'Your code' : 'Or type the 6-digit code from the email'}
        <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="123456">
      </label>
      <button class="btn" type="submit">Sign in with code</button>
      <button class="btn ghost" type="button" id="again">Use a different email</button>
    </form>
  </main>`.s;

  const emailForm = $('#email-form', app);
  const codeForm = $('#code-form', app);
  let email = '';

  emailForm.addEventListener('submit', (e) => {
    e.preventDefault();
    email = emailForm.email.value.trim().toLowerCase();
    busy(emailForm.querySelector('button'), async () => {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: isNativeApp() ? {} : { emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
      $('#sent-to', app).textContent = email;
      emailForm.hidden = true;
      codeForm.hidden = false;
    });
  });

  codeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const token = codeForm.code.value.trim();
    busy(codeForm.querySelector('button'), async () => {
      const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw error;
    });
  });

  const pwForm = $('#password-form', app);
  $('#use-password', app).addEventListener('click', (e) => {
    pwForm.hidden = !pwForm.hidden;
    e.target.textContent = pwForm.hidden ? 'Sign in with a password instead' : 'Use an email code instead';
  });
  pwForm.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(pwForm.querySelector('button'), async () => {
      const { error } = await sb.auth.signInWithPassword({ email: pwForm.email.value.trim(), password: pwForm.password.value });
      if (error) throw error;
    });
  });

  $('#back-account', app)?.addEventListener('click', () => switchAccount(returnAccount().key));

  $('#again', app).addEventListener('click', () => {
    codeForm.hidden = true;
    emailForm.hidden = false;
  });
}

export async function join(app, code) {
  const { data: preview, error } = await sb.rpc('family_preview', { p_code: code });
  if (error) throw error;
  if (!preview) {
    app.innerHTML = html`<main class="page narrow"><div class="card stack">
      <h1>That invite link doesn’t work</h1>
      <p>It may be old. Ask the person who sent it for a new one.</p>
      <a class="btn" href="#/">Back</a></div></main>`.s;
    return;
  }
  if (preview.already_member) {
    await loadFamily(preview.family_id);
    go('');
    return;
  }
  if (preview.pending) {
    showWaiting(app, preview.name);
    return;
  }

  app.innerHTML = html`<main class="page narrow">
    <div class="hero-brand">
      <div class="logo">${icon('people', 32)}</div>
      <p class="lead">You’re invited to join</p>
      <h1 class="display">${preview.name}</h1>
      ${preview.needs_approval ? html`<p class="muted small">An admin will approve you after you join.</p>` : ''}
    </div>
    ${preview.unclaimed.length ? html`<section class="card stack">
      <h2>Are you already on the list?</h2>
      <p class="muted">Someone may have added you. Tap your name.</p>
      <div class="chip-list">
        ${preview.unclaimed.map((m) => html`<button class="chip big" data-claim="${m.id}">${m.display_name}${m.household ? html` <span class="muted small">· ${m.household}</span>` : ''}</button>`)}
      </div>
    </section>` : ''}
    <form id="new-form" class="card stack">
      <h2>${preview.unclaimed.length ? 'Not on the list?' : 'What’s your name?'}</h2>
      <label class="field" for="join-name">Your name, as the group will see it
        <input id="join-name" name="name" required maxlength="80" autocomplete="name" value="${preview.kind === 'family' || preview.kind === 'friends' ? firstName() : profileName()}">
      </label>
      <button class="btn big" type="submit">Join ${preview.name}</button>
    </form>
  </main>`.s;

  async function doJoin(button, claim, name) {
    await busy(button, async () => {
      const { data: memberId, error: err } = await sb.rpc('join_family', { p_code: code, p_claim: claim, p_display_name: name });
      if (err) throw err;
      const bday = state.user?.user_metadata?.birthday;
      if (bday && memberId) {
        await sb.from('members').update({ birthday: bday }).eq('id', memberId).is('birthday', null);
      }
      if (preview.needs_approval) {
        await loadFamily();
        showWaiting(app, preview.name);
        return;
      }
      await loadFamily(preview.family_id);
      toast(`Welcome to ${preview.name}!`);
      go('me');
      return memberId;
    });
  }

  $$('[data-claim]', app).forEach((b) => b.addEventListener('click', () => doJoin(b, b.dataset.claim, null)));
  $('#new-form', app).addEventListener('submit', (e) => {
    e.preventDefault();
    doJoin(e.target.querySelector('button'), null, e.target.name.value);
  });
}

function showWaiting(app, name) {
  app.innerHTML = html`<main class="page narrow"><div class="card stack center">
    <div class="logo">${icon('lock', 30)}</div>
    <h1>Almost in</h1>
    <p>You asked to join <b>${name}</b>. An admin will let you in soon, and then you’ll see everything here.</p>
    <a class="btn" href="#/">OK</a>
  </div></main>`.s;
}

// The one-time profile step for new people, right after their first sign-in.
export async function profile(app) {
  const m = state.user?.user_metadata || {};
  app.innerHTML = html`<main class="page narrow">
    <div class="hero-brand">
      <div class="logo">${icon('user', 32)}</div>
      <h1 class="display">Welcome!</h1>
      <p class="lead">Tell us a little about you. It takes 10 seconds.</p>
    </div>
    <form id="profile-form" class="card stack">
      <div class="grid2">
        <label class="field" for="p-first">First name
          <input id="p-first" name="first" required maxlength="40" autocomplete="given-name" value="${m.first_name || ''}">
        </label>
        <label class="field" for="p-last">Last name
          <input id="p-last" name="last" maxlength="40" autocomplete="family-name" value="${m.last_name || ''}">
        </label>
      </div>
      <label class="field" for="p-bday">Birthday <span class="muted small">(so your groups can celebrate you)</span>
        <input id="p-bday" type="date" name="birthday" value="${m.birthday || ''}">
      </label>
    </form>
    <form id="setup-form" class="card stack">
      <h2>A few quick questions</h2>
      <p class="muted small">So the app is set up right for you.</p>
      ${prefsFields(m)}
      <p class="muted small">Signed in as ${state.user?.email}</p>
      <button class="btn big" type="submit">Continue</button>
    </form>
  </main>`.s;

  const setup = $('#setup-form', app);
  wirePrefs(setup);
  $('#profile-form', app).addEventListener('submit', (e) => { e.preventDefault(); setup.requestSubmit(); });
  setup.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = $('#profile-form', app);
    if (!f.reportValidity()) return;
    busy(setup.querySelector('button[type=submit]'), async () => {
      const { data, error } = await sb.auth.updateUser({
        data: { first_name: f.first.value.trim(), last_name: f.last.value.trim(), birthday: f.birthday.value || null, ...readPrefs(setup) },
      });
      if (error) throw error;
      state.user = data.user;
      rememberAccount();
      await loadFamily();
      go(takeNext() || '');
    });
  });
}
