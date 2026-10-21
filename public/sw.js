self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Reminder';
  let actions = [
    { action: 'mark_done', title: '✅ Mark as done' }
  ];

  if (data.quadrant === 'Q1') {
    actions.push({ action: 'postpone_15m', title: '⏳ Postpone 15m' });
  } else if (data.quadrant === 'Q2') {
    actions.push({ action: 'postpone_1d', title: '📅 Postpone 1 day' });
  } else if (data.quadrant === 'Q3') {
    actions.push({ action: 'postpone_1h', title: '⏳ Postpone 1 hr' });
  } else if (data.quadrant === 'Q4') {
    actions.push({ action: 'delete_task', title: '🗑️ Delete Task' });
  } else {
    actions.push({ action: 'postpone_1h', title: '⏳ Postpone 1 hr' });
  }

  const options = {
    body: data.body || 'You have a scheduled task.',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: { taskId: data.taskId },
    actions: actions
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data || {};
  const taskId = data.taskId;

  if (action === 'mark_done' && taskId) {
    event.waitUntil(
      fetch('/api/mark-task-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })
    );
  } else if (action === 'delete_task' && taskId) {
    event.waitUntil(
      fetch('/api/delete-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })
    );
  } else if (action.startsWith('postpone') && taskId) {
    let minutesToAdd = 60; // default 1 hour
    if (action === 'postpone_15m') minutesToAdd = 15;
    if (action === 'postpone_1d') minutesToAdd = 24 * 60;
    
    event.waitUntil(
      fetch('/api/postpone-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, minutesToAdd })
      })
    );
  } else {
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
        return clients.openWindow('/');
      })
    );
  }
});
