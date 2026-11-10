import webpush from 'web-push';
import { readFromSheet } from './utils/googleSheets.js';
import { getQuoteForQuadrant, getQuadrantString } from './utils/quotes.js';

// Setup VAPID keys from environment variables
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || process.env.VITE_VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    'mailto:test@example.com',
    publicVapidKey,
    privateVapidKey
  );
}

// Convert any time string (e.g. "10:30", "10:30:00", "5:15 PM", "17:15") to total minutes from midnight
function parseTimeToMinutes(t) {
  if (!t || typeof t !== 'string') return null;
  const str = t.trim().toLowerCase();
  const isPM = str.includes('pm');
  const isAM = str.includes('am');
  const clean = str.replace(/[^\d:]/g, '');
  const parts = clean.split(':').map(Number);
  if (parts.length === 0 || isNaN(parts[0])) return null;
  let hours = parts[0];
  let minutes = parts.length > 1 && !isNaN(parts[1]) ? parts[1] : 0;
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// Compare two date strings to see if they refer to different calendar days (>= 20 hours apart)
function areDatesDifferentDays(d1Str, d2Str) {
  if (!d1Str || !d2Str) return false;
  if (d1Str.trim() === d2Str.trim()) return false;

  const toYMD = (str) => {
    const s = str.trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  };

  const ymd1 = toYMD(d1Str);
  const ymd2 = toYMD(d2Str);
  if (ymd1 && ymd2) {
    return ymd1 !== ymd2;
  }

  const t1 = Date.parse(d1Str);
  const t2 = Date.parse(d2Str);
  if (isNaN(t1) || isNaN(t2)) return false; // Fail open if parsing is uncertain
  return Math.abs(t1 - t2) >= 20 * 60 * 60 * 1000;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {}
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
  } = body || {};

  let title = initialTitle;
  let profile = initialProfile;
  let isYearlyTask = false;

  const randomQuote = getQuoteForQuadrant(is_urgent, is_important);
  const quadrant = getQuadrantString(is_urgent, is_important);

  try {
    // Check if task exists and validate current state against Google Sheets
    if (taskId) {
      try {
        let taskRows = [];
        try {
          const sheetData = await readFromSheet('Tasks!A:K');
          taskRows = sheetData.values || [];
        } catch (e1) {
          try {
            const sheetData = await readFromSheet('A:K');
            taskRows = sheetData.values || [];
          } catch (e2) {
            console.warn('Could not read tasks sheet for validation:', e2.message);
          }
        }

        const taskRow = taskRows.find(r => r && r[0] && r[0].toString().trim() === taskId.toString().trim());

        // 1. If we successfully loaded the sheet and the task is definitively gone (deleted), skip
        if (taskRows.length > 1 && !taskRow) {
          console.log(`Task ${taskId} not found in sheet (deleted). Skipping notification.`);
          return res.status(200).json({ success: true, message: 'Task deleted, notification skipped' });
        }

        if (taskRow) {
          // Columns: [0] id, [1] profile, [2] title, [3] task_date, [4] time_block,
          //          [5] is_completed, [6] reminder_time, [7] created_at, [8] is_recurring,
          //          [9] recurrence_pattern, [10] completed_dates
          if (taskRow[2]) title = taskRow[2];
          if (taskRow[1]) profile = taskRow[1];

          const isRecurring = taskRow[8] === 'TRUE' || taskRow[8] === true || taskRow[8] === 'true';
          const isCompleted = taskRow[5] === 'TRUE' || taskRow[5] === true || taskRow[5] === 'true';
          const currentReminderTime = (taskRow[6] || '').toString().trim();
          const currentTaskDate = (taskRow[3] || '').toString().trim();
          const recurrencePattern = (taskRow[9] || '').toString().trim();

          if (recurrencePattern) {
            isYearlyTask = recurrencePattern.toLowerCase().includes('yearly') || recurrencePattern.toLowerCase().includes('annual');
          }

          const userTz = timeZone || 'Asia/Kolkata';
          const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: userTz }).format(new Date());
          const todayUTC = new Date().toISOString().split('T')[0];

          // 2. Check if already completed
          if (isRecurring) {
            const completedDates = (taskRow[10] || '').toString().split(',').map(s => s.trim());
            if (completedDates.includes(todayStr) || completedDates.includes(todayUTC)) {
              console.log(`Task ${taskId} already completed for today (${todayStr}). Skipping.`);
              return res.status(200).json({ success: true, message: 'Task already completed for today, skipped notification' });
            }
          } else {
            if (isCompleted) {
              console.log(`Task ${taskId} is already completed. Skipping.`);
              return res.status(200).json({ success: true, message: 'Task already completed, skipped notification' });
            }
          }

          // 3. Check if reminder was removed/cleared in sheet
          if (!currentReminderTime) {
            console.log(`Task ${taskId} has no reminder_time set in sheet. Skipping notification.`);
            return res.status(200).json({ success: true, message: 'Task reminder cleared, notification skipped' });
          }

          // 4. Stale reminder check: Compare reminder_time in minutes
          if (reminder_time && currentReminderTime) {
            const schedMin = parseTimeToMinutes(reminder_time);
            const sheetMin = parseTimeToMinutes(currentReminderTime);

            if (schedMin !== null && sheetMin !== null && schedMin !== sheetMin) {
              console.log(`Task ${taskId} reminder_time mismatch: scheduled=${reminder_time} (${schedMin}m), sheet=${currentReminderTime} (${sheetMin}m). Skipping stale.`);
              return res.status(200).json({ 
                success: true, 
                message: `Task reminder time changed from ${reminder_time} to ${currentReminderTime}, stale notification skipped` 
              });
            }
          }

          // 5. Stale date check: For non-recurring tasks, check if task was moved to a different day
          if (!isRecurring && task_date && currentTaskDate) {
            if (areDatesDifferentDays(currentTaskDate, task_date)) {
              console.log(`Task ${taskId} date mismatch: scheduled=${task_date}, sheet=${currentTaskDate}. Skipping stale.`);
              return res.status(200).json({ 
                success: true, 
                message: `Task date changed from ${task_date} to ${currentTaskDate}, stale notification skipped` 
              });
            }
          }
        }
      } catch (err) {
        console.error('Error verifying task in send-push (failing open):', err);
      }
    }

    if (!title) {
      return res.status(400).json({ error: 'Missing title' });
    }

    // 1. Fetch all subscriptions from the sheet
    let sheetData;
    try {
      sheetData = await readFromSheet('Subscriptions!A:C');
    } catch (e) {
      console.error('Failed to read Subscriptions sheet:', e);
      return res.status(500).json({ error: 'Failed to read subscriptions' });
    }

    const data = sheetData.values || [];
    if (data.length === 0) {
      console.log('No subscriptions found in Subscriptions sheet.');
      return res.status(200).json({ success: true, message: 'No subscriptions found' });
    }

    // 2. Parse, filter, and deduplicate subscriptions by endpoint
    const uniqueSubs = new Map();
    data.forEach((row, index) => {
      if (row[1]) {
        try {
          const sub = JSON.parse(row[1]);
          if (!sub || !sub.endpoint) return;

          const subIdentity = (row[2] || 'PattuThangam').toString().trim();
          
          // Filter by profile (case-insensitive)
          let shouldSend = true;
          if (profile && profile.toLowerCase() !== 'pattuthangam') {
            const pNorm = profile.toLowerCase();
            const sNorm = subIdentity.toLowerCase();
            if (sNorm !== pNorm && sNorm !== 'pattuthangam') {
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
      console.log(`No subscriptions matched profile filter (${profile}). Subscriptions in sheet: ${data.length}`);
      return res.status(200).json({ success: true, message: 'No matching subscriptions found' });
    }

    // 3. Send notification to all subscriptions
    const payload = JSON.stringify({
      title: title || 'Task Reminder',
      body: isYearlyTask 
        ? `🎉 Anniversary / Birthday Reminder! Celebrate ${title} today!` 
        : `${profile && profile.toLowerCase() !== 'pattuthangam' ? `[${profile}] ` : ''}${randomQuote}`,
      url: '/',
      taskId,
      quadrant
    });

    const sendPromises = subscriptions.map(sub => {
      return webpush.sendNotification(sub, payload, { urgency: 'high' }).catch(err => {
        console.error('Error sending push to subscription:', err.statusCode || err.message);
      });
    });

    await Promise.all(sendPromises);

    console.log(`Successfully sent push notification for "${title}" to ${subscriptions.length} devices.`);
    return res.status(200).json({ success: true, sentCount: subscriptions.length });
  } catch (error) {
    console.error('Send push error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
