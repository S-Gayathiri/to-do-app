import React, { createContext, useContext, useState, useEffect } from 'react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { fetchSheetData, appendRow, updateRow, deleteRow, getSheetId } from '../services/googleSheets';
import { scheduleTaskReminder } from '../services/notifications';

const TaskContext = createContext();

export const useTasks = () => useContext(TaskContext);

export const TaskProvider = ({ children }) => {
  const [identity, setIdentity] = useState(() => localStorage.getItem('user_identity') || 'Pattu');
  const [activeProfile, setActiveProfile] = useState(() => localStorage.getItem('active_profile') || 'PattuThangam');
  const [tasks, setTasks] = useState([]);
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

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await fetchSheetData('A:L');
      setTasks(data || []);
    } catch (error) {
      console.error("Failed to fetch tasks from Google Sheets", error);
      alert("Failed to read from Google Sheets: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const addTask = async (taskData) => {
    setLoading(true);
    try {
      const newTask = {
        id: crypto.randomUUID(),
        ...taskData,
        is_completed: false,
        created_at: new Date().toISOString()
      };
      
      setTasks(prev => [...prev, newTask]);
      scheduleTaskReminder(newTask); // Schedule reminder

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
    } finally {
      setLoading(false);
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

    // Direct tasks matching target date and profile
    const rawDirectTasks = (tasks || []).filter(t => {
      if (!t || !t.task_date || typeof t.task_date !== 'string') return false;
      if (t.task_date !== formattedDate) return false;
      if (targetProfile === 'PattuThangam') return true;
      return t.profile === targetProfile || t.profile === 'PattuThangam';
    });

    // Deduplicate direct tasks if identical rows exist
    const seenDirectKeys = new Set();
    const directTasks = [];
    rawDirectTasks.forEach(t => {
      const key = `${t.id || ''}_${(t.title || '').trim().toLowerCase()}_${t.time_block}`;
      if (!seenDirectKeys.has(key)) {
        seenDirectKeys.add(key);
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
      if (existingKeys.has(titleKey) || generatedKeys.has(titleKey)) {
        return; // Already exists as direct entry or already generated by parent series
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

    setLoading(true);
    try {
      let updatedTask = null;
      setTasks(prev => prev.map(t => {
        if (t.id === id) {
          updatedTask = { ...t, ...updates };
          return updatedTask;
        }
        return t;
      }));

      const data = await fetchSheetData('A:L');
      const rowIndex = data.findIndex(row => row.id === id);
      
      if (rowIndex !== -1 && updatedTask) {
        scheduleTaskReminder(updatedTask); // Schedule reminder
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
      loadTasks(); // revert on failure
    } finally {
      setLoading(false);
    }
  };

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

  const allowedProfiles = ['PattuThangam', identity];

  return (
    <TaskContext.Provider value={{
      identity, setIdentity,
      activeProfile, setActiveProfile,
      allowedProfiles,
      tasks, 
      loading,
      selectedDate, setSelectedDate,
      addTask, updateTask, deleteTask, fetchTasks: loadTasks, carryForwardTasks,
      getTasksForDate
    }}>
      {children}
    </TaskContext.Provider>
  );
};
