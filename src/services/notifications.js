export const initNotifications = async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (error) {
    console.error('SW registration failed:', error);
  }
};

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

export const scheduleTaskReminder = async (task) => {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  
  if (!task.reminder_time) return;

  const [year, month, day] = task.task_date.split('-');
  const [hours, minutes] = task.reminder_time.split(':');
  
  const timestamp = new Date(year, month - 1, day, hours, minutes, 0).getTime();
  
  if (timestamp < Date.now()) return; // Already passed

  try {
    // Try using the experimental Notification Triggers API
    // Note: This only works in Chrome on Android currently.
    if ('showTrigger' in Notification.prototype) {
      await registration.showNotification(task.title, {
        tag: task.id,
        body: `It's time to work on: ${task.title}`,
        icon: '/pwa-192x192.png',
        vibrate: [200, 100, 200],
        showTrigger: new window.TimestampTrigger(timestamp)
      });
      return;
    }
  } catch (e) {
    console.warn("Notification Triggers API failed or not supported:", e);
  }

  // Fallback: Local timeout if the app remains open
  const delay = timestamp - Date.now();
  if (delay > 0 && delay < 2147483647) { // Max setTimeout delay
    setTimeout(() => {
      registration.showNotification(task.title, {
        tag: task.id,
        body: `It's time to work on: ${task.title}`,
        icon: '/pwa-192x192.png',
        vibrate: [200, 100, 200]
      });
    }, delay);
  }
};

export const toggleDailyBriefing = async (enabled, timeString) => {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return false;
  
  // Basic implementation of daily briefing - in a real app this would
  // use a background sync or server push.
  return true;
};
