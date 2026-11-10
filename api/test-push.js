import webpush from 'web-push';
import { readFromSheet } from './utils/googleSheets.js';

const publicVapidKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || process.env.VITE_VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    'mailto:test@example.com',
    publicVapidKey,
    privateVapidKey
  );
}

export default async function handler(req, res) {
  try {
    const sheetData = await readFromSheet('Subscriptions!A:C');
    const rows = sheetData.values || [];

    if (rows.length === 0) {
      return res.status(200).json({ success: false, message: 'No subscriptions found in sheet. Please enable push notifications first.' });
    }

    const uniqueMap = new Map();
    rows.forEach(row => {
      try {
        const sub = JSON.parse(row[1]);
        if (sub && sub.endpoint) {
          uniqueMap.set(sub.endpoint, sub);
        }
      } catch (e) {}
    });

    const subscriptions = Array.from(uniqueMap.values());

    if (subscriptions.length === 0) {
      return res.status(200).json({ success: false, message: 'No valid push subscriptions found.' });
    }

    const payload = JSON.stringify({
      title: '🔔 Test Notification',
      body: 'Push notifications are configured and working properly!',
      url: '/'
    });

    const results = [];
    
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub, payload);
        results.push('SUCCESS');
      } catch (err) {
        console.error('Test Push Error:', err);
        results.push(`ERROR: ${err.statusCode || err.message || err.toString()}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Sent test notification to ${subscriptions.length} device(s).`,
      results
    });
  } catch (error) {
    console.error('Test push handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
