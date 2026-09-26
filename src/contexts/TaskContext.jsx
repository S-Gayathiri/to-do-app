import React, { createContext, useContext, useState, useEffect } from 'react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { fetchSheetData, appendRow, updateRow, deleteRow, getSheetId, rewriteSheet } from '../services/googleSheets';
import { scheduleTaskReminder } from '../services/notifications';
import { subDays } from 'date-fns';

const TaskContext = createContext();

export const useTasks = () => useContext(TaskContext);

export const TaskProvider = ({ children }) => {
  const [identity, setIdentity] = useState(() => localStorage.getItem('user_identity') || 'Pattu');
  const [activeProfile, setActiveProfile] = useState(() => localStorage.getItem('active_profile') || 'PattuThangam');
  
  // Instant loading from offline cache
  const [tasks, setTasks] = useState(() => {
    try {
      const cached = localStorage.getItem('tasks_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    localStorage.setItem('user_identity', identity);
    if (activeProfile !== 'PattuThangam' && activeProfile !== identity) {
      setActiveProfile(identity);
      localStorage.setItem('active_profile', identity);
    }
  }, [identity]);

  useEffect(() => {
    localStorage.setItem('active_profile', activeProfile);
  }, [activeProfile]);

  // Sync cache with state
  useEffect(() => {
    if (tasks && tasks.length >= 0) {
      try {
        localStorage.setItem('tasks_cache', JSON.stringify(tasks));
      } catch (e) {
        console.warn('Cache save failed', e);
      }
    }
  }, [tasks]);

  const loadTasks = async () => {
    if (tasks.length === 0) setLoading(true);
    try {
      const data = await fetchSheetData('A:L');
      if (data) {
        setTasks(data);
        localStorage.setItem('tasks_cache', JSON.stringify(data));
      }
    } catch (error) {
      console.error("Failed to fetch tasks from Google Sheets", error);
      // If we have cached tasks, don't show an invasive alert
      if (tasks.length === 0) {
        alert("Failed to read from Google Sheets: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const addTask = async (taskData) => {
    const newTask = {
      id: crypto.randomUUID(),
      is_completed: false,
      ...taskData,
      created_at: taskData.created_at || new Date().toISOString()
    };
    
    // Optimistic update
    setTasks(prev => [...prev, newTask]);
    scheduleTaskReminder(newTask);

    try {
      await appendRow('A:L', [
        newTask.id,
        newTask.profile,
        newTask.title,
        newTask.task_date,
        newTask.time_block,
        newTask.is_urgent,
        newTask.is_important,
        newTask.is_completed,
        newTask.reminder_time || '',
        newTask.created_at,
        newTask.is_recurring || false,
        newTask.recurrence_pattern || ''
      ]);
    } catch (error) {
      console.error("Failed to add task", error);
      alert("Failed to add task to Google Sheets: " + error.message);
      loadTasks(); // revert on failure
    }
  };

  const getTasksForDate = (date, profile) => {
    let formattedDate;
    try {
      formattedDate = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    } catch {
      formattedDate = format(new Date(), 'yyyy-MM-dd');
    }
    const targetProfile = profile || activeProfile;

    // Direct tasks matching target date and profile (excluding skipped/deleted single occurrences)
    const rawDirectTasks = (tasks || []).filter(t => {
      if (!t || !t.task_date || typeof t.task_date !== 'string') return false;
      if (t.task_date !== formattedDate) return false;
      if (t.is_skipped || t.is_deleted || t.id === 'DELETED') return false;
      if (targetProfile === 'PattuThangam') return true;
      return t.profile === targetProfile || t.profile === 'PattuThangam';
    });

    // Track skipped single-day occurrences
    const skippedKeys = new Set(
      (tasks || [])
        .filter(t => t && t.task_date === formattedDate && (t.is_skipped || t.is_deleted || t.id === 'DELETED'))
        .map(t => `${(t.title || '').trim().toLowerCase()}_${t.time_block}`)
    );

    // Deduplicate direct tasks by title + time_block so duplicate rows never show
    const seenDirectTitles = new Set();
    const directTasks = [];
    rawDirectTasks.forEach(t => {
      const titleKey = `${(t.title || '').trim().toLowerCase()}_${t.time_block}`;
      if (!seenDirectTitles.has(titleKey)) {
        seenDirectTitles.add(titleKey);
        directTasks.push(t);
      }
    });

    // Track existing titles + time blocks so virtual instances never duplicate direct entries
    const existingKeys = new Set(directTasks.map(t => `${(t.title || '').trim().toLowerCase()}_${t.time_block}`));
    const generatedKeys = new Set();

    // Expand recurring tasks that began on or before formattedDate
    const virtualRecurringTasks = [];

    (tasks || []).forEach(t => {
      if (!t || !t.task_date || typeof t.task_date !== 'string') return;
      const isRecurring = Boolean(t.is_recurring) && t.is_recurring !== 'false';
      if (!isRecurring || !t.recurrence_pattern) return;
      if (t.task_date >= formattedDate) return; // if ===, already in directTasks; if >, hasn't started
      if (targetProfile !== 'PattuThangam' && t.profile !== targetProfile && t.profile !== 'PattuThangam') return;

      const parts = t.task_date.split('-').map(Number);
      const targetParts = formattedDate.split('-').map(Number);
      if (parts.length !== 3 || parts.some(isNaN) || targetParts.length !== 3 || targetParts.some(isNaN)) return;

      const [y, m, d] = parts;
      const [ty, tm, td] = targetParts;
      const startDate = new Date(y, m - 1, d);
      const targetDate = new Date(ty, tm - 1, td);

      const pattern = (t.recurrence_pattern || '').toLowerCase().trim();

      let isMatch = false;
      if (pattern === 'daily') {
        isMatch = true;
      } else if (pattern === 'weekly') {
        isMatch = targetDate.getDay() === startDate.getDay();
      } else if (pattern === 'monthly') {
        isMatch = targetDate.getDate() === startDate.getDate();
      } else {
        const targetDay = format(targetDate, 'EEE').toLowerCase();
        const targetDays = pattern.split(',').map(s => s.trim().toLowerCase());
        isMatch = targetDays.includes(targetDay);
      }

      if (!isMatch) return;

      const titleKey = `${(t.title || '').trim().toLowerCase()}_${t.time_block}`;
      if (existingKeys.has(titleKey) || generatedKeys.has(titleKey) || skippedKeys.has(titleKey)) {
        return; // Already exists as direct entry, already generated, or skipped for this day
      }

      generatedKeys.add(titleKey);

      virtualRecurringTasks.push({
        ...t,
        id: `recurring_${t.id}_${formattedDate}`,
        series_id: t.id,
        task_date: formattedDate,
        is_completed: false,
        is_virtual: true
      });
    });

    return [...directTasks, ...virtualRecurringTasks];
  };

  const updateTask = async (id, updates) => {
    // If it's a virtual recurring instance, create a single-day record for this date
    if (typeof id === 'string' && id.startsWith('recurring_')) {
      const [, seriesId, targetDate] = id.split('_');
      const baseTask = tasks.find(t => t.id === seriesId);
      if (baseTask) {
        const newInstance = {
          ...baseTask,
          ...updates,
          task_date: targetDate,
          // A single-day completed entry must NOT be a recurring generator itself
          is_recurring: false,
          recurrence_pattern: ''
        };
        delete newInstance.id;
        delete newInstance.is_virtual;
        delete newInstance.series_id;
        await addTask(newInstance);
        return;
      }
    }

    let updatedTask = null;
    // Optimistic update locally
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        updatedTask = { ...t, ...updates };
        return updatedTask;
      }
      return t;
    }));

    try {
      const data = await fetchSheetData('A:L');
      const rowIndex = data.findIndex(row => row.id === id);
      
      if (rowIndex !== -1 && updatedTask) {
        scheduleTaskReminder(updatedTask);
        const sheetRow = rowIndex + 2;
        
        await updateRow(`A${sheetRow}:L${sheetRow}`, [
          updatedTask.id,
          updatedTask.profile,
          updatedTask.title,
          updatedTask.task_date,
          updatedTask.time_block,
          updatedTask.is_urgent,
          updatedTask.is_important,
          updatedTask.is_completed,
          updatedTask.reminder_time || '',
          updatedTask.created_at || new Date().toISOString(),
          updatedTask.is_recurring || false,
          updatedTask.recurrence_pattern || ''
        ]);
      }
    } catch (error) {
      console.error("Failed to update task", error);
      alert("Failed to update task in Google Sheets: " + error.message);
      loadTasks();
    }
  };

  // Standard delete
  const deleteTask = async (id) => {
    let targetId = id;
    if (typeof id === 'string' && id.startsWith('recurring_')) {
      targetId = id.split('_')[1];
    }

    setTasks(prev => prev.filter(t => t.id !== targetId && t.series_id !== targetId));
    
    try {
      const data = await fetchSheetData('A:L');
      const rowIndex = data.findIndex(row => row.id === targetId);
      if (rowIndex !== -1) {
        const sheetId = await getSheetId('Tasks');
        await deleteRow(sheetId, rowIndex + 1);
      }
    } catch (error) {
      console.error("Failed to delete", error);
      alert("Failed to delete task in Google Sheets: " + error.message);
      loadTasks();
    }
  };

  // Delete only this specific occurrence of a repeating task
  const deleteTaskOccurrence = async (task, dateStr) => {
    const targetDate = dateStr || task.task_date;
    
    // If it's an explicit record for this day, delete it
    if (task.id && !task.id.startsWith('recurring_') && task.task_date === targetDate) {
      await deleteTask(task.id);
    }
    
    // Record a skipped exception for this day so virtual recurrence ignores it
    const skipEntry = {
      title: task.title,
      profile: task.profile,
      time_block: task.time_block,
      task_date: targetDate,
      is_completed: false,
      is_skipped: true,
      is_recurring: false,
      recurrence_pattern: ''
    };
    await addTask(skipEntry);
  };

  // Delete entire recurring series
  const deleteTaskSeries = async (task) => {
    const masterId = task.id.startsWith('recurring_') ? task.id.split('_')[1] : (task.series_id || task.id);
    const titleKey = (task.title || '').trim().toLowerCase();

    // Optimistically remove master and related records from local state
    setTasks(prev => prev.filter(t => t.id !== masterId && (t.title || '').trim().toLowerCase() !== titleKey));

    try {
      const data = await fetchSheetData('A:L');
      const sheetId = await getSheetId('Tasks');
      
      // Delete in reverse order to keep row indices valid
      const matchingIndices = [];
      data.forEach((row, idx) => {
        if (row.id === masterId || (row.title || '').trim().toLowerCase() === titleKey) {
          matchingIndices.push(idx + 1); // +1 because row 0 is headers in 0-based dimension
        }
      });

      matchingIndices.sort((a, b) => b - a);
      for (const rowIdx of matchingIndices) {
        await deleteRow(sheetId, rowIdx);
      }
    } catch (error) {
      console.error("Failed to delete recurring series", error);
      alert("Failed to delete recurring series: " + error.message);
      loadTasks();
    }
  };

  const carryForwardTasks = async (taskIdsToCarryForward) => {
    setLoading(true);
    try {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const tasksToUpdate = tasks.filter(t => taskIdsToCarryForward.includes(t.id));
      
      if (tasksToUpdate.length === 0) return;

      // Optimistically update locally
      setTasks(prev => prev.map(t => {
        if (taskIdsToCarryForward.includes(t.id)) {
          return { ...t, task_date: tomorrow };
        }
        return t;
      }));

      // Update in sheets
      const data = await fetchSheetData('A:L');
      
      for (const t of tasksToUpdate) {
        const rowIndex = data.findIndex(row => row.id === t.id);
        if (rowIndex !== -1) {
          const sheetRow = rowIndex + 2;
          const taskToUpdate = { ...data[rowIndex], task_date: tomorrow };
          
          await updateRow(`A${sheetRow}:L${sheetRow}`, [
            taskToUpdate.id,
            taskToUpdate.profile,
            taskToUpdate.title,
            taskToUpdate.task_date,
            taskToUpdate.time_block,
            taskToUpdate.is_urgent,
            taskToUpdate.is_important,
            taskToUpdate.is_completed,
            taskToUpdate.reminder_time || '',
            taskToUpdate.created_at || new Date().toISOString(),
            taskToUpdate.is_recurring || false,
            taskToUpdate.recurrence_pattern || ''
          ]);
        }
      }
    } catch (error) {
      console.error("Failed to carry forward tasks", error);
      alert("Failed to carry forward tasks: " + error.message);
      loadTasks(); // revert on failure
    } finally {
      setLoading(false);
    }
  };

  const cleanupSheet = async (options = { removeDuplicates: true, removeCompleted: false }) => {
    setLoading(true);
    try {
      const data = await fetchSheetData('A:L');
      if (!data || data.length === 0) {
        alert("Sheet is already empty.");
        return;
      }

      const initialCount = data.length;
      const seen = new Set();
      const cleanTasks = [];

      for (const t of data) {
        if (!t || !t.title || !t.task_date) continue; // Skip empty rows
        if (t.is_skipped || t.is_deleted || t.id === 'DELETED') continue; // Purge skip markers

        const isCompleted = Boolean(t.is_completed) && t.is_completed !== 'false';
        if (options.removeCompleted && isCompleted) {
          continue; // Remove completed if requested
        }

        const isRecurring = Boolean(t.is_recurring) && t.is_recurring !== 'false';
        const key = isRecurring 
          ? `rec_${(t.title || '').trim().toLowerCase()}_${t.time_block}_${t.profile}`
          : `single_${(t.title || '').trim().toLowerCase()}_${t.task_date}_${t.time_block}_${t.profile}`;

        if (!seen.has(key)) {
          seen.add(key);
          cleanTasks.push(t);
        }
      }

      // Convert clean tasks to 2D array
      const rowsArray = cleanTasks.map(t => [
        t.id || crypto.randomUUID(),
        t.profile || 'Pattu',
        t.title || '',
        t.task_date || '',
        t.time_block || 'morning',
        t.is_urgent || false,
        t.is_important || false,
        t.is_completed || false,
        t.reminder_time || '',
        t.created_at || new Date().toISOString(),
        t.is_recurring || false,
        t.recurrence_pattern || ''
      ]);

      await rewriteSheet(rowsArray);
      setTasks(cleanTasks);
      localStorage.setItem('tasks_cache', JSON.stringify(cleanTasks));
      alert(`Cleaned up Google Sheet! Reduced ${initialCount} rows to ${cleanTasks.length} clean rows.`);
    } catch (error) {
      console.error("Failed to clean up sheet", error);
      alert("Failed to clean up sheet: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const allowedProfiles = ['PattuThangam', identity];

  return (
    <TaskContext.Provider value={{
      identity, setIdentity,
      activeProfile, setActiveProfile,
      allowedProfiles,
      tasks, 
      loading,
      selectedDate, setSelectedDate,
      addTask, updateTask, deleteTask, deleteTaskOccurrence, deleteTaskSeries,
      fetchTasks: loadTasks, carryForwardTasks,
      getTasksForDate,
      cleanupSheet
    }}>
      {children}
    </TaskContext.Provider>
  );
};
