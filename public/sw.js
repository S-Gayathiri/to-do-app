self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Task Reminder';
  const options = {
    body: data.body || 'You have a scheduled task.',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: {
      taskId: data.taskId,
      url: data.url || '/'
    },
    actions: data.taskId ? [
      {
        action: 'mark-done',
        title: '✅ Mark as Done'
      },
      {
        action: 'open-app',
        title: '👁️ View Task'
      }
    ] : []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const taskId = event.notification.data?.taskId;
  const targetUrl = event.notification.data?.url || '/';

  if (event.action === 'mark-done' && taskId) {
    event.waitUntil(
      (async () => {
        try {
          // 1. Call API to mark task done in Google Sheets
          await fetch('/api/mark-done', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ taskId })
          });

          // 2. Broadcast to open app tabs to update UI in real-time
          const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
          clientList.forEach(client => {
            client.postMessage({
              type: 'TASK_MARKED_DONE',
              taskId
            });
          });

          // 3. Show brief confirmation toast notification
          await self.registration.showNotification('Task Completed! 🎉', {
            body: 'Great job! The task has been marked as done.',
            icon: '/logo.png',
            badge: '/logo.png',
            vibrate: [100, 50, 100],
            requireInteraction: false
          });
        } catch (err) {
          console.error('Failed to mark task done via notification action:', err);
        }
      })()
    );
  } else {
    // Open app or focus existing active tab
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length > 0) {
          let client = clientList[0];
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].focused) {
              client = clientList[i];
            }
          }
          return client.focus();
        }
        return clients.openWindow(targetUrl);
      })
    );
  }
});

