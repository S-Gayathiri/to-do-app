import { Client } from "@upstash/qstash";

const qstashClient = new Client({
  token: process.env.VITE_QSTASH_TOKEN || process.env.QSTASH_TOKEN,
  baseUrl: process.env.VITE_QSTASH_URL || process.env.QSTASH_URL || "https://qstash.upstash.io"
});

const daysMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };

function getCronFromPattern(pattern, timeStr, timeZone = 'Asia/Kolkata', taskDate = null) {
  const [hoursStr, minutesStr] = (timeStr || '09:00').split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  const tz = timeZone || 'Asia/Kolkata';

  const cleanPattern = (pattern || 'daily').trim().toLowerCase();

  if (cleanPattern === 'daily') {
    return `CRON_TZ=${tz} ${minutes} ${hours} * * *`;
  }

  if (cleanPattern === 'yearly' || cleanPattern === 'annual') {
    let month = 1;
    let day = 1;
    if (taskDate) {
      const parts = taskDate.split('-').map(Number);
      if (parts.length >= 3) {
        month = parts[1]; // 1-12
        day = parts[2];   // 1-31
      }
    }
    return `CRON_TZ=${tz} ${minutes} ${hours} ${day} ${month} *`;
  }

  if (cleanPattern === 'monthly') {
    let day = 1;
    if (taskDate) {
      const parts = taskDate.split('-').map(Number);
      if (parts.length >= 3) {
        day = parts[2];
      }
    }
    return `CRON_TZ=${tz} ${minutes} ${hours} ${day} * *`;
  }

  if (cleanPattern === 'weekly') {
    let dayOfWeek = 0; // default Sunday
    if (taskDate) {
      const [y, m, d] = taskDate.split('-').map(Number);
      dayOfWeek = new Date(y, m - 1, d).getDay();
    }
    return `CRON_TZ=${tz} ${minutes} ${hours} * * ${dayOfWeek}`;
  }

  // Handle comma-separated days, e.g. "Mon,Tue,Wed,Thu,Fri" or "Sat,Sun"
  const rawDays = pattern.split(',').map(s => s.trim());
  const dayIndices = [];

  for (const day of rawDays) {
    const dayIndex = daysMap[day];
    if (dayIndex !== undefined) {
      dayIndices.push(dayIndex);
    }
  }

  if (dayIndices.length === 0 || dayIndices.length === 7) {
    return `CRON_TZ=${tz} ${minutes} ${hours} * * *`;
  }

  const sortedDays = [...new Set(dayIndices)].sort((a, b) => a - b).join(',');
  return `CRON_TZ=${tz} ${minutes} ${hours} * * ${sortedDays}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }

    const { 
      taskId, 
      title, 
      reminderTimeISO, 
      reminder_time, 
      task_date,
      timeZone,
      is_recurring, 
      recurrence_pattern, 
      profile, 
      is_urgent, 
      is_important 
    } = body || {};

    const tz = timeZone || 'Asia/Kolkata';
    const isRecurring = is_recurring === true || is_recurring === 'true' || is_recurring === 'TRUE';

    if (!title && !taskId) {
      return res.status(400).json({ error: 'Missing title or taskId' });
    }

    // Determine the base URL dynamically based on the incoming request (default to https on production)
    const host = req.headers.host;
    const isLocal = host && (host.includes('localhost') || host.includes('127.0.0.1'));
    const protocol = isLocal ? 'http' : (req.headers['x-forwarded-proto'] || 'https');
    const targetUrl = `${protocol}://${host}/api/send-push`;

    // Always delete any existing recurring QStash schedule for this task to avoid duplicates/orphaned schedules
    if (taskId) {
      try {
        await qstashClient.schedules.delete(`task-${taskId}`);
      } catch (e) {
        // Ignore if schedule did not exist
      }
    }

    // If reminder was cleared / no reminder time specified, stop here (schedule deleted above)
    if (!reminder_time) {
      return res.status(200).json({ success: true, message: 'No reminder time set, schedule cleared' });
    }

    // 1. If recurring task with a reminder time: create recurring QStash schedule
    if (isRecurring && recurrence_pattern && reminder_time) {
      const cron = getCronFromPattern(recurrence_pattern, reminder_time, tz, task_date);
      const scheduleResponse = await qstashClient.schedules.create({
        scheduleId: `task-${taskId}`,
        destination: targetUrl,
        cron,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId,
          title,
          reminder_time,
          task_date,
          timeZone: tz,
          is_recurring: true,
          recurrence_pattern,
          message: "It's time to work on your task!",
          profile,
          is_urgent,
          is_important
        })
      });

      console.log(`Created recurring schedule task-${taskId}: cron=${cron}, target=${targetUrl}`);
      return res.status(200).json({ success: true, scheduleId: scheduleResponse.scheduleId, cron });
    }

    // 2. Non-recurring task: schedule one-off message
    if (!reminderTimeISO) {
      return res.status(400).json({ error: 'Missing reminderTimeISO' });
    }

    const reminderTime = new Date(reminderTimeISO);
    if (reminderTime.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Reminder time must be in the future' });
    }

    const targetDateStr = task_date || reminderTimeISO.split('T')[0];

    const response = await qstashClient.publishJSON({
      url: targetUrl,
      body: {
        taskId,
        title,
        message: "It's time to work on your task!",
        profile,
        is_urgent,
        is_important,
        reminder_time,
        task_date: targetDateStr,
        reminderTimeISO,
        timeZone: tz,
        is_recurring: false
      },
      notBefore: Math.floor(reminderTime.getTime() / 1000)
    });

    console.log(`Published one-off reminder task-${taskId} for ${reminderTimeISO} (messageId: ${response.messageId})`);
    return res.status(200).json({ success: true, messageId: response.messageId });
  } catch (error) {
    console.error('QStash scheduling error:', error);
    return res.status(500).json({ error: 'Failed to schedule reminder', details: error.message });
  }
}
