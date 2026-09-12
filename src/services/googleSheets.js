import { SignJWT, importPKCS8 } from 'jose';

const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const CLIENT_EMAIL = import.meta.env.VITE_GOOGLE_CLIENT_EMAIL;
// Private keys in env vars might have escaped newlines
const PRIVATE_KEY = import.meta.env.VITE_GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (!CLIENT_EMAIL || !PRIVATE_KEY) {
    throw new Error("Missing Google Service Account credentials in environment variables.");
  }

  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const alg = 'RS256';
  const privateKey = await importPKCS8(PRIVATE_KEY, alg);

  const jwt = await new SignJWT({
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token'
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // buffer of 1 min
  return cachedToken;
}

export async function fetchSheetData(range = 'Tasks!A:J') {
  if (!SPREADSHEET_ID) return [];
  const token = await getAccessToken();
  
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) throw new Error("Failed to fetch sheet data");
  
  const data = await response.json();
  const rows = data.values || [];
  if (rows.length <= 1) return []; // Only headers or empty

  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      if (val === 'TRUE') val = true;
      if (val === 'FALSE') val = false;
      obj[h] = val;
    });
    return obj;
  });
}

export async function appendRow(range, rowData) {
  if (!SPREADSHEET_ID) return;
  const token = await getAccessToken();

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [rowData]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Failed to append row: ${JSON.stringify(err)}`);
  }
}

// Updating requires finding the row index. For a robust app, you usually read all, find index, then update.
// We'll expose a batch update method to clear and rewrite if needed, or update specific ranges.
export async function updateCell(range, value) {
  if (!SPREADSHEET_ID) return;
  const token = await getAccessToken();

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [[value]]
    })
  });
}
