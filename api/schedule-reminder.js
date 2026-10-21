import { Client } from "@upstash/qstash";

const qstashClient = new Client({
  token: process.env.VITE_QSTASH_TOKEN || process.env.QSTASH_TOKEN,
  baseUrl: process.env.VITE_QSTASH_URL || process.env.QSTASH_URL || "https://qstash.upstash.io"
});

const daysMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };

function getCronFromPattern(pattern, timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  // Reference date: Oct 18, 2026 was Sunday
  const baseSunday = new Date(2026, 9, 18, hours, minutes, 0);

  if (pattern.toLowerCase() === 'daily') {
    return `${baseSunday.getUTCMinutes()} ${baseSunday.getUTCHours()} * * *`;
  }
  if (pattern.toLowerCase() === 'weekly') {
    return `${baseSunday.getUTCMinutes()} ${baseSunday.getUTCHours()} * * ${baseSunday.getUTCDay()}`;
  }

  const days = pattern.split(',').map(s => s.trim());
  const utcDays = [];
  let utcH = baseSunday.getUTCHours();
  let utcM = baseSunday.getUTCMinutes();

  for (const day of days) {
    const dayIndex = daysMap[day];
    if (dayIndex !== undefined) {
      const localDate = new Date(2026, 9, 18 + dayIndex, hours, minutes, 0);
      utcH = localDate.getUTCHours();
      utcM = localDate.getUTCMinutes();
      utcDays.push(localDate.getUTCDay());
    }
  }

  const sortedDays = [...new Set(utcDays)].sort().join(',');
  return `${utcM} ${utcH} * * ${sortedDays}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      taskId, 
      title, 
      reminderTimeISO, 
      reminder_time, 
      is_recurring, 
      recurrence_pattern, 
      profile, 
      is_urgent, 
      is_important 
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Missing title' });
    }

    // Determine the base URL dynamically based on the incoming request
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const targetUrl = `${protocol}://${host}/api/send-push`;

    // 1. If recurring task with a reminder time: create recurring QStash schedule
    if (is_recurring && recurrence_pattern && reminder_time) {
      try {
        await qstashClient.schedules.delete(`task-${taskId}`);
      } catch (e) {
        // Ignore if schedule did not exist
      }

      const cron = getCronFromPattern(recurrence_pattern, reminder_time);
      const scheduleResponse = await qstashClient.schedules.create({
        scheduleId: `task-${taskId}`,
        destination: targetUrl,
        cron,
        body: JSON.stringify({
          taskId,
          title,
          message: "It's time to work on your task!",
          profile,
          is_urgent,
          is_important
        })
      });

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

    const response = await qstashClient.publishJSON({
      url: targetUrl,
      body: {
        taskId,
        title,
        message: "It's time to work on your task!",
        profile,
        is_urgent,
        is_important
      },
      notBefore: Math.floor(reminderTime.getTime() / 1000),
    });

    return res.status(200).json({ success: true, messageId: response.messageId });
  } catch (error) {
    console.error('QStash scheduling error:', error);
    return res.status(500).json({ error: 'Failed to schedule reminder', details: error.message });
  }
}
