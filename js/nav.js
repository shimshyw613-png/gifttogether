// Moves to another screen (re-showing the current one if it's the same).
export function go(path) {
  const target = '#/' + String(path).replace(/^#?\/?/, '');
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}
