import { SignJWT, importPKCS8 } from 'jose';

const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const CLIENT_EMAIL = import.meta.env.VITE_GOOGLE_CLIENT_EMAIL;
let rawKey = import.meta.env.VITE_GOOGLE_PRIVATE_KEY || '';
if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
  rawKey = rawKey.slice(1, -1);
} else if (rawKey.startsWith("'") && rawKey.endsWith("'")) {
  rawKey = rawKey.slice(1, -1);
}
// Private keys in env vars might have escaped newlines
const PRIVATE_KEY = rawKey.replace(/\\n/g, '\n');

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

export async function fetchSheetData(range = 'A:J') {
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

export async function updateRow(range, values) {
  if (!SPREADSHEET_ID) return;
  const token = await getAccessToken();

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [values]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Failed to update row: ${JSON.stringify(err)}`);
  }
}

export async function deleteRow(sheetId, rowIndex) {
  if (!SPREADSHEET_ID) return;
  const token = await getAccessToken();

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Failed to delete row: ${JSON.stringify(err)}`);
  }
}

export async function getSheetId(sheetName = 'Tasks') {
  if (!SPREADSHEET_ID) return 0;
  const token = await getAccessToken();
  
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) throw new Error("Failed to fetch spreadsheet metadata");
  
  const data = await response.json();
  const sheet = data.sheets.find(s => s.properties.title === sheetName);
  if (sheet) return sheet.properties.sheetId;
  
  return data.sheets[0].properties.sheetId; // fallback to first sheet
}
