import { appendToSheet } from './utils/googleSheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const subscription = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    // Convert the entire subscription object to a JSON string so it fits in one cell
    // Column A: Timestamp, Column B: Subscription JSON
    const values = [
      [
        new Date().toISOString(),
        JSON.stringify(subscription)
      ]
    ];

    // Append to "Subscriptions" sheet
    await appendToSheet('Subscriptions!A:B', values);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Subscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
