import { readFromSheet, updateSheetRow } from './utils/googleSheets.js';

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

    const { taskId } = body || {};
    if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

    // 1. Fetch all tasks to find the row index (Columns A:K)
    let rows = [];
    try {
      const sheetData = await readFromSheet('Tasks!A:K');
      rows = sheetData.values || [];
    } catch (e1) {
      try {
        const sheetData = await readFromSheet('A:K');
        rows = sheetData.values || [];
      } catch (e2) {
        console.error('Failed to read tasks sheet in mark-task-done:', e2);
      }
    }
    
    let rowIndex = -1;
    let targetRow = null;
    for (let i = 1; i < rows.length; i++) { // Skip header
      if (rows[i] && rows[i][0] && rows[i][0].toString().trim() === taskId.toString().trim()) {
        rowIndex = i;
        targetRow = rows[i];
        break;
      }
    }

    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const sheetRowNumber = rowIndex + 1;
    // Check isRecurring robustly (boolean true, 'TRUE', 'true', etc.)
    const isRecurring = targetRow[8] === true || targetRow[8] === 'TRUE' || targetRow[8] === 'true' || String(targetRow[8]).toLowerCase() === 'true';

    if (isRecurring) {
      // Append today's date in local user timezone to Column K (completed_dates)
      const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); // YYYY-MM-DD
      const todayUTC = new Date().toISOString().split('T')[0];
      const existingCompleted = targetRow[10] ? targetRow[10].toString().split(',').map(s => s.trim()).filter(Boolean) : [];
      
      if (!existingCompleted.includes(todayLocal)) {
        existingCompleted.push(todayLocal);
      }
      if (todayUTC !== todayLocal && !existingCompleted.includes(todayUTC)) {
        existingCompleted.push(todayUTC);
      }

      try {
        await updateSheetRow(`Tasks!K${sheetRowNumber}`, [[existingCompleted.join(',')]]);
      } catch (e) {
        await updateSheetRow(`K${sheetRowNumber}`, [[existingCompleted.join(',')]]);
      }
    } else {
      // Update Column F (is_completed) to TRUE for non-recurring task
      try {
        await updateSheetRow(`Tasks!F${sheetRowNumber}`, [['TRUE']]);
      } catch (e) {
        await updateSheetRow(`F${sheetRowNumber}`, [['TRUE']]);
      }
    }

    return res.status(200).json({ success: true, message: 'Task marked as done' });
  } catch (error) {
    console.error('Error marking task done:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
