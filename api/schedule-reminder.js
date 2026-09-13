import { Client } from "@upstash/qstash";

const qstashClient = new Client({
  token: process.env.VITE_QSTASH_TOKEN || process.env.QSTASH_TOKEN,
  baseUrl: process.env.VITE_QSTASH_URL || process.env.QSTASH_URL || "https://qstash.upstash.io"
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, title, reminderTimeISO } = req.body;

    if (!title || !reminderTimeISO) {
      return res.status(400).json({ error: 'Missing title or reminderTimeISO' });
    }

    const reminderTime = new Date(reminderTimeISO);
    
    // Only schedule if the reminder time is in the future
    if (reminderTime.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Reminder time must be in the future' });
    }

    // Determine the base URL dynamically based on the incoming request
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const targetUrl = `${protocol}://${host}/api/send-push`;

    // Schedule the webhook using QStash
    const response = await qstashClient.publishJSON({
      url: targetUrl,
      body: {
        taskId,
        title,
        message: "It's time to work on your task!",
      },
      notBefore: Math.floor(reminderTime.getTime() / 1000), // QStash expects Unix timestamp in seconds
    });

    return res.status(200).json({ success: true, messageId: response.messageId });
  } catch (error) {
    console.error('QStash scheduling error:', error);
    return res.status(500).json({ error: 'Failed to schedule reminder', details: error.message, stack: error.stack });
  }
}
