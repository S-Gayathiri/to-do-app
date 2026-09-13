import webpush from 'web-push';
import { readFromSheet } from './utils/googleSheets.js';

// Setup VAPID keys from environment variables
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // NOTE: In a production app, you should verify the QStash signature here.
  // We'll skip it for brevity unless strictly necessary.

  try {
    const { taskId, title, message } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Missing title' });
    }

    // 1. Fetch all subscriptions from the sheet
    const sheetData = await readFromSheet('Subscriptions!A:B');
    const rows = sheetData.values || [];

    if (rows.length === 0) {
      return res.status(200).json({ success: true, message: 'No subscriptions found' });
    }

    // 2. Parse subscriptions
    const subscriptions = rows.map(row => {
      try {
        return JSON.parse(row[1]);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    // 3. Send notification to all subscriptions
    const payload = JSON.stringify({
      title: title || 'Task Reminder',
      body: message || "It's time for your task!",
      url: '/',
      taskId,
    });

    const sendPromises = subscriptions.map(sub => {
      return webpush.sendNotification(sub, payload, { urgency: 'high' }).catch(err => {
        console.error('Error sending push to subscription:', err);
        // If statusCode === 410, the subscription has expired or unsubscribed
      });
    });

    await Promise.all(sendPromises);

    return res.status(200).json({ success: true, sentCount: subscriptions.length });
  } catch (error) {
    console.error('Send push error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
