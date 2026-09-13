function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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
  
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  
  if (permission === 'granted') {
    await subscribeToPush();
  }
  
  return permission === 'granted';
};

const subscribeToPush = async () => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    
    if (!publicKey) {
      console.warn('VAPID public key not found in env');
      return;
    }

    const applicationServerKey = urlB64ToUint8Array(publicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Send subscription to backend
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });
    
    console.log('Successfully subscribed to push notifications.');
  } catch (err) {
    console.error('Failed to subscribe to push notifications:', err);
  }
};

export const scheduleTaskReminder = async (task) => {
  if (!task.reminder_time || !task.task_date) return;

  const [year, month, day] = task.task_date.split('-');
  const [hours, minutes] = task.reminder_time.split(':');
  
  // Format as ISO string for backend
  const date = new Date(year, month - 1, day, hours, minutes, 0);
  
  if (date.getTime() < Date.now()) return; // Already passed

  try {
    const response = await fetch('/api/schedule-reminder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId: task.id,
        title: task.title,
        reminderTimeISO: date.toISOString(),
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to schedule reminder on backend');
    }
  } catch (err) {
    console.error('Network error scheduling reminder:', err);
  }
};
