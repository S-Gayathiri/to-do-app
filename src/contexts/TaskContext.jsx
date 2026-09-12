import React, { createContext, useContext, useState, useEffect } from 'react';
import { format } from 'date-fns';

const TaskContext = createContext();

export const useTasks = () => useContext(TaskContext);

export const TaskProvider = ({ children }) => {
  const [identity, setIdentity] = useState(() => localStorage.getItem('user_identity') || 'Pattu');
  const [activeProfile, setActiveProfile] = useState(() => localStorage.getItem('active_profile') || 'PattuThangam');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const GAS_URL = import.meta.env.VITE_GAS_URL || '';

  useEffect(() => {
    localStorage.setItem('user_identity', identity);
    // When identity changes, ensure active profile is valid
    if (activeProfile !== 'PattuThangam' && activeProfile !== identity) {
      setActiveProfile(identity);
      localStorage.setItem('active_profile', identity);
    }
  }, [identity]);

  useEffect(() => {
    localStorage.setItem('active_profile', activeProfile);
  }, [activeProfile]);

  const fetchTasks = async () => {
    if (!GAS_URL) {
      console.warn("VITE_GAS_URL is not set. Cannot fetch tasks.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${GAS_URL}?action=readTasks`);
      const data = await response.json();
      setTasks(data || []);
    } catch (error) {
      console.error("Failed to fetch tasks", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [GAS_URL]);

  const addTask = async (taskData) => {
    const newTask = {
      ...taskData,
      id: Date.now().toString(),
      is_completed: false,
      created_at: new Date().toISOString()
    };
    
    // Optimistic update
    setTasks(prev => [...prev, newTask]);

    if (!GAS_URL) return;

    try {
      await fetch(GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'createTask',
          data: JSON.stringify(newTask)
        })
      });
    } catch (error) {
      console.error("Failed to add task", error);
      fetchTasks(); // Revert optimistic update on failure
    }
  };

  const updateTask = async (id, updates) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    if (!GAS_URL) return;

    try {
      await fetch(GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'updateTask',
          data: JSON.stringify({ id, updates })
        })
      });
    } catch (error) {
      console.error("Failed to update task", error);
      fetchTasks();
    }
  };

  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));

    if (!GAS_URL) return;

    try {
      await fetch(GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'deleteTask',
          id
        })
      });
    } catch (error) {
      console.error("Failed to delete task", error);
      fetchTasks();
    }
  };

  const allowedProfiles = ['PattuThangam', identity];

  return (
    <TaskContext.Provider value={{
      identity, setIdentity,
      activeProfile, setActiveProfile,
      allowedProfiles,
      tasks, loading,
      selectedDate, setSelectedDate,
      addTask, updateTask, deleteTask, fetchTasks
    }}>
      {children}
    </TaskContext.Provider>
  );
};
