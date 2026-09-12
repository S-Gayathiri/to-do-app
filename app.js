/**
 * TaskFlow - Complete Mobile-First Offline PWA Application Logic
 * 
 * Features:
 * - IndexedDB (Dexie.js) for 0ms local reads/writes
 * - Client-side NLP (chrono-node) for auto date/time detection
 * - Eisenhower 2-Pill toggle state manager (Q1, Q2, Q3, Q4)
 * - Multi-Profile partitioning (Sarah, Alex, custom)
 * - Category Cards & Eisenhower Matrix Dual Views
 * - Background Sync Worker with Google Sheets (GAS)
 * - Service Worker & Local Notification Cadence
 */

// ============================================================================
// 1. IndexedDB Schema & Dexie Initialization
// ============================================================================
const db = new Dexie('TaskFlowDB');

db.version(1).stores({
  tasks: 'task_id, profile_id, title, category, quadrant, due_date, due_time, recurrence, status, updated_at',
  profiles: 'profile_id, name, digest_time, evening_time, default_view',
  sync_queue: '++id, action, task_id, profile_id, timestamp',
  settings: 'key'
});

// Global Application State
const AppState = {
  currentProfileId: 'sarah_1',
  profiles: [],
  tasks: [],
  activeView: 'view-categories', // 'view-categories' | 'view-matrix' | 'view-cadence'
  activeFilter: 'all',          // 'all' | 'today' | 'urgent' | 'done'
  primaryIdentity: 'pattu',
  isOnline: navigator.onLine,
  isSyncing: false,
  
  // Quick-Capture State
  quickCapture: {
    isUrgent: false,
    isImportant: false,
    category: 'Personal',
    dueDate: '',
    dueTime: '',
    nlpParsedText: '',
    nlpCleanTitle: ''
  }
};

// ============================================================================
// 2. Application Startup & Initialization
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initServiceWorker();
    await initDatabase();
    await loadSettings();
    await loadProfiles();
    setupEventListeners();
    updateOnlineStatus();
    
    // Initial Render
    await refreshTasks();
    switchView(AppState.activeView);

    // Initial Sync Trigger
    if (AppState.isOnline) {
      triggerBackgroundSync();
    }

    // Check cadence alerts
    checkDailyCadence();
  } catch (err) {
    console.error('[App] Init Error:', err);
    showToast('App initialized with local storage.');
  }
});

/**
 * Register Service Worker for PWA Offline Caching
 */
async function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      console.log('[PWA] Service Worker registered with scope:', reg.scope);

      // Listen for messages from SW (e.g. background sync triggers)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TRIGGER_SYNC') {
          triggerBackgroundSync();
        }
      });
    } catch (err) {
      console.warn('[PWA] Service Worker registration failed:', err);
    }
  }
}

/**
 * Initialize Database with default profiles & starter tasks if empty
 */
async function initDatabase() {
  const profileCount = await db.profiles.count();
  if (profileCount === 0) {
    const defaultProfiles = [
      {
        profile_id: 'pattu',
        name: 'Pattu',
        digest_time: '08:00',
        evening_time: '20:00',
        default_view: 'categories'
      },
      {
        profile_id: 'thangam',
        name: 'Thangam',
        digest_time: '08:00',
        evening_time: '20:00',
        default_view: 'categories'
      },
      {
        profile_id: 'pattuthangam',
        name: 'PattuThangam',
        digest_time: '08:00',
        evening_time: '20:00',
        default_view: 'categories'
      }
    ];
    await db.profiles.bulkPut(defaultProfiles);
  }
}

/**
 * Load Persistent Settings from IndexedDB
 */
async function loadSettings() {
  const identitySetting = await db.settings.get('primary_identity');
  if (identitySetting) {
    AppState.primaryIdentity = identitySetting.value;
  }
  const input = document.getElementById('setting-identity');
  if (input) input.value = AppState.primaryIdentity;

  const activeProfileSetting = await db.settings.get('active_profile_id');
  if (activeProfileSetting) {
    AppState.currentProfileId = activeProfileSetting.value;
  } else {
    AppState.currentProfileId = AppState.primaryIdentity;
  }
}

/**
 * Load Profiles into memory & update Header
 */
async function loadProfiles() {
  AppState.profiles = await db.profiles.toArray();
  
  // Verify current profile exists
  const current = AppState.profiles.find(p => p.profile_id === AppState.currentProfileId);
  if (!current && AppState.profiles.length > 0) {
    AppState.currentProfileId = AppState.profiles[0].profile_id;
  }

  renderProfileDropdown();
  updateProfileHeader();
}

