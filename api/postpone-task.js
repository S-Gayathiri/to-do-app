import { readFromSheet, updateSheetRow } from './utils/googleSheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, minutesToAdd = 60 } = req.body;
    if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

    // 1. Fetch all tasks to find the row index
    const sheetData = await readFromSheet('Tasks!A:L');
    const rows = sheetData.values || [];
    
    let rowIndex = -1;
    let taskRow = null;
    for (let i = 1; i < rows.length; i++) { // Skip header
      if (rows[i][0] === taskId) {
        rowIndex = i;
        taskRow = rows[i];
        break;
      }
    }

    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // 2. Add minutesToAdd to task_date and reminder_time
    const taskDateStr = taskRow[3]; // Column D
    const reminderTimeStr = taskRow[8]; // Column I
    const title = taskRow[2]; // Column C
    const profile = taskRow[1]; // Column B
    const is_urgent = taskRow[9] === 'TRUE'; // Column J
    const is_important = taskRow[10] === 'TRUE'; // Column K

    if (!taskDateStr || !reminderTimeStr) {
      return res.status(400).json({ error: 'Task does not have a scheduled time' });
    }

    const [year, month, day] = taskDateStr.split('-');
    const [hours, minutes] = reminderTimeStr.split(':');
    
    const dateObj = new Date(year, month - 1, day, parseInt(hours), parseInt(minutes) + minutesToAdd, 0);
    
    const newDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const newTimeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    // 3. Update the sheet (Column D and Column I)
    const sheetRowNumber = rowIndex + 1;
    await updateSheetRow(`Tasks!D${sheetRowNumber}`, [[newDateStr]]);
    await updateSheetRow(`Tasks!I${sheetRowNumber}`, [[newTimeStr]]);

    // 4. Trigger /api/schedule-reminder internally to schedule the new QStash webhook
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const scheduleUrl = `${protocol}://${host}/api/schedule-reminder`;

    await fetch(scheduleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        taskId,
        title,
        reminderTimeISO: dateObj.toISOString(),
        profile,
        is_urgent,
        is_important
      })
    });

    return res.status(200).json({ success: true, message: `Task postponed by ${minutesToAdd} minutes` });
  } catch (error) {
    console.error('Error postponing task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
