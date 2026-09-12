const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const webPush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Ensure the private key is properly formatted
const privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

module.exports = async function handler(req, res) {
  try {
    if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !privateKey) {
      return res.status(500).json({ success: false, error: 'Google Sheets credentials not configured.' });
    }

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    // Ensure tabs exist
    let tasksSheet = doc.sheetsByTitle['Tasks'];
    if (!tasksSheet) {
      tasksSheet = await doc.addSheet({ title: 'Tasks', headerValues: ['task_id', 'profile_id', 'title', 'notes', 'category', 'quadrant', 'due_date', 'due_time', 'recurrence', 'status', 'updated_at'] });
    }
    
    let subsSheet = doc.sheetsByTitle['Subscriptions'];
    if (!subsSheet) {
      subsSheet = await doc.addSheet({ title: 'Subscriptions', headerValues: ['endpoint', 'p256dh', 'auth', 'primary_identity'] });
    }

    if (req.method === 'GET') {
      const { profile_id } = req.query;
      
      const rows = await tasksSheet.getRows();
      let tasks = rows.map(row => ({
        task_id: row.get('task_id'),
        profile_id: row.get('profile_id'),
        title: row.get('title'),
        notes: row.get('notes'),
        category: row.get('category'),
        quadrant: row.get('quadrant'),
        due_date: row.get('due_date'),
        due_time: row.get('due_time'),
        recurrence: row.get('recurrence'),
        status: row.get('status'),
        updated_at: row.get('updated_at')
      }));

      if (profile_id) {
        tasks = tasks.filter(t => t.profile_id === profile_id || t.profile_id === 'pattuthangam');
      }
      
      return res.status(200).json({ success: true, tasks });
    }

    if (req.method === 'POST') {
      const { mutations } = req.body;
      
      if (!mutations || !Array.isArray(mutations)) {
        return res.status(400).json({ success: false, error: 'Invalid mutations payload' });
      }

      await tasksSheet.loadHeaderRow();
      const rows = await tasksSheet.getRows();
      
      let upserted = 0;
      let deleted = 0;
      let profilesToNotify = new Set();
      let latestTaskTitles = {};

      for (const mut of mutations) {
        if (mut.type === 'upsert' && mut.task) {
          const t = mut.task;
          const existingRow = rows.find(r => r.get('task_id') === t.task_id);
          
          const rowData = {
            task_id: t.task_id,
            profile_id: t.profile_id,
            title: t.title,
            notes: t.notes || '',
            category: t.category || '',
            quadrant: t.quadrant || '',
            due_date: t.due_date || '',
            due_time: t.due_time || '',
            recurrence: t.recurrence || '',
            status: t.status,
            updated_at: t.updated_at
          };

          if (existingRow) {
            existingRow.assign(rowData);
            await existingRow.save();
          } else {
            await tasksSheet.addRow(rowData);
          }
          
          upserted++;
          profilesToNotify.add(t.profile_id);
          latestTaskTitles[t.profile_id] = t.title;
          
        } else if (mut.type === 'delete' && mut.task_id) {
          const existingRow = rows.find(r => r.get('task_id') === mut.task_id);
          if (existingRow) {
            await existingRow.delete();
            deleted++;
          }
        }
      }

      // Send Push Notifications asynchronously
      if (profilesToNotify.size > 0 && process.env.VAPID_PUBLIC_KEY) {
        notifySubscribers(subsSheet, profilesToNotify, latestTaskTitles).catch(console.error);
      }

      return res.status(200).json({ success: true, syncedCount: mutations.length, upserted, deleted });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err) {
    console.error('Sync Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

async function notifySubscribers(subsSheet, profilesToNotify, latestTaskTitles) {
  let targetIdentities = new Set();
  
  if (profilesToNotify.has('pattuthangam')) {
    targetIdentities.add('pattu');
    targetIdentities.add('thangam');
  }
  if (profilesToNotify.has('pattu')) targetIdentities.add('pattu');
  if (profilesToNotify.has('thangam')) targetIdentities.add('thangam');

  if (targetIdentities.size === 0) return;

  const rows = await subsSheet.getRows();
  
  const notifications = rows
    .filter(row => targetIdentities.has(row.get('primary_identity')))
    .map(row => {
      const pushSubscription = {
        endpoint: row.get('endpoint'),
        keys: {
          p256dh: row.get('p256dh'),
          auth: row.get('auth')
        }
      };
      
      let taskTitle = Object.values(latestTaskTitles)[0] || 'A task was updated';
      
      const payload = JSON.stringify({
        title: 'TaskFlow Update',
        body: \`Task updated: \${taskTitle}\`,
        data: { url: './' }
      });

      return webPush.sendNotification(pushSubscription, payload).catch(async err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log('Subscription expired, removing:', row.get('endpoint'));
          await row.delete();
        } else {
          console.error('Push Error:', err);
        }
      });
  });

  await Promise.all(notifications);
}