// ============================================================================
// 3. Multi-Profile Switcher Logic
// ============================================================================
function updateProfileHeader() {
  const current = AppState.profiles.find(p => p.profile_id === AppState.currentProfileId) || { name: 'Sarah' };
  const nameEl = document.getElementById('current-profile-name');
  const avatarEl = document.getElementById('current-profile-avatar');
  const settingsLabel = document.getElementById('settings-profile-label');
  
  if (nameEl) nameEl.textContent = current.name;
  if (avatarEl) avatarEl.textContent = current.name.charAt(0).toUpperCase();
  if (settingsLabel) settingsLabel.textContent = current.name;

  // Update time inputs in settings modal
  const digestInput = document.getElementById('setting-digest-time');
  const eveningInput = document.getElementById('setting-evening-time');
  if (digestInput && current.digest_time) digestInput.value = current.digest_time;
  if (eveningInput && current.evening_time) eveningInput.value = current.evening_time;
}

function renderProfileDropdown() {
  const listEl = document.getElementById('profile-list');
  if (!listEl) return;

  listEl.innerHTML = '';
  // Only show the primary identity and PattuThangam
  const visibleProfiles = AppState.profiles.filter(p => 
    p.profile_id === AppState.primaryIdentity || p.profile_id === 'pattuthangam'
  );

  visibleProfiles.forEach(p => {
    const btn = document.createElement('button');
    btn.className = `dropdown-item ${p.profile_id === AppState.currentProfileId ? 'active' : ''}`;
    btn.innerHTML = `
      <span class="profile-avatar" style="width:20px;height:20px;font-size:0.7rem">${p.name.charAt(0).toUpperCase()}</span>
      <span>${escapeHtml(p.name)}</span>
    `;
    btn.addEventListener('click', () => switchProfile(p.profile_id));
    listEl.appendChild(btn);
  });
}

async function switchProfile(profileId) {
  AppState.currentProfileId = profileId;
  await db.settings.put({ key: 'active_profile_id', value: profileId });
  
  const menu = document.getElementById('profile-menu');
  if (menu) menu.classList.add('hidden');

  updateProfileHeader();
  renderProfileDropdown();
  await refreshTasks();
  
  showToast(`Switched profile to ${AppState.profiles.find(p => p.profile_id === profileId)?.name}`);

  // Background sync for the new profile
  if (AppState.isOnline) {
    triggerBackgroundSync();
  }
}

// ============================================================================
// 4. Eisenhower Pill State Manager & Quick-Capture NLP
// ============================================================================

/**
 * Calculates Quadrant based on 2-Pill Toggles:
 * Both OFF = Q4 (Backlog)
 * ⭐ Important ON = Q2 (Schedule)
 * ⚡ Urgent ON = Q3 (Delegate)
 * Both ON = Q1 (Crisis / Do First)
 */
function updateEisenhowerQuadrantState() {
  const { isUrgent, isImportant } = AppState.quickCapture;
  let quadrant = 'Q4';
  let label = 'Q4: Backlog';

  if (isUrgent && isImportant) {
    quadrant = 'Q1';
    label = 'Q1: Crisis';
  } else if (!isUrgent && isImportant) {
    quadrant = 'Q2';
    label = 'Q2: Schedule';
  } else if (isUrgent && !isImportant) {
    quadrant = 'Q3';
    label = 'Q3: Delegate';
  } else {
    quadrant = 'Q4';
    label = 'Q4: Backlog';
  }

  // Update UI badge
  const badge = document.getElementById('live-quadrant-badge');
  if (badge) {
    badge.className = `live-quadrant-pill ${quadrant.toLowerCase()}`;
    badge.textContent = label;
  }

  return quadrant;
}

/**
 * Passive NLP Client-Side Parser using chrono-node
 */
function handleQuickCaptureInput(e) {
  const text = e.target.value;
  const nlpIndicator = document.getElementById('nlp-indicator');
  const nlpText = document.getElementById('nlp-text');

  if (!text || text.trim().length < 3 || typeof chrono === 'undefined') {
    if (nlpIndicator) nlpIndicator.classList.add('hidden');
    AppState.quickCapture.nlpParsedText = '';
    AppState.quickCapture.nlpCleanTitle = text;
    return;
  }

  // Parse natural language dates and times
  const parsedResults = chrono.parse(text, new Date(), { forwardDate: true });

  if (parsedResults && parsedResults.length > 0) {
    const firstResult = parsedResults[0];
    const parsedDate = firstResult.start.date();
    const matchedText = firstResult.text;

    const yyyy = parsedDate.getFullYear();
    const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(parsedDate.getDate()).padStart(2, '0');
    const formattedDate = `${yyyy}-${mm}-${dd}`;

    let formattedTime = '';
    if (firstResult.start.isCertain('hour')) {
      const hh = String(parsedDate.getHours()).padStart(2, '0');
      const min = String(parsedDate.getMinutes()).padStart(2, '0');
      formattedTime = `${hh}:${min}`;
    }

    // Auto-populate form controls
    AppState.quickCapture.dueDate = formattedDate;
    AppState.quickCapture.dueTime = formattedTime;
    AppState.quickCapture.nlpParsedText = matchedText;

    // Clean title by removing the detected date phrase
    AppState.quickCapture.nlpCleanTitle = text.replace(matchedText, '').replace(/\s+/g, ' ').trim();

    // Update Date & Time inputs in UI
    const dateInput = document.getElementById('task-due-date');
    const timeInput = document.getElementById('task-due-time');
    const dateLabel = document.getElementById('date-chip-label');

    if (dateInput) dateInput.value = formattedDate;
    if (timeInput) timeInput.value = formattedTime;
    if (dateLabel) dateLabel.textContent = formatHumanDate(formattedDate);

    // Show indicator badge
    if (nlpIndicator && nlpText) {
      let displayText = `Detected: ${formatHumanDate(formattedDate)}`;
      if (formattedTime) displayText += ` at ${formatHumanTime(formattedTime)}`;
      nlpText.textContent = displayText;
      nlpIndicator.classList.remove('hidden');
    }
  } else {
    AppState.quickCapture.nlpCleanTitle = text;
    if (nlpIndicator) nlpIndicator.classList.add('hidden');
  }
}

