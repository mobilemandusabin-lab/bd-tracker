import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

import { API_URL as BASE_URL } from '../config/api';

const API_ENDPOINT = `${BASE_URL}/tasks`;

// Helper to get auth header
const getAuthConfig = (getState) => ({
  headers: { Authorization: `Bearer ${getState().auth.token}` }
});

// Get all tasks
export const fetchTasks = createAsyncThunk(
  'tasks/fetchTasks',
  async ({ department_id, status } = {}, { rejectWithValue, getState }) => {
    try {
      const params = {};
      if (department_id) params.department_id = department_id;
      if (status) params.status = status;
      
      const response = await axios.get(API_ENDPOINT, {
        ...getAuthConfig(getState),
        params
      });
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

// Get admin tasks
export const fetchAdminTasks = createAsyncThunk(
  'tasks/fetchAdminTasks',
  async (view = 'all', { rejectWithValue, getState }) => {
    try {
      const response = await axios.get(`${API_ENDPOINT}/admin`, {
        ...getAuthConfig(getState),
        params: { view }
      });
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

// Create task
export const createTask = createAsyncThunk(
  'tasks/createTask',
  async (taskData, { rejectWithValue, getState }) => {
    try {
      const response = await axios.post(API_ENDPOINT, taskData, getAuthConfig(getState));
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

// Update task
export const updateTask = createAsyncThunk(
  'tasks/updateTask',
  async ({ id, ...taskData }, { rejectWithValue, getState }) => {
    try {
      const response = await axios.put(`${API_ENDPOINT}/${id}`, taskData, getAuthConfig(getState));
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

// Delete task
export const deleteTask = createAsyncThunk(
  'tasks/deleteTask',
  async (id, { rejectWithValue, getState }) => {
    try {
      await axios.delete(`${API_ENDPOINT}/${id}`, getAuthConfig(getState));
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

const taskSlice = createSlice({
  name: 'tasks',
  initialState: {
    tasks: [],
    loading: false,
    error: null,
    selectedTask: null,
    filter: {
      department_id: null,
      status: null,
      view: 'all' // 'all' or 'my' for admin
    }
  },
  reducers: {
    setFilter: (state, action) => {
      state.filter = { ...state.filter, ...action.payload };
    },
    clearError: (state) => {
      state.error = null;
    },
    setSelectedTask: (state, action) => {
      state.selectedTask = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch tasks
      .addCase(fetchTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = action.payload;
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch tasks';
      })
      // Fetch admin tasks
      .addCase(fetchAdminTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = action.payload;
      })
      .addCase(fetchAdminTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch admin tasks';
      })
      // Create task
      .addCase(createTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTask.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks.unshift(action.payload);
      })
      .addCase(createTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to create task';
      })
      // Update task
      .addCase(updateTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.tasks.findIndex(t => t._id === action.payload._id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
      })
      .addCase(updateTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to update task';
      })
      // Delete task
      .addCase(deleteTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = state.tasks.filter(t => t._id !== action.payload);
      })
      .addCase(deleteTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to delete task';
      });
  }
});

export const { setFilter, clearError, setSelectedTask } = taskSlice.actions;
export default taskSlice.reducer;
