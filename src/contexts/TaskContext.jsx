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
      const data = await fetchSheetData('A:M');
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
        created_at: new Date().toISOString(),
        completed_dates: taskData.completed_dates || ''
      };
      
      setTasks(prev => [...prev, newTask]);
      scheduleTaskReminder(newTask); // Schedule reminder

      await appendRow('A:M', [
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
        newTask.recurrence_pattern || '',
        newTask.completed_dates || ''
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

      const data = await fetchSheetData('A:M');
      const rowIndex = data.findIndex(row => row.id === id);
      
      if (rowIndex !== -1 && updatedTask) {
        scheduleTaskReminder(updatedTask); // Schedule reminder
        const sheetRow = rowIndex + 2;
        
        await updateRow(`A${sheetRow}:M${sheetRow}`, [
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
          updatedTask.recurrence_pattern || '',
          updatedTask.completed_dates || ''
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

  const isTaskDueOnDate = (task, targetDate) => {
    const dateStr = typeof targetDate === 'string' ? targetDate : format(targetDate, 'yyyy-MM-dd');
    if (!task.is_recurring) {
      return task.task_date === dateStr;
    }
    
    // Recurring task: must start on or before target date
    if (task.task_date > dateStr) {
      return false;
    }

    const pattern = (task.recurrence_pattern || '').trim();
    if (!pattern) {
      return task.task_date === dateStr;
    }

    const dateObj = typeof targetDate === 'string' 
      ? (() => { const [y, m, d] = targetDate.split('-'); return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)); })()
      : targetDate;
    const dayOfWeek = format(dateObj, 'EEE'); // 'Mon', 'Tue', etc.

    if (pattern.toLowerCase() === 'daily') {
      return true;
    }
    if (pattern.toLowerCase() === 'weekly') {
      const [y, m, d] = task.task_date.split('-');
      const taskStartDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return format(taskStartDate, 'EEE') === dayOfWeek;
    }
    if (pattern.toLowerCase() === 'monthly') {
      const taskDay = parseInt(task.task_date.split('-')[2], 10);
      return dateObj.getDate() === taskDay;
    }

    // Comma-separated days: e.g. "Mon,Wed,Fri"
    const days = pattern.split(',').map(s => s.trim());
    return days.includes(dayOfWeek);
  };

  const isTaskCompletedOnDate = (task, targetDate) => {
    const dateStr = typeof targetDate === 'string' ? targetDate : format(targetDate, 'yyyy-MM-dd');
    if (!task.is_recurring) {
      return Boolean(task.is_completed);
    }
    const completedList = (task.completed_dates || '').split(',').map(s => s.trim()).filter(Boolean);
    if (completedList.includes(dateStr)) {
      return true;
    }
    // Backwards compatibility: if base task_date matches and is_completed was true
    if (task.task_date === dateStr && task.is_completed) {
      return true;
    }
    return false;
  };

  const getTasksForDate = (targetDate = selectedDate, profile = activeProfile) => {
    const dateStr = typeof targetDate === 'string' ? targetDate : format(targetDate, 'yyyy-MM-dd');
    return tasks
      .filter(t => {
        if (profile && t.profile !== profile) return false;
        return isTaskDueOnDate(t, targetDate);
      })
      .map(t => ({
        ...t,
        is_completed: isTaskCompletedOnDate(t, targetDate),
        display_date: dateStr
      }));
  };

  const toggleTaskCompletion = async (id, targetDate = selectedDate) => {
    const dateStr = typeof targetDate === 'string' ? targetDate : format(targetDate, 'yyyy-MM-dd');
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.is_recurring) {
      const completedList = (task.completed_dates || '').split(',').map(s => s.trim()).filter(Boolean);
      const isDone = isTaskCompletedOnDate(task, dateStr);
      let updatedCompletedList;
      if (isDone) {
        updatedCompletedList = completedList.filter(d => d !== dateStr);
      } else {
        updatedCompletedList = [...completedList.filter(d => d !== dateStr), dateStr];
      }
      const newCompletedDates = updatedCompletedList.join(',');
      await updateTask(id, { completed_dates: newCompletedDates });
    } else {
      await updateTask(id, { is_completed: !task.is_completed });
    }
  };

  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));

    // Cancel any scheduled notification on the backend
    fetch('/api/delete-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: id })
    }).catch(err => console.error("Failed to delete QStash schedule:", err));
    
    try {
      const data = await fetchSheetData('A:M');
      const rowIndex = data.findIndex(row => row.id === id);
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
      // Only non-recurring tasks are carried forward to avoid breaking recurrence schedules
      const tasksToUpdate = tasks.filter(t => !t.is_recurring && taskIdsToCarryForward.includes(t.id));
      
      if (tasksToUpdate.length === 0) return;

      // Optimistically update locally
      setTasks(prev => prev.map(t => {
        if (taskIdsToCarryForward.includes(t.id) && !t.is_recurring) {
          return { ...t, task_date: tomorrow };
        }
        return t;
      }));

      // Update in sheets
      const data = await fetchSheetData('A:M');
      
      for (const t of tasksToUpdate) {
        const rowIndex = data.findIndex(row => row.id === t.id);
        if (rowIndex !== -1) {
          const sheetRow = rowIndex + 2;
          const taskToUpdate = { ...data[rowIndex], task_date: tomorrow };
          
          await updateRow(`A${sheetRow}:M${sheetRow}`, [
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
            taskToUpdate.recurrence_pattern || '',
            taskToUpdate.completed_dates || ''
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
      isTaskDueOnDate, isTaskCompletedOnDate, getTasksForDate, toggleTaskCompletion
    }}>
      {children}
    </TaskContext.Provider>
  );
};
