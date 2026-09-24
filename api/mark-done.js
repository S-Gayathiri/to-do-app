import { readFromSheet, updateSheet, appendToSheet } from './utils/googleSheets.js';

function getNextDate(taskDateStr, pattern) {
  if (!taskDateStr) return null;
  const [y, m, d] = taskDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  if (pattern === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (pattern === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (pattern === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else {
    return null;
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'Missing taskId' });
    }

    // 1. Fetch current tasks from Google Sheets
    const sheetData = await readFromSheet('Tasks!A:L').catch(() => readFromSheet('A:L'));
    const rows = sheetData.values || [];

    if (rows.length <= 1) {
      return res.status(404).json({ error: 'No tasks found' });
    }

    const headers = rows[0];
    const taskIndex = rows.slice(1).findIndex(row => row[0] === taskId);

    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const sheetRowNumber = taskIndex + 2; // 1-based index (+1 for header, +1 for 0-index)
    const originalRow = rows[taskIndex + 1];

    // Columns:
    // 0: id, 1: profile, 2: title, 3: task_date, 4: time_block,
    // 5: is_urgent, 6: is_important, 7: is_completed, 8: reminder_time,
    // 9: created_at, 10: is_recurring, 11: recurrence_pattern
    const updatedRow = [...originalRow];
    // Pad to 12 columns if needed
    while (updatedRow.length < 12) {
      updatedRow.push('');
    }

    // Mark as completed
    updatedRow[7] = 'TRUE';

    // Update in Google Sheet
    await updateSheet(`Tasks!A${sheetRowNumber}:L${sheetRowNumber}`, [updatedRow]);

    // Handle recurring task spawning if applicable
    const isRecurring = updatedRow[10] === 'TRUE' || updatedRow[10] === true;
    const recurrencePattern = updatedRow[11];
    const taskDate = updatedRow[3];

    if (isRecurring && recurrencePattern && taskDate) {
      const nextDate = getNextDate(taskDate, recurrencePattern);
      if (nextDate) {
        const nextId = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

        const newRecurringRow = [
          nextId,
          updatedRow[1], // profile
          updatedRow[2], // title
          nextDate,      // new task_date
          updatedRow[4], // time_block
          updatedRow[5], // is_urgent
          updatedRow[6], // is_important
          'FALSE',       // is_completed
          updatedRow[8], // reminder_time
          new Date().toISOString(), // created_at
          updatedRow[10], // is_recurring
          updatedRow[11]  // recurrence_pattern
        ];

        await appendToSheet('Tasks!A:L', [newRecurringRow]).catch(err => {
          console.error('Failed to append next recurring task:', err);
        });
      }
    }

    return res.status(200).json({
      success: true,
      taskId,
      title: updatedRow[2] || 'Task'
    });
  } catch (error) {
    console.error('Error marking task as done:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
