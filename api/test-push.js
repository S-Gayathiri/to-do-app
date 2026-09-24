import webpush from 'web-push';
import { readFromSheet } from './utils/googleSheets.js';

const publicVapidKey = process.env.VITE_VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VITE_VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    'mailto:test@example.com',
    publicVapidKey,
    privateVapidKey
  );
}

export default async function handler(req, res) {
  try {
    const sheetData = await readFromSheet('Subscriptions!A:B');
    const rows = sheetData.values || [];

    if (rows.length === 0) {
      return res.status(200).send('<h1>No subscriptions found</h1><p>Please enable push notifications in the app first.</p>');
    }

    const subscriptions = rows.map(row => {
      try {
        return JSON.parse(row[1]);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    // Try to get a sample pending task to test the "Mark as Done" button
    let sampleTaskId = null;
    try {
      const taskData = await readFromSheet('Tasks!A:L').catch(() => readFromSheet('A:L'));
      const taskRows = taskData.values || [];
      const pendingTask = taskRows.slice(1).find(r => r[7] !== 'TRUE' && r[7] !== true);
      if (pendingTask) {
        sampleTaskId = pendingTask[0];
      }
    } catch (e) {
      console.warn('Could not fetch sample task for test push:', e);
    }

    const payload = JSON.stringify({
      title: 'Test Notification',
      body: sampleTaskId ? 'This is a test notification. Tap "Mark as Done" below to test action!' : 'This is a test notification triggered from the test endpoint!',
      url: '/',
      taskId: sampleTaskId
    });

    const results = [];
    
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub, payload);
        results.push('SUCCESS');
      } catch (err) {
        console.error('Test Push Error:', err);
        results.push(`ERROR: ${err.message || err.toString()}`);
      }
    }

    return res.status(200).send(`
      <h1>Test Push Results</h1>
      <p>Attempted to send ${subscriptions.length} notifications.</p>
      <ul>
        ${results.map((r, i) => `<li>Subscription ${i + 1}: ${r}</li>`).join('')}
      </ul>
    `);
  } catch (error) {
    return res.status(500).send(`<h1>Fatal Error</h1><pre>${error.message}</pre>`);
  }
}
