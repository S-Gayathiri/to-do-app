import React, { createContext, useContext, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fetchSheetData, appendRow, updateCell } from '../services/googleSheets';

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
      const data = await fetchSheetData('A:J');
      setTasks(data || []);
    } catch (error) {
      console.error("Failed to fetch tasks from Google Sheets", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const addTask = async (taskData) => {
    const newTask = {
      ...taskData,
      id: Date.now().toString(),
      is_completed: false,
      created_at: new Date().toISOString()
    };
    
    // Optimistic update
    setTasks(prev => [...prev, newTask]);

    try {
      await appendRow('A:J', [
        newTask.id,
        newTask.profile,
        newTask.title,
        newTask.task_date,
        newTask.time_block,
        newTask.is_urgent,
        newTask.is_important,
        newTask.is_completed,
        newTask.reminder_time || '',
        newTask.created_at
      ]);
    } catch (error) {
      console.error("Failed to add task to sheets", error);
      loadTasks(); // Revert on failure
    }
  };

  const updateTask = async (id, updates) => {
    // Optimistic
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    try {
      // Very naive update approach for Google Sheets REST API without batchGet
      // 1. Fetch current data to find row index
      const data = await fetchSheetData('A:J');
      const rowIndex = data.findIndex(row => row.id === id);
      
      if (rowIndex !== -1) {
        // Row index in sheet is rowIndex + 2 (1 for 1-based, 1 for header)
        const sheetRow = rowIndex + 2;
        
        // If we are updating is_completed (which is column H, 8th column)
        if (updates.hasOwnProperty('is_completed')) {
          await updateCell(`H${sheetRow}`, updates.is_completed);
        }
        
        // Similarly update other fields if needed
      }
    } catch (error) {
      console.error("Failed to update task in sheets", error);
      loadTasks();
    }
  };

  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    
    // Deleting rows via REST API is complex without apps script (requires batchUpdate with DeleteDimensionRequest).
    // For simplicity, we just clear the row or mark it as deleted if we wanted to. 
    // Here we'll just log a warning that true row deletion requires batchUpdate.
    console.warn("Delete in Sheets REST API requires batchUpdate DeleteDimensionRequest. Optimistically removed locally.");
    try {
      const data = await fetchSheetData('A:J');
      const rowIndex = data.findIndex(row => row.id === id);
      if (rowIndex !== -1) {
        const sheetRow = rowIndex + 2;
        // We'll just clear the ID column to "soft delete" it
        await updateCell(`A${sheetRow}`, 'DELETED');
      }
    } catch (error) {
      console.error("Failed to delete", error);
      loadTasks();
    }
  };

  const allowedProfiles = ['PattuThangam', identity];

  return (
    <TaskContext.Provider value={{
      identity, setIdentity,
      activeProfile, setActiveProfile,
      allowedProfiles,
      tasks: tasks.filter(t => t.id !== 'DELETED'), 
      loading,
      selectedDate, setSelectedDate,
      addTask, updateTask, deleteTask, fetchTasks: loadTasks
    }}>
      {children}
    </TaskContext.Provider>
  );
};
