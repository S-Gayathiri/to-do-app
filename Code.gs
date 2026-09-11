/**
 * TaskFlow - Google Apps Script Backend
 * 
 * Synchronizes offline IndexedDB tasks with Google Sheets.
 * 
 * Schema:
 * Tab 1 (Tasks):    task_id | profile_id | title | notes | category | quadrant | due_date | due_time | recurrence | status | updated_at
 * Tab 2 (Profiles): profile_id | name | digest_time | evening_time | default_view
 */

const SHEET_NAMES = {
  TASKS: 'Tasks',
  PROFILES: 'Profiles'
};

const TASK_HEADERS = [
  'task_id',
  'profile_id',
  'title',
  'notes',
  'category',
  'quadrant',
  'due_date',
  'due_time',
  'recurrence',
  'status',
  'updated_at'
];

const PROFILE_HEADERS = [
  'profile_id',
  'name',
  'digest_time',
  'evening_time',
  'default_view'
];

/**
 * Handle GET Requests
 * Supports:
 * - ?action=getTasks&profile_id=xyz
 * - ?action=getProfiles
 * - ?action=init
 * - ?action=ping
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || 'getTasks';
    const profileId = params.profile_id;

    // Ensure database sheets and headers exist
    ensureDatabaseStructure();

    let result = {};

    if (action === 'ping') {
      result = { success: true, message: 'TaskFlow GAS endpoint is active.', timestamp: new Date().toISOString() };
    } else if (action === 'init') {
      result = {
        success: true,
        message: 'Database initialized successfully.',
        profiles: getAllProfiles(),
        tasks: getAllTasks(profileId)
      };
    } else if (action === 'getProfiles') {
      result = {
        success: true,
        profiles: getAllProfiles()
      };
    } else if (action === 'getTasks') {
      result = {
        success: true,
        profile_id: profileId || 'all',
        tasks: getAllTasks(profileId)
      };
    } else {
      result = { success: false, error: 'Unknown action: ' + action };
    }

    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString(),
      stack: error.stack
    });
  }
}

/**
 * Handle POST Requests
 * Supports batch mutations for offline sync:
 * Payload:
 * {
 *   action: 'batchSync',
 *   profile_id: 'sarah_1',
 *   mutations: [
 *     { type: 'upsert', task: { task_id, profile_id, title, ... } },
 *     { type: 'delete', task_id: 'xyz' },
 *     { type: 'profile_update', profile: { profile_id, name, ... } }
 *   ]
 * }
 */