/**
 * Save Task with 0ms IndexedDB Latency & Queue Sync Mutation
 */
async function saveQuickTask() {
  const inputEl = document.getElementById('task-title-input');
  const rawTitle = inputEl ? inputEl.value.trim() : '';
  
  if (!rawTitle) {
    inputEl?.focus();
    return;
  }

  // Use clean title if NLP detected date/time and title isn't empty, otherwise raw
  const title = (AppState.quickCapture.nlpCleanTitle && AppState.quickCapture.nlpCleanTitle.length > 0) 
    ? AppState.quickCapture.nlpCleanTitle 
    : rawTitle;

  const quadrant = updateEisenhowerQuadrantState();
  const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const nowIso = new Date().toISOString();

  const newTask = {
    task_id: taskId,
    profile_id: AppState.currentProfileId,
    title: title,
    notes: '',
    category: AppState.quickCapture.category || 'Personal',
    quadrant: quadrant,
    due_date: AppState.quickCapture.dueDate || '',
    due_time: AppState.quickCapture.dueTime || '',
    recurrence: 'none',
    status: 'pending',
    updated_at: nowIso
  };

  // 1. Instant 0ms IndexedDB Write
  await db.tasks.put(newTask);

  // 2. Queue Sync Mutation
  await db.sync_queue.add({
    action: 'upsert',
    task_id: taskId,
    profile_id: AppState.currentProfileId,
    payload: newTask,
    timestamp: Date.now()
  });

  // 3. Tactile Vibration Feedback
  if ('vibrate' in navigator) {
    navigator.vibrate([25]);
  }

  // 4. Reset Inputs & State
  if (inputEl) inputEl.value = '';
  AppState.quickCapture.nlpParsedText = '';
  AppState.quickCapture.nlpCleanTitle = '';
  AppState.quickCapture.dueDate = '';
  AppState.quickCapture.dueTime = '';

  const nlpIndicator = document.getElementById('nlp-indicator');
  if (nlpIndicator) nlpIndicator.classList.add('hidden');

  const dateInput = document.getElementById('task-due-date');
  const timeInput = document.getElementById('task-due-time');
  const dateLabel = document.getElementById('date-chip-label');
  if (dateInput) dateInput.value = '';
  if (timeInput) timeInput.value = '';
  if (dateLabel) dateLabel.textContent = '📅 Pick';

  // Deselect quick date chips
  document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));

  // 5. Reactive UI Refresh
  await refreshTasks();
  showToast('Task added');

  // 6. Trigger Background Sync
  triggerBackgroundSync();
}

// ============================================================================
// 5. Task Mutation Handlers (Toggle Complete, Delete, Move Quadrant)
// ============================================================================

async function toggleTaskStatus(taskId) {
  const task = await db.tasks.get(taskId);
  if (!task) return;

  const newStatus = task.status === 'completed' ? 'pending' : 'completed';
  const updatedTask = {
    ...task,
    status: newStatus,
    updated_at: new Date().toISOString()
  };

  // Update Local DB
  await db.tasks.put(updatedTask);

  // Queue Mutation
  await db.sync_queue.add({
    action: 'upsert',
    task_id: taskId,
    profile_id: task.profile_id,
    payload: updatedTask,
    timestamp: Date.now()
  });

  if ('vibrate' in navigator) {
    navigator.vibrate([15]);
  }

  await refreshTasks();
  triggerBackgroundSync();
}

async function deleteTask(taskId) {
  const task = await db.tasks.get(taskId);
  if (!task) return;

  // Local Delete
  await db.tasks.delete(taskId);

  // Queue Delete Mutation
  await db.sync_queue.add({
    action: 'delete',
    task_id: taskId,
    profile_id: task.profile_id,
    payload: null,
    timestamp: Date.now()
  });

  await refreshTasks();
  showToast('Task deleted');
  triggerBackgroundSync();
}

