import * as jose from 'jose';

// These use process.env in Node.js instead of import.meta.env
const SPREADSHEET_ID = process.env.VITE_SPREADSHEET_ID;
const CLIENT_EMAIL = process.env.VITE_GOOGLE_CLIENT_EMAIL;
let PRIVATE_KEY = process.env.VITE_GOOGLE_PRIVATE_KEY;

if (PRIVATE_KEY) {
  PRIVATE_KEY = PRIVATE_KEY.replace(/\\n/g, '\n');
}

let cachedToken = null;
let tokenExpiration = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiration) {
    return cachedToken;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const privateKeyObj = await jose.importPKCS8(PRIVATE_KEY, 'RS256');
  
  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader(header)
    .sign(privateKeyObj);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to get access token: ${err}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiration = Date.now() + (data.expires_in - 300) * 1000;
  return cachedToken;
}

export async function appendToSheet(range, values) {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to append to sheet: ${err}`);
  }
  return response.json();
}

export async function readFromSheet(range) {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to read from sheet: ${err}`);
  }
  return response.json();
}
