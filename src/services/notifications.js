export const toggleDailyBriefing = async (enabled, timeString) => {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn("Notifications are not supported in this browser.");
    return false;
  }

  if (enabled) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn("Notification permission denied.");
      return false;
    }
    // Set up local alarm/interval or send to SW.
    // For PWA without backend push server, we register a sync or local check
    registerLocalAlarm(timeString);
  } else {
    clearLocalAlarm();
  }
  return true;
};

// Simplified local alarm using setTimeout for demonstration,
// In a true PWA, we might use periodic background sync or alarms API (if available), 
// but standard web apps on Android rely on Push API from a server. 
// Without a backend, we check when the app is open or use a service worker postMessage.
let alarmTimeout;

function registerLocalAlarm(timeString) {
  clearLocalAlarm();
  const [hours, minutes] = timeString.split(':').map(Number);
  
  const checkAlarm = () => {
    const now = new Date();
    if (now.getHours() === hours && now.getMinutes() === minutes && now.getSeconds() === 0) {
      triggerBriefingNotification();
    }
  };

  // Check every second (only works while app is open).
  // A true background notification without a Push server is limited on the web.
  alarmTimeout = setInterval(checkAlarm, 1000);
}

function clearLocalAlarm() {
  if (alarmTimeout) {
    clearInterval(alarmTimeout);
  }
}

export const triggerBriefingNotification = () => {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification("Good morning!", {
        body: "You have tasks scheduled for today. Let's get them done!",
        icon: "/pwa-192x192.png",
        vibrate: [200, 100, 200],
        tag: 'daily-briefing'
      });
    });
  }
};
