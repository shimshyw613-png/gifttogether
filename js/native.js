// Extra abilities when GiftTogether runs as the phone app (App Store / Google Play).
// In a normal browser none of this runs.
import { sb, state } from './data.js';

export function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

let asked = false;

// Asks once for permission to send notifications and saves this phone's
// notification address so reminders and birthdays can reach it.
export async function setupNotifications() {
  if (!isNativeApp() || asked || !state.user) return;
  asked = true;
  const push = window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
  if (!push) return;
  try {
    let perm = await push.checkPermissions();
    if (perm.receive === 'prompt') perm = await push.requestPermissions();
    if (perm.receive !== 'granted') return;
    await push.addListener('registration', async ({ value }) => {
      await sb.from('device_tokens').upsert({
        token: value,
        user_id: state.user.id,
        platform: window.Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      });
    });
    // Tapping a notification opens the screen it's about, for example "#/c/<id>".
    await push.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const route = notification && notification.data && notification.data.route;
      if (route && /^[a-z0-9/-]+$/i.test(route)) location.hash = '#/' + route;
    });
    await push.register();
  } catch (e) {
    console.warn('Notifications are not available', e);
  }
}
