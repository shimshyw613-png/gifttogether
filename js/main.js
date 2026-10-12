// Starts the app and shows the right screen for the address bar.
import { sb, configured, state, loadSession, loadFamily, rememberNext, takeNext, rememberAccount, needsProfile } from './data.js';
import { html, friendly } from './ui.js';
import * as auth from './pages/auth.js';
import * as home from './pages/home.js';
import * as celebrations from './pages/celebrations.js';
import * as dates from './pages/dates.js';
import * as people from './pages/people.js';
import * as groups from './pages/groups.js';
import * as calendar from './pages/calendar.js';
import { setupNotifications } from './native.js';

const app = document.getElementById('app');

const routes = [
  [/^$/, home.show],
  [/^login$/, auth.login],
  [/^profile$/, auth.profile],
  [/^accounts$/, people.accounts],
  [/^welcome$/, groups.welcome],
  [/^groups$/, groups.groups],
  [/^add$/, groups.add],
  [/^settings$/, groups.settings],
  [/^join\/([a-z0-9]+)$/i, auth.join],
  [/^new$/, celebrations.create],
  [/^c\/([0-9a-f-]{36})$/, celebrations.show],
  [/^dates$/, dates.list],
  [/^calendar$/, calendar.show],
  [/^birthday\/([0-9a-f-]{36})$/, dates.birthday],
  [/^contacts$/, people.contacts],
  [/^me$/, people.me],
  [/^family$/, people.family],
];

function currentPath() {
  return location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
}

let rendering = 0;
async function render() {
  const ticket = ++rendering;
  let path = currentPath();
  if (/access_token=|error_description=/.test(path)) return; // sign-in link still being read

  if (!state.user) {
    if (path.startsWith('join/')) rememberNext(path);
    if (path !== 'login') { location.replace('#/login'); return; }
  } else if (needsProfile() && path !== 'profile') {
    if (path.startsWith('join/')) rememberNext(path);
    location.replace('#/profile');
    return;
  } else if (!state.family && !path.startsWith('join/') && !['welcome', 'profile', 'accounts'].includes(path)) {
    location.replace('#/welcome');
    return;
  } else if (state.family && (path === 'login' || path === 'welcome' || (path === 'profile' && !needsProfile()))) {
    location.replace('#/');
    return;
  }

  if (state.family) setupNotifications();
  for (const [pattern, page] of routes) {
    const m = path.match(pattern);
    if (m) {
      try {
        window.scrollTo(0, 0);
        await page(app, ...m.slice(1));
      } catch (e) {
        if (ticket === rendering) app.innerHTML = html`<main class="page"><div class="card"><h2>That didn’t load</h2><p>${friendly(e)}</p><a class="btn" href="#/">Go home</a></div></main>`.s;
      }
      return;
    }
  }
  location.replace('#/');
}

async function boot() {
  if (!configured) {
    app.innerHTML = html`<main class="page"><div class="card">
      <h1>Almost ready</h1>
      <p>GiftTogether isn’t connected to its database yet. Open <b>config.js</b> and paste in your Supabase project URL and key (step 4 of the setup guide).</p>
    </div></main>`.s;
    return;
  }
  try {
    await loadSession();
    if (state.user) { rememberAccount(); await loadFamily(); }
  } catch (e) {
    app.innerHTML = html`<main class="page"><div class="card"><h1>Can’t connect</h1><p>${friendly(e)}</p><button class="btn" onclick="location.reload()">Try again</button></div></main>`.s;
    return;
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    const before = state.user?.id;
    state.session = session;
    state.user = session?.user || null;
    if (event === 'SIGNED_OUT') {
      state.family = null; state.me = null; state.members = [];
      location.replace('#/login');
      return;
    }
    if (event === 'SIGNED_IN' && state.user && state.user.id !== before) {
      rememberAccount();
      await loadFamily().catch(() => {});
      const next = needsProfile() ? 'profile' : takeNext();
      location.replace('#/' + (next || ''));
      render();
    }
  });

  window.addEventListener('hashchange', render);
  if (/access_token=/.test(location.hash)) {
    const next = takeNext();
    history.replaceState(null, '', location.pathname + '#/' + (next || ''));
  }
  render();
}

boot();