async function moveTaskQuadrant(taskId, newQuadrant) {
  const task = await db.tasks.get(taskId);
  if (!task || task.quadrant === newQuadrant) return;

  const updatedTask = {
    ...task,
    quadrant: newQuadrant,
    updated_at: new Date().toISOString()
  };

  await db.tasks.put(updatedTask);
  await db.sync_queue.add({
    action: 'upsert',
    task_id: taskId,
    profile_id: task.profile_id,
    payload: updatedTask,
    timestamp: Date.now()
  });

  await refreshTasks();
  showToast(`Moved to ${newQuadrant}`);
  triggerBackgroundSync();
}

// ============================================================================
// 6. UI Render Engine (Category Cards & Eisenhower Matrix Views)
// ============================================================================

async function refreshTasks() {
  // Query strictly partitioned by current profile
  AppState.tasks = await db.tasks
    .where('profile_id')
    .equals(AppState.currentProfileId)
    .toArray();

  // Sort: pending first, then by due_date ascending
  AppState.tasks.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'pending' ? -1 : 1;
    }
    if (a.due_date && b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }
    return a.due_date ? -1 : 1;
  });

  updateCounters();
  renderCategoryCardsView();
  renderMatrixView();
  renderCadenceView();
  updateDbStats();
}

function updateCounters() {
  const todayStr = getTodayDateString();
  const allCount = AppState.tasks.length;
  const todayCount = AppState.tasks.filter(t => t.due_date === todayStr && t.status === 'pending').length;
  const urgentCount = AppState.tasks.filter(t => (t.quadrant === 'Q1' || t.quadrant === 'Q3') && t.status === 'pending').length;
  const doneCount = AppState.tasks.filter(t => t.status === 'completed').length;

  const elAll = document.getElementById('count-all');
  const elToday = document.getElementById('count-today');
  const elUrgent = document.getElementById('count-urgent');
  const elDone = document.getElementById('count-done');

  if (elAll) elAll.textContent = allCount;
  if (elToday) elToday.textContent = todayCount;
  if (elUrgent) elUrgent.textContent = urgentCount;
  if (elDone) elDone.textContent = doneCount;

  // Quadrant counts
  const q1Count = AppState.tasks.filter(t => t.quadrant === 'Q1' && t.status === 'pending').length;
  const q2Count = AppState.tasks.filter(t => t.quadrant === 'Q2' && t.status === 'pending').length;
  const q3Count = AppState.tasks.filter(t => t.quadrant === 'Q3' && t.status === 'pending').length;
  const q4Count = AppState.tasks.filter(t => t.quadrant === 'Q4' && t.status === 'pending').length;

  const elQ1 = document.getElementById('q1-count');
  const elQ2 = document.getElementById('q2-count');
  const elQ3 = document.getElementById('q3-count');
  const elQ4 = document.getElementById('q4-count');

  if (elQ1) elQ1.textContent = q1Count;
  if (elQ2) elQ2.textContent = q2Count;
  if (elQ3) elQ3.textContent = q3Count;
  if (elQ4) elQ4.textContent = q4Count;
}

/**
 * Filter tasks according to active filter
 */
function getFilteredTasks() {
  const todayStr = getTodayDateString();
  return AppState.tasks.filter(t => {
    if (AppState.activeFilter === 'today') {
      return t.due_date === todayStr;
    }
    if (AppState.activeFilter === 'urgent') {
      return (t.quadrant === 'Q1' || t.quadrant === 'Q3');
    }
    if (AppState.activeFilter === 'done') {
      return t.status === 'completed';
    }
    return true; // 'all'
  });
}

/**
 * Render VIEW 1: Category Cards View
 */
function renderCategoryCardsView() {
  const grid = document.getElementById('category-cards-grid');
  if (!grid) return;

  const filteredTasks = getFilteredTasks();
  grid.innerHTML = '';

  if (filteredTasks.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>No tasks found for this view.</p>
        <p style="font-size:0.8rem;color:var(--text-subtle);margin-top:4px;">Use the quick capture strip below to add your first task!</p>
      </div>
    `;
    return;
  }

  // Group tasks by category
  const categories = {};
  filteredTasks.forEach(task => {
    const cat = task.category || 'General';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(task);
  });

  Object.keys(categories).forEach(catName => {
    const tasks = categories[catName];
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const progressPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <div class="category-card-header">
        <div class="cat-title-wrap">
          <span class="cat-icon"></span>
          <h2 class="cat-name">${escapeHtml(catName)}</h2>
        </div>
        <span class="cat-progress-pill">${completedTasks}/${tasks.length}</span>
      </div>
      <div class="cat-progress-bar">
        <div class="cat-progress-fill" style="width: ${progressPercent}%"></div>
      </div>
      <div class="cat-task-list"></div>
    `;

    const taskListEl = card.querySelector('.cat-task-list');
    tasks.forEach(task => {
      taskListEl.appendChild(createTaskItemElement(task));
    });

    grid.appendChild(card);
  });
}