function doPost(e) {
  // Lock to avoid race conditions during concurrent syncs
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(15000); // 15 seconds timeout

  if (!hasLock) {
    return createJsonResponse({
      success: false,
      error: 'Server busy. Another sync is currently processing. Please retry.'
    });
  }

  try {
    ensureDatabaseStructure();

    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter && e.parameter.data) {
      payload = JSON.parse(e.parameter.data);
    }

    const action = payload.action || 'batchSync';
    let responseData = {};

    if (action === 'batchSync') {
      const mutations = payload.mutations || [];
      const stats = processBatchMutations(mutations);
      responseData = {
        success: true,
        syncedCount: stats.processed,
        upserted: stats.upserted,
        deleted: stats.deleted,
        profilesUpdated: stats.profilesUpdated,
        serverTime: new Date().toISOString()
      };
    } else if (action === 'saveProfile') {
      const profile = payload.profile;
      if (profile && profile.profile_id) {
        upsertProfile(profile);
        responseData = { success: true, profile: profile };
      } else {
        responseData = { success: false, error: 'Missing profile payload' };
      }
    } else {
      responseData = { success: false, error: 'Unsupported POST action: ' + action };
    }

    return createJsonResponse(responseData);
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString(),
      stack: error.stack
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Process array of mutations against Tasks and Profiles sheets
 */
function processBatchMutations(mutations) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  const profileSheet = ss.getSheetByName(SHEET_NAMES.PROFILES);

  let processed = 0;
  let upserted = 0;
  let deleted = 0;
  let profilesUpdated = 0;

  if (!mutations || mutations.length === 0) {
    return { processed, upserted, deleted, profilesUpdated };
  }

  // Load existing tasks into memory map for fast O(1) index lookups
  const taskData = taskSheet.getDataRange().getValues();
  const taskIdRowMap = new Map(); // task_id -> rowNumber (1-based)

  for (let r = 1; r < taskData.length; r++) {
    const id = String(taskData[r][0]);
    if (id) {
      taskIdRowMap.set(id, r + 1); // sheet row number is 1-based
    }
  }

  // Process task mutations
  const newRowsToAppend = [];
  const rowsToDeleteDesc = []; // delete from bottom to top to preserve row indices

  mutations.forEach(function(mut) {
    processed++;
    if (mut.type === 'upsert' && mut.task) {
      const t = mut.task;
      const taskId = String(t.task_id);
      const rowValues = [
        taskId,
        t.profile_id || 'default',
        t.title || '',
        t.notes || '',
        t.category || 'Personal',
        t.quadrant || 'Q4',
        t.due_date || '',
        t.due_time || '',
        t.recurrence || 'none',
        t.status || 'pending',
        t.updated_at || new Date().toISOString()
      ];

      if (taskIdRowMap.has(taskId)) {
        // Update existing row in place
        const rowNum = taskIdRowMap.get(taskId);
        taskSheet.getRange(rowNum, 1, 1, TASK_HEADERS.length).setValues([rowValues]);
        upserted++;
      } else {
        // New task to append
        newRowsToAppend.push(rowValues);
        // Track in map so subsequent mutations in the same batch don't duplicate
        taskIdRowMap.set(taskId, taskSheet.getLastRow() + newRowsToAppend.length);
        upserted++;
      }
    } else if (mut.type === 'delete' && mut.task_id) {
      const delId = String(mut.task_id);
      if (taskIdRowMap.has(delId)) {
        const rowNum = taskIdRowMap.get(delId);
        rowsToDeleteDesc.push(rowNum);
        taskIdRowMap.delete(delId);
        deleted++;
      }
    } else if (mut.type === 'profile_update' && mut.profile) {
      upsertProfile(mut.profile);
      profilesUpdated++;
    }
  });

  // Batch append new rows
  if (newRowsToAppend.length > 0) {
    const startRow = taskSheet.getLastRow() + 1;
    taskSheet.getRange(startRow, 1, newRowsToAppend.length, TASK_HEADERS.length).setValues(newRowsToAppend);
  }

  // Delete removed rows from highest row index down to lowest
  if (rowsToDeleteDesc.length > 0) {
    rowsToDeleteDesc.sort(function(a, b) { return b - a; });
    rowsToDeleteDesc.forEach(function(rowNum) {
      taskSheet.deleteRow(rowNum);
    });
  }

  return { processed, upserted, deleted, profilesUpdated };
}

/**
 * Retrieve all tasks from Tab 1 (optionally filtered by profile_id)
 */
function getAllTasks(profileId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return [];

  const tasks = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const taskId = String(row[0]);
    const rowProfileId = String(row[1]);

    if (!taskId) continue;

    // Filter by profile if requested
    if (profileId && profileId !== 'all' && rowProfileId !== profileId) {
      continue;
    }

    tasks.push({
      task_id: taskId,
      profile_id: rowProfileId,
      title: row[2] || '',
      notes: row[3] || '',
      category: row[4] || 'Personal',
      quadrant: row[5] || 'Q4',
      due_date: formatDateValue(row[6]),
      due_time: formatTimeValue(row[7]),
      recurrence: row[8] || 'none',
      status: row[9] || 'pending',
      updated_at: formatDateValue(row[10]) || new Date().toISOString()
    });
  }

  return tasks;
}

/**
 * Retrieve all profiles from Tab 2
 */
