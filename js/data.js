// Connection to the database and the signed-in person's groups.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as config from '../config.js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = config;

export const configured = /^https:\/\/.+\.supabase\.co\/?$/.test(SUPABASE_URL || '') && (SUPABASE_ANON_KEY || '').length > 20;

// ---------------------------------------------------------------- accounts on this phone
// Several people can stay signed in on one phone (a parent and a child, or a
// shared tablet). Each account keeps its own sign-in under its own storage key;
// switching accounts reloads the app with the other key.
const ACCOUNTS = 'gt.accounts';
const ACTIVE = 'gt.activeAccount';
const RETURN_TO = 'gt.returnTo';

function readList() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS)) || []; } catch { return []; }
}
function writeList(list) {
  try { localStorage.setItem(ACCOUNTS, JSON.stringify(list)); } catch { /* private mode */ }
}
function setActive(key) {
  try { if (key) localStorage.setItem(ACTIVE, key); else localStorage.removeItem(ACTIVE); } catch { /* private mode */ }
}

export const activeKey = (() => {
  try { return localStorage.getItem(ACTIVE) || 'gt-acct-1'; } catch { return 'gt-acct-1'; }
})();

export function accounts() {
  return readList();
}

export function profileName(user = state.user) {
  const m = user?.user_metadata || {};
  return [m.first_name, m.last_name].filter(Boolean).join(' ');
}

export function firstName(user = state.user) {
  return user?.user_metadata?.first_name || '';
}

// New people fill in their name (and birthday) once, right after signing up.
export function needsProfile() {
  return !!state.user && !state.user.user_metadata?.first_name;
}

// Adds (or refreshes) the signed-in account in this phone's account list.
export function rememberAccount() {
  if (!state.user) return;
  const list = readList().filter((a) => a.key !== activeKey && a.userId !== state.user.id);
  list.push({ key: activeKey, userId: state.user.id, email: state.user.email, name: profileName() || state.user.email });
  writeList(list);
}

export function switchAccount(key) {
  setActive(key);
  location.hash = '#/';
  location.reload();
}

// Opens the sign-in screen for one more person, keeping everyone else signed in.
export function addAccount() {
  try { localStorage.setItem(RETURN_TO, activeKey); } catch { /* private mode */ }
  setActive('gt-acct-' + Date.now().toString(36));
  location.hash = '#/login';
  location.reload();
}

// While adding an account: the account to go back to if the person cancels.
export function returnAccount() {
  let key = null;
  try { key = localStorage.getItem(RETURN_TO); } catch { /* private mode */ }
  return readList().find((a) => a.key === key && a.key !== activeKey) || null;
}

// Signs out only the account in use, then opens the next one on this phone.
export async function signOutHere() {
  await sb.auth.signOut({ scope: 'local' }).catch(() => {});
  const rest = readList().filter((a) => a.key !== activeKey);
  writeList(rest);
  setActive(rest[0]?.key || null);
  location.hash = rest[0] ? '#/' : '#/login';
  location.reload();
}

export const sb = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: activeKey },
    })
  : null;

// The kinds of group people can start, with sensible starting settings.
export const KINDS = {
  family: {
    label: 'Family', noun: 'family', people: 'Family members', example: 'The Levi Family',
    settings: { approve_members: false, who_can_create: 'anyone', share_contacts_default: true,
                features: { celebrations: true, dates: true, wishes: true, contacts: true } },
  },
  community: {
    label: 'Shul or community', noun: 'community', people: 'Members', example: 'Beth Israel Sisterhood',
    settings: { approve_members: true, who_can_create: 'admins', share_contacts_default: false,
                features: { celebrations: true, dates: true, wishes: true, contacts: true } },
  },
  school: {
    label: 'Yeshiva or school class', noun: 'class', people: 'Students and staff', example: 'Rabbi Klein’s 8th grade',
    settings: { approve_members: true, who_can_create: 'admins', share_contacts_default: false, suggested_cents: 1800,
                features: { celebrations: true, dates: true, wishes: true, contacts: false } },
  },
  college: {
    label: 'College friends', noun: 'group', people: 'Friends', example: 'Floor 3 roommates',
    settings: { approve_members: false, who_can_create: 'anyone', share_contacts_default: false, suggested_cents: 1000,
                features: { celebrations: true, dates: true, wishes: true, contacts: true } },
  },
  friends: {
    label: 'Friends', noun: 'group', people: 'Friends', example: 'The Sunday Chevra',
    settings: { approve_members: false, who_can_create: 'anyone', share_contacts_default: true,
                features: { celebrations: true, dates: true, wishes: true, contacts: true } },
  },
  other: {
    label: 'Other group', noun: 'group', people: 'Members', example: 'Our group',
    settings: { approve_members: true, who_can_create: 'anyone', share_contacts_default: false,
                features: { celebrations: true, dates: true, wishes: true, contacts: true } },
  },
};

