import webpush from 'web-push';
import { readFromSheet } from './utils/googleSheets.js';
import { getQuoteForQuadrant, getQuadrantString } from './utils/quotes.js';

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

  const { taskId, title, message, profile, is_urgent, is_important } = req.body;

  const randomQuote = getQuoteForQuadrant(is_urgent, is_important);
  const quadrant = getQuadrantString(is_urgent, is_important);

  // NOTE: In a production app, you should verify the QStash signature here.
  // We'll skip it for brevity unless strictly necessary.

  try {
    if (!title) {
      return res.status(400).json({ error: 'Missing title' });
    }

    // Check if task exists and was already completed for today (skip if done)
    if (taskId) {
      try {
        const tasksSheetData = await readFromSheet('Tasks!A:M');
        const taskRows = tasksSheetData.values || [];
        const taskRow = taskRows.find(r => r[0] === taskId);
        if (taskRow) {
          const isRecurring = taskRow[10] === 'TRUE';
          const todayStr = new Date().toISOString().split('T')[0];
          if (isRecurring) {
            const completedDates = (taskRow[12] || '').split(',').map(s => s.trim());
            if (completedDates.includes(todayStr)) {
              return res.status(200).json({ success: true, message: 'Task already completed for today, skipped notification' });
            }
          } else {
            if (taskRow[7] === 'TRUE') {
              return res.status(200).json({ success: true, message: 'Task already completed, skipped notification' });
            }
          }
        }
      } catch (err) {
        console.error('Error checking task completion in send-push:', err);
      }
    }

    // 1. Fetch all subscriptions from the sheet
    const sheetData = await readFromSheet('Subscriptions!A:C');
    const data = sheetData.values || [];

    if (data.length === 0) {
      return res.status(200).json({ success: true, message: 'No subscriptions found' });
    }

    // 2. Parse and filter subscriptions
    let subscriptions = [];
    data.forEach((row, index) => {
      if (index === 0) return; // skip header
      if (row[1]) {
        try {
          const sub = JSON.parse(row[1]);
          const subIdentity = row[2] || 'PattuThangam'; // Default if missing
          
          // Filter by profile
          let shouldSend = true;
          if (profile && profile !== 'PattuThangam') {
            // If task is specific, only send to matching identity or 'PattuThangam' devices
            if (subIdentity !== profile && subIdentity !== 'PattuThangam') {
              shouldSend = false;
            }
          }

          if (shouldSend) {
            subscriptions.push(sub);
          }
        } catch (e) {
          console.error('Invalid subscription format at row', index + 1);
        }
      }
    });

    if (subscriptions.length === 0) {
      return res.status(200).json({ success: true, message: 'No matching subscriptions found' });
    }

    // 3. Send notification to all subscriptions
    const payload = JSON.stringify({
      title: title || 'Task Reminder',
      body: `${profile && profile !== 'PattuThangam' ? `[${profile}] ` : ''}${randomQuote}`,
      url: '/',
      taskId,
      quadrant
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
