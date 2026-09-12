const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { subscription, primaryIdentity } = req.body;

    if (!subscription || !primaryIdentity) {
      return res.status(400).json({ error: 'Missing subscription or primaryIdentity' });
    }

    const { endpoint, keys } = subscription;
    
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !privateKey) {
      return res.status(500).json({ success: false, error: 'Google Sheets credentials not configured.' });
    }

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    let subsSheet = doc.sheetsByTitle['Subscriptions'];
    if (!subsSheet) {
      subsSheet = await doc.addSheet({ title: 'Subscriptions', headerValues: ['endpoint', 'p256dh', 'auth', 'primary_identity'] });
    }

    await subsSheet.loadHeaderRow();
    const rows = await subsSheet.getRows();
    const existingRow = rows.find(r => r.get('endpoint') === endpoint);

    const rowData = {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      primary_identity: primaryIdentity
    };

    if (existingRow) {
      existingRow.assign(rowData);
      await existingRow.save();
    } else {
      await subsSheet.addRow(rowData);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Subscription error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