// What every screen needs to know.
export const state = {
  session: null,
  user: null,
  groups: [], // every group I belong to (or asked to join): [{ member, family }]
  family: null, // the group I'm looking at: { id, name, invite_code, kind, settings }
  me: null, // my row in members for that group
  members: [], // everyone in the group (approved)
  pendingMembers: [], // people waiting for approval
  memberById: new Map(),
};

export function isAdmin() {
  return state.me && (state.me.role === 'owner' || state.me.role === 'admin');
}

export function nameOf(memberId) {
  return state.memberById.get(memberId)?.display_name || 'Someone';
}

export function kind() {
  return KINDS[state.family?.kind] || KINDS.family;
}

export function setting(key) {
  const s = state.family?.settings || {};
  return key in s ? s[key] : kind().settings[key];
}

export function feature(name) {
  const f = setting('features') || {};
  return f[name] !== false;
}

export function canCreateCelebration() {
  return feature('celebrations') && (setting('who_can_create') !== 'admins' || isAdmin());
}

export async function loadSession() {
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  state.user = data.session?.user || null;
  return state.user;
}

function rememberedGroup() {
  try { return localStorage.getItem('gt.group'); } catch { return null; }
}

// Loads every group the person is in and opens the one they used last.
export async function loadFamily(preferId) {
  state.family = null;
  state.me = null;
  state.members = [];
  state.pendingMembers = [];
  state.memberById = new Map();
  state.groups = [];
  if (!state.user) return null;
  const { data: mine, error } = await sb
    .from('members')
    .select('*, families(id, name, invite_code, kind, settings)')
    .eq('user_id', state.user.id)
    .order('created_at');
  if (error) throw error;
  state.groups = (mine || []).filter((m) => m.families).map((m) => ({ member: m, family: m.families }));
  const active = state.groups.filter((g) => g.member.status !== 'pending');
  if (!active.length) return null;
  const want = preferId || rememberedGroup();
  const pick = active.find((g) => g.family.id === want) || active[0];
  state.me = pick.member;
  state.family = pick.family;
  try { localStorage.setItem('gt.group', pick.family.id); } catch { /* private mode */ }
  await loadMembers();
  return state.family;
}

export async function switchGroup(familyId) {
  return loadFamily(familyId);
}

export async function refreshGroup() {
  const { data, error } = await sb.from('families').select('id, name, invite_code, kind, settings').eq('id', state.family.id).single();
  if (error) throw error;
  state.family = data;
  const g = state.groups.find((x) => x.family.id === data.id);
  if (g) g.family = data;
}

export async function loadMembers() {
  const { data, error } = await sb
    .from('members')
    .select('*')
    .eq('family_id', state.family.id)
    .order('display_name');
  if (error) throw error;
  state.members = data.filter((m) => m.status !== 'pending');
  state.pendingMembers = data.filter((m) => m.status === 'pending');
  state.memberById = new Map(data.map((m) => [m.id, m]));
  const fresh = state.memberById.get(state.me.id);
  if (fresh) state.me = fresh;
}

export async function loadContacts() {
  const { data, error } = await sb.from('member_contacts').select('*').eq('family_id', state.family.id);
  if (error) throw error;
  return new Map(data.map((c) => [c.member_id, c]));
}

// The address links are shared with: the public website (also from inside the phone app).
function baseUrl() {
  const fixed = (config.PUBLIC_URL || '').trim();
  if (fixed) return fixed.endsWith('/') ? fixed : fixed + '/';
  return `${location.origin}${location.pathname}`;
}

export function inviteLink(code = state.family?.invite_code) {
  return `${baseUrl()}#/join/${code}`;
}

export function celebrationLink(id) {
  return `${baseUrl()}#/c/${id}`;
}

// Remembers where to go after signing in (for invite links).
export function rememberNext(route) {
  try { localStorage.setItem('gt.next', route); } catch { /* private mode */ }
}
export function takeNext() {
  try {
    const r = localStorage.getItem('gt.next');
    localStorage.removeItem('gt.next');
    return r;
  } catch { return null; }
}

// ---------------------------------------------------------------- community and calendar settings
// Each person's answers to the setup questions live with their account.
export function prefs() {
  return state.user?.user_metadata || {};
}

// The Jewish calendar shows for Jewish users, or in groups set up as Jewish.
export function isJewish() {
  return prefs().tradition === 'jewish' || state.family?.settings?.tradition === 'jewish';
}

// Ashkenazi or Sephardi spellings (Shabbos / Shabbat, Sukkos / Sukkot).
export function hebrewStyle() {
  return prefs().minhag === 'sephardi' ? 'sephardi' : 'ashkenazi';
}
