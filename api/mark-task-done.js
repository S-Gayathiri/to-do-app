import { readFromSheet, updateSheetRow } from './utils/googleSheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

    // 1. Fetch all tasks to find the row index
    const sheetData = await readFromSheet('Tasks!A:M');
    const rows = sheetData.values || [];
    
    let rowIndex = -1;
    let targetRow = null;
    for (let i = 1; i < rows.length; i++) { // Skip header
      if (rows[i][0] === taskId) {
        rowIndex = i;
        targetRow = rows[i];
        break;
      }
    }

    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const sheetRowNumber = rowIndex + 1;
    const isRecurring = targetRow[10] === 'TRUE';

    if (isRecurring) {
      // Append today's date to Column M (completed_dates)
      const todayStr = new Date().toISOString().split('T')[0];
      const existingCompleted = targetRow[12] ? targetRow[12].split(',').map(s => s.trim()).filter(Boolean) : [];
      if (!existingCompleted.includes(todayStr)) {
        existingCompleted.push(todayStr);
      }
      await updateSheetRow(`Tasks!M${sheetRowNumber}`, [[existingCompleted.join(',')]]);
    } else {
      // 2. Update Column H (is_completed) to TRUE for non-recurring task
      await updateSheetRow(`Tasks!H${sheetRowNumber}`, [['TRUE']]);
    }

    return res.status(200).json({ success: true, message: 'Task marked as done' });
  } catch (error) {
    console.error('Error marking task done:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
