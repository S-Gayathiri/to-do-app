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

  const updateTask = async (id, updates) => {
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

        // Handle recurring tasks: if marking as completed and it is recurring, spawn next
        const isTaskRecurring = Boolean(updatedTask.is_recurring) && updatedTask.is_recurring !== 'false';
        if (updates.is_completed && isTaskRecurring && updatedTask.recurrence_pattern) {
          await spawnNextRecurringTask(updatedTask);
        }
      }
    } catch (error) {
      console.error("Failed to update task", error);
      alert("Failed to update task in Google Sheets: " + error.message);
      loadTasks(); // revert on failure
    } finally {
      setLoading(false);
    }
  };

  const spawnNextRecurringTask = async (task) => {
    if (!task.task_date || !task.recurrence_pattern) return;

    try {
      const [year, month, day] = task.task_date.split('-').map(Number);
      const currentDate = new Date(year, month - 1, day);
      let nextDate = currentDate;

      const pattern = (task.recurrence_pattern || '').toLowerCase().trim();

      if (pattern === 'daily') {
        nextDate = addDays(currentDate, 1);
      } else if (pattern === 'weekly') {
        nextDate = addWeeks(currentDate, 1);
      } else if (pattern === 'monthly') {
        nextDate = addMonths(currentDate, 1);
      } else {
        // Handle specific days of week, e.g. "Mon,Wed,Fri"
        const targetDays = pattern.split(',').map(d => d.trim().toLowerCase());
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        let matched = false;
        for (let i = 1; i <= 7; i++) {
          const candidate = addDays(currentDate, i);
          const dayName = dayNames[candidate.getDay()];
          if (targetDays.includes(dayName)) {
            nextDate = candidate;
            matched = true;
            break;
          }
        }
        if (!matched) {
          nextDate = addDays(currentDate, 1);
        }
      }

      const newTask = {
        ...task,
        task_date: format(nextDate, 'yyyy-MM-dd'),
        is_completed: false
      };
      delete newTask.id; // ensure it gets a new ID in addTask
      await addTask(newTask);
    } catch (err) {
      console.error('Error spawning next recurring task:', err);
    }
  };

  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    
    try {
      const data = await fetchSheetData('A:L');
      const rowIndex = data.findIndex(row => row.id === id);
      if (rowIndex !== -1) {
        const sheetId = await getSheetId('Tasks');
        // rowIndex in array is 0-based. But the dimension is 0-based indexing for the entire sheet.
        // Array index 0 corresponds to sheet row 1 (header is row 0). So array index + 1 is the row index to delete.
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
      addTask, updateTask, deleteTask, fetchTasks: loadTasks, carryForwardTasks
    }}>
      {children}
    </TaskContext.Provider>
  );
};
