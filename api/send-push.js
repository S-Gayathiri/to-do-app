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

  const { 
    taskId, 
    title: initialTitle, 
    message, 
    profile: initialProfile, 
    is_urgent, 
    is_important,
    reminder_time,
    task_date,
    timeZone
  } = req.body;

  let title = initialTitle;
  let profile = initialProfile;

  const randomQuote = getQuoteForQuadrant(is_urgent, is_important);
  const quadrant = getQuadrantString(is_urgent, is_important);

  const normalizeTime = (t) => {
    if (!t) return '';
    const parts = t.trim().split(':');
    if (parts.length < 2) return t.trim();
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  };

  // NOTE: In a production app, you should verify the QStash signature here.
  // We'll skip it for brevity unless strictly necessary.

  try {
    // Check if task exists and validate current state against Google Sheets
    if (taskId) {
      try {
        const tasksSheetData = await readFromSheet('Tasks!A:K');
        const taskRows = tasksSheetData.values || [];
        const taskRow = taskRows.find(r => r[0] === taskId);

        // 1. If task was deleted, skip notification
        if (!taskRow) {
          console.log(`Task ${taskId} not found in sheet (deleted). Skipping notification.`);
          return res.status(200).json({ success: true, message: 'Task deleted, notification skipped' });
        }

        const isRecurring = taskRow[8] === 'TRUE' || taskRow[8] === true || taskRow[8] === 'true';
        const isCompleted = taskRow[5] === 'TRUE' || taskRow[5] === true || taskRow[5] === 'true';
        const currentReminderTime = (taskRow[6] || '').trim();
        const currentTaskDate = (taskRow[3] || '').trim();
        const userTz = timeZone || 'Asia/Kolkata';
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: userTz }).format(new Date());
        const todayUTC = new Date().toISOString().split('T')[0];

        // 2. Check if already completed
        if (isRecurring) {
          const completedDates = (taskRow[10] || '').split(',').map(s => s.trim());
          if (completedDates.includes(todayStr) || completedDates.includes(todayUTC)) {
            return res.status(200).json({ success: true, message: 'Task already completed for today, skipped notification' });
          }
        } else {
          if (isCompleted) {
            return res.status(200).json({ success: true, message: 'Task already completed, skipped notification' });
          }
        }

        // 3. Check if reminder was removed/cleared
        if (!currentReminderTime) {
          console.log(`Task ${taskId} has no reminder_time set in sheet. Skipping notification.`);
          return res.status(200).json({ success: true, message: 'Task reminder cleared, notification skipped' });
        }

        // 4. Stale reminder check: Does reminder_time in sheet still match what was scheduled?
        if (reminder_time && normalizeTime(currentReminderTime) !== normalizeTime(reminder_time)) {
          console.log(`Task ${taskId} reminder_time mismatch: scheduled=${reminder_time}, sheet=${currentReminderTime}. Skipping stale notification.`);
          return res.status(200).json({ 
            success: true, 
            message: `Task reminder time changed from ${reminder_time} to ${currentReminderTime}, stale notification skipped` 
          });
        }

        // 5. Fallback for legacy messages without reminder_time in payload: verify against current local time
        if (!reminder_time && currentReminderTime) {
          const nowTimeStr = new Intl.DateTimeFormat('en-US', {
            timeZone: userTz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).format(new Date());

          const [curH, curM] = nowTimeStr.split(':').map(Number);
          const [remH, remM] = currentReminderTime.split(':').map(Number);
          const diffMinutes = Math.abs((curH * 60 + curM) - (remH * 60 + remM));

          if (diffMinutes > 5 && diffMinutes < (24 * 60 - 5)) {
            console.log(`Task ${taskId} trigger time (${nowTimeStr}) does not match sheet reminder (${currentReminderTime}). Skipping stale legacy notification.`);
            return res.status(200).json({ 
              success: true, 
              message: `Legacy trigger time ${nowTimeStr} does not match sheet reminder ${currentReminderTime}, stale notification skipped` 
            });
          }
        }

        // 6. Stale date check: For non-recurring tasks, does task_date in sheet still match?
        if (!isRecurring && task_date && currentTaskDate && currentTaskDate !== task_date.trim()) {
          console.log(`Task ${taskId} task_date mismatch: scheduled=${task_date}, sheet=${currentTaskDate}. Skipping stale notification.`);
          return res.status(200).json({ 
            success: true, 
            message: `Task date changed from ${task_date} to ${currentTaskDate}, stale notification skipped` 
          });
        }

        // Use the freshest title and profile from the sheet
        if (taskRow[2]) title = taskRow[2];
        if (taskRow[1]) profile = taskRow[1];

      } catch (err) {
        console.error('Error verifying task in send-push:', err);
      }
    }

    if (!title) {
      return res.status(400).json({ error: 'Missing title' });
    }

    // 1. Fetch all subscriptions from the sheet
    const sheetData = await readFromSheet('Subscriptions!A:C');
    const data = sheetData.values || [];

    if (data.length === 0) {
      return res.status(200).json({ success: true, message: 'No subscriptions found' });
    }

    // 2. Parse, filter, and deduplicate subscriptions by endpoint
    const uniqueSubs = new Map();
    data.forEach((row, index) => {
      if (row[1]) {
        try {
          const sub = JSON.parse(row[1]);
          if (!sub || !sub.endpoint) return;

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
            uniqueSubs.set(sub.endpoint, sub);
          }
        } catch (e) {
          // Skip header or invalid JSON row
        }
      }
    });

    const subscriptions = Array.from(uniqueSubs.values());

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
