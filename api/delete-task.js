import { readFromSheet, deleteSheetRow } from './utils/googleSheets.js';
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
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

    // 1. Delete QStash schedule if any
    try {
      await qstashClient.schedules.delete(`task-${taskId}`);
    } catch (e) {
      // Ignore if no schedule existed
    }

    // 2. Fetch all tasks to find the row index
    const sheetData = await readFromSheet('Tasks!A:A');
    const rows = sheetData.values || [];
    
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) { // Skip header
      if (rows[i][0] === taskId) {
        rowIndex = i; // This is the 0-based index of the row
        break;
      }
    }

    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // 3. Delete the row
    await deleteSheetRow('Tasks', rowIndex);

    return res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