/**
 * Render VIEW 2: Eisenhower Matrix View
 */
function renderMatrixView() {
  const qLists = {
    Q1: document.getElementById('q1-list'),
    Q2: document.getElementById('q2-list'),
    Q3: document.getElementById('q3-list'),
    Q4: document.getElementById('q4-list')
  };

  if (!qLists.Q1) return;

  // Clear lists
  Object.values(qLists).forEach(el => {
    if (el) el.innerHTML = '';
  });

  // Populate per quadrant
  AppState.tasks.forEach(task => {
    const targetList = qLists[task.quadrant] || qLists.Q4;
    if (targetList) {
      targetList.appendChild(createTaskItemElement(task, true));
    }
  });

  // Empty quadrant fallbacks
  Object.entries(qLists).forEach(([qKey, el]) => {
    if (el && el.children.length === 0) {
      el.innerHTML = `<div class="empty-state" style="padding:12px;">No ${qKey} tasks</div>`;
    }
  });
}

/**
 * Render VIEW 3: Cadence & Daily Rollover View
 */
function renderCadenceView() {
  const morningList = document.getElementById('morning-tasks-list');
  const eveningList = document.getElementById('evening-rollover-list');
  const todayStr = getTodayDateString();

  if (morningList) {
    morningList.innerHTML = '';
    const todayTasks = AppState.tasks.filter(t => t.due_date === todayStr);
    if (todayTasks.length === 0) {
      morningList.innerHTML = '<div class="empty-state">No scheduled tasks due today. Great job!</div>';
    } else {
      todayTasks.forEach(task => {
        morningList.appendChild(createTaskItemElement(task));
      });
    }
  }

  if (eveningList) {
    eveningList.innerHTML = '';
    // Unfinished tasks due today or earlier
    const unfinishedTasks = AppState.tasks.filter(t => t.status === 'pending' && t.due_date && t.due_date <= todayStr);
    if (unfinishedTasks.length === 0) {
      eveningList.innerHTML = '<div class="empty-state">All tasks completed! Nothing to rollover.</div>';
      const actionBtn = document.getElementById('btn-rollover-all');
      if (actionBtn) actionBtn.style.display = 'none';
    } else {
      unfinishedTasks.forEach(task => {
        eveningList.appendChild(createTaskItemElement(task));
      });
      const actionBtn = document.getElementById('btn-rollover-all');
      if (actionBtn) actionBtn.style.display = 'block';
    }
  }
}

/**
 * Create reusable Task DOM Element
 */
function createTaskItemElement(task, showQuadrantSwitcher = false) {
  const isCompleted = task.status === 'completed';
  const item = document.createElement('div');
  item.className = `task-item ${isCompleted ? 'completed' : ''}`;
  item.dataset.taskId = task.task_id;

  const todayStr = getTodayDateString();
  const isOverdue = task.due_date && task.due_date < todayStr && !isCompleted;

  let dueBadgeHtml = '';
  if (task.due_date) {
    const dueClass = isOverdue ? 'task-due-badge overdue' : 'task-due-badge';
    let timeText = task.due_time ? ` ${formatHumanTime(task.due_time)}` : '';
    dueBadgeHtml = `<span class="${dueClass}">📅 ${formatHumanDate(task.due_date)}${timeText}</span>`;
  }

  let quadrantBadgeHtml = `<span class="task-quadrant-tag tag-${task.quadrant.toLowerCase()}">${task.quadrant}</span>`;

  item.innerHTML = `
    <div class="task-left">
      <button class="task-checkbox-custom" aria-label="Toggle Complete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>
      <div class="task-details">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <div class="task-meta-row">
          ${quadrantBadgeHtml}
          ${dueBadgeHtml}
        </div>
      </div>
    </div>
    <div class="task-actions">
      ${showQuadrantSwitcher ? `
        <select class="form-input" style="min-height:28px;padding:0 4px;font-size:0.75rem;border-radius:4px;" onchange="moveTaskQuadrant('${task.task_id}', this.value)">
          <option value="Q1" ${task.quadrant === 'Q1' ? 'selected' : ''}>Q1</option>
          <option value="Q2" ${task.quadrant === 'Q2' ? 'selected' : ''}>Q2</option>
          <option value="Q3" ${task.quadrant === 'Q3' ? 'selected' : ''}>Q3</option>
          <option value="Q4" ${task.quadrant === 'Q4' ? 'selected' : ''}>Q4</option>
        </select>
      ` : ''}
      <button class="task-action-btn btn-delete" aria-label="Delete Task">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `;

  // Checkbox Click
  const checkboxBtn = item.querySelector('.task-checkbox-custom');
  checkboxBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTaskStatus(task.task_id);
  });

  // Delete Click
  const deleteBtn = item.querySelector('.btn-delete');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.task_id);
  });

  return item;
}

