import { appendToSheet, readFromSheet, updateSheetRow } from './utils/googleSheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscription, identity } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    // Read existing subscriptions to check for duplicates
    const sheetData = await readFromSheet('Subscriptions!A:C');
    const rows = sheetData.values || [];
    
    let rowIndexToUpdate = -1;
    for (let i = 1; i < rows.length; i++) { // Skip header
      if (rows[i][1]) {
        try {
          const sub = JSON.parse(rows[i][1]);
          if (sub.endpoint === subscription.endpoint) {
            rowIndexToUpdate = i;
            break;
          }
        } catch(e) {}
      }
    }

    const timestamp = new Date().toISOString();
    const subJson = JSON.stringify(subscription);
    const subIdentity = identity || 'PattuThangam';

    if (rowIndexToUpdate !== -1) {
      // Update existing row
      // Rows are 1-indexed in Sheets, and array is 0-indexed. Plus header row.
      const sheetRowNumber = rowIndexToUpdate + 1;
      await updateSheetRow(`Subscriptions!A${sheetRowNumber}:C${sheetRowNumber}`, [
        [timestamp, subJson, subIdentity]
      ]);
    } else {
      // Append new row
      await appendToSheet('Subscriptions!A:C', [
        [timestamp, subJson, subIdentity]
      ]);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Subscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