function getAllProfiles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.PROFILES);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return createDefaultProfiles();
  }

  const profiles = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const profileId = String(row[0]);
    if (!profileId) continue;

    profiles.push({
      profile_id: profileId,
      name: row[1] || 'User',
      digest_time: formatTimeValue(row[2]) || '08:00',
      evening_time: formatTimeValue(row[3]) || '20:00',
      default_view: row[4] || 'categories'
    });
  }

  return profiles.length > 0 ? profiles : createDefaultProfiles();
}

/**
 * Upsert single profile into Profiles sheet
 */
function upsertProfile(profile) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.PROFILES);
  const data = sheet.getDataRange().getValues();
  const profileId = String(profile.profile_id);

  const rowValues = [
    profileId,
    profile.name || 'User',
    profile.digest_time || '08:00',
    profile.evening_time || '20:00',
    profile.default_view || 'categories'
  ];

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]) === profileId) {
      sheet.getRange(r + 1, 1, 1, PROFILE_HEADERS.length).setValues([rowValues]);
      return;
    }
  }

  // If not found, append
  sheet.appendRow(rowValues);
}

/**
 * Ensure both sheets exist and have formatted header rows
 */
function ensureDatabaseStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Tasks Sheet
  let taskSheet = ss.getSheetByName(SHEET_NAMES.TASKS);
  if (!taskSheet) {
    taskSheet = ss.insertSheet(SHEET_NAMES.TASKS);
    taskSheet.getRange(1, 1, 1, TASK_HEADERS.length).setValues([TASK_HEADERS]);
    formatHeaderRow(taskSheet, '#1e1b4b', '#ffffff');
  } else {
    // Check if headers match
    const existingHeaders = taskSheet.getRange(1, 1, 1, TASK_HEADERS.length).getValues()[0];
    if (!existingHeaders[0] || existingHeaders[0] === '') {
      taskSheet.getRange(1, 1, 1, TASK_HEADERS.length).setValues([TASK_HEADERS]);
      formatHeaderRow(taskSheet, '#1e1b4b', '#ffffff');
    }
  }

  // 2. Profiles Sheet
  let profileSheet = ss.getSheetByName(SHEET_NAMES.PROFILES);
  if (!profileSheet) {
    profileSheet = ss.insertSheet(SHEET_NAMES.PROFILES);
    profileSheet.getRange(1, 1, 1, PROFILE_HEADERS.length).setValues([PROFILE_HEADERS]);
    formatHeaderRow(profileSheet, '#311042', '#ffffff');
    createDefaultProfiles();
  } else {
    const existingHeaders = profileSheet.getRange(1, 1, 1, PROFILE_HEADERS.length).getValues()[0];
    if (!existingHeaders[0] || existingHeaders[0] === '') {
      profileSheet.getRange(1, 1, 1, PROFILE_HEADERS.length).setValues([PROFILE_HEADERS]);
      formatHeaderRow(profileSheet, '#311042', '#ffffff');
      createDefaultProfiles();
    }
  }
}

/**
 * Create default profiles if sheet is newly setup
 */
function createDefaultProfiles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const profileSheet = ss.getSheetByName(SHEET_NAMES.PROFILES);
  
  const defaults = [
    ['sarah_1', 'Sarah', '08:00', '20:00', 'categories'],
    ['alex_2', 'Alex', '09:00', '21:00', 'matrix']
  ];

  profileSheet.getRange(2, 1, defaults.length, PROFILE_HEADERS.length).setValues(defaults);
  
  return defaults.map(function(d) {
    return {
      profile_id: d[0],
      name: d[1],
      digest_time: d[2],
      evening_time: d[3],
      default_view: d[4]
    };
  });
}

/**
 * Format Header Row with styling
 */
function formatHeaderRow(sheet, bgColor, fontColor) {
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
  headerRange.setBackground(bgColor);
  headerRange.setFontColor(fontColor);
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/**
 * Helpers for date/time formatting from Google Sheets cells
 */
function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(val);
}

function formatTimeValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const hh = String(val.getHours()).padStart(2, '0');
    const mm = String(val.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return String(val);
}

/**
 * Return JSON response with CORS compatibility
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
