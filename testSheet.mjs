import fs from 'fs';
import * as jose from 'jose';

const email = "pt-to-do@to-do-508411.iam.gserviceaccount.com";
const key = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDD1E+kyLmTguUZ
jip/pC6WJEwd/KloAWhDQkJ41ruTCJtv0iFZV95WMLR4R7bVpyDq2IMEw56h8+xE
WMzwZd+vKJgnsKRkP5DYXhRs/ltv64qv7GBDDjqpOiUf5H3DEJp6UxpRuMZXdxge
Tewskch1XECIdECE7ZYfLGx4Re6a5YvgzyFu5ILtC0/KNFXAjAYeFjsfc6lSHE1I
Oumm5Uwd0ZvDpY9z2GDDDhqkaixcVwFzLnHQNco3KnHlrTUSYWDulIv14K7l8lxE
iRhi7SrBNhcHrHoKBbQgyJf71tsnTS5vGXayyM8YNLRcQY1wADJEJD7QZFtjYEKn
l9YWzOhDAgMBAAECggEAAZg5/yKEowHe3GK++oPGFAI+/cOFRvaJTdA9UFSXTxmJ
LSjt4pdc6nYXvMmrYHlYQvFOZ9Hb+dT4UzonORHrTLbXk63UON4XpNtnQ9fyZf/q
BN1iOfQ6CroRe/1VVNWkHGOO2aQtNqBz+X3dnXihGZY4ZE67Xm8SLjYjZVCpzRMW
diD416/Ro87RaM5tQEOzVUx9SK8U4Ol9q+9oZGmJbFAzOX63dEK0PcwGYEHFeyYi
ydeoXUZQbmst+qMXbFXtiO7zY/tRRDzzHlm3s6XMqBw+lu57xxjO2Zm4qlc4Gey0
JVDGDC5EpLu+80AlDIlx1iVhxo+vKXJNJKWAO1pN4QKBgQDrjjte8cY+Y6pYwAMI
1mbVQOpJzf2oi7ZbyVO/rU3aV1PyG7JTb9MxsUZTpgAY7DdZj3iXPwLXubKIRPoZ
soW/KlQTCQdqv9U2mN7wZ5riBDJx6cOcrxRnZ1vIb0l3htZj2kMziFIFaUH9QMaa
ng7c8fujjRMzAmr0pLW706tCUwKBgQDU02iZt83XWBHewVtTnmA6I3PwHaNOAoDY
qq1xYHD8zOhgul3phKn1vqoc4oVid4C+w/79I1eLpILBQs3w9LdljQNlIUatvHng
xQHqkJZqXFJ1s7NwBmTu07HCkT6qjbB7QwG9q9TktK14bZ+U85rO4aTi7OkJIrHd
JZelw+nkUQKBgQCNz4ggxc/Cub/RRG/PPzyTgExMeI4QjWQQ6CjaSZyIKXDpXhFC
uBzeWsprC5IdbwB3k69W5uFwPGSmM1iaZeatSu9oslPbyXe0Md5tvwH4tewktkZE
qwbOpeQUzCLfqbaiUMGKYbR3e4H11Kx8Y1GxZKFJOmJnoDoB5LNgS7Nb7wKBgH4q
UZEG8GTflcBq+bvpYHw2ti07NKszOrS3AZj7ph+HTZ7B/JhJiAPhorD67D3CQDVW
tVvVTrm+rbDp7HIScIIoBUI3ZtHpsIq533fxfOnSjyOtgws/DyixoGiKeA7dbii0
QVzyd4OZRFjnC7pea4CHLZtE/KTox24lMfAX4xjxAoGANqbCHjFVCVH1vIQ+hIJV
XFY9DrHzTs4cojJUZ9hxQwAm+bK+bEjHHFqBmXoW3cNkKOayhzyteN1tt9HtSAj9
V3e19glvqBsy0pLQbX6kdZSz6BI1u07DadFaQkZjmYPLGXOB1lMSsV/0yioYY7FZ
7E7pg4lWMn7YAB/56SJxAoU=
-----END PRIVATE KEY-----`;
const id = "18diC7wWvlox3009tsMFCTaWBS4I99OEMkIRN34k1BxM";

async function test() {
  const alg = 'RS256';
  try {
    const privateKey = await jose.importPKCS8(key, alg);
    const jwt = await new jose.SignJWT({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token'
    })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
      
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
    });
    const data = await response.json();
    if(!response.ok) { console.error('Token error:', data); return; }
    console.log('Token acquired.');
    
    const token = data.access_token;
    const sheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values/Tasks!A:J:append?valueInputOption=USER_ENTERED', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['1', 'Pattu', 'Test', '2023-01-01', 'morning', false, false, false, '', '2023-01-01T00:00:00Z']] })
    });
    const sheetData = await sheetRes.json();
    console.log('Sheet append result:', sheetData);
  } catch(e) {
    console.error('Exception:', e);
  }
}
test().catch(console.error);