// ============================================================================
// 7. Background Sync Worker (Google Apps Script Integration)
// ============================================================================

function updateOnlineStatus() {
  AppState.isOnline = navigator.onLine;
  const badge = document.getElementById('sync-status-badge');
  const text = document.getElementById('sync-status-text');

  if (!badge || !text) return;

  badge.className = 'sync-badge';
  if (AppState.isSyncing) {
    badge.classList.add('syncing');
    text.textContent = 'Syncing...';
  } else if (AppState.isOnline) {
    badge.classList.add('online');
    text.textContent = 'Live Sync';
  } else {
    badge.classList.add('offline');
    text.textContent = 'Offline';
  }
}

async function triggerBackgroundSync() {
  if (!AppState.isOnline || AppState.isSyncing) {
    return;
  }

  AppState.isSyncing = true;
  updateOnlineStatus();

  try {
    // 1. Fetch pending mutations from sync_queue
    const queuedItems = await db.sync_queue.toArray();

    if (queuedItems.length > 0) {
      const mutations = queuedItems.map(item => ({
        type: item.action,
        task_id: item.task_id,
        task: item.payload
      }));

      const payload = {
        action: 'batchSync',
        profile_id: AppState.currentProfileId,
        mutations: mutations
      };

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          // Remove processed items from local queue
          const queueIds = queuedItems.map(q => q.id);
          await db.sync_queue.bulkDelete(queueIds);
          console.log(`[Sync] Successfully synced ${mutations.length} mutations.`);
        }
      }
    }

    // 2. Reconcile / Pull latest remote tasks for current profile
    const pullUrl = `/api/sync?action=getTasks&profile_id=${encodeURIComponent(AppState.currentProfileId)}`;
    const getRes = await fetch(pullUrl);
    
    if (getRes.ok) {
      const data = await getRes.json();
      if (data.success && Array.isArray(data.tasks)) {
        // Last-Write-Wins Merge with local tasks
        for (const remoteTask of data.tasks) {
          const localTask = await db.tasks.get(remoteTask.task_id);
          if (!localTask || new Date(remoteTask.updated_at) > new Date(localTask.updated_at)) {
            await db.tasks.put(remoteTask);
          }
        }
        await refreshTasks();
      }
    }
  } catch (err) {
    console.warn('[Sync] Background sync encountered network glitch:', err);
  } finally {
    AppState.isSyncing = false;
    updateOnlineStatus();
  }
}

// ============================================================================
// 8. Daily Cadence & Notification Engine
// ============================================================================

function checkDailyCadence() {
  const current = AppState.profiles.find(p => p.profile_id === AppState.currentProfileId);
  if (!current) return;

  const now = new Date();
  const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Check Morning Digest trigger
  if (current.digest_time && currentHourMin === current.digest_time) {
    triggerLocalAlert('🌅 Morning Focus Briefing', 'Review your prioritized tasks for today in TaskFlow.');
  }

  // Check Evening Rollover trigger
  if (current.evening_time && currentHourMin === current.evening_time) {
    triggerLocalAlert('🌙 Evening Rollover', 'Rollover today’s unfinished tasks to tomorrow.');
  }
}

async function triggerLocalAlert(title, message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title: title,
        options: { body: message }
      });
    } else {
      new Notification(title, { body: message, icon: './icon.svg' });
    }
  }
}

async function rolloverAllToTomorrow() {
  const todayStr = getTodayDateString();
  const tomorrowStr = getTomorrowDateString();

  const unfinishedTasks = AppState.tasks.filter(t => t.status === 'pending' && t.due_date && t.due_date <= todayStr);
  if (unfinishedTasks.length === 0) {
    showToast('No tasks to rollover');
    return;
  }

  for (const t of unfinishedTasks) {
    const updated = {
      ...t,
      due_date: tomorrowStr,
      updated_at: new Date().toISOString()
    };
    await db.tasks.put(updated);
    await db.sync_queue.add({
      action: 'upsert',
      task_id: t.task_id,
      profile_id: t.profile_id,
      payload: updated,
      timestamp: Date.now()
    });
  }

  await refreshTasks();
  showToast(`Rolled over ${unfinishedTasks.length} tasks to tomorrow`);
  triggerBackgroundSync();
}

// ============================================================================
// 9. Event Listeners & Interactive UI Bindings
// ============================================================================

function setupEventListeners() {
  // Online / Offline Network Events
  window.addEventListener('online', () => {
    updateOnlineStatus();
    showToast('Connection restored. Syncing...');
    triggerBackgroundSync();
  });

  window.addEventListener('offline', () => {
    updateOnlineStatus();
    showToast('Offline mode active. All changes saved locally.');
  });

  // Profile Dropdown Toggle
  const profileBtn = document.getElementById('profile-btn');
  const profileMenu = document.getElementById('profile-menu');
  if (profileBtn && profileMenu) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      profileMenu.classList.add('hidden');
    });
  }



  // Bottom Navigation Bar View Switcher
  const navButtons = document.querySelectorAll('.bottom-nav .nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.target;
      if (targetView) {
        switchView(targetView);
      }
    });
  });

  // Settings & Sync Modal Triggers
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnNavSync = document.getElementById('nav-sync-modal');
  const modalSettings = document.getElementById('modal-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnTestSync = document.getElementById('btn-test-gas-sync');

  const openSettingsModal = () => {
    updateDbStats();
    modalSettings?.classList.remove('hidden');
  };

  btnOpenSettings?.addEventListener('click', openSettingsModal);
  btnNavSync?.addEventListener('click', openSettingsModal);
  btnCloseSettings?.addEventListener('click', () => modalSettings?.classList.add('hidden'));

  btnSaveSettings?.addEventListener('click', async () => {
    const identityInput = document.getElementById('setting-identity');
    const digestInput = document.getElementById('setting-digest-time');
    const eveningInput = document.getElementById('setting-evening-time');

    if (identityInput) {
      AppState.primaryIdentity = identityInput.value;
      await db.settings.put({ key: 'primary_identity', value: AppState.primaryIdentity });
      
      // If the current profile is not one of the visible ones, switch to the primary identity
      if (AppState.currentProfileId !== AppState.primaryIdentity && AppState.currentProfileId !== 'pattuthangam') {
        AppState.currentProfileId = AppState.primaryIdentity;
        await db.settings.put({ key: 'active_profile_id', value: AppState.currentProfileId });
      }
      
      renderProfileDropdown();
      updateProfileHeader();
      await refreshTasks();
    }

    const current = AppState.profiles.find(p => p.profile_id === AppState.currentProfileId);
    if (current) {
      current.digest_time = digestInput ? digestInput.value : current.digest_time;
      current.evening_time = eveningInput ? eveningInput.value : current.evening_time;
      await db.profiles.put(current);
      await loadProfiles();
    }

    modalSettings?.classList.add('hidden');
    showToast('Settings saved');
    triggerBackgroundSync();
  });

  // Notification Permission Request & Web Push Subscription
  document.getElementById('btn-enable-notifications')?.addEventListener('click', async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          
          // Get VAPID public key from backend
          const vapidRes = await fetch('/api/vapid-public-key');
          const vapidData = await vapidRes.json();
          const applicationServerKey = urlB64ToUint8Array(vapidData.publicKey);
          
          const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
          });

          // Send subscription and primaryIdentity to backend
          await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription,
              primaryIdentity: AppState.primaryIdentity
            })
          });

          showToast('Push notifications enabled!');
        } catch (err) {
          console.error('Push subscription failed:', err);
          showToast('Failed to setup push notifications.');
        }
      } else {
        showToast('Notification permission denied.');
      }
    } else {
      showToast('Push notifications not supported in this browser.');
    }
  });

  // Helper to convert VAPID key
  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Backup & Purge Actions
  document.getElementById('btn-export-backup')?.addEventListener('click', async () => {
    const allTasks = await db.tasks.toArray();
    const blob = new Blob([JSON.stringify(allTasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow_backup_${getTodayDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-clear-completed')?.addEventListener('click', async () => {
    const completed = await db.tasks.where('status').equals('completed').toArray();
    for (const t of completed) {
      await db.tasks.delete(t.task_id);
      await db.sync_queue.add({
        action: 'delete',
        task_id: t.task_id,
        profile_id: t.profile_id,
        payload: null,
        timestamp: Date.now()
      });
    }
    await refreshTasks();
    showToast('Completed tasks cleared');
    triggerBackgroundSync();
  });

  // Filter Chips in Category View
  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.activeFilter = chip.dataset.filter || 'all';
      renderCategoryCardsView();
    });
  });

  // Quick Capture Input & NLP
  const taskTitleInput = document.getElementById('task-title-input');
  const btnSave = document.getElementById('btn-save-task');
  const quickCaptureForm = document.getElementById('quick-capture-form');

  if (taskTitleInput) {
    taskTitleInput.addEventListener('input', handleQuickCaptureInput);
    taskTitleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveQuickTask();
      }
    });
  }

  if (quickCaptureForm) {
    quickCaptureForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveQuickTask();
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', (e) => {
      e.preventDefault();
      saveQuickTask();
    });
  }

  // Clear NLP Badge
  document.getElementById('nlp-clear-btn')?.addEventListener('click', () => {
    document.getElementById('nlp-indicator')?.classList.add('hidden');
    AppState.quickCapture.nlpParsedText = '';
    AppState.quickCapture.dueDate = '';
    AppState.quickCapture.dueTime = '';
    const dateInput = document.getElementById('task-due-date');
    const timeInput = document.getElementById('task-due-time');
    const dateLabel = document.getElementById('date-chip-label');
    if (dateInput) dateInput.value = '';
    if (timeInput) timeInput.value = '';
    if (dateLabel) dateLabel.textContent = '📅 Pick';
  });

  // Eisenhower 2-Pill Toggles
  const urgentToggle = document.getElementById('toggle-urgent');
  const importantToggle = document.getElementById('toggle-important');

  urgentToggle?.addEventListener('click', () => {
    AppState.quickCapture.isUrgent = !AppState.quickCapture.isUrgent;
    urgentToggle.dataset.active = String(AppState.quickCapture.isUrgent);
    urgentToggle.setAttribute('aria-pressed', String(AppState.quickCapture.isUrgent));
    updateEisenhowerQuadrantState();
    if ('vibrate' in navigator) navigator.vibrate([10]);
  });

  importantToggle?.addEventListener('click', () => {
    AppState.quickCapture.isImportant = !AppState.quickCapture.isImportant;
    importantToggle.dataset.active = String(AppState.quickCapture.isImportant);
    importantToggle.setAttribute('aria-pressed', String(AppState.quickCapture.isImportant));
    updateEisenhowerQuadrantState();
    if ('vibrate' in navigator) navigator.vibrate([10]);
  });

  // Category Chips Selection & Custom Category Adder
  const categoryChipsList = document.getElementById('category-chips-list');
  categoryChipsList?.addEventListener('click', (e) => {
    const target = e.target.closest('.chip');
    if (!target) return;

    if (target.id === 'btn-add-custom-category') {
      const customName = prompt('Enter new category name:');
      if (customName && customName.trim()) {
        const name = customName.trim();
        const newChip = document.createElement('button');
        newChip.type = 'button';
        newChip.className = 'chip active';
        newChip.dataset.category = name;
        newChip.textContent = name;
        
        categoryChipsList.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        categoryChipsList.insertBefore(newChip, target);
        AppState.quickCapture.category = name;
      }
      return;
    }

    categoryChipsList.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    target.classList.add('active');
    AppState.quickCapture.category = target.dataset.category || 'Personal';
    if ('vibrate' in navigator) navigator.vibrate([10]);
  });

  // Quick Date Chips (Today / Tomorrow / Picker)
  const dateChips = document.querySelectorAll('.date-chip');
  dateChips.forEach(chip => {
    chip.addEventListener('click', () => {
      dateChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      
      const type = chip.dataset.date;
      const targetDate = type === 'today' ? getTodayDateString() : getTomorrowDateString();
      AppState.quickCapture.dueDate = targetDate;
      
      const dateInput = document.getElementById('task-due-date');
      const dateLabel = document.getElementById('date-chip-label');
      if (dateInput) dateInput.value = targetDate;
      if (dateLabel) dateLabel.textContent = formatHumanDate(targetDate);
    });
  });

  // Native Date & Time Input Change Handlers
  const nativeDateInput = document.getElementById('task-due-date');
  nativeDateInput?.addEventListener('change', (e) => {
    AppState.quickCapture.dueDate = e.target.value;
    const dateLabel = document.getElementById('date-chip-label');
    if (dateLabel) {
      dateLabel.textContent = e.target.value ? formatHumanDate(e.target.value) : '📅 Pick';
    }
  });

  const nativeTimeInput = document.getElementById('task-due-time');
  nativeTimeInput?.addEventListener('change', (e) => {
    AppState.quickCapture.dueTime = e.target.value;
  });

  // Cadence Rollover Action
  document.getElementById('btn-rollover-all')?.addEventListener('click', rolloverAllToTomorrow);

  // Sync Badge Force Trigger
  document.getElementById('sync-status-badge')?.addEventListener('click', () => {
    if (AppState.gasUrl) {
      showToast('Triggering sync...');
      triggerBackgroundSync();
    } else {
      openSettingsModal();
    }
  });
}

function switchView(viewId) {
  AppState.activeView = viewId;
  
  // Toggle view containers
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');

  // Toggle navigation active state
  document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === viewId);
  });
}

async function updateDbStats() {
  const taskCount = await db.tasks.count();
  const queueCount = await db.sync_queue.count();

  const elTasks = document.getElementById('stat-local-tasks');
  const elQueue = document.getElementById('stat-pending-sync');

  if (elTasks) elTasks.textContent = taskCount;
  if (elQueue) elQueue.textContent = queueCount;
}

// ============================================================================
// 10. Utility Functions
// ============================================================================

function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatHumanDate(dateStr) {
  if (!dateStr) return '';
  const todayStr = getTodayDateString();
  const tomorrowStr = getTomorrowDateString();

  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return dateStr;
}

function formatHumanTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let hour = parseInt(parts[0], 10);
    const min = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${min} ${ampm}`;
  }
  return timeStr;
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-message');
  if (!toast || !msg) return;

  msg.textContent = message;
  toast.classList.remove('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2400);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
